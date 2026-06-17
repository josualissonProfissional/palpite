-- Classificacao dos times calculada pelo BACKEND a partir dos resultados
-- (jogos ao vivo/intervalo/finalizados da fase de grupos), sem depender da API.
-- Recalculada por trigger sempre que um placar/status muda, e como a tabela
-- standings esta no publication de Realtime, a atualizacao chega via websocket.

create or replace function palpite.recompute_standings(p_competition_id uuid)
returns void
language plpgsql
security definer
set search_path = palpite, public
as $$
begin
  with team_matches as (
    select m.home_team_id as team_id, m.home_score as gf, m.away_score as ga
    from palpite.matches m
    where m.competition_id = p_competition_id
      and m.stage = 'group_stage'
      and m.home_score is not null and m.away_score is not null
      and m.status in ('live', 'halftime', 'finished')
    union all
    select m.away_team_id as team_id, m.away_score as gf, m.home_score as ga
    from palpite.matches m
    where m.competition_id = p_competition_id
      and m.stage = 'group_stage'
      and m.home_score is not null and m.away_score is not null
      and m.status in ('live', 'halftime', 'finished')
  ),
  agg as (
    select
      team_id,
      count(*)::smallint as played,
      count(*) filter (where gf > ga)::smallint as won,
      count(*) filter (where gf = ga)::smallint as drawn,
      count(*) filter (where gf < ga)::smallint as lost,
      coalesce(sum(gf), 0)::smallint as goals_for,
      coalesce(sum(ga), 0)::smallint as goals_against,
      coalesce(sum(case when gf > ga then 3 when gf = ga then 1 else 0 end), 0)::smallint as points
    from team_matches
    group by team_id
  )
  update palpite.standings s set
    played = coalesce(a.played, 0),
    won = coalesce(a.won, 0),
    drawn = coalesce(a.drawn, 0),
    lost = coalesce(a.lost, 0),
    goals_for = coalesce(a.goals_for, 0),
    goals_against = coalesce(a.goals_against, 0),
    goal_difference = (coalesce(a.goals_for, 0) - coalesce(a.goals_against, 0))::smallint,
    points = coalesce(a.points, 0),
    synced_at = now()
  from palpite.standings s2
  left join agg a on a.team_id = s2.team_id
  where s.id = s2.id
    and s2.competition_id = p_competition_id;

  with ranked as (
    select
      id,
      row_number() over (
        partition by group_name
        order by points desc, goal_difference desc, goals_for desc
      )::smallint as pos
    from palpite.standings
    where competition_id = p_competition_id
  )
  update palpite.standings s set position = r.pos
  from ranked r
  where s.id = r.id;
end;
$$;

revoke all on function palpite.recompute_standings(uuid) from public, anon, authenticated;
grant execute on function palpite.recompute_standings(uuid) to service_role;

create or replace function palpite_private.recompute_standings_after_match_change()
returns trigger
language plpgsql
security definer
set search_path = palpite, public
as $$
begin
  perform palpite.recompute_standings(new.competition_id);
  return new;
end;
$$;

drop trigger if exists trg_recompute_standings on palpite.matches;
create trigger trg_recompute_standings
after update on palpite.matches
for each row
when (
  old.home_score is distinct from new.home_score
  or old.away_score is distinct from new.away_score
  or old.status is distinct from new.status
)
execute function palpite_private.recompute_standings_after_match_change();
