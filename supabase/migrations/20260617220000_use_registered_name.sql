-- T04: usar o nome cadastrado (full_name) no ranking, nao o inicio do email.
-- 1) trigger de novo usuario nao deriva mais apelido do email
-- 2) limpa apelidos existentes que vieram do email
-- 3) funcoes de ranking/board passam a preferir full_name

create or replace function palpite_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = palpite, public
as $$
begin
  insert into palpite.profiles (id, full_name, nickname, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    null,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- limpa apelidos que foram preenchidos automaticamente com o inicio do email
update palpite.profiles p
set nickname = null
from auth.users u
where u.id = p.id
  and p.nickname is not null
  and p.nickname = split_part(u.email, '@', 1);

-- ranking do grupo: preferir nome cadastrado
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
    select gm.user_id, coalesce(p.full_name, p.nickname, 'Participante') as display_name, p.avatar_url
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

-- board "Geral": preferir nome cadastrado
create or replace function palpite.get_group_live_board(p_group_id uuid)
returns table (
  match_id uuid,
  match_date timestamptz,
  status text,
  home_label text,
  away_label text,
  home_logo text,
  away_logo text,
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
security definer
set search_path = palpite, public
as $$
  with group_scope as (
    select g.id
    from palpite.groups g
    where g.id = p_group_id
      and palpite_private.is_active_member(p_group_id)
  ),
  matches_today as (
    select m.*
    from palpite.matches m
    join group_scope gs on true
    where
      (m.match_date at time zone 'America/Recife')::date
        = (now() at time zone 'America/Recife')::date
      or m.status in ('live', 'halftime')
  )
  select
    m.id as match_id,
    m.match_date,
    m.status::text as status,
    coalesce(ht.country, ht.name, 'Mandante') as home_label,
    coalesce(awt.country, awt.name, 'Visitante') as away_label,
    ht.logo_url as home_logo,
    awt.logo_url as away_logo,
    m.home_score,
    m.away_score,
    p.user_id,
    case when p.user_id is null then null
         else coalesce(pr.full_name, pr.nickname, 'Participante') end as display_name,
    pr.avatar_url,
    p.predicted_home_score as predicted_home,
    p.predicted_away_score as predicted_away,
    coalesce(ps.points, 0)::integer as points,
    case when p.user_id is null then null
         else coalesce(ps.status::text, 'pending') end as score_status,
    ps.score_reason,
    coalesce(ps.is_final, false) as is_final
  from matches_today m
  left join palpite.predictions p
    on p.match_id = m.id and p.group_id = p_group_id
  left join palpite.teams ht on ht.id = m.home_team_id
  left join palpite.teams awt on awt.id = m.away_team_id
  left join palpite.profiles pr on pr.id = p.user_id
  left join palpite.prediction_scores ps
    on ps.group_id = p_group_id
   and ps.user_id = p.user_id
   and ps.match_id = m.id
  order by m.match_date asc, points desc, display_name asc;
$$;

grant execute on function palpite.get_group_live_board(uuid) to authenticated;
