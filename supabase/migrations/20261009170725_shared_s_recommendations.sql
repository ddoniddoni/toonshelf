-- DISC-03/05, SOC-06: public canonical-tier recommendations for a work.
-- Additive RPC only; no Auth, other-app tables, baseline or default ACL changes.
begin;
set local lock_timeout='3s';

-- Definer is limited to this aggregate and the existing permission-aware card
-- projection. No evaluator identity or sub-threshold candidate is returned.
create function public.toon_get_shared_s_recommendations(p_work uuid) returns jsonb
language plpgsql stable security definer set search_path='' set statement_timeout='5s' as $$
declare v_result jsonb;
begin
 if p_work is null then raise exception 'VALIDATION_ERROR' using errcode='P0001';end if;
 -- Anonymous readers may see public aggregates. A stale/restricted signed-in
 -- account must not silently fall back to an anonymous view of blocked users.
 if auth.uid() is not null then
  if not toon_private.toon_session_live() then raise exception 'AUTH_REQUIRED' using errcode='P0001';end if;
  if not toon_private.toon_current_active() then raise exception 'FORBIDDEN' using errcode='P0001';end if;
 end if;
 if not toon_private.toon_work_public(p_work) then return null;end if;
 with cohort as materialized (
  select e.user_id from public.toon_user_evaluations e
  join public.toon_library_entries l on l.user_id=e.user_id and l.work_id=e.work_id and l.status<>'planned'
  where e.work_id=p_work and e.visibility='public' and e.canonical_tier='S'
   and toon_private.toon_profile_visible(e.user_id)
 ), counts as (
  select e.work_id,count(*) n,count(*) filter(where e.canonical_tier='S') s
  from cohort c join public.toon_user_evaluations e on e.user_id=c.user_id
  join public.toon_library_entries l on l.user_id=e.user_id and l.work_id=e.work_id and l.status<>'planned'
  where e.work_id<>p_work and e.visibility='public' and e.canonical_tier is not null
   and toon_private.toon_work_public(e.work_id)
  group by e.work_id having count(*)>=5 and count(*) filter(where e.canonical_tier='S')>=3
 ), ranked as (
  -- (s/n) * n/(n+10) = s/(n+10), with numeric division throughout.
  select *,s::numeric/n co_s_ratio,s::numeric/(n+10) ranking_score from counts
 ), top_works as (
  select * from ranked order by ranking_score desc,n desc,s desc,work_id limit 6
 ) select jsonb_build_object('workId',p_work,
  'computedAt',to_char(statement_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'items',coalesce((select jsonb_agg(jsonb_build_object('work',toon_private.toon_work_card(work_id),
   'sampleCount',n,'sharedSCount',s,'coSRatio',co_s_ratio,'rankingScore',ranking_score)
   order by ranking_score desc,n desc,s desc,work_id) from top_works),'[]'::jsonb)) into v_result;
 return v_result;
end;$$;
revoke all on function public.toon_get_shared_s_recommendations(uuid) from public,anon,authenticated,service_role;
grant execute on function public.toon_get_shared_s_recommendations(uuid) to anon,authenticated;
commit;
