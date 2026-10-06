-- TIER-11. File only: not applied or executed. No new tables or direct DML grants.
-- Every caller is an active owner; private projections omit notes/progress/tokens.
create function toon_private.toon_tier_evaluation_items(p_uid uuid,p_id uuid,p_mode text,p_ids uuid[],p_page integer)
returns jsonb language sql stable set search_path = '' as $$
 with draft as (select * from public.toon_tier_list_drafts where tier_list_id = p_id), candidates as (
  select e.work_id from public.toon_user_evaluations e where p_mode = 'import' and e.user_id = p_uid and e.canonical_tier is not null
  union all select (p->>'workId')::uuid from draft d cross join lateral jsonb_array_elements(d.placements) p where p_mode = 'apply'
 ), chosen as (
  select work_id from candidates where p_ids is null or work_id = any(p_ids)
  order by work_id limit case when p_ids is null then 25 else 100 end offset case when p_ids is null then (p_page-1)*24 else 0 end
 ), entries as (
  select c.work_id,w.title,w.version work_version,toon_private.toon_work_public(c.work_id) available,l.status,l.version,
   l.visibility library_visibility,e.visibility evaluation_visibility,e.rating_steps,e.canonical_tier,
   placement.p,source_row.r source_row,target_row.r target_row
  from chosen c cross join draft d join public.toon_works w on w.id = c.work_id
  left join public.toon_library_entries l on l.user_id = p_uid and l.work_id = c.work_id
  left join public.toon_user_evaluations e on e.user_id = p_uid and e.work_id = c.work_id
  left join lateral (select p from jsonb_array_elements(d.placements) p where (p->>'workId')::uuid = c.work_id) placement on true
  left join lateral (select r from jsonb_array_elements(d.rows) r where r->>'id' = placement.p->>'rowId') source_row on true
  left join lateral (select r from jsonb_array_elements(d.rows) r where
   (p_mode = 'import' and r->>'canonicalTier' = e.canonical_tier::text) or
   (p_mode = 'apply' and r->>'id' = placement.p->>'rowId')) target_row on true
 ) select coalesce(jsonb_agg(jsonb_build_object(
  'workId',work_id,'title',case when available then title else null end,'workVersion',case when available then work_version else null end,
  'status',status,'entryVersion',version,'ratingSteps',rating_steps,'sourceTier',canonical_tier,
  'libraryVisibility',library_visibility,'evaluationVisibility',evaluation_visibility,
  'fromRow',case when p is not null and p->>'rowId' is null then '미배치' else source_row->>'label' end,
  'toRow',target_row->>'label','targetRowId',target_row->>'id','targetTier',target_row->>'canonicalTier',
  'requiresStatus',p_mode = 'apply' and (status is null or status = 'planned'),
  'reason',case when not available then 'unavailable'
   when p_mode = 'apply' and p->>'rowId' is null then 'unplaced'
   when p_mode = 'apply' and target_row->>'canonicalTier' is null then 'custom'
   when p_mode = 'import' and target_row is null then 'missing_row'
   when p_mode = 'import' and p->>'rowId' = target_row->>'id' then 'unchanged'
   when p_mode = 'apply' and canonical_tier::text = target_row->>'canonicalTier' then 'unchanged'
   else null end) order by work_id),'[]'::jsonb) from entries;
$$;

create function public.toon_get_my_tier_evaluations(p_id uuid,p_mode text,p_page integer) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '8s' as $$
declare v_uid uuid;v_draft public.toon_tier_list_drafts;v_items jsonb;
begin
 v_uid := toon_private.toon_require_current();
 if p_mode is null or p_mode not in ('import','apply') or p_page is null or p_page not between 1 and 1000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 select d.* into v_draft from public.toon_tier_list_drafts d join public.toon_tier_lists t on t.id = d.tier_list_id where t.id = p_id and t.user_id = v_uid and t.deleted_at is null;
 if not found then return null;end if;
 v_items := toon_private.toon_tier_evaluation_items(v_uid,p_id,p_mode,null,p_page);
 return jsonb_build_object('id',p_id,'title',v_draft.title,'version',v_draft.version,'mode',p_mode,'page',p_page,
  'hasMore',p_page < 1000 and jsonb_array_length(v_items) > 24,'items',(select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) from jsonb_array_elements(v_items) with ordinality where ordinality <= 24));
end;$$;

-- Deterministic owner/draft/selection snapshot; not an authorization token.
-- Recomputed after locks at commit, including reading versions, stars/privacy,
-- current public work state and explicit status choices. Any difference aborts all.
create function toon_private.toon_tier_evaluation_preview(p_uid uuid,p_id uuid,p_mode text,p_version bigint,p_choices jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare v_version bigint;v_choice jsonb;v_id uuid;v_ids uuid[] := '{}';v_choices jsonb;v_items jsonb;v_item jsonb;v_status text;v_result jsonb := '[]';v_fingerprint text;
begin
 if p_mode is null or p_mode not in ('import','apply') or p_version is null or p_version not between 1 and 9007199254740990 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 select d.version into v_version from public.toon_tier_list_drafts d join public.toon_tier_lists t on t.id = d.tier_list_id where t.id = p_id and t.user_id = p_uid and t.deleted_at is null;
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 if p_version <> v_version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 if p_choices is null or jsonb_typeof(p_choices) <> 'array' or octet_length(p_choices::text) > 32768 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 if jsonb_array_length(p_choices) not between 1 and 100 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 for v_choice in select value from jsonb_array_elements(p_choices) loop
  if jsonb_typeof(v_choice) <> 'object' then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
  if (select count(*) from jsonb_object_keys(v_choice)) <> 2 or not v_choice ?& array['workId','status']
   or jsonb_typeof(v_choice->'workId') <> 'string'
   or (v_choice->'status' <> 'null'::jsonb and (jsonb_typeof(v_choice->'status') <> 'string' or v_choice->>'status' not in ('reading','completed','dropped'))) then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
  v_id := toon_private.toon_tier_uuid(v_choice->>'workId');
  if v_id = any(v_ids) then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
  v_ids := array_append(v_ids,v_id);
 end loop;
 select jsonb_agg(value || jsonb_build_object('workId',(value->>'workId')::uuid) order by (value->>'workId')::uuid) into v_choices from jsonb_array_elements(p_choices);
 v_items := toon_private.toon_tier_evaluation_items(p_uid,p_id,p_mode,v_ids,1);
 if jsonb_array_length(v_items) <> cardinality(v_ids) then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 for v_item in select value from jsonb_array_elements(v_items) loop
  if v_item->>'reason' is not null then raise exception 'CONFLICT' using errcode = 'P0001';end if;
  select value->>'status' into v_status from jsonb_array_elements(v_choices) where value->>'workId' = v_item->>'workId';
  if (v_item->>'requiresStatus')::boolean then
   if v_status is null then raise exception 'READING_STATUS_REQUIRED' using errcode = 'P0001';end if;
  elsif v_status is not null then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
  v_result := v_result || jsonb_build_array(v_item || jsonb_build_object('nextStatus',case when p_mode = 'apply' then coalesce(v_status,v_item->>'status') else v_item->>'status' end));
 end loop;
 if p_mode = 'import' and (select jsonb_array_length(d.placements) +
  (select count(*) from unnest(v_ids) id where not toon_private.toon_tier_contains(d.placements,id)) from public.toon_tier_list_drafts d where d.tier_list_id = p_id) > 300 then
  raise exception 'TIER_CAPACITY' using errcode = 'P0001';end if;
 if p_mode = 'apply' and exists(select 1 from jsonb_array_elements(v_result) where (value->>'entryVersion')::bigint >= 9007199254740991) then
  raise exception 'CONFLICT' using errcode = 'P0001';end if;
 v_fingerprint := toon_private.toon_merge_digest(jsonb_build_object('owner',p_uid,'id',p_id,'mode',p_mode,'version',v_version,'choices',v_choices,'items',v_result)::text);
 return jsonb_build_object('id',p_id,'mode',p_mode,'version',v_version,'fingerprint',v_fingerprint,'items',v_result);
end;$$;

create function public.toon_preview_tier_evaluations(p_id uuid,p_mode text,p_version bigint,p_choices jsonb) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '8s' as $$
declare v_uid uuid;
begin
 v_uid := toon_private.toon_require_current();perform toon_private.toon_take_rate('tier_evaluation_preview',60,60);
 return toon_private.toon_tier_evaluation_preview(v_uid,p_id,p_mode,p_version,p_choices);
end;$$;

create function public.toon_commit_tier_evaluations(p_id uuid,p_mode text,p_version bigint,p_choices jsonb,p_fingerprint text,p_confirm boolean) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '8s' as $$
declare v_uid uuid;v_preview jsonb;v_locked jsonb;v_draft jsonb;v_placements jsonb;v_item jsonb;v_reply jsonb;v_version bigint;
begin
 v_uid := toon_private.toon_require_current();perform toon_private.toon_take_rate('tier_evaluation_commit',30,60);
 if p_confirm is distinct from true then raise exception 'CONFIRM_REQUIRED' using errcode = 'P0001';end if;
 if p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 -- Validate ownership and bounded input before touching works. Match existing
 -- mutation lock order: current user -> UUID-ordered works -> list/draft/entries.
 v_preview := toon_private.toon_tier_evaluation_preview(v_uid,p_id,p_mode,p_version,p_choices);
 perform w.id from public.toon_works w where w.id in (
  select (value->>'workId')::uuid from jsonb_array_elements(v_preview->'items')
  union select (value->>'workId')::uuid from public.toon_tier_list_drafts d cross join lateral jsonb_array_elements(d.placements) where d.tier_list_id = p_id
 ) or w.id in (
  select toon_private.toon_current_merged_work((value->>'workId')::uuid) from public.toon_tier_list_drafts d cross join lateral jsonb_array_elements(d.placements) where d.tier_list_id = p_id
 ) order by w.id for share;
 perform id from public.toon_tier_lists where id = p_id and user_id = v_uid and deleted_at is null for update;
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001';end if;
 perform tier_list_id from public.toon_tier_list_drafts where tier_list_id = p_id for update;
 perform work_id from public.toon_library_entries where user_id = v_uid and work_id in (select (value->>'workId')::uuid from jsonb_array_elements(v_preview->'items')) order by work_id for update;
 v_locked := toon_private.toon_tier_evaluation_preview(v_uid,p_id,p_mode,p_version,p_choices);
 if v_locked->>'fingerprint' <> p_fingerprint then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 if p_mode = 'import' then
  v_draft := toon_private.toon_tier_draft_json(p_id);
  with entries as (
   select (value->>'workId')::uuid work_id,value->>'rowId' row_id,(value->>'position')::integer pos
   from jsonb_array_elements(v_draft->'placements') where not (value->>'workId')::uuid in (select (value->>'workId')::uuid from jsonb_array_elements(v_locked->'items'))
   union all select (value->>'workId')::uuid,value->>'targetRowId',300+ordinality::integer from jsonb_array_elements(v_locked->'items') with ordinality
  ), ranked as (select work_id,row_id,row_number() over(partition by row_id order by pos,work_id)-1 pos from entries)
  select coalesce(jsonb_agg(jsonb_build_object('workId',work_id,'rowId',row_id,'position',pos) order by row_id nulls first,pos),'[]'::jsonb) into v_placements from ranked;
  if jsonb_array_length(v_placements) > 300 then raise exception 'TIER_CAPACITY' using errcode = 'P0001';end if;
  -- Reuse full draft validation/normalization and unavailable preservation.
  v_reply := public.toon_save_tier_draft(p_id,p_version,jsonb_set(v_draft,'{placements}',v_placements));
  if (v_reply->>'ok')::boolean is distinct from true then raise exception 'CONFLICT' using errcode = 'P0001';end if;
  v_version := (v_reply->>'version')::bigint;
 else
  for v_item in select value from jsonb_array_elements(v_locked->'items') loop
   -- Existing status/privacy and private details stay intact; new records private.
   insert into public.toon_library_entries(user_id,work_id,status,visibility)
    values(v_uid,(v_item->>'workId')::uuid,(v_item->>'nextStatus')::public.toon_reading_status,'private')
   on conflict(user_id,work_id) do update set status = case when public.toon_library_entries.status = 'planned' then excluded.status else public.toon_library_entries.status end,
    version = public.toon_library_entries.version+1,updated_at = now();
   -- Only canonical_tier changes on conflict. Preserve stars and visibility.
   insert into public.toon_user_evaluations(user_id,work_id,canonical_tier,visibility)
    values(v_uid,(v_item->>'workId')::uuid,(v_item->>'targetTier')::public.toon_canonical_tier,'private')
   on conflict(user_id,work_id) do update set canonical_tier = excluded.canonical_tier,updated_at = now();
  end loop;
  v_version := p_version;
 end if;
 return jsonb_build_object('version',v_version,'changed',jsonb_array_length(v_locked->'items'));
end;$$;

revoke all on function toon_private.toon_tier_evaluation_items(uuid,uuid,text,uuid[],integer),toon_private.toon_tier_evaluation_preview(uuid,uuid,text,bigint,jsonb) from public,anon,authenticated;
revoke all on function public.toon_get_my_tier_evaluations(uuid,text,integer),public.toon_preview_tier_evaluations(uuid,text,bigint,jsonb),public.toon_commit_tier_evaluations(uuid,text,bigint,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.toon_get_my_tier_evaluations(uuid,text,integer),public.toon_preview_tier_evaluations(uuid,text,bigint,jsonb),public.toon_commit_tier_evaluations(uuid,text,bigint,jsonb,text,boolean) to authenticated;
