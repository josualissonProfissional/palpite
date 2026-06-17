-- Tabela ao vivo "Geral": palpite de todos os participantes + status ao vivo
-- (quem esta acertando, parciais, etc.) para jogos ja iniciados/locked.
-- Funcao SQL (stable, NAO security definer): a visibilidade dos numeros do
-- palpite continua sob RLS (can_view_prediction); os pontos/status ja sao
-- visiveis a todos os membros via RLS de prediction_scores.

create or replace function palpite.get_group_live_board(p_group_id uuid)
returns table (
  match_id uuid,
  match_date timestamptz,
  status text,
  home_label text,
  away_label text,
  home_score integer,
  away_score integer,
  user_id uuid,
  display_name text,
  avatar_url text,
  predicted_home integer,
  predicted_away integer,
  points integer,
  score_status text,
  score_reason text,
  is_final boolean
)
language sql
stable
set search_path = palpite, public
as $$
  with group_scope as (
    select g.id, g.created_at
    from palpite.groups g
    where g.id = p_group_id
      and palpite_private.is_active_member(p_group_id)
  )
  select
    m.id as match_id,
    m.match_date,
    m.status::text as status,
    coalesce(ht.country, ht.name, 'Mandante') as home_label,
    coalesce(awt.country, awt.name, 'Visitante') as away_label,
    m.home_score,
    m.away_score,
    p.user_id,
    coalesce(pr.nickname, pr.full_name, 'Participante') as display_name,
    pr.avatar_url,
    p.predicted_home_score as predicted_home,
    p.predicted_away_score as predicted_away,
    coalesce(ps.points, 0)::integer as points,
    coalesce(ps.status::text, 'pending') as score_status,
    ps.score_reason,
    coalesce(ps.is_final, false) as is_final
  from palpite.predictions p
  join group_scope gs on gs.id = p.group_id
  join palpite.matches m on m.id = p.match_id
  left join palpite.teams ht on ht.id = m.home_team_id
  left join palpite.teams awt on awt.id = m.away_team_id
  left join palpite.profiles pr on pr.id = p.user_id
  left join palpite.prediction_scores ps
    on ps.group_id = p.group_id
   and ps.user_id = p.user_id
   and ps.match_id = p.match_id
  where p.group_id = p_group_id
    and m.status in ('live', 'halftime', 'finished')
    and m.match_date >= gs.created_at
  order by m.match_date desc, points desc, display_name asc;
$$;

grant execute on function palpite.get_group_live_board(uuid) to authenticated;
