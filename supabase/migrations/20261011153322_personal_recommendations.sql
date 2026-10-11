-- DISC-03/05, SOC-06. Additive personal recommendation RPC; no shared Auth changes.
begin;
set local lock_timeout='3s';
-- Reuse the installed toon_evaluation_public_work_idx(work_id,user_id) partial index.
-- No new table, index, raw grants, or default privilege changes.

create function public.toon_get_personal_recommendations() returns jsonb
language plpgsql stable security definer set search_path='' set statement_timeout='5s' as $$
declare v_uid uuid:=auth.uid();v_count bigint;v_items jsonb;v_reason text;
begin
 if not toon_private.toon_session_live() then raise exception 'AUTH_REQUIRED' using errcode='P0001';end if;
 if not toon_private.toon_current_active() then raise exception 'FORBIDDEN' using errcode='P0001';end if;
 -- Own private evaluations are allowed only in this current-user result.
 with mine as materialized (
  select e.* from public.toon_user_evaluations e join public.toon_library_entries l using(user_id,work_id)
  where e.user_id=v_uid and l.status<>'planned' and (e.canonical_tier is not null or e.rating_steps is not null)
   and toon_private.toon_work_public(e.work_id)
 ), anchors as (
  select * from mine order by updated_at desc,work_id limit 100
 ), sampled as materialized (
  -- At most 200 indexed public evaluation rows per anchor before eligibility.
  select s.user_id from anchors m cross join lateral (
   select e.user_id,e.canonical_tier,e.rating_steps from public.toon_user_evaluations e
   where e.work_id=m.work_id and e.user_id<>v_uid and e.visibility='public'
    and (e.canonical_tier is not null or e.rating_steps is not null)
   order by e.user_id limit 200
  ) s join public.toon_profiles p on p.id=s.user_id
  join public.toon_library_entries l on l.user_id=s.user_id and l.work_id=m.work_id and l.status<>'planned'
  where p.discovery_opt_in and toon_private.toon_profile_visible(p.id)
   and ((m.canonical_tier is not null and s.canonical_tier is not null) or (m.rating_steps is not null and s.rating_steps is not null))
 ), pool as materialized (
  select user_id from sampled group by user_id order by count(*) desc,user_id limit 200
 ), pairs as (
  select p.user_id,case when m.canonical_tier is not null and e.canonical_tier is not null then
   abs(array_position(array['F','D','C','B','A','S'],m.canonical_tier::text)-array_position(array['F','D','C','B','A','S'],e.canonical_tier::text))/5.0
   else abs(m.rating_steps-e.rating_steps)/9.0 end difference
  from pool p join public.toon_user_evaluations e on e.user_id=p.user_id and e.visibility='public'
  join mine m on m.work_id=e.work_id
  join public.toon_library_entries l on l.user_id=e.user_id and l.work_id=e.work_id and l.status<>'planned'
  where (m.canonical_tier is not null and e.canonical_tier is not null) or (m.rating_steps is not null and e.rating_steps is not null)
 ), neighbors as materialized (
  select user_id,count(*) common_count,(1-avg(difference))*count(*)/(count(*)+10) weight
  from pairs group by user_id having count(*)>=5 and avg(difference)<1
  order by weight desc,common_count desc,user_id limit 50
 ), signals as (
  select e.work_id,n.common_count,n.weight,case when e.canonical_tier is not null then
   (array_position(array['F','D','C','B','A','S'],e.canonical_tier::text)-1)/5.0
   else (e.rating_steps-1)/9.0 end value
  from neighbors n join public.toon_user_evaluations e on e.user_id=n.user_id and e.visibility='public'
  join public.toon_library_entries l on l.user_id=e.user_id and l.work_id=e.work_id and l.status<>'planned'
  where (e.canonical_tier is not null or e.rating_steps is not null) and toon_private.toon_work_public(e.work_id)
   and not exists(select 1 from public.toon_library_entries own where own.user_id=v_uid and own.work_id=e.work_id)
 ), ranked as (
  select work_id,count(*) sample_count,min(common_count) min_common_count,max(common_count) max_common_count,
   sum(value*weight)/sum(weight) score from signals group by work_id
  having count(*)>=3 and sum(value*weight)/sum(weight)>=0.6
 ), top_works as (
  select * from ranked order by score desc,sample_count desc,work_id limit 12
 ) select (select count(*) from mine),coalesce((select jsonb_agg(jsonb_build_object(
   'work',toon_private.toon_work_card(work_id),'sampleCount',sample_count,'score',score,
   'minCommonCount',min_common_count,'maxCommonCount',max_common_count)
   order by score desc,sample_count desc,work_id) from top_works),'[]'::jsonb) into v_count,v_items;
 if jsonb_array_length(v_items)>0 then
  return jsonb_build_object('viewerId',v_uid,'mode','collaborative','ownEvaluationCount',v_count,'items',v_items,
   'computedAt',to_char(statement_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
 end if;
 v_reason:=case when v_count<5 then 'insufficient_evaluations' else 'no_candidates' end;
 -- Only genuine preferred-genre matches; no fabricated collaborative evidence.
 with candidates as (
  select w.id,w.created_at from public.toon_works w
  where toon_private.toon_work_public(w.id)
   and not exists(select 1 from public.toon_library_entries l where l.user_id=v_uid and l.work_id=w.id)
   and exists(select 1 from public.toon_work_genres wg join public.toon_genres g on g.id=wg.genre_id and g.active
    join public.toon_user_settings s on s.user_id=v_uid and g.id=any(s.preferred_genre_ids) where wg.work_id=w.id)
  order by w.created_at desc,w.id limit 12
 ) select coalesce(jsonb_agg(jsonb_build_object('work',toon_private.toon_work_card(c.id),'genres',(
   select jsonb_agg(g.name order by g.sort_order,g.id) from public.toon_work_genres wg
   join public.toon_genres g on g.id=wg.genre_id and g.active
   join public.toon_user_settings s on s.user_id=v_uid and g.id=any(s.preferred_genre_ids) where wg.work_id=c.id))
  order by c.created_at desc,c.id),'[]'::jsonb) into v_items from candidates c;
 return jsonb_build_object('viewerId',v_uid,'mode',case when jsonb_array_length(v_items)>0 then 'genre' else 'empty' end,
  'reason',v_reason,'ownEvaluationCount',v_count,'items',v_items,
  'computedAt',to_char(statement_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
end;$$;
revoke all on function public.toon_get_personal_recommendations() from public,anon,authenticated,service_role;
grant execute on function public.toon_get_personal_recommendations() to authenticated;
commit;
