create or replace function palpite_private.prediction_lock_at(p_group_id uuid, p_match_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = palpite, public
as $$
  select
    case
      when m.status <> 'scheduled' then '-infinity'::timestamptz
      when m.match_date < g.created_at then '-infinity'::timestamptz
      else m.match_date - make_interval(mins => coalesce(sr.lock_prediction_minutes_before, 0))
    end
  from palpite.matches m
  join palpite.groups g on g.id = p_group_id
  join palpite.scoring_rules sr on sr.group_id = p_group_id
  where m.id = p_match_id;
$$;

revoke all on function palpite_private.prediction_lock_at(uuid, uuid) from public;
grant execute on function palpite_private.prediction_lock_at(uuid, uuid) to authenticated, service_role;

create or replace function palpite_private.can_change_prediction(p_group_id uuid, p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = palpite, public
as $$
  select palpite_private.is_active_member(p_group_id)
    and now() < coalesce(palpite_private.prediction_lock_at(p_group_id, p_match_id), '-infinity'::timestamptz);
$$;

revoke all on function palpite_private.can_change_prediction(uuid, uuid) from public;
grant execute on function palpite_private.can_change_prediction(uuid, uuid) to authenticated, service_role;

create or replace function palpite.get_group_ranking(
  p_group_id uuid,
  p_round_name text default null,
  p_match_date date default null,
  p_stage text default null,
  p_from date default null,
  p_to date default null
)
returns table (
  rank_position integer,
  user_id uuid,
  display_name text,
  avatar_url text,
  total_points integer,
  exact_scores integer,
  partial_hits integer,
  wrong_predictions integer,
  penalties integer,
  predicted_matches integer
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
  ),
  member_rows as (
    select gm.user_id, coalesce(p.nickname, p.full_name, 'Participante') as display_name, p.avatar_url
    from palpite.group_members gm
    join group_scope gs on gs.id = gm.group_id
    left join palpite.profiles p on p.id = gm.user_id
    where gm.group_id = p_group_id
      and gm.status = 'active'
  ),
  filtered_scores as (
    select ps.*
    from palpite.prediction_scores ps
    join palpite.matches m on m.id = ps.match_id
    join group_scope gs on gs.id = ps.group_id
    where ps.group_id = p_group_id
      and m.match_date >= gs.created_at
      and (p_round_name is null or m.round_name = p_round_name)
      and (p_match_date is null or m.match_date::date = p_match_date)
      and (p_stage is null or m.stage::text = p_stage)
      and (p_from is null or m.match_date::date >= p_from)
      and (p_to is null or m.match_date::date <= p_to)
  ),
  totals as (
    select
      user_id,
      coalesce(sum(points), 0)::integer as total_points,
      count(*) filter (where status = 'correct')::integer as exact_scores,
      count(*) filter (where status = 'partial')::integer as partial_hits,
      count(*) filter (where status = 'wrong')::integer as wrong_predictions,
      count(*) filter (where points < 0 or status = 'inverse_penalty')::integer as penalties,
      count(*)::integer as predicted_matches
    from filtered_scores
    group by user_id
  )
  select
    row_number() over (
      order by coalesce(t.total_points, 0) desc, coalesce(t.exact_scores, 0) desc, mr.display_name asc
    )::integer as rank_position,
    mr.user_id,
    mr.display_name,
    mr.avatar_url,
    coalesce(t.total_points, 0)::integer as total_points,
    coalesce(t.exact_scores, 0)::integer as exact_scores,
    coalesce(t.partial_hits, 0)::integer as partial_hits,
    coalesce(t.wrong_predictions, 0)::integer as wrong_predictions,
    coalesce(t.penalties, 0)::integer as penalties,
    coalesce(t.predicted_matches, 0)::integer as predicted_matches
  from member_rows mr
  left join totals t on t.user_id = mr.user_id
  order by rank_position;
$$;

grant execute on function palpite.get_group_ranking(uuid, text, date, text, date, date) to authenticated;

create or replace function palpite.recalculate_match_scores(p_match_id uuid, p_group_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = palpite, public
as $$
declare
  rec record;
  v_points integer;
  v_status palpite.prediction_score_status;
  v_reason text;
  v_predicted_winner text;
  v_result_winner text;
  v_is_final boolean;
  v_changed integer := 0;
begin
  for rec in
    select
      p.id as prediction_id,
      p.group_id,
      p.user_id,
      p.match_id,
      p.predicted_home_score,
      p.predicted_away_score,
      m.home_score,
      m.away_score,
      m.status as match_status,
      sr.exact_score_points,
      sr.correct_winner_points,
      sr.correct_draw_points,
      sr.correct_goal_home_points,
      sr.correct_goal_away_points,
      sr.wrong_prediction_points,
      sr.inverse_score_policy,
      sr.inverse_score_penalty,
      sr.allow_negative_score
    from palpite.predictions p
    join palpite.groups g on g.id = p.group_id
    join palpite.matches m on m.id = p.match_id
    join palpite.scoring_rules sr on sr.group_id = p.group_id
    where p.match_id = p_match_id
      and (p_group_id is null or p.group_id = p_group_id)
      and m.match_date >= g.created_at
      and m.home_score is not null
      and m.away_score is not null
      and m.status in ('live', 'halftime', 'finished')
  loop
    v_points := 0;
    v_status := 'wrong';
    v_is_final := rec.match_status = 'finished';
    v_reason := case when v_is_final then 'Errou o palpite' else 'Ao vivo: errou por enquanto' end;

    if rec.predicted_home_score = rec.home_score and rec.predicted_away_score = rec.away_score then
      v_points := rec.exact_score_points;
      v_status := 'correct';
      v_reason := case when v_is_final then 'Placar exato' else 'Ao vivo: placar exato agora' end;
    elsif rec.predicted_home_score = rec.predicted_away_score and rec.home_score = rec.away_score then
      v_points := rec.correct_draw_points;
      v_status := 'partial';
      v_reason := case when v_is_final then 'Acertou empate' else 'Ao vivo: acertando empate agora' end;
    elsif rec.predicted_home_score = rec.away_score and rec.predicted_away_score = rec.home_score then
      if rec.inverse_score_policy = 'penalty' then
        v_points := case when rec.allow_negative_score then rec.inverse_score_penalty else 0 end;
        v_status := 'inverse_penalty';
        v_reason := case when v_is_final then 'Placar contrário' else 'Ao vivo: placar contrário no momento' end;
      else
        v_points := 0;
        v_status := 'wrong';
        v_reason := case when v_is_final then 'Placar contrário zerado' else 'Ao vivo: placar contrário zerado no momento' end;
      end if;
    else
      v_predicted_winner := case
        when rec.predicted_home_score > rec.predicted_away_score then 'home'
        when rec.predicted_away_score > rec.predicted_home_score then 'away'
        else 'draw'
      end;
      v_result_winner := case
        when rec.home_score > rec.away_score then 'home'
        when rec.away_score > rec.home_score then 'away'
        else 'draw'
      end;

      if v_predicted_winner = v_result_winner then
        v_points := rec.correct_winner_points;
        if rec.predicted_home_score = rec.home_score then
          v_points := v_points + rec.correct_goal_home_points;
        end if;
        if rec.predicted_away_score = rec.away_score then
          v_points := v_points + rec.correct_goal_away_points;
        end if;
        v_status := 'partial';
        v_reason := case when v_is_final then 'Acertou o vencedor' else 'Ao vivo: acertando vencedor agora' end;
      else
        v_points := case when rec.allow_negative_score then rec.wrong_prediction_points else greatest(0, rec.wrong_prediction_points) end;
        v_status := 'wrong';
        v_reason := case when v_is_final then 'Errou o palpite' else 'Ao vivo: errou por enquanto' end;
      end if;
    end if;

    insert into palpite.prediction_scores (
      prediction_id,
      group_id,
      user_id,
      match_id,
      points,
      status,
      score_reason,
      is_final,
      calculated_at
    )
    values (
      rec.prediction_id,
      rec.group_id,
      rec.user_id,
      rec.match_id,
      v_points,
      v_status,
      v_reason,
      v_is_final,
      now()
    )
    on conflict (group_id, user_id, match_id)
    do update set
      prediction_id = excluded.prediction_id,
      points = excluded.points,
      status = excluded.status,
      score_reason = excluded.score_reason,
      is_final = excluded.is_final,
      calculated_at = excluded.calculated_at;

    v_changed := v_changed + 1;
  end loop;

  return v_changed;
end;
$$;

revoke all on function palpite.recalculate_match_scores(uuid, uuid) from public, anon, authenticated;
grant execute on function palpite.recalculate_match_scores(uuid, uuid) to service_role;
