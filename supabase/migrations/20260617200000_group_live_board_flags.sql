-- Aba "Geral": adiciona os escudos/bandeiras (logo_url) de mandante e visitante.
-- Precisa de DROP + CREATE porque a estrutura de retorno (colunas) muda.

drop function if exists palpite.get_group_live_board(uuid);

create function palpite.get_group_live_board(p_group_id uuid)
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
         else coalesce(pr.nickname, pr.full_name, 'Participante') end as display_name,
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
