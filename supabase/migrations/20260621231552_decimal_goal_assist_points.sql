alter table palpite.scoring_rules
  alter column goal_scorer_points type numeric(8,2) using goal_scorer_points::numeric,
  alter column goal_assist_points type numeric(8,2) using goal_assist_points::numeric;

alter table palpite.prediction_scores
  alter column points type numeric(12,2) using points::numeric,
  alter column goal_assist_points type numeric(12,2) using goal_assist_points::numeric;

create or replace function palpite_private.recalculate_goal_assist_points(
  p_match_id uuid,
  p_group_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = palpite, public
as $$
declare
  rec record;
  v_goal_assist_points numeric(12,2);
  v_changed integer := 0;
begin
  for rec in
    select ps.id prediction_score_id, ps.points base_points, ps.score_reason,
      p.id prediction_id, p.match_id, sr.goal_scorer_points,
      sr.goal_assist_points, sr.goal_assist_scoring_mode
    from palpite.prediction_scores ps
    join palpite.predictions p on p.id = ps.prediction_id
    join palpite.scoring_rules sr on sr.group_id = ps.group_id
    where ps.match_id = p_match_id and (p_group_id is null or ps.group_id = p_group_id)
  loop
    with actual_goals as (
      select e.team_id, e.scorer_player_id, e.assist_player_id,
        row_number() over (partition by e.team_id order by coalesce(e.minute,999), coalesce(e.extra_minute,0), e.created_at, e.id)::smallint goal_index
      from palpite.match_events e
      where e.match_id = rec.match_id and e.event_type in ('goal','own_goal','penalty')
        and not e.is_cancelled and e.scorer_player_id is not null
    )
    select coalesce(sum(case
      when rec.goal_assist_scoring_mode = 'pair_only'
        and s.scorer_player_id = a.scorer_player_id
        and s.assist_player_id is not distinct from a.assist_player_id
        then rec.goal_scorer_points + rec.goal_assist_points
      when rec.goal_assist_scoring_mode = 'separate' then
        case when s.scorer_player_id = a.scorer_player_id then rec.goal_scorer_points else 0 end
        + case when s.assist_player_id is not distinct from a.assist_player_id then rec.goal_assist_points else 0 end
      else 0 end),0)::numeric(12,2)
    into v_goal_assist_points
    from palpite.prediction_goal_selections s
    join actual_goals a on a.team_id=s.team_id and a.goal_index=s.goal_index
    where s.prediction_id=rec.prediction_id;

    update palpite.prediction_scores set
      score_points=rec.base_points::integer,
      goal_assist_points=v_goal_assist_points,
      points=rec.base_points+v_goal_assist_points,
      score_reason=case when v_goal_assist_points>0 then concat_ws(' · ',rec.score_reason,format('+%s pts em gols e assistências',v_goal_assist_points)) else rec.score_reason end,
      calculated_at=now()
    where id=rec.prediction_score_id;
    v_changed:=v_changed+1;
  end loop;
  return v_changed;
end;
$$;

drop function if exists palpite.get_group_ranking(uuid,text,date,text,date,date);

create function palpite.get_group_ranking(
  p_group_id uuid, p_round_name text default null, p_match_date date default null,
  p_stage text default null, p_from date default null, p_to date default null
)
returns table (
  rank_position integer, user_id uuid, display_name text, avatar_url text,
  total_points numeric, best_players_points integer, exact_scores integer,
  partial_hits integer, wrong_predictions integer, penalties integer, predicted_matches integer
)
language sql stable set search_path=palpite,public as $$
  with group_scope as (
    select g.id,g.created_at from palpite.groups g
    where g.id=p_group_id and palpite_private.is_active_member(p_group_id)
  ), member_rows as (
    select gm.user_id,coalesce(p.full_name,p.nickname,'Participante') display_name,p.avatar_url
    from palpite.group_members gm join group_scope gs on gs.id=gm.group_id
    left join palpite.profiles p on p.id=gm.user_id
    where gm.group_id=p_group_id and gm.status='active'
  ), filtered_scores as (
    select ps.* from palpite.prediction_scores ps join palpite.matches m on m.id=ps.match_id
    join group_scope gs on gs.id=ps.group_id where ps.group_id=p_group_id and m.match_date>=gs.created_at
      and (p_round_name is null or m.round_name=p_round_name)
      and (p_match_date is null or m.match_date::date=p_match_date)
      and (p_stage is null or m.stage::text=p_stage)
      and (p_from is null or m.match_date::date>=p_from) and (p_to is null or m.match_date::date<=p_to)
  ), match_totals as (
    select user_id,coalesce(sum(points),0)::numeric match_points,
      count(*) filter(where status='correct')::integer exact_scores,
      count(*) filter(where status='partial')::integer partial_hits,
      count(*) filter(where status='wrong')::integer wrong_predictions,
      count(*) filter(where points<0 or status='inverse_penalty')::integer penalties,
      count(*)::integer predicted_matches from filtered_scores group by user_id
  ), bonus_totals as (
    select s.user_id,coalesce(sum(s.points),0)::integer best_players_points
    from palpite.best_player_scores s join palpite.best_player_voting_windows w on w.id=s.window_id
    where s.group_id=p_group_id and p_match_date is null
      and (p_round_name is null or w.round_name=p_round_name) and (p_stage is null or w.stage::text=p_stage)
      and (p_from is null or w.closes_at::date>=p_from) and (p_to is null or w.closes_at::date<=p_to)
    group by s.user_id
  )
  select row_number() over(order by coalesce(mt.match_points,0)+coalesce(bt.best_players_points,0) desc,coalesce(mt.exact_scores,0) desc,mr.display_name)::integer,
    mr.user_id,mr.display_name,mr.avatar_url,
    (coalesce(mt.match_points,0)+coalesce(bt.best_players_points,0))::numeric total_points,
    coalesce(bt.best_players_points,0)::integer,coalesce(mt.exact_scores,0)::integer,
    coalesce(mt.partial_hits,0)::integer,coalesce(mt.wrong_predictions,0)::integer,
    coalesce(mt.penalties,0)::integer,coalesce(mt.predicted_matches,0)::integer
  from member_rows mr left join match_totals mt on mt.user_id=mr.user_id
  left join bonus_totals bt on bt.user_id=mr.user_id order by 1;
$$;

grant execute on function palpite.get_group_ranking(uuid,text,date,text,date,date) to authenticated;
