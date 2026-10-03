-- P4 image increment: file only, not applied or executed.
-- Readers use user sessions. Only active members can reserve expensive PNG work;
-- anonymous capability/IP export awaits deployment-level limits.
create function private.tier_image_item(p_id uuid) returns jsonb
language sql stable set search_path = '' as $$
 select case when private.work_public(p_id)
  then jsonb_build_object('title',private.work_card(p_id)->>'title') else null end;
$$;
create function private.tier_image_body(p_payload jsonb) returns jsonb
language sql stable set search_path = '' as $$
 with body as (select private.tier_public_body(p_payload) value)
 select (value - 'rows') || jsonb_build_object('rows',(
  select jsonb_agg((r.value - 'items') || jsonb_build_object('items',coalesce((
   select jsonb_agg(case when w.value = 'null'::jsonb then null else jsonb_build_object('title',w.value->>'title') end order by w.ordinality)
   from jsonb_array_elements(r.value->'items') with ordinality w),'[]'::jsonb)) order by r.ordinality)
  from jsonb_array_elements(value->'rows') with ordinality r)) from body;
$$;
create function public.get_tier_image_source(p_id uuid,p_source text,p_version bigint,p_hash text,p_confirm_spoiler boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;v_list public.tier_lists;v_draft public.tier_list_drafts;v_publication public.tier_list_publications;v_payload jsonb;
begin
 v_uid := private.require_current();
 if p_id is null or p_source is null or p_source not in ('draft','publication') or p_version is null or p_version not between 1 and 9007199254740991
  or p_confirm_spoiler is null or (p_hash is not null and p_hash !~ '^[a-f0-9]{64}$')
  or (p_source = 'draft' and p_hash is not null) then raise exception 'VALIDATION_ERROR' using errcode = 'P0001';end if;
 if p_source = 'draft' then
  select * into v_list from public.tier_lists where id = p_id and user_id = v_uid and deleted_at is null;
  if not found then return null;end if;
  select * into v_draft from public.tier_list_drafts where tier_list_id = p_id;
  if not found then return null;end if;
  if p_version is distinct from v_draft.version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
  v_payload := private.tier_normalize(private.tier_draft_json(p_id));
  return jsonb_build_object('id',p_id,'source','draft','version',v_draft.version,'isSpoiler',true,
   'body',private.tier_image_body(v_payload),'unplaced',coalesce((
    select jsonb_agg(private.tier_image_item((w.value->>'workId')::uuid) order by (w.value->>'position')::integer)
    from jsonb_array_elements(v_payload->'placements') w where w.value->>'rowId' is null),'[]'::jsonb));
 end if;
 -- Ownership does not bypass public/unlisted access, block, expiry or moderation.
 if not private.tier_accessible(p_id,p_hash) then return null;end if;
 select * into v_list from public.tier_lists where id = p_id;
 if p_version is distinct from v_list.version then raise exception 'CONFLICT' using errcode = 'P0001';end if;
 select * into v_publication from public.tier_list_publications where tier_list_id = p_id and version = v_list.published_version;
 if not found then return null;end if;
 if v_publication.is_spoiler and p_confirm_spoiler is distinct from true then raise exception 'CONFIRM_REQUIRED' using errcode = 'P0001';end if;
 return jsonb_build_object('id',p_id,'source','publication','version',v_list.version,'isSpoiler',v_publication.is_spoiler,
  'body',private.tier_image_body(v_publication.payload),'unplaced','[]'::jsonb);
end;$$;
create function public.begin_tier_image_export(p_id uuid,p_source text,p_version bigint,p_hash text,p_confirm_spoiler boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_source jsonb;
begin
 v_source := public.get_tier_image_source(p_id,p_source,p_version,p_hash,p_confirm_spoiler);
 if v_source is null then return null;end if;
 -- Shared account bucket across lists, pages, drafts and publications. The
 -- reservation commits before rendering and failed renders are not refunded.
 perform private.take_rate('tier_png_export',5,600);
 return v_source;
end;$$;
revoke all on function private.tier_image_item(uuid),private.tier_image_body(jsonb) from public,anon,authenticated;
revoke all on function public.get_tier_image_source(uuid,text,bigint,text,boolean),public.begin_tier_image_export(uuid,text,bigint,text,boolean) from public,anon,authenticated;
grant execute on function public.get_tier_image_source(uuid,text,bigint,text,boolean),public.begin_tier_image_export(uuid,text,bigint,text,boolean) to authenticated;
alter function public.get_tier_image_source(uuid,text,bigint,text,boolean) set statement_timeout = '5s';
alter function public.begin_tier_image_export(uuid,text,bigint,text,boolean) set statement_timeout = '5s';
