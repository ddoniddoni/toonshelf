-- P4 increment 1: private draft editor. File only; no DB application/verification.
create table public.toon_tier_lists (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.toon_profiles(id) on delete cascade,
 visibility public.toon_tier_visibility not null default 'private',published_version bigint,
 moderation_status text not null default 'visible',deleted_at timestamptz,created_at timestamptz not null default now(),
 -- Publication requires a separate reviewed migration/handler, not direct DML.
 constraint tier_private_only check(visibility = 'private' and published_version is null)
);
create table public.toon_tier_list_drafts (
 tier_list_id uuid primary key references public.toon_tier_lists(id) on delete cascade,
 title text not null,description text not null default '',tags text[] not null default '{}',
 rows jsonb not null,placements jsonb not null,version bigint not null default 1 check(version between 1 and 9007199254740991),
 updated_at timestamptz not null default now()
);
create index toon_tier_lists_owner_idx on public.toon_tier_lists(user_id,created_at desc,id) where deleted_at is null;
-- JSON containment supports merge discovery without scanning every placement.
create index toon_tier_drafts_placements_idx on public.toon_tier_list_drafts using gin(placements jsonb_path_ops);
create table toon_private.toon_tier_merge_history (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.toon_profiles(id) on delete cascade,
 tier_list_id uuid not null references public.toon_tier_lists(id) on delete cascade,
 source_id uuid not null references public.toon_works(id),target_id uuid not null references public.toon_works(id),
 source_title text not null,target_title text not null,draft_before jsonb not null,
 version_before bigint not null,version_after bigint not null,duplicates_removed integer not null,
 created_at timestamptz not null default now()
);
create index toon_tier_merge_history_owner_idx on toon_private.toon_tier_merge_history(user_id,tier_list_id,created_at desc,id);
alter table public.toon_tier_lists enable row level security;
alter table public.toon_tier_list_drafts enable row level security;
alter table toon_private.toon_tier_merge_history enable row level security;
revoke all on public.toon_tier_lists,public.toon_tier_list_drafts,toon_private.toon_tier_merge_history from public,anon,authenticated;
-- No direct SELECT or DML policies, including for administrators. Owner RPC only.

create function toon_private.toon_tier_uuid(p_value text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
 if p_value is null or p_value !~* '^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$' then
  raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 return p_value::uuid;
end;$$;
create function toon_private.toon_tier_payload(p_draft jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare v_row jsonb;v_item jsonb;v_id uuid;v_ids uuid[] := '{}';v_works uuid[] := '{}';v_codes text[] := '{}';v_tags text[] := '{}';v_tag jsonb;
begin
 if p_draft is null or jsonb_typeof(p_draft) <> 'object' or octet_length(p_draft::text) > 262144
  or (select count(*) from jsonb_object_keys(p_draft)) <> 5 or not p_draft ?& array['title','description','tags','rows','placements'] then
  raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 if jsonb_typeof(p_draft->'title') <> 'string' or char_length(p_draft->>'title') not between 1 and 80
  or jsonb_typeof(p_draft->'description') <> 'string' or char_length(p_draft->>'description') > 1000
  or jsonb_typeof(p_draft->'tags') <> 'array' or jsonb_typeof(p_draft->'rows') <> 'array'
  or jsonb_typeof(p_draft->'placements') <> 'array' then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 if jsonb_array_length(p_draft->'tags') > 5 or jsonb_array_length(p_draft->'rows') not between 2 and 10
  or jsonb_array_length(p_draft->'placements') > 300 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 for v_tag in select value from jsonb_array_elements(p_draft->'tags') loop
  if jsonb_typeof(v_tag) <> 'string' or char_length(v_tag #>> '{}') not between 1 and 20 or (v_tag #>> '{}') = any(v_tags) then
   raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
  v_tags := array_append(v_tags,v_tag #>> '{}');
 end loop;
 for v_row in select value from jsonb_array_elements(p_draft->'rows') loop
  if jsonb_typeof(v_row) <> 'object' then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
  if (select count(*) from jsonb_object_keys(v_row)) <> 4 or not v_row ?& array['id','label','colorToken','canonicalTier']
   or jsonb_typeof(v_row->'id') <> 'string' or jsonb_typeof(v_row->'label') <> 'string'
   or char_length(v_row->>'label') not between 1 and 12 or jsonb_typeof(v_row->'colorToken') <> 'string'
   or v_row->>'colorToken' not in ('S','A','B','C','D','F')
   or (v_row->'canonicalTier' <> 'null'::jsonb and (jsonb_typeof(v_row->'canonicalTier') <> 'string' or v_row->>'canonicalTier' not in ('S','A','B','C','D','F'))) then
   raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
  v_id := toon_private.toon_tier_uuid(v_row->>'id');
  if v_id = any(v_ids) or (v_row->>'canonicalTier') = any(v_codes) then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
  v_ids := array_append(v_ids,v_id);if v_row->>'canonicalTier' is not null then v_codes := array_append(v_codes,v_row->>'canonicalTier');end if;
 end loop;
 for v_item in select value from jsonb_array_elements(p_draft->'placements') loop
  if jsonb_typeof(v_item) <> 'object' then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
  if (select count(*) from jsonb_object_keys(v_item)) <> 3 or not v_item ?& array['workId','rowId','position']
   or jsonb_typeof(v_item->'workId') <> 'string' or jsonb_typeof(v_item->'position') <> 'number' or v_item->>'position' !~ '^(0|[1-9][0-9]{0,2})$'
   or (v_item->'rowId' <> 'null'::jsonb and jsonb_typeof(v_item->'rowId') <> 'string') then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
  if (v_item->>'position')::integer > 299 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
  v_id := toon_private.toon_tier_uuid(v_item->>'workId');
  if v_id = any(v_works) then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
  v_works := array_append(v_works,v_id);
  if v_item->>'rowId' is not null and not toon_private.toon_tier_uuid(v_item->>'rowId') = any(v_ids) then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 end loop;
 if exists(select 1 from (
  select (value->>'position')::integer pos,row_number() over(partition by (value->>'rowId')::uuid order by (value->>'position')::integer)-1 expected
  from jsonb_array_elements(p_draft->'placements')) p where p.pos <> p.expected) then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 -- UUID spelling is canonical on storage/DTOs, including direct RPC callers.
 return p_draft || jsonb_build_object('rows',(
  select jsonb_agg(jsonb_set(value,'{id}',to_jsonb((value->>'id')::uuid)) order by ordinality) from jsonb_array_elements(p_draft->'rows') with ordinality),
  'placements',coalesce((select jsonb_agg(value || jsonb_build_object('workId',(value->>'workId')::uuid,'rowId',(value->>'rowId')::uuid) order by ordinality) from jsonb_array_elements(p_draft->'placements') with ordinality),'[]'::jsonb));
end;$$;
alter table public.toon_tier_list_drafts add constraint tier_draft_valid check (
 toon_private.toon_tier_payload(jsonb_build_object('title',title,'description',description,'tags',tags,'rows',rows,'placements',placements)) is not null
);

create function toon_private.toon_tier_contains(p_placements jsonb,p_work uuid) returns boolean
language sql immutable set search_path = '' as $$select p_placements @> jsonb_build_array(jsonb_build_object('workId',p_work));$$;
-- Resolve merged identities, retain an already-present target placement, compact
-- row positions. Labels/colors do not imply canonical evaluation changes.
create function toon_private.toon_tier_normalize(p_draft jsonb) returns jsonb
language sql stable set search_path = '' as $$
 with entries as (
  select value,ordinality,toon_private.toon_current_merged_work((value->>'workId')::uuid) resolved
  from jsonb_array_elements(p_draft->'placements') with ordinality
 ), picked as (
  select *,row_number() over(partition by resolved order by ((value->>'workId')::uuid = resolved) desc,ordinality) choice from entries
 ), ranked as (
  select resolved,value->>'rowId' row_id,row_number() over(partition by value->>'rowId' order by (value->>'position')::integer,ordinality)-1 pos
  from picked where choice = 1
 ) select jsonb_set(p_draft,'{placements}',coalesce((select jsonb_agg(jsonb_build_object('workId',resolved,'rowId',row_id,'position',pos) order by row_id nulls first,pos) from ranked),'[]'::jsonb));
$$;
create function toon_private.toon_tier_check_works(p_draft jsonb,p_previous jsonb) returns void
language plpgsql set search_path = '' as $$
declare v_work uuid;
begin
 for v_work in select (value->>'workId')::uuid from jsonb_array_elements(p_draft->'placements') loop
  if not exists(select 1 from public.toon_works where id = v_work) then raise exception 'WORK_UNAVAILABLE' using errcode = 'P0001';end if;
  if not toon_private.toon_work_public(v_work) and not toon_private.toon_tier_contains(coalesce(p_previous,'[]'::jsonb),v_work)
   and not toon_private.toon_tier_contains(coalesce(p_previous,'[]'::jsonb),toon_private.toon_current_merged_work(v_work)) then
   raise exception 'WORK_UNAVAILABLE' using errcode = 'P0001';end if;
 end loop;
end;$$;
create function toon_private.toon_tier_draft_json(p_id uuid) returns jsonb
language sql stable set search_path = '' as $$
 select jsonb_build_object('title',title,'description',description,'tags',tags,'rows',rows,'placements',placements) from public.toon_tier_list_drafts where tier_list_id = p_id;
$$;
create function toon_private.toon_tier_work_cards(p_placements jsonb) returns jsonb
language sql stable set search_path = '' as $$
 select coalesce(jsonb_agg(jsonb_build_object('workId',value->>'workId','work',case when toon_private.toon_work_public((value->>'workId')::uuid) then toon_private.toon_work_card((value->>'workId')::uuid) else null end)),'[]'::jsonb) from jsonb_array_elements(p_placements);
$$;

create function public.toon_create_tier_draft(p_draft jsonb,p_origin uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;v_id uuid;v_draft jsonb;v_previous jsonb := '[]';
begin
 v_uid := toon_private.toon_require_current();perform toon_private.toon_take_rate('tier_create',15,60);v_draft := toon_private.toon_tier_payload(p_draft);
 if p_origin is not null then
  select d.placements into v_previous from public.toon_tier_lists l join public.toon_tier_list_drafts d on d.tier_list_id = l.id
   where l.id = p_origin and l.user_id = v_uid and l.deleted_at is null;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 end if;
 if (select count(*) from public.toon_tier_lists where user_id = v_uid and deleted_at is null) >= 50 then raise exception 'TIER_LIMIT' using errcode = 'P0001';end if;
 -- User lock precedes work locks. Merge locks use NOWAIT in reverse order.
 perform id from public.toon_works where id in (
  select (value->>'workId')::uuid from jsonb_array_elements(v_draft->'placements')
  union select toon_private.toon_current_merged_work((value->>'workId')::uuid) from jsonb_array_elements(v_draft->'placements')) order by id for share;
 perform toon_private.toon_tier_check_works(v_draft,v_previous);
 v_draft := toon_private.toon_tier_normalize(v_draft);
 perform toon_private.toon_tier_check_works(v_draft,toon_private.toon_tier_normalize(jsonb_build_object('placements',v_previous))->'placements');
 insert into public.toon_tier_lists(user_id) values(v_uid) returning id into v_id;
 insert into public.toon_tier_list_drafts(tier_list_id,title,description,tags,rows,placements)
 values(v_id,v_draft->>'title',v_draft->>'description',array(select jsonb_array_elements_text(v_draft->'tags')),v_draft->'rows',v_draft->'placements');
 return v_id;
end;$$;
create function public.toon_copy_tier_draft(p_id uuid,p_version bigint) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;v_version bigint;v_draft jsonb;
begin
 v_uid := toon_private.toon_require_current();
 select d.version,toon_private.toon_tier_draft_json(l.id) into v_version,v_draft from public.toon_tier_lists l join public.toon_tier_list_drafts d on d.tier_list_id = l.id
  where l.id = p_id and l.user_id = v_uid and l.deleted_at is null;
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if p_version is distinct from v_version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 return public.toon_create_tier_draft(jsonb_set(v_draft,'{title}',to_jsonb(left(v_draft->>'title',75) || ' (복사)')),p_id);
end;$$;
create function public.toon_save_tier_draft(p_id uuid,p_version bigint,p_draft jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;v_current public.toon_tier_list_drafts;v_draft jsonb;v_saved timestamptz;
begin
 v_uid := toon_private.toon_require_current();perform toon_private.toon_take_rate('tier_save',120,60);v_draft := toon_private.toon_tier_payload(p_draft);
 if p_version is null or p_version not between 1 and 9007199254740990 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 if not exists(select 1 from public.toon_tier_lists where id = p_id and user_id = v_uid and deleted_at is null) then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 perform id from public.toon_works where id in (
  select (value->>'workId')::uuid from jsonb_array_elements(v_draft->'placements')
  union select toon_private.toon_current_merged_work((value->>'workId')::uuid) from jsonb_array_elements(v_draft->'placements')) order by id for share;
 select * into v_current from public.toon_tier_list_drafts where tier_list_id = p_id for update;
 if p_version is distinct from v_current.version then return jsonb_build_object('ok',false,'conflict',jsonb_build_object('version',v_current.version,'savedAt',v_current.updated_at));end if;
 perform toon_private.toon_tier_check_works(v_draft,v_current.placements);v_draft := toon_private.toon_tier_normalize(v_draft);
 perform toon_private.toon_tier_check_works(v_draft,toon_private.toon_tier_normalize(jsonb_build_object('placements',v_current.placements))->'placements');
 v_saved := clock_timestamp();
 update public.toon_tier_list_drafts set title = v_draft->>'title',description = v_draft->>'description',tags = array(select jsonb_array_elements_text(v_draft->'tags')),
  rows = v_draft->'rows',placements = v_draft->'placements',version = version+1,updated_at = v_saved where tier_list_id = p_id;
 return jsonb_build_object('ok',true,'version',v_current.version+1,'savedAt',v_saved,'draft',v_draft,'works',toon_private.toon_tier_work_cards(v_draft->'placements'));
end;$$;
create function public.toon_delete_tier_draft(p_id uuid,p_version bigint,p_confirm boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;v_version bigint;
begin
 v_uid := toon_private.toon_require_current();perform toon_private.toon_take_rate('tier_delete',20,60);
 if p_confirm is distinct from true then raise exception 'CONFIRM_REQUIRED' using errcode = 'P0001';end if;
 select d.version into v_version from public.toon_tier_lists l join public.toon_tier_list_drafts d on d.tier_list_id = l.id
  where l.id = p_id and l.user_id = v_uid and l.deleted_at is null for update of l,d;
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if p_version is distinct from v_version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 update public.toon_tier_lists set deleted_at = now() where id = p_id;
 delete from toon_private.toon_tier_merge_history where tier_list_id = p_id;
 delete from public.toon_tier_list_drafts where tier_list_id = p_id;
end;$$;
create function public.toon_get_my_tier_editor(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;v_result jsonb;
begin
 v_uid := toon_private.toon_require_current();
 select jsonb_build_object('id',l.id,'version',d.version,'savedAt',d.updated_at,'draft',toon_private.toon_tier_draft_json(l.id),
  'works',toon_private.toon_tier_work_cards(d.placements),
  'mergeNotices',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'sourceId',h.source_id,'targetId',h.target_id,'sourceTitle',h.source_title,'targetTitle',h.target_title,'createdAt',h.created_at,'duplicatesRemoved',h.duplicates_removed,'draftBefore',h.draft_before) order by h.created_at desc,h.id) from
   (select * from toon_private.toon_tier_merge_history where tier_list_id = p_id and user_id = v_uid order by created_at desc,id limit 10) h),'[]'::jsonb))
 into v_result from public.toon_tier_lists l join public.toon_tier_list_drafts d on d.tier_list_id = l.id where l.id = p_id and l.user_id = v_uid and l.deleted_at is null;
 return v_result;
end;$$;
create function public.toon_get_my_tier_merge_history(p_id uuid,p_page integer default 1) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;v_result jsonb;
begin
 v_uid := toon_private.toon_require_current();if p_page is null or p_page not between 1 and 1000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 if not exists(select 1 from public.toon_tier_lists where id = p_id and user_id = v_uid and deleted_at is null) then return null;end if;
 select jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object('id',h.id,'sourceId',h.source_id,'targetId',h.target_id,'sourceTitle',h.source_title,'targetTitle',h.target_title,'createdAt',h.created_at,'duplicatesRemoved',h.duplicates_removed,'draftBefore',h.draft_before) order by h.created_at desc,h.id),'[]'::jsonb),
  'hasNext',(select count(*) from toon_private.toon_tier_merge_history where user_id = v_uid and tier_list_id = p_id) > p_page*20) into v_result from (
  select * from toon_private.toon_tier_merge_history where user_id = v_uid and tier_list_id = p_id order by created_at desc,id limit 20 offset (p_page-1)*20) h;
 return v_result;
end;$$;
create function public.toon_list_my_tier_drafts(p_page integer default 1) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;v_result jsonb;
begin
 v_uid := toon_private.toon_require_current();if p_page is null or p_page not between 1 and 1000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 select jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'description',description,'tags',tags,'workCount',jsonb_array_length(placements),'version',version,'savedAt',updated_at) order by created_at desc,id),'[]'::jsonb),
  'hasNext',(select count(*) from public.toon_tier_lists where user_id = v_uid and deleted_at is null) > p_page*20) into v_result from (
  select l.id,l.created_at,d.* from public.toon_tier_lists l join public.toon_tier_list_drafts d on d.tier_list_id = l.id where l.user_id = v_uid and l.deleted_at is null order by l.created_at desc,l.id limit 20 offset (p_page-1)*20) page;
 return v_result;
end;$$;
create function public.toon_search_tier_draft_works(p_origin text,p_q text,p_page integer default 1) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;v_q text;v_result jsonb;
begin
 v_uid := toon_private.toon_require_current();perform toon_private.toon_take_rate('tier_search',90,60);
 if p_origin is null or p_origin not in ('library','catalogue') or p_q is null or char_length(p_q) > 100 or p_page is null or p_page not between 1 and 1000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 v_q := '%' || replace(replace(replace(p_q,'\','\\'),'%','\%'),'_','\_') || '%';
 with matches as (
  select w.id,w.title from public.toon_works w where toon_private.toon_work_public(w.id) and (p_q = '' or w.search_text ilike v_q escape '\')
   and (p_origin = 'catalogue' or exists(select 1 from public.toon_library_entries where user_id = v_uid and work_id = w.id))
 ), page as (select *,row_number() over(order by title,id) ordinal from matches order by title,id limit 25 offset (p_page-1)*24)
 select jsonb_build_object('items',coalesce(jsonb_agg(toon_private.toon_work_card(id) order by title,id) filter(where ordinal <= p_page*24),'[]'::jsonb),'hasNext',count(*) > 24) into v_result from page;
 return v_result;
end;$$;

-- Extend P3 merge under the same transaction/preview fingerprint. The old
-- personal-domain function stays private; every lock added here uses NOWAIT.
alter function toon_private.toon_work_merge_fingerprint(uuid,uuid) rename to toon_personal_merge_fingerprint;
create function toon_private.toon_work_merge_fingerprint(p_source uuid,p_target uuid) returns text
language sql stable set search_path = '' as $$
 select toon_private.toon_merge_digest(toon_private.toon_personal_merge_fingerprint(p_source,p_target) || coalesce((
  select string_agg(toon_private.toon_merge_digest(to_jsonb(l)::text || to_jsonb(d)::text),'|' order by l.id)
  from public.toon_tier_lists l join public.toon_tier_list_drafts d on d.tier_list_id = l.id where l.deleted_at is null
   and ((d.placements @> jsonb_build_array(jsonb_build_object('workId',p_source))) or (d.placements @> jsonb_build_array(jsonb_build_object('workId',p_target))))),''));
$$;
alter function toon_private.toon_work_merge_summary(uuid,uuid) rename to toon_personal_merge_summary;
create function toon_private.toon_work_merge_summary(p_source uuid,p_target uuid) returns jsonb
language sql stable set search_path = '' as $$
 with base as (select toon_private.toon_personal_merge_summary(p_source,p_target) value), future as (
  select exists(select 1 from unnest(array['tier_list_items','tier_list_publications','posts']) t where to_regclass('public.toon_' || t) is not null) blocked
 ) select value || jsonb_build_object('records',(value->'records') || jsonb_build_object('tiers',(
  select count(*) from public.toon_tier_list_drafts d join public.toon_tier_lists l on l.id = d.tier_list_id where l.deleted_at is null and (d.placements @> jsonb_build_array(jsonb_build_object('workId',p_source))))),
  'blockedByPersonalDomains',blocked,'canMerge',not blocked and not exists(select 1 from jsonb_each_text(value->'conflicts') x where x.value::integer > 0)) from base cross join future;
$$;
create function toon_private.toon_merge_tier_drafts(p_source uuid,p_target uuid) returns void
language plpgsql set search_path = '' as $$
declare v_item record;v_before jsonb;v_after jsonb;v_count integer;
begin
 for v_item in select l.user_id,d.* from public.toon_tier_list_drafts d join public.toon_tier_lists l on l.id = d.tier_list_id
  where l.deleted_at is null and (d.placements @> jsonb_build_array(jsonb_build_object('workId',p_source))) order by d.tier_list_id loop
  v_before := toon_private.toon_tier_draft_json(v_item.tier_list_id);
  v_after := toon_private.toon_tier_normalize(v_before);v_count := jsonb_array_length(v_item.placements)-jsonb_array_length(v_after->'placements');
  insert into toon_private.toon_tier_merge_history(user_id,tier_list_id,source_id,target_id,source_title,target_title,draft_before,version_before,version_after,duplicates_removed)
   select v_item.user_id,v_item.tier_list_id,p_source,p_target,s.title,t.title,v_before,v_item.version,v_item.version+1,v_count from public.toon_works s cross join public.toon_works t where s.id = p_source and t.id = p_target;
  update public.toon_tier_list_drafts set placements = v_after->'placements',version = version+1,updated_at = clock_timestamp() where tier_list_id = v_item.tier_list_id;
 end loop;
end;$$;
alter function public.toon_admin_merge_works(uuid,uuid,bigint,bigint,text,boolean,uuid,text) set schema toon_private;
alter function toon_private.toon_admin_merge_works(uuid,uuid,bigint,bigint,text,boolean,uuid,text) rename to toon_admin_merge_personal_base;
revoke all on function toon_private.toon_admin_merge_personal_base(uuid,uuid,bigint,bigint,text,boolean,uuid,text) from public,anon,authenticated;
-- Refresh callers of the new fingerprint/summary contracts.
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

create or replace function toon_private.toon_admin_merge_personal_base(p_source uuid,p_target uuid,p_source_version bigint,p_target_version bigint,
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
create function public.toon_admin_merge_works(p_source uuid,p_target uuid,p_source_version bigint,p_target_version bigint,p_reason text,p_confirm boolean,p_preview_token uuid,p_conflict_policy text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 perform toon_private.toon_require_catalogue_admin();
 if not pg_catalog.pg_try_advisory_xact_lock(716231) then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 perform id from public.toon_works where id in (p_source,p_target) order by id for update nowait;
 perform a.user_id from toon_private.toon_user_access a where a.user_id in (
  select l.user_id from public.toon_tier_lists l join public.toon_tier_list_drafts d on d.tier_list_id = l.id where l.deleted_at is null and
   ((d.placements @> jsonb_build_array(jsonb_build_object('workId',p_source))) or (d.placements @> jsonb_build_array(jsonb_build_object('workId',p_target))))) order by a.user_id for update nowait;
 perform d.tier_list_id from public.toon_tier_list_drafts d join public.toon_tier_lists l on l.id = d.tier_list_id where l.deleted_at is null and
  ((d.placements @> jsonb_build_array(jsonb_build_object('workId',p_source))) or (d.placements @> jsonb_build_array(jsonb_build_object('workId',p_target)))) order by d.tier_list_id for update of d nowait;
 perform toon_private.toon_admin_merge_personal_base(p_source,p_target,p_source_version,p_target_version,p_reason,p_confirm,p_preview_token,p_conflict_policy);
 -- Base sets source.merged_into_id before normalization, but all is atomic.
 perform toon_private.toon_merge_tier_drafts(p_source,p_target);
exception when lock_not_available then raise exception 'CONFLICT' using errcode = 'P0001';
end;$$;

revoke all on function toon_private.toon_tier_uuid(text),toon_private.toon_tier_payload(jsonb),toon_private.toon_tier_contains(jsonb,uuid),toon_private.toon_tier_normalize(jsonb),toon_private.toon_tier_check_works(jsonb,jsonb),toon_private.toon_tier_draft_json(uuid),toon_private.toon_tier_work_cards(jsonb),toon_private.toon_merge_tier_drafts(uuid,uuid),toon_private.toon_personal_merge_fingerprint(uuid,uuid),toon_private.toon_personal_merge_summary(uuid,uuid),toon_private.toon_work_merge_fingerprint(uuid,uuid),toon_private.toon_work_merge_summary(uuid,uuid) from public,anon,authenticated;
revoke all on function public.toon_create_tier_draft(jsonb,uuid),public.toon_copy_tier_draft(uuid,bigint),public.toon_save_tier_draft(uuid,bigint,jsonb),public.toon_delete_tier_draft(uuid,bigint,boolean),public.toon_get_my_tier_editor(uuid),public.toon_list_my_tier_drafts(integer),public.toon_search_tier_draft_works(text,text,integer),public.toon_admin_merge_works(uuid,uuid,bigint,bigint,text,boolean,uuid,text) from public,anon,authenticated;
grant execute on function public.toon_create_tier_draft(jsonb,uuid),public.toon_copy_tier_draft(uuid,bigint),public.toon_save_tier_draft(uuid,bigint,jsonb),public.toon_delete_tier_draft(uuid,bigint,boolean),public.toon_get_my_tier_editor(uuid),public.toon_list_my_tier_drafts(integer),public.toon_search_tier_draft_works(text,text,integer),public.toon_admin_merge_works(uuid,uuid,bigint,bigint,text,boolean,uuid,text) to authenticated;
revoke all on function public.toon_get_my_tier_merge_history(uuid,integer) from public,anon,authenticated;
grant execute on function public.toon_get_my_tier_merge_history(uuid,integer) to authenticated;
alter function public.toon_search_tier_draft_works(text,text,integer) set statement_timeout = '5s';
alter function public.toon_get_my_tier_editor(uuid) set statement_timeout = '5s';
alter function public.toon_get_my_tier_merge_history(uuid,integer) set statement_timeout = '5s';
