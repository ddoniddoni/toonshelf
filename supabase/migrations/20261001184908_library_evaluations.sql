-- P3 first increment: personal library and one canonical evaluation per work.
-- Not applied to a database. Reviews and domain-safe catalogue merge follow later.
create table public.toon_library_entries (
 user_id uuid not null references public.toon_profiles(id) on delete cascade,
 work_id uuid not null references public.toon_works(id),
 status public.toon_reading_status not null default 'planned', visibility public.toon_visibility not null default 'private',
 version bigint not null default 1 check(version > 0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(user_id,work_id)
);
create table public.toon_library_private_details (
 user_id uuid not null, work_id uuid not null, last_read_episode integer check(last_read_episode between 0 and 1000000),
 started_on date, finished_on date, private_note text not null default '' check(char_length(private_note) <= 5000),
 tags text[] not null default '{}', preferred_work_platform_id uuid references public.toon_work_platforms(id),
 updated_at timestamptz not null default now(), primary key(user_id,work_id),
 foreign key(user_id,work_id) references public.toon_library_entries(user_id,work_id) on delete cascade,
 check(started_on is null or finished_on is null or finished_on >= started_on), check(cardinality(tags) <= 20)
);
create table public.toon_user_evaluations (
 user_id uuid not null, work_id uuid not null, rating_steps smallint check(rating_steps between 1 and 10),
 canonical_tier public.toon_canonical_tier, visibility public.toon_visibility not null default 'private',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(user_id,work_id), foreign key(user_id,work_id) references public.toon_library_entries(user_id,work_id) on delete cascade,
 check(rating_steps is not null or canonical_tier is not null)
);
create index toon_library_owner_updated_idx on public.toon_library_entries(user_id,updated_at desc,work_id);
create index toon_library_work_idx on public.toon_library_entries(work_id);
create index toon_library_preferred_link_idx on public.toon_library_private_details(preferred_work_platform_id) where preferred_work_platform_id is not null;
create index toon_library_public_work_idx on public.toon_library_entries(work_id,user_id) where visibility = 'public';
create index toon_evaluation_public_work_idx on public.toon_user_evaluations(work_id,user_id) where visibility = 'public';
create index toon_library_private_tags_idx on public.toon_library_private_details using gin(tags);
alter table public.toon_library_entries enable row level security;
alter table public.toon_library_private_details enable row level security;
alter table public.toon_user_evaluations enable row level security;
revoke all on public.toon_library_entries,public.toon_library_private_details,public.toon_user_evaluations from public,anon,authenticated;
grant select(user_id,work_id,status,visibility) on public.toon_library_entries to anon,authenticated;
grant select(user_id,work_id,rating_steps,canonical_tier,visibility) on public.toon_user_evaluations to anon,authenticated;
grant select on public.toon_library_private_details to authenticated;
create policy library_read on public.toon_library_entries for select to anon,authenticated using (
 (user_id = (select auth.uid()) and (select toon_private.toon_current_active())) or
 (visibility = 'public' and toon_private.toon_profile_visible(user_id) and toon_private.toon_work_public(work_id))
);
create policy evaluation_read on public.toon_user_evaluations for select to anon,authenticated using (
 (user_id = (select auth.uid()) and (select toon_private.toon_current_active())) or
 (visibility = 'public' and toon_private.toon_profile_visible(user_id) and toon_private.toon_work_public(work_id))
);
create policy library_details_read on public.toon_library_private_details for select to authenticated
 using(user_id = (select auth.uid()) and (select toon_private.toon_current_active()));

-- These invariants also apply to privileged SQL writes, not only the app RPC.
create function toon_private.toon_guard_reading_record() returns trigger
language plpgsql set search_path = '' as $$
begin
 if tg_table_name = 'library_entries' then
  if new.status = 'planned' and exists(select 1 from public.toon_user_evaluations where user_id = new.user_id and work_id = new.work_id)
   then raise exception 'CLEAR_EVALUATION_REQUIRED' using errcode = 'P0001'; end if;
 elsif tg_table_name = 'user_evaluations' then
  if not exists(select 1 from public.toon_library_entries where user_id = new.user_id and work_id = new.work_id and status <> 'planned')
   then raise exception 'PLANNED_EVALUATION' using errcode = 'P0001'; end if;
 else
  if array_position(new.tags,null) is not null or exists(select 1 from unnest(new.tags) t where char_length(t) not between 1 and 20 or t <> btrim(t))
   or cardinality(new.tags) <> (select count(distinct t) from unnest(new.tags) t)
   or (new.preferred_work_platform_id is not null and not exists(select 1 from public.toon_work_platforms where id = new.preferred_work_platform_id and work_id = new.work_id))
   then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 end if;
 return new;
end;
$$;
create trigger library_status_guard before insert or update on public.toon_library_entries for each row execute function toon_private.toon_guard_reading_record();
create trigger evaluation_status_guard before insert or update on public.toon_user_evaluations for each row execute function toon_private.toon_guard_reading_record();
create trigger library_details_guard before insert or update on public.toon_library_private_details for each row execute function toon_private.toon_guard_reading_record();

create function public.toon_save_reading_record(p_work uuid,p_expected_version bigint,p_payload jsonb,p_clear_evaluation boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_old public.toon_library_entries; v_status public.toon_reading_status; v_rating smallint; v_tier public.toon_canonical_tier;
 v_tags text[]; v_started date; v_finished date; v_episode integer; v_link uuid; v_library public.toon_visibility; v_evaluation public.toon_visibility; v_key text;
begin
 v_uid := toon_private.toon_require_current(); perform toon_private.toon_take_rate('reading_save',60,60);
 perform id from public.toon_works where id = p_work for share;
 if not toon_private.toon_work_public(p_work) then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
 perform toon_private.toon_assert_keys(p_payload,array['status','libraryVisibility','evaluationVisibility','ratingSteps','canonicalTier','episode','startedOn','finishedOn','note','tags','preferredLink']);
 if p_payload is null or octet_length(p_payload::text) > 32768 or not p_payload ?& array['status','libraryVisibility','evaluationVisibility','ratingSteps','canonicalTier','episode','startedOn','finishedOn','note','tags','preferredLink']
  or jsonb_typeof(p_payload->'note') is distinct from 'string' or char_length(p_payload->>'note') > 5000
  or jsonb_typeof(p_payload->'tags') is distinct from 'array'
  or (p_payload->'ratingSteps' <> 'null'::jsonb and (jsonb_typeof(p_payload->'ratingSteps') <> 'number' or p_payload->>'ratingSteps' !~ '^(10|[1-9])$'))
  or (p_payload->'episode' <> 'null'::jsonb and (jsonb_typeof(p_payload->'episode') <> 'number' or p_payload->>'episode' !~ '^(0|[1-9][0-9]{0,6})$'))
  then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 foreach v_key in array array['status','libraryVisibility','evaluationVisibility'] loop
  if jsonb_typeof(p_payload->v_key) is distinct from 'string' then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 end loop;
 foreach v_key in array array['startedOn','finishedOn'] loop
  if p_payload->v_key <> 'null'::jsonb and (jsonb_typeof(p_payload->v_key) <> 'string' or p_payload->>v_key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
   then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 end loop;
 v_status := (p_payload->>'status')::public.toon_reading_status; v_library := (p_payload->>'libraryVisibility')::public.toon_visibility;
 v_evaluation := (p_payload->>'evaluationVisibility')::public.toon_visibility;
 v_rating := (p_payload->>'ratingSteps')::smallint; v_tier := (p_payload->>'canonicalTier')::public.toon_canonical_tier;
 v_episode := (p_payload->>'episode')::integer; v_started := (p_payload->>'startedOn')::date; v_finished := (p_payload->>'finishedOn')::date;
 v_link := (p_payload->>'preferredLink')::uuid; v_tags := toon_private.toon_text_list(p_payload->'tags',20,20);
 if v_status is null or v_library is null or v_evaluation is null or v_episode not between 0 and 1000000 or v_rating not between 1 and 10
  or (v_started is not null and v_finished is not null and v_finished < v_started)
  or (v_link is not null and not exists(select 1 from public.toon_work_platforms l join public.toon_platforms p on p.id = l.platform_id where l.id = v_link and l.work_id = p_work and l.active and p.active and l.age_rating in ('all','12','15') and l.verified_at <= now()))
  then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 select * into v_old from public.toon_library_entries where user_id = v_uid and work_id = p_work for update;
 if (v_old.user_id is null and p_expected_version is not null) or (v_old.user_id is not null and p_expected_version is distinct from v_old.version)
  then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
 if v_status = 'planned' then
  if v_rating is not null or v_tier is not null then raise exception 'PLANNED_EVALUATION' using errcode = 'P0001'; end if;
  if exists(select 1 from public.toon_user_evaluations where user_id = v_uid and work_id = p_work) and p_clear_evaluation is distinct from true
   then raise exception 'CLEAR_EVALUATION_REQUIRED' using errcode = 'P0001'; end if;
  delete from public.toon_user_evaluations where user_id = v_uid and work_id = p_work;
 end if;
 insert into public.toon_library_entries(user_id,work_id,status,visibility) values(v_uid,p_work,v_status,v_library)
 on conflict(user_id,work_id) do update set status = excluded.status,visibility = excluded.visibility,version = public.toon_library_entries.version + 1,updated_at = now();
 insert into public.toon_library_private_details(user_id,work_id,last_read_episode,started_on,finished_on,private_note,tags,preferred_work_platform_id)
 values(v_uid,p_work,v_episode,v_started,v_finished,p_payload->>'note',v_tags,v_link)
 on conflict(user_id,work_id) do update set last_read_episode = excluded.last_read_episode,started_on = excluded.started_on,finished_on = excluded.finished_on,
  private_note = excluded.private_note,tags = excluded.tags,preferred_work_platform_id = excluded.preferred_work_platform_id,updated_at = now();
 if v_rating is null and v_tier is null then
  delete from public.toon_user_evaluations where user_id = v_uid and work_id = p_work;
 else
  insert into public.toon_user_evaluations(user_id,work_id,rating_steps,canonical_tier,visibility) values(v_uid,p_work,v_rating,v_tier,v_evaluation)
  on conflict(user_id,work_id) do update set rating_steps = excluded.rating_steps,canonical_tier = excluded.canonical_tier,visibility = excluded.visibility,updated_at = now();
 end if;
end;
$$;

create function public.toon_copy_work_to_library(p_work uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
 v_uid := toon_private.toon_require_current(); perform toon_private.toon_take_rate('reading_copy',60,60);
 perform id from public.toon_works where id = p_work for share;
 if not toon_private.toon_work_public(p_work) then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
 -- BEFORE INSERT runs even for ON CONFLICT DO NOTHING. Return before attempting
 -- a planned row when the existing record already has an evaluation.
 -- require_current holds the owner lock, so another owner write cannot race this.
 if exists(select 1 from public.toon_library_entries where user_id = v_uid and work_id = p_work) then return; end if;
 insert into public.toon_library_entries(user_id,work_id,visibility)
 select v_uid,p_work,default_library_visibility from public.toon_user_settings where user_id = v_uid on conflict do nothing;
 -- Never copy somebody else's status, evaluation, progress or note.
 insert into public.toon_library_private_details(user_id,work_id) values(v_uid,p_work) on conflict do nothing;
end;
$$;

create function public.toon_bulk_library_change(p_selection jsonb,p_operation text,p_value text,p_confirm boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_item jsonb; v_entry public.toon_library_entries; v_id uuid; v_tags text[]; v_status public.toon_reading_status;
begin
 v_uid := toon_private.toon_require_current(); perform toon_private.toon_take_rate('reading_bulk',20,60);
 if p_selection is null or jsonb_typeof(p_selection) <> 'array' or jsonb_array_length(p_selection) not between 1 and 100 or octet_length(p_selection::text) > 32768
  or p_operation is null or p_operation not in ('delete','status','libraryVisibility','evaluationVisibility','tag')
  or (select count(distinct x->>'id') from jsonb_array_elements(p_selection) x) <> jsonb_array_length(p_selection)
  then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 if p_operation = 'delete' and p_confirm is distinct from true then raise exception 'CONFIRM_REQUIRED' using errcode = 'P0001'; end if;
 if p_operation = 'status' then
  v_status := p_value::public.toon_reading_status;
  if v_status is null then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 elsif p_operation in ('libraryVisibility','evaluationVisibility') then
  if p_value is null or p_value not in ('public','private') then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 elsif p_operation = 'tag' then
  if p_value is null or p_value <> btrim(p_value) or char_length(p_value) not between 1 and 20 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 end if;
 for v_item in select value from jsonb_array_elements(p_selection) order by value->>'id' loop
  perform toon_private.toon_assert_keys(v_item,array['id','version']);
  if not v_item ?& array['id','version'] or jsonb_typeof(v_item->'version') <> 'number' or v_item->>'version' !~ '^[1-9][0-9]{0,15}$'
   then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
  v_id := (v_item->>'id')::uuid;
  perform id from public.toon_works where id = v_id for share;
  select * into v_entry from public.toon_library_entries where user_id = v_uid and work_id = v_id for update;
  if v_entry.user_id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_entry.version is distinct from (v_item->>'version')::bigint then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
  -- Hidden/unknown/adult records can be removed or made private, never newly exposed.
  if not toon_private.toon_work_public(v_id) and not (p_operation = 'delete' or (p_operation in ('libraryVisibility','evaluationVisibility') and p_value = 'private'))
   then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if p_operation = 'delete' then
   delete from public.toon_library_entries where user_id = v_uid and work_id = v_id;
  elsif p_operation = 'status' then
   if v_status = 'planned' and exists(select 1 from public.toon_user_evaluations where user_id = v_uid and work_id = v_id) then
    if p_confirm is distinct from true then raise exception 'CLEAR_EVALUATION_REQUIRED' using errcode = 'P0001'; end if;
    delete from public.toon_user_evaluations where user_id = v_uid and work_id = v_id;
   end if;
   update public.toon_library_entries set status = v_status,version = version + 1,updated_at = now() where user_id = v_uid and work_id = v_id;
  elsif p_operation = 'libraryVisibility' then
   update public.toon_library_entries set visibility = p_value::public.toon_visibility,version = version + 1,updated_at = now() where user_id = v_uid and work_id = v_id;
  elsif p_operation = 'evaluationVisibility' then
   update public.toon_user_evaluations set visibility = p_value::public.toon_visibility,updated_at = now() where user_id = v_uid and work_id = v_id;
   update public.toon_library_entries set version = version + 1,updated_at = now() where user_id = v_uid and work_id = v_id;
  else
   select tags into v_tags from public.toon_library_private_details where user_id = v_uid and work_id = v_id;
   select array_agg(distinct t order by t) into v_tags from unnest(coalesce(v_tags,'{}') || array[p_value]) t;
   if cardinality(v_tags) > 20 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
   insert into public.toon_library_private_details(user_id,work_id,tags) values(v_uid,v_id,v_tags)
    on conflict(user_id,work_id) do update set tags = excluded.tags,updated_at = now();
   update public.toon_library_entries set version = version + 1,updated_at = now() where user_id = v_uid and work_id = v_id;
  end if;
 end loop;
end;
$$;

create function public.toon_make_all_library_private(p_confirm boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
 v_uid := toon_private.toon_require_current(); perform toon_private.toon_take_rate('reading_private',5,60);
 if p_confirm is distinct from true then raise exception 'CONFIRM_REQUIRED' using errcode = 'P0001'; end if;
 update public.toon_library_entries set visibility = 'private',version = version + 1,updated_at = now() where user_id = v_uid;
 update public.toon_user_evaluations set visibility = 'private',updated_at = now() where user_id = v_uid;
 update public.toon_user_settings set default_library_visibility = 'private',default_evaluation_visibility = 'private',updated_at = now() where user_id = v_uid;
end;
$$;

-- Owner DTO intentionally separate from public DTO. Unavailable work metadata is null.
create function toon_private.toon_my_reading_record(p_work uuid) returns jsonb
language sql stable set search_path = '' as $$
 select jsonb_build_object('workId',l.work_id,'version',l.version,'status',l.status,'libraryVisibility',l.visibility,
  'evaluationVisibility',coalesce(e.visibility,s.default_evaluation_visibility),'ratingSteps',e.rating_steps,'canonicalTier',e.canonical_tier,
  'episode',d.last_read_episode,'startedOn',d.started_on,'finishedOn',d.finished_on,'note',coalesce(d.private_note,''),'tags',coalesce(d.tags,'{}'),
  'preferredLink',d.preferred_work_platform_id,'createdAt',l.created_at,'updatedAt',l.updated_at,
  'work',case when toon_private.toon_work_public(l.work_id) then toon_private.toon_work_card(l.work_id) else null end)
 from public.toon_library_entries l left join public.toon_library_private_details d using(user_id,work_id)
 left join public.toon_user_evaluations e using(user_id,work_id) join public.toon_user_settings s on s.user_id = l.user_id
 where l.user_id = auth.uid() and l.work_id = p_work;
$$;
create function public.toon_get_my_reading_record(p_work uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 perform toon_private.toon_require_current(); return toon_private.toon_my_reading_record(p_work);
end;
$$;
create function public.toon_get_my_library(p_filters jsonb,p_page integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_q text; v_status text; v_sort text; v_platform text; v_genre text; v_rating integer; v_tier text; v_tag text; v_total integer; v_items jsonb; v_key text;
begin
 v_uid := toon_private.toon_require_current();
 perform toon_private.toon_assert_keys(p_filters,array['q','status','sort','platform','genre','rating','tier','tag']);
 if p_filters is null or not p_filters ?& array['q','status','sort','platform','genre','rating','tier','tag'] or p_page is null or p_page not between 1 and 1000
  or octet_length(p_filters::text) > 4096 or char_length(p_filters->>'q') > 100 or char_length(p_filters->>'tag') > 20
  then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 if jsonb_typeof(p_filters->'q') is distinct from 'string' or jsonb_typeof(p_filters->'sort') is distinct from 'string'
  or (p_filters->'rating' <> 'null'::jsonb and (jsonb_typeof(p_filters->'rating') <> 'number' or p_filters->>'rating' !~ '^(10|[1-9])$'))
  then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 foreach v_key in array array['status','platform','genre','tier','tag'] loop
  if p_filters->v_key <> 'null'::jsonb and jsonb_typeof(p_filters->v_key) <> 'string' then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 end loop;
 v_status := p_filters->>'status'; v_sort := p_filters->>'sort'; v_platform := p_filters->>'platform'; v_genre := p_filters->>'genre';
 v_rating := (p_filters->>'rating')::integer; v_tier := p_filters->>'tier'; v_tag := p_filters->>'tag';
 if v_sort is null or v_sort not in ('updated','added','title','rating') or (v_status is not null and v_status not in ('reading','completed','dropped','planned'))
  or (v_tier is not null and v_tier not in ('S','A','B','C','D','F')) or v_rating not between 1 and 10
  or (v_platform is not null and not exists(select 1 from public.toon_platforms where code = v_platform and active))
  or (v_genre is not null and not exists(select 1 from public.toon_genres where slug = v_genre and active))
  then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 v_q := '%' || replace(replace(replace(coalesce(p_filters->>'q',''),'\','\\'),'%','\%'),'_','\_') || '%';
 with filtered as (
  select l.work_id,l.updated_at,l.created_at,e.rating_steps,
   case when toon_private.toon_work_public(l.work_id) then w.title else '' end as safe_title
  from public.toon_library_entries l join public.toon_works w on w.id = l.work_id
  left join public.toon_user_evaluations e using(user_id,work_id) left join public.toon_library_private_details d using(user_id,work_id)
  where l.user_id = v_uid and (v_status is null or l.status::text = v_status) and (v_rating is null or e.rating_steps = v_rating)
   and (v_tier is null or e.canonical_tier::text = v_tier) and (v_tag is null or v_tag = any(d.tags))
   and (p_filters->>'q' = '' or (toon_private.toon_work_public(w.id) and w.search_text ilike v_q escape '\'))
   and (v_platform is null or (toon_private.toon_work_public(w.id) and exists(select 1 from public.toon_work_platforms r join public.toon_platforms p on p.id = r.platform_id where r.work_id = w.id and p.code = v_platform and p.active and r.active and r.age_rating in ('all','12','15') and r.verified_at <= now())))
   and (v_genre is null or (toon_private.toon_work_public(w.id) and exists(select 1 from public.toon_work_genres r join public.toon_genres g on g.id = r.genre_id where r.work_id = w.id and g.slug = v_genre and g.active)))
 ), page as (
  select *,row_number() over(order by case when v_sort = 'title' then safe_title end asc,
   case when v_sort = 'rating' then rating_steps end desc nulls last,
   case when v_sort = 'added' then created_at else updated_at end desc,work_id) as position from filtered
 )
 select (select count(*) from filtered),coalesce((select jsonb_agg(toon_private.toon_my_reading_record(work_id) order by position) from page where position > (p_page - 1)*24 and position <= p_page*24),'[]') into v_total,v_items;
 return jsonb_build_object('items',v_items,'total',v_total,'hasNext',v_total > p_page*24 and p_page < 1000);
end;
$$;

-- Only public work metadata and independent public status/evaluation fields.
-- No progress, dates, tags, notes, record timestamps or private-derived badges.
create function public.toon_get_public_library(p_username text,p_page integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid; v_total integer; v_items jsonb;
begin
 if p_username is null or p_username !~ '^[a-z0-9_]{3,20}$' or p_page is null or p_page not between 1 and 1000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 select id into v_uid from public.toon_profiles where username = p_username and toon_private.toon_profile_visible(id);
 if v_uid is null then return null; end if;
 with visible as (
  select l.work_id,case when l.visibility = 'public' then l.status else null end as status,
   case when e.visibility = 'public' then e.rating_steps else null end as rating,
   case when e.visibility = 'public' then e.canonical_tier else null end as tier
  from public.toon_library_entries l left join public.toon_user_evaluations e using(user_id,work_id)
  where l.user_id = v_uid and (l.visibility = 'public' or e.visibility = 'public') and toon_private.toon_work_public(l.work_id)
 ), page as (select *,row_number() over(order by work_id) as position from visible)
 select (select count(*) from visible),coalesce((select jsonb_agg(jsonb_build_object('work',toon_private.toon_work_card(work_id),'status',status,'ratingSteps',rating,'canonicalTier',tier) order by position)
  from page where position > (p_page - 1)*24 and position <= p_page*24),'[]') into v_total,v_items;
 return jsonb_build_object('items',v_items,'total',v_total,'hasNext',v_total > p_page*24 and p_page < 1000);
end;
$$;

create function public.toon_get_reading_stats(p_username text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_private boolean := p_username is null; v_read integer; v_genres jsonb;
begin
 if v_private then v_uid := toon_private.toon_require_current();
 else
  if p_username !~ '^[a-z0-9_]{3,20}$' then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
  select id into v_uid from public.toon_profiles where username = p_username and toon_private.toon_profile_visible(id);
  if v_uid is null then return null; end if;
 end if;
 select count(*) into v_read from public.toon_library_entries where user_id = v_uid and status <> 'planned' and (v_private or visibility = 'public') and toon_private.toon_work_public(work_id);
 with read_works as (
  select work_id from public.toon_library_entries where user_id = v_uid and status <> 'planned' and (v_private or visibility = 'public') and toon_private.toon_work_public(work_id)
 ), genre_rows as (
  select r.work_id,g.name from read_works r left join lateral (
   select g.name from public.toon_work_genres wg join public.toon_genres g on g.id = wg.genre_id and g.active where wg.work_id = r.work_id
  ) g on true
 ), weighted as (
  select coalesce(name,'미분류') as name,1.0/count(*) over(partition by work_id) as weight from genre_rows
 ) select coalesce(jsonb_agg(jsonb_build_object('name',name,'weight',weight,'share',case when v_read = 0 then 0 else weight/v_read end) order by weight desc,name),'[]') into v_genres
 from (select name,sum(weight) as weight from weighted group by name) grouped;
 return jsonb_build_object('readCount',v_read,'genres',v_genres,
  'statuses',(select coalesce(jsonb_object_agg(status,n),'{}') from (select status,count(*) n from public.toon_library_entries where user_id = v_uid and (v_private or visibility = 'public') and toon_private.toon_work_public(work_id) group by status) s),
  'ratings',(select coalesce(jsonb_object_agg(rating_steps,n),'{}') from (select rating_steps,count(*) n from public.toon_user_evaluations where user_id = v_uid and rating_steps is not null and (v_private or visibility = 'public') and toon_private.toon_work_public(work_id) group by rating_steps) s),
  'tiers',(select coalesce(jsonb_object_agg(canonical_tier,n),'{}') from (select canonical_tier,count(*) n from public.toon_user_evaluations where user_id = v_uid and canonical_tier is not null and (v_private or visibility = 'public') and toon_private.toon_work_public(work_id) group by canonical_tier) s));
end;
$$;

create function public.toon_get_work_evaluation_stats(p_work uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
 select case when toon_private.toon_work_public(p_work) then jsonb_build_object('ratingCount',count(rating_steps),'average',avg(rating_steps/2.0),
  'tierCount',count(canonical_tier),'tiers',coalesce((select jsonb_object_agg(canonical_tier,n) from (
   select canonical_tier,count(*) n from public.toon_user_evaluations where work_id = p_work and visibility = 'public' and canonical_tier is not null and toon_private.toon_profile_visible(user_id) group by canonical_tier) t),'{}')) else null end
 from public.toon_user_evaluations where work_id = p_work and visibility = 'public' and toon_private.toon_profile_visible(user_id);
$$;

revoke execute on function toon_private.toon_guard_reading_record(),toon_private.toon_my_reading_record(uuid) from public,anon,authenticated;
revoke execute on function public.toon_save_reading_record(uuid,bigint,jsonb,boolean),public.toon_copy_work_to_library(uuid),public.toon_bulk_library_change(jsonb,text,text,boolean),
 public.toon_make_all_library_private(boolean),public.toon_get_my_reading_record(uuid),public.toon_get_my_library(jsonb,integer),public.toon_get_public_library(text,integer),
 public.toon_get_reading_stats(text),public.toon_get_work_evaluation_stats(uuid) from public,anon,authenticated;
grant execute on function public.toon_save_reading_record(uuid,bigint,jsonb,boolean),public.toon_copy_work_to_library(uuid),public.toon_bulk_library_change(jsonb,text,text,boolean),
 public.toon_make_all_library_private(boolean),public.toon_get_my_reading_record(uuid),public.toon_get_my_library(jsonb,integer) to authenticated;
grant execute on function public.toon_get_public_library(text,integer),public.toon_get_reading_stats(text),public.toon_get_work_evaluation_stats(uuid) to anon,authenticated;
-- Existing admin_merge_preview detects these personal tables and blocks merges.
-- Preserve that fail-closed guard until a lossless, private-domain merge handler exists.
