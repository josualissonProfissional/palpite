alter table palpite.matches replica identity full;
alter table palpite.standings replica identity full;
alter table palpite.groups replica identity full;
alter table palpite.group_members replica identity full;
alter table palpite.scoring_rules replica identity full;
alter table palpite.predictions replica identity full;
alter table palpite.prediction_scores replica identity full;

do $$
declare
  v_table text;
  v_tables text[] := array[
    'matches',
    'standings',
    'groups',
    'group_members',
    'scoring_rules',
    'predictions',
    'prediction_scores'
  ];
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array v_tables loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'palpite'
          and tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table palpite.%I', v_table);
      end if;
    end loop;
  end if;
end;
$$;

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
    join palpite.matches m on m.id = p.match_id
    join palpite.scoring_rules sr on sr.group_id = p.group_id
    where p.match_id = p_match_id
      and (p_group_id is null or p.group_id = p_group_id)
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

create or replace function palpite_private.recalculate_scores_after_match_change()
returns trigger
language plpgsql
security definer
set search_path = palpite, public
as $$
begin
  if new.home_score is not null
    and new.away_score is not null
    and new.status in ('live', 'halftime', 'finished')
  then
    perform palpite.recalculate_match_scores(new.id, null);
  elsif tg_op = 'UPDATE'
    and old.status in ('live', 'halftime')
    and new.status in ('scheduled', 'postponed', 'cancelled')
  then
    delete from palpite.prediction_scores
    where match_id = new.id
      and is_final = false;
  end if;

  return new;
end;
$$;

revoke all on function palpite_private.recalculate_scores_after_match_change() from public, anon, authenticated;

drop trigger if exists recalculate_scores_after_match_change on palpite.matches;

create trigger recalculate_scores_after_match_change
after insert or update of status, home_score, away_score on palpite.matches
for each row
execute function palpite_private.recalculate_scores_after_match_change();
