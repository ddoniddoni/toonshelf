-- CAT-08, COM-01/02/03, OPS-04. Apply after the three pending community/review migrations.
-- Preserve installed personal/tier handlers, shared Auth and other applications.
begin;
set local lock_timeout='3s';

create table toon_private.toon_post_work_merge_history (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.toon_posts(id) on delete cascade,
 user_id uuid not null references public.toon_profiles(id) on delete cascade,
 source_id uuid not null references public.toon_works(id),target_id uuid not null references public.toon_works(id),
 source_title text not null,target_title text not null,
 published_before uuid[] not null,published_after uuid[] not null,draft_before uuid[],draft_after uuid[],
 created_at timestamptz not null default now(),check(source_id<>target_id),
 check(cardinality(published_before)<=5 and cardinality(published_after)<=5),
 check(cardinality(draft_before)<=5 and cardinality(draft_after)<=5)
);
create index toon_post_merge_history_owner_idx on toon_private.toon_post_work_merge_history(user_id,post_id,created_at desc,id desc);
create index toon_post_merge_history_post_idx on toon_private.toon_post_work_merge_history(post_id);
create index toon_post_merge_history_source_idx on toon_private.toon_post_work_merge_history(source_id);
create index toon_post_merge_history_target_idx on toon_private.toon_post_work_merge_history(target_id);
alter table toon_private.toon_post_work_merge_history enable row level security;
revoke all on toon_private.toon_post_work_merge_history from public,anon,authenticated,service_role;

-- Replace source IDs and keep the first occurrence, preserving relative order.
create function toon_private.toon_remap_post_work_ids(p_ids uuid[],p_source uuid,p_target uuid) returns uuid[]
language sql immutable set search_path='' as $$
 select coalesce(array_agg(work_id order by first_position),'{}'::uuid[]) from (
  select case when id=p_source then p_target else id end work_id,min(position) first_position
  from unnest(p_ids) with ordinality t(id,position) group by case when id=p_source then p_target else id end
 ) ordered;
$$;
create function toon_private.toon_post_merge_affected(p_source uuid,p_target uuid) returns setof uuid
language sql stable set search_path='' as $$
 select w.post_id from public.toon_post_works w join public.toon_posts p on p.id=w.post_id
  where p.deleted_at is null and w.work_id in (p_source,p_target)
 union
 select d.post_id from toon_private.toon_post_drafts d join public.toon_posts p on p.id=d.post_id
  where p.deleted_at is null and ((d.payload->'workIds') ? p_source::text or (d.payload->'workIds') ? p_target::text);
$$;

-- Digests stay private; administrators receive only counts and a random token.
alter function toon_private.toon_work_merge_fingerprint(uuid,uuid) rename to toon_tier_merge_fingerprint;
create function toon_private.toon_work_merge_fingerprint(p_source uuid,p_target uuid) returns text
language sql stable set search_path='' as $$
 select toon_private.toon_merge_digest(toon_private.toon_tier_merge_fingerprint(p_source,p_target)||'|posts|'||coalesce((
  select string_agg(toon_private.toon_merge_digest(to_jsonb(p)::text||coalesce(to_jsonb(d)::text,'')||coalesce((
   select jsonb_agg(to_jsonb(w) order by w.position)::text from public.toon_post_works w where w.post_id=p.id),'')),'|' order by p.id)
  from public.toon_posts p left join toon_private.toon_post_drafts d on d.post_id=p.id
  where p.id in (select toon_private.toon_post_merge_affected(p_source,p_target))),''));
$$;
create or replace function toon_private.toon_work_merge_summary(p_source uuid,p_target uuid) returns jsonb
language sql stable set search_path='' as $$
 with base as (select toon_private.toon_personal_merge_summary(p_source,p_target) value), states as (
  select value,to_regclass('public.toon_tier_list_items') is not null blocked,
   (select count(*) from public.toon_tier_lists l join public.toon_tier_list_publications p on p.tier_list_id=l.id and p.version=l.published_version
    where l.deleted_at is null and toon_private.toon_tier_publication_mentions(p.payload,p_source)) publications from base
 ), community as (
  select count(*) filter(where exists(select 1 from public.toon_post_works w where w.post_id=p.id and w.work_id=p_source)) posts,
   count(*) filter(where (d.payload->'workIds') ? p_source::text) drafts,
   count(*) filter(where exists(select 1 from public.toon_post_works w where w.post_id=p.id and w.work_id=p_source)
    and exists(select 1 from public.toon_post_works w where w.post_id=p.id and w.work_id=p_target)) duplicate_posts,
   count(*) filter(where (d.payload->'workIds') ? p_source::text and (d.payload->'workIds') ? p_target::text) duplicate_drafts,
   count(*) filter(where exists(select 1 from public.toon_post_works w where w.post_id=p.id and w.work_id=p_source)
    or (d.payload->'workIds') ? p_source::text) affected
  from public.toon_posts p left join toon_private.toon_post_drafts d on d.post_id=p.id
  where p.id in (select toon_private.toon_post_merge_affected(p_source,p_target))
 ), updated as (
  select value||jsonb_build_object('records',(value->'records')||jsonb_build_object('tiers',(
   select count(*) from public.toon_tier_lists l join public.toon_tier_list_drafts d on d.tier_list_id=l.id
   left join public.toon_tier_list_publications p on p.tier_list_id=l.id and p.version=l.published_version where l.deleted_at is null
    and (d.placements @> jsonb_build_array(jsonb_build_object('workId',p_source)) or toon_private.toon_tier_publication_mentions(p.payload,p_source))),
    'posts',community.posts,'postDrafts',community.drafts),
   'community',jsonb_build_object('posts',community.posts,'drafts',community.drafts,'deduplicatedPosts',duplicate_posts,'deduplicatedDrafts',duplicate_drafts),
   'conflicts',(value->'conflicts')||jsonb_build_object('unavailable',(value->'conflicts'->>'unavailable')::bigint+
    case when not toon_private.toon_work_public(p_source) then publications+affected else 0 end),
   'blockedByPersonalDomains',blocked) value,blocked from states cross join community
 ) select value||jsonb_build_object('canMerge',not blocked and not exists(select 1 from jsonb_each_text(value->'conflicts') x where x.value::bigint>0)) from updated;
$$;

-- Called only after the current preview has passed and all affected rows are locked.
create function toon_private.toon_merge_post_work_links(p_source uuid,p_target uuid) returns void
language plpgsql set search_path='' as $$
declare v_post public.toon_posts;v_before uuid[];v_after uuid[];v_draft_before uuid[];v_draft_after uuid[];v_source_title text;v_target_title text;
begin
 select title into v_source_title from public.toon_works where id=p_source;
 select title into v_target_title from public.toon_works where id=p_target;
 for v_post in select p.* from public.toon_posts p where p.deleted_at is null and (
  exists(select 1 from public.toon_post_works w where w.post_id=p.id and w.work_id=p_source)
  or exists(select 1 from toon_private.toon_post_drafts d where d.post_id=p.id and (d.payload->'workIds') ? p_source::text)) order by p.id loop
  select coalesce(array_agg(work_id order by position),'{}'::uuid[]) into v_before from public.toon_post_works where post_id=v_post.id;
  select array(select x::uuid from jsonb_array_elements_text(d.payload->'workIds') with ordinality t(x,n) order by n)
   into v_draft_before from toon_private.toon_post_drafts d where d.post_id=v_post.id;
  v_after:=toon_private.toon_remap_post_work_ids(v_before,p_source,p_target);
  v_draft_after:=case when v_draft_before is null then null else toon_private.toon_remap_post_work_ids(v_draft_before,p_source,p_target) end;
  insert into toon_private.toon_post_work_merge_history(post_id,user_id,source_id,target_id,source_title,target_title,published_before,published_after,draft_before,draft_after)
   values(v_post.id,v_post.user_id,p_source,p_target,v_source_title,v_target_title,v_before,v_after,v_draft_before,v_draft_after);
  if v_before is distinct from v_after then
   delete from public.toon_post_works where post_id=v_post.id;
   insert into public.toon_post_works(post_id,work_id,position) select v_post.id,id,(n-1)::smallint from unnest(v_after) with ordinality t(id,n);
   -- Invalidate stale publication/comment/like versions without bumping activity.
   update public.toon_posts set version=version+1 where id=v_post.id;
  end if;
  if v_draft_before is distinct from v_draft_after then
   update toon_private.toon_post_drafts set payload=jsonb_set(payload,'{workIds}',to_jsonb(v_draft_after)),version=version+1,updated_at=now() where post_id=v_post.id;
  end if;
 end loop;
end;$$;

-- Keep the existing personal/tier implementation intact behind a private wrapper.
alter function public.toon_admin_merge_works(uuid,uuid,bigint,bigint,text,boolean,uuid,text) set schema toon_private;
alter function toon_private.toon_admin_merge_works(uuid,uuid,bigint,bigint,text,boolean,uuid,text) rename to toon_admin_merge_before_posts;
revoke all on function toon_private.toon_admin_merge_before_posts(uuid,uuid,bigint,bigint,text,boolean,uuid,text) from public,anon,authenticated,service_role;
create function public.toon_admin_merge_works(p_source uuid,p_target uuid,p_source_version bigint,p_target_version bigint,
 p_reason text,p_confirm boolean,p_preview_token uuid,p_conflict_policy text) returns void
language plpgsql security definer set search_path='' set statement_timeout='10s' as $$
declare v_posts uuid[];
begin
 perform toon_private.toon_require_catalogue_admin();
 if p_source is null or p_target is null or p_source=p_target then raise exception 'VALIDATION_ERROR' using errcode='P0001';end if;
 if not pg_catalog.pg_try_advisory_xact_lock(716231) then raise exception 'CONFLICT' using errcode='P0001';end if;
 -- Writers hold post/draft before a work SHARE lock. NOWAIT prevents inverted
 -- lock waits here; a concurrent writer either commits before preview validation
 -- or forces the whole merge to roll back. No partial catalogue/link updates.
 perform id from public.toon_works where id in (p_source,p_target) order by id for update nowait;
 select coalesce(array_agg(id order by id),'{}'::uuid[]) into v_posts from toon_private.toon_post_merge_affected(p_source,p_target) affected(id);
 perform a.user_id from toon_private.toon_user_access a where a.user_id in (select user_id from public.toon_posts where id=any(v_posts)) order by a.user_id for update nowait;
 perform p.id from public.toon_posts p where p.id=any(v_posts) order by p.id for update nowait;
 perform d.post_id from toon_private.toon_post_drafts d where d.post_id=any(v_posts) order by d.post_id for update nowait;
 perform w.post_id from public.toon_post_works w where w.post_id=any(v_posts) order by w.post_id,w.position for update nowait;
 perform toon_private.toon_admin_merge_before_posts(p_source,p_target,p_source_version,p_target_version,p_reason,p_confirm,p_preview_token,p_conflict_policy);
 perform toon_private.toon_merge_post_work_links(p_source,p_target);
exception when lock_not_available or deadlock_detected or serialization_failure then raise exception 'CONFLICT' using errcode='P0001';
end;$$;

create function public.toon_get_my_post_merge_history(p_id uuid,p_page integer default 1) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='5s' as $$
declare v_uid uuid:=toon_private.toon_require_current();v_result jsonb;
begin
 if p_id is null or p_page is null or p_page not between 1 and 1000 then raise exception 'VALIDATION_ERROR' using errcode='P0001';end if;
 if not exists(select 1 from public.toon_posts where id=p_id and user_id=v_uid and deleted_at is null) then return null;end if;
 with page as materialized (select h.* from toon_private.toon_post_work_merge_history h where h.user_id=v_uid and h.post_id=p_id
  order by h.created_at desc,h.id desc limit 21 offset (p_page-1)*20), numbered as (select *,row_number() over(order by created_at desc,id desc) n from page)
 select jsonb_build_object('postId',p_id,'items',coalesce(jsonb_agg(jsonb_build_object('id',id,'sourceId',source_id,'targetId',target_id,
  'sourceTitle',source_title,'targetTitle',target_title,'publishedBefore',published_before,'publishedAfter',published_after,
  'draftBefore',draft_before,'draftAfter',draft_after,'createdAt',created_at) order by n) filter(where n<=20),'[]'),'hasNext',count(*)>20) into v_result from numbered;
 return v_result;
end;$$;

revoke all on function toon_private.toon_remap_post_work_ids(uuid[],uuid,uuid),toon_private.toon_post_merge_affected(uuid,uuid),
 toon_private.toon_tier_merge_fingerprint(uuid,uuid),toon_private.toon_work_merge_fingerprint(uuid,uuid),
 toon_private.toon_work_merge_summary(uuid,uuid),toon_private.toon_merge_post_work_links(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.toon_admin_merge_works(uuid,uuid,bigint,bigint,text,boolean,uuid,text),public.toon_get_my_post_merge_history(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.toon_admin_merge_works(uuid,uuid,bigint,bigint,text,boolean,uuid,text),public.toon_get_my_post_merge_history(uuid,integer) to authenticated;
commit;
