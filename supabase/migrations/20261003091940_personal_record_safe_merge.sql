-- P3 lossless personal-domain merge. File only: DB application/verification deferred.
-- Digests remain private. Random, owner-bound, expiring tokens are the only
-- preview identity returned to an administrator; no hashes of notes leave SQL.
create table toon_private.toon_work_merge_previews (
 token uuid primary key default gen_random_uuid(), admin_id uuid not null references public.toon_profiles(id) on delete cascade,
 source_id uuid not null references public.toon_works(id),target_id uuid not null references public.toon_works(id),
 fingerprint text not null,expires_at timestamptz not null,
 unique(admin_id,source_id,target_id),check(source_id <> target_id)
);
create table toon_private.toon_work_merge_history (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.toon_profiles(id) on delete cascade,
 source_id uuid not null references public.toon_works(id),target_id uuid not null references public.toon_works(id),
 source_title text not null,target_title text not null,source_record jsonb,target_record jsonb,
 moved_review_id uuid references public.toon_reviews(id) on delete set null,created_at timestamptz not null default now()
);
create index toon_work_merge_history_owner_idx on toon_private.toon_work_merge_history(user_id,created_at desc,id);
alter table toon_private.toon_work_merge_previews enable row level security;
alter table toon_private.toon_work_merge_history enable row level security;
revoke all on toon_private.toon_work_merge_previews,toon_private.toon_work_merge_history from public,anon,authenticated;
-- No administrator SELECT policy. Owner history is reachable only via its RPC.
create index toon_library_details_merge_work_idx on public.toon_library_private_details(work_id,user_id);
create index toon_evaluations_merge_work_idx on public.toon_user_evaluations(work_id,user_id);
create index toon_work_platforms_merge_work_idx on public.toon_work_platforms(work_id);

create function toon_private.toon_merge_record_snapshot(p_owner uuid,p_work uuid) returns jsonb
language sql stable set search_path = '' as $$
 select jsonb_build_object('workId',l.work_id,'version',l.version,'status',l.status,'libraryVisibility',l.visibility,
  'evaluationVisibility',coalesce(e.visibility,'private'),'ratingSteps',e.rating_steps,'canonicalTier',e.canonical_tier,
  'episode',d.last_read_episode,'startedOn',d.started_on,'finishedOn',d.finished_on,'note',coalesce(d.private_note,''),
  'tags',coalesce(d.tags,'{}'),'preferredLink',d.preferred_work_platform_id,'createdAt',l.created_at,'updatedAt',l.updated_at,'work',null,
  'evaluationCreatedAt',e.created_at,'evaluationUpdatedAt',e.updated_at,'detailsUpdatedAt',d.updated_at)
 from public.toon_library_entries l left join public.toon_library_private_details d using(user_id,work_id)
 left join public.toon_user_evaluations e using(user_id,work_id) where l.user_id = p_owner and l.work_id = p_work;
$$;

-- One plan per source-library owner. Timestamps tie in favour of the target.
-- Status/evaluation/details choose independently; evaluation is a whole row.
create function toon_private.toon_work_merge_plan(p_source uuid,p_target uuid)
returns table(user_id uuid,status public.toon_reading_status,library_visibility public.toon_visibility,
 rating_steps smallint,canonical_tier public.toon_canonical_tier,evaluation_visibility public.toon_visibility,
 episode integer,started_on date,finished_on date,note text,tags text[],preferred_link uuid,created_at timestamptz,version bigint)
language sql stable set search_path = '' as $$
 select s.user_id,
  case when t.user_id is null or s.updated_at > t.updated_at then s.status else t.status end,
  case when s.visibility = 'private' or t.visibility = 'private' then 'private'::public.toon_visibility else s.visibility end,
  case when te.user_id is null or se.updated_at > te.updated_at then se.rating_steps else te.rating_steps end,
  case when te.user_id is null or se.updated_at > te.updated_at then se.canonical_tier else te.canonical_tier end,
  case when se.visibility = 'private' or te.visibility = 'private' then 'private'::public.toon_visibility else coalesce(se.visibility,te.visibility,'private') end,
  case when td.user_id is null or sd.updated_at > td.updated_at then coalesce(sd.last_read_episode,td.last_read_episode) else coalesce(td.last_read_episode,sd.last_read_episode) end,
  case when td.user_id is null or sd.updated_at > td.updated_at then coalesce(sd.started_on,td.started_on) else coalesce(td.started_on,sd.started_on) end,
  case when td.user_id is null or sd.updated_at > td.updated_at then coalesce(sd.finished_on,td.finished_on) else coalesce(td.finished_on,sd.finished_on) end,
  case when coalesce(sd.private_note,'') = '' then coalesce(td.private_note,'')
   when coalesce(td.private_note,'') = '' then sd.private_note
   else '[병합 전 기록: ' || tw.title || ' / ' || p_target::text || E']\n' || td.private_note ||
    E'\n\n[병합 전 기록: ' || sw.title || ' / ' || p_source::text || E']\n' || sd.private_note end,
  array(select distinct tag from unnest(coalesce(sd.tags,'{}') || coalesce(td.tags,'{}')) tag order by tag),
  case when td.user_id is null or sd.updated_at > td.updated_at then coalesce(sd.preferred_work_platform_id,td.preferred_work_platform_id) else coalesce(td.preferred_work_platform_id,sd.preferred_work_platform_id) end,
  least(s.created_at,t.created_at),greatest(s.version,coalesce(t.version,0)) + 1
 from public.toon_library_entries s left join public.toon_library_entries t on t.user_id = s.user_id and t.work_id = p_target
 left join public.toon_library_private_details sd on sd.user_id = s.user_id and sd.work_id = p_source
 left join public.toon_library_private_details td on td.user_id = s.user_id and td.work_id = p_target
 left join public.toon_user_evaluations se on se.user_id = s.user_id and se.work_id = p_source
 left join public.toon_user_evaluations te on te.user_id = s.user_id and te.work_id = p_target
 join public.toon_works sw on sw.id = p_source join public.toon_works tw on tw.id = p_target where s.work_id = p_source;
$$;

create function toon_private.toon_merge_digest(p_value text) returns text
language sql immutable set search_path = '' as $$select encode(sha256(convert_to(p_value,'UTF8')),'hex');$$;
create function toon_private.toon_work_merge_fingerprint(p_source uuid,p_target uuid) returns text
language sql stable set search_path = '' as $$
 select toon_private.toon_merge_digest(coalesce(string_agg(kind || ':' || identity || ':' || digest,'|' order by kind,identity),'')) from (
  select 'work' kind,w.id::text identity,toon_private.toon_merge_digest(to_jsonb(w)::text) digest from public.toon_works w where w.id in (p_source,p_target)
  union all select 'library',l.user_id::text || l.work_id::text,toon_private.toon_merge_digest(to_jsonb(l)::text) from public.toon_library_entries l where l.work_id in (p_source,p_target)
  union all select 'details',d.user_id::text || d.work_id::text,toon_private.toon_merge_digest(to_jsonb(d)::text) from public.toon_library_private_details d where d.work_id in (p_source,p_target)
  union all select 'evaluation',e.user_id::text || e.work_id::text,toon_private.toon_merge_digest(to_jsonb(e)::text) from public.toon_user_evaluations e where e.work_id in (p_source,p_target)
  union all select 'review',r.id::text,toon_private.toon_merge_digest(to_jsonb(r)::text) from public.toon_reviews r where r.work_id in (p_source,p_target)
  union all select 'draft',d.id::text,toon_private.toon_merge_digest(to_jsonb(d)::text) from public.toon_content_edit_drafts d join public.toon_reviews r on r.id = d.review_id where r.work_id in (p_source,p_target)
 ) snapshot;
$$;

create function toon_private.toon_work_merge_summary(p_source uuid,p_target uuid) returns jsonb
language sql stable set search_path = '' as $$
 with plans as (select * from toon_private.toon_work_merge_plan(p_source,p_target)), conflicts as (
  select jsonb_build_object('notes',count(*) filter(where char_length(note) > 5000),
   'tags',count(*) filter(where cardinality(tags) > 20),
   'plannedEvaluations',count(*) filter(where status = 'planned' and (rating_steps is not null or canonical_tier is not null)),
   'dates',count(*) filter(where finished_on < started_on),
   'reviews',(select count(*) from public.toon_reviews s join public.toon_reviews t on t.user_id = s.user_id
    where s.work_id = p_source and t.work_id = p_target and s.deleted_at is null and t.deleted_at is null),
   'unavailable',case when not toon_private.toon_work_public(p_source) then
    (select count(*) from (select user_id from public.toon_library_entries where work_id = p_source
      union select user_id from public.toon_reviews where work_id = p_source and deleted_at is null) owners) else 0 end,
   'metadata',case when (select count(distinct a) from public.toon_works s cross join public.toon_works t,
     lateral unnest(s.aliases || t.aliases || array[s.title]) a where s.id = p_source and t.id = p_target and a <> t.title) > 20
    or (select count(*) from public.toon_work_platforms where work_id in (p_source,p_target)) > 20
    or (select count(*) from (select distinct creator_id,role from public.toon_work_creators where work_id in (p_source,p_target)) c) > 20
    or (select count(distinct genre_id) from public.toon_work_genres where work_id in (p_source,p_target)) > 12 then 1 else 0 end) value from plans
 ), future as (
  select exists(select 1 from unnest(array['tier_lists','tier_list_items','tier_list_drafts','tier_list_publications','posts']) t where to_regclass('public.toon_' || t) is not null) blocked
 )
 select jsonb_build_object('records',jsonb_build_object('library',(select count(*) from plans),
  'overlappingLibrary',(select count(*) from plans p join public.toon_library_entries t on t.user_id = p.user_id and t.work_id = p_target),
  'evaluations',(select count(*) from public.toon_user_evaluations where work_id = p_source),
  'reviews',(select count(*) from public.toon_reviews where work_id = p_source and deleted_at is null),
  'drafts',(select count(*) from public.toon_content_edit_drafts d join public.toon_reviews r on r.id = d.review_id where r.work_id = p_source)),
  'conflicts',c.value,'blockedByPersonalDomains',f.blocked,
  'canMerge',not f.blocked and not exists(select 1 from jsonb_each_text(c.value) x where x.value::integer > 0))
 from conflicts c cross join future f;
$$;

create or replace function public.toon_admin_merge_preview(p_source uuid,p_target uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;v_source public.toon_works;v_target public.toon_works;v_result jsonb;v_token uuid;v_fingerprint text;v_state record;
begin
 v_uid := toon_private.toon_require_catalogue_admin();perform toon_private.toon_take_rate('catalogue_merge_preview',30,60);
 -- Metadata, counts and private digest all use this statement's snapshot.
 select s as source,t as target,toon_private.toon_work_merge_summary(p_source,p_target) as summary,toon_private.toon_work_merge_fingerprint(p_source,p_target) as fingerprint
  into v_state from public.toon_works s cross join public.toon_works t where s.id = p_source and t.id = p_target;
 v_source := v_state.source;v_target := v_state.target;v_result := v_state.summary;v_fingerprint := v_state.fingerprint;
 if v_source.id is null or v_target.id is null or p_source = p_target or v_source.catalogue_status = 'merged' or v_target.catalogue_status = 'merged'
  then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 if v_source.age_rating not in ('all','12','15') or v_target.age_rating not in ('all','12','15') or v_source.is_test or v_target.is_test
  then raise exception 'FORBIDDEN' using errcode = 'P0001';end if;
 delete from toon_private.toon_work_merge_previews where admin_id = v_uid and expires_at < clock_timestamp();
 insert into toon_private.toon_work_merge_previews(admin_id,source_id,target_id,fingerprint,expires_at)
 values(v_uid,p_source,p_target,v_fingerprint,clock_timestamp() + interval '10 minutes')
 on conflict(admin_id,source_id,target_id) do update set token = gen_random_uuid(),fingerprint = excluded.fingerprint,expires_at = excluded.expires_at returning token into v_token;
 return v_result || jsonb_build_object('source',jsonb_build_object('id',v_source.id,'title',v_source.title,'version',v_source.version,'status',v_source.catalogue_status),
  'target',jsonb_build_object('id',v_target.id,'title',v_target.title,'version',v_target.version,'status',v_target.catalogue_status),'previewToken',v_token,
  'sourceLinkCount',(select count(*) from public.toon_work_platforms where work_id = p_source),
  'sourceGenreCount',(select count(*) from public.toon_work_genres where work_id = p_source),'sourceCoverWillBeRevoked',v_source.cover_asset_id is not null);
end;
$$;

-- Remove the old signature instead of exposing two PostgREST overloads.
drop function public.toon_admin_merge_works(uuid,uuid,bigint,bigint,text,boolean);
create function public.toon_admin_merge_works(p_source uuid,p_target uuid,p_source_version bigint,p_target_version bigint,
 p_reason text,p_confirm boolean,p_preview_token uuid,p_conflict_policy text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;v_source public.toon_works;v_target public.toon_works;v_preview toon_private.toon_work_merge_previews;v_summary jsonb;v_aliases text[];v_plan record;
begin
 v_uid := toon_private.toon_require_catalogue_admin();perform toon_private.toon_take_rate('catalogue_merge',10,60);
 if p_confirm is distinct from true or p_conflict_policy is distinct from 'latest_private' or p_reason is null
  or char_length(btrim(p_reason)) not between 2 and 1000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 -- Owner RPCs lock user_access before works; review publication locks its
 -- review before the work. Never wait in the reverse order: retry from preview.
 if not pg_catalog.pg_try_advisory_xact_lock(716231) then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 perform id from public.toon_works where id in (p_source,p_target) order by id for update nowait;
 select * into v_source from public.toon_works where id = p_source;select * into v_target from public.toon_works where id = p_target;
 if v_source.id is null or v_target.id is null or p_source = p_target or v_source.catalogue_status = 'merged' or v_target.catalogue_status = 'merged'
  then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 if v_source.age_rating not in ('all','12','15') or v_target.age_rating not in ('all','12','15') or v_source.is_test or v_target.is_test
  then raise exception 'FORBIDDEN' using errcode = 'P0001';end if;
 perform a.user_id from toon_private.toon_user_access a where a.user_id in (
  select user_id from public.toon_library_entries where work_id in (p_source,p_target)
  union select user_id from public.toon_reviews where work_id in (p_source,p_target)) order by a.user_id for update nowait;
 perform user_id from public.toon_library_entries where work_id in (p_source,p_target) order by user_id,work_id for update nowait;
 perform user_id from public.toon_library_private_details where work_id in (p_source,p_target) order by user_id,work_id for update nowait;
 perform user_id from public.toon_user_evaluations where work_id in (p_source,p_target) order by user_id,work_id for update nowait;
 perform id from public.toon_reviews where work_id in (p_source,p_target) order by id for update nowait;
 perform d.id from public.toon_content_edit_drafts d where d.review_id in (select id from public.toon_reviews where work_id in (p_source,p_target)) order by d.id for update nowait;
 select * into v_preview from toon_private.toon_work_merge_previews where token = p_preview_token and admin_id = v_uid
  and source_id = p_source and target_id = p_target for update nowait;
 if v_preview.token is null or v_preview.expires_at <= clock_timestamp()
  or p_source_version is distinct from v_source.version or p_target_version is distinct from v_target.version
  or v_preview.fingerprint is distinct from toon_private.toon_work_merge_fingerprint(p_source,p_target)
  then raise exception 'MERGE_PREVIEW_EXPIRED' using errcode = 'P0001';end if;
 v_summary := toon_private.toon_work_merge_summary(p_source,p_target);
 if (v_summary->>'blockedByPersonalDomains')::boolean then raise exception 'MERGE_REQUIRES_DOMAIN_HANDLERS' using errcode = 'P0001';end if;
 if not (v_summary->>'canMerge')::boolean then raise exception 'MERGE_RECORD_CONFLICT' using errcode = 'P0001';end if;

 -- Private snapshots precede replacement/cascades. No content in admin audit.
 insert into toon_private.toon_work_merge_history(user_id,source_id,target_id,source_title,target_title,source_record,target_record,moved_review_id)
 select owners.user_id,p_source,p_target,v_source.title,v_target.title,
  toon_private.toon_merge_record_snapshot(owners.user_id,p_source),toon_private.toon_merge_record_snapshot(owners.user_id,p_target),
  (select id from public.toon_reviews where user_id = owners.user_id and work_id = p_source and deleted_at is null)
 from (select user_id from public.toon_library_entries where work_id = p_source
  union select user_id from public.toon_reviews where work_id = p_source and deleted_at is null) owners;
 -- Link identities remain stable so preferred-platform foreign keys survive.
 update public.toon_work_platforms set work_id = p_target where work_id = p_source;
 for v_plan in select * from toon_private.toon_work_merge_plan(p_source,p_target) loop
  insert into public.toon_library_entries(user_id,work_id,status,visibility,version,created_at)
   values(v_plan.user_id,p_target,v_plan.status,v_plan.library_visibility,v_plan.version,v_plan.created_at)
   on conflict(user_id,work_id) do update set status = excluded.status,visibility = excluded.visibility,
    version = excluded.version,created_at = excluded.created_at,updated_at = now();
  insert into public.toon_library_private_details(user_id,work_id,last_read_episode,started_on,finished_on,private_note,tags,preferred_work_platform_id)
   values(v_plan.user_id,p_target,v_plan.episode,v_plan.started_on,v_plan.finished_on,v_plan.note,v_plan.tags,v_plan.preferred_link)
   on conflict(user_id,work_id) do update set last_read_episode = excluded.last_read_episode,started_on = excluded.started_on,
    finished_on = excluded.finished_on,private_note = excluded.private_note,tags = excluded.tags,preferred_work_platform_id = excluded.preferred_work_platform_id,updated_at = now();
  if v_plan.rating_steps is not null or v_plan.canonical_tier is not null then
   insert into public.toon_user_evaluations(user_id,work_id,rating_steps,canonical_tier,visibility)
    values(v_plan.user_id,p_target,v_plan.rating_steps,v_plan.canonical_tier,v_plan.evaluation_visibility)
    on conflict(user_id,work_id) do update set rating_steps = excluded.rating_steps,canonical_tier = excluded.canonical_tier,visibility = excluded.visibility,updated_at = now();
  end if;
 end loop;
 delete from public.toon_library_entries where work_id = p_source;
 update public.toon_content_edit_drafts set version = version + 1,updated_at = now()
  where review_id in (select id from public.toon_reviews where work_id = p_source and deleted_at is null);
 update public.toon_reviews set work_id = p_target,version = version + 1,updated_at = now() where work_id = p_source;
 select array_agg(distinct a order by a) into v_aliases from unnest(v_target.aliases || v_source.aliases || array[v_source.title]) a where a <> v_target.title;
 insert into public.toon_work_creators(work_id,creator_id,role,sort_order) select p_target,creator_id,role,sort_order from public.toon_work_creators where work_id = p_source on conflict do nothing;
 insert into public.toon_work_genres(work_id,genre_id) select p_target,genre_id from public.toon_work_genres where work_id = p_source on conflict do nothing;
 update toon_private.toon_catalogue_sources set work_id = p_target where work_id = p_source;
 update public.toon_catalogue_submissions set work_id = p_target where work_id = p_source;
 update public.toon_catalogue_submissions set result_work_id = p_target where result_work_id = p_source;
 update toon_private.toon_asset_licenses set status = 'revoked' where work_id = p_source;
 update public.toon_works set catalogue_status = 'merged',merged_into_id = p_target,cover_asset_id = null,version = version + 1 where id = p_source;
 update public.toon_works set aliases = coalesce(v_aliases,'{}'),age_rating = case when v_source.age_rating::text = '15' or v_target.age_rating::text = '15' then '15'::public.toon_age_rating
  when v_source.age_rating::text = '12' or v_target.age_rating::text = '12' then '12'::public.toon_age_rating else 'all'::public.toon_age_rating end,version = version + 1 where id = p_target;
 perform toon_private.toon_refresh_work_search(p_target);
 perform toon_private.toon_audit_catalogue('merge_work',p_source,p_reason,jsonb_build_object('sourceVersion',v_source.version,'targetVersion',v_target.version),
  jsonb_build_object('mergedInto',p_target,'policy',p_conflict_policy,'counts',v_summary->'records'));
 delete from toon_private.toon_work_merge_previews where token = p_preview_token;
exception when lock_not_available or deadlock_detected then
 raise exception 'CONFLICT' using errcode = 'P0001';
end;
$$;

create function toon_private.toon_current_merged_work(p_work uuid) returns uuid
language sql stable set search_path = '' as $$
 with recursive chain as (
  select id,merged_into_id,catalogue_status,0 depth from public.toon_works where id = p_work
  union all select w.id,w.merged_into_id,w.catalogue_status,c.depth + 1 from chain c
   join public.toon_works w on w.id = c.merged_into_id where c.catalogue_status = 'merged' and c.depth < 8
 ) select id from chain where catalogue_status <> 'merged' order by depth desc limit 1;
$$;
create function public.toon_get_my_work_merge_target(p_source uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;v_target uuid;
begin
 v_uid := toon_private.toon_require_current();
 if not exists(select 1 from toon_private.toon_work_merge_history where user_id = v_uid and source_id = p_source) then return null;end if;
 v_target := toon_private.toon_current_merged_work(p_source);
 if exists(select 1 from public.toon_library_entries where user_id = v_uid and work_id = v_target) then return v_target;end if;
 return null;
end;
$$;
create function public.toon_delete_my_work_merge_history(p_id uuid,p_confirm boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
 v_uid := toon_private.toon_require_current();perform toon_private.toon_take_rate('merge_history_delete',20,60);
 if p_confirm is distinct from true then raise exception 'CONFIRM_REQUIRED' using errcode = 'P0001';end if;
 delete from toon_private.toon_work_merge_history where id = p_id and user_id = v_uid;
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
end;
$$;
create function public.toon_get_my_work_merge_history(p_page integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;v_items jsonb;v_total bigint;
begin
 v_uid := toon_private.toon_require_current();
 if p_page is null or p_page not between 1 and 1000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 select count(*) into v_total from toon_private.toon_work_merge_history where user_id = v_uid;
 select coalesce(jsonb_agg(item order by created_at desc,id),'[]') into v_items from (
  select h.id,h.created_at,jsonb_build_object('id',h.id,'sourceId',h.source_id,'targetId',h.target_id,
   'sourceTitle',case when toon_private.toon_work_public(resolved.id) then h.source_title else null end,
   'targetTitle',case when toon_private.toon_work_public(resolved.id) then h.target_title else null end,
   'currentTargetId',case when exists(select 1 from public.toon_library_entries where user_id = v_uid and work_id = resolved.id) then resolved.id else null end,
   'sourceRecord',h.source_record,'targetRecord',h.target_record,
   'reviewId',case when exists(select 1 from public.toon_reviews where id = h.moved_review_id and user_id = v_uid and deleted_at is null) then h.moved_review_id else null end,'createdAt',h.created_at) item
  from toon_private.toon_work_merge_history h cross join lateral (select toon_private.toon_current_merged_work(h.target_id) id) resolved
  where h.user_id = v_uid order by h.created_at desc,h.id limit 20 offset (p_page - 1) * 20
 ) page;
 return jsonb_build_object('items',v_items,'total',v_total,'hasNext',v_total > p_page * 20 and p_page < 1000);
end;
$$;

revoke all on function toon_private.toon_merge_digest(text),toon_private.toon_current_merged_work(uuid),toon_private.toon_merge_record_snapshot(uuid,uuid),toon_private.toon_work_merge_plan(uuid,uuid),
 toon_private.toon_work_merge_fingerprint(uuid,uuid),toon_private.toon_work_merge_summary(uuid,uuid) from public,anon,authenticated;
revoke all on function public.toon_admin_merge_preview(uuid,uuid),public.toon_admin_merge_works(uuid,uuid,bigint,bigint,text,boolean,uuid,text),
 public.toon_get_my_work_merge_history(integer),public.toon_get_my_work_merge_target(uuid),public.toon_delete_my_work_merge_history(uuid,boolean) from public,anon,authenticated;
grant execute on function public.toon_admin_merge_preview(uuid,uuid),public.toon_admin_merge_works(uuid,uuid,bigint,bigint,text,boolean,uuid,text),
 public.toon_get_my_work_merge_history(integer),public.toon_get_my_work_merge_target(uuid),public.toon_delete_my_work_merge_history(uuid,boolean) to authenticated;
