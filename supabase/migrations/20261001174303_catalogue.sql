-- P2 written contract. Apply/verify only when the user requests DB work.
begin;
create extension if not exists pg_trgm with schema extensions;

create table public.toon_platforms (
  id uuid primary key default gen_random_uuid(), code text not null unique,
  name text not null, approved_hosts text[] not null, active boolean not null default true
);
insert into public.toon_platforms(code,name,approved_hosts) values
 ('naver_webtoon','네이버웹툰',array['comic.naver.com']),
 ('naver_series','네이버 시리즈',array['series.naver.com']),
 ('kakao_webtoon','카카오웹툰',array['webtoon.kakao.com']),
 ('kakao_page','카카오페이지',array['page.kakao.com']),
 ('toptoon','탑툰',array['toptoon.com','www.toptoon.com']),
 ('lezhin','레진코믹스',array['lezhin.com','www.lezhin.com']),
 ('ridi','리디',array['ridibooks.com']);
create table public.toon_creators (
  id uuid primary key default gen_random_uuid(), name text not null check(char_length(name) between 1 and 100),
  aliases text[] not null default '{}' check(cardinality(aliases) <= 20)
);
create table public.toon_works (
  id uuid primary key default gen_random_uuid(), slug text not null unique check(slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  title text not null check(char_length(title) between 1 and 200),
  aliases text[] not null default '{}' check(cardinality(aliases) <= 20),
  original_description text not null default '' check(char_length(original_description) <= 2000),
  serial_status public.toon_serial_status not null default 'unknown', age_rating public.toon_age_rating not null default 'unknown',
  catalogue_status public.toon_catalogue_status not null default 'draft', cover_asset_id uuid,
  merged_into_id uuid references public.toon_works(id), is_test boolean not null default false,
  search_text text not null default '', version bigint not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check((catalogue_status = 'merged') = (merged_into_id is not null)), check(merged_into_id is distinct from id)
);
create table public.toon_work_creators (
  work_id uuid not null references public.toon_works(id), creator_id uuid not null references public.toon_creators(id),
  role text not null check(role in ('writer','artist','original','studio')), sort_order integer not null default 0,
  primary key(work_id,creator_id,role)
);
create index toon_work_creators_creator_idx on public.toon_work_creators(creator_id,work_id);
create table public.toon_work_genres (
  work_id uuid not null references public.toon_works(id), genre_id uuid not null references public.toon_genres(id),
  primary key(work_id,genre_id)
);
create index toon_work_genres_genre_idx on public.toon_work_genres(genre_id,work_id);
create table public.toon_work_platforms (
  id uuid primary key default gen_random_uuid(), work_id uuid not null references public.toon_works(id),
  platform_id uuid not null references public.toon_platforms(id), official_url text not null unique,
  external_id text check(char_length(external_id) between 1 and 100), weekdays smallint[] not null default '{}',
  serial_status public.toon_serial_status not null default 'unknown', age_rating public.toon_age_rating not null default 'unknown',
  verified_at timestamptz not null, active boolean not null default true
);
create unique index toon_work_platforms_external_idx on public.toon_work_platforms(platform_id,external_id) where external_id is not null;
create index toon_work_platforms_work_idx on public.toon_work_platforms(work_id,platform_id) where active;
create index toon_work_platforms_platform_idx on public.toon_work_platforms(platform_id,work_id) where active;
create index toon_works_latest_idx on public.toon_works(created_at desc,id desc) where catalogue_status = 'published';
create index toon_works_title_idx on public.toon_works(lower(title),id) where catalogue_status = 'published';
create index toon_works_search_idx on public.toon_works using gin(search_text extensions.gin_trgm_ops);
create index toon_works_merge_idx on public.toon_works(merged_into_id) where merged_into_id is not null;
create trigger works_updated before update on public.toon_works for each row execute function toon_private.toon_touch_updated_at();
create table toon_private.toon_catalogue_sources (
  id uuid primary key default gen_random_uuid(), work_id uuid not null references public.toon_works(id),
  source_url text not null, verified_fields text[] not null,
  verified_at timestamptz not null, verified_by uuid references public.toon_profiles(id) on delete set null,
  note text not null default '' check(char_length(note) <= 2000)
);
create index toon_catalogue_sources_work_idx on toon_private.toon_catalogue_sources(work_id);
create table toon_private.toon_asset_licenses (
  id uuid primary key default gen_random_uuid(), work_id uuid not null references public.toon_works(id),
  storage_path text not null unique, rights_holder text not null check(char_length(rights_holder) between 1 and 200),
  evidence_reference text not null check(char_length(evidence_reference) between 1 and 2000),
  display_allowed boolean not null, og_allowed boolean not null, export_allowed boolean not null, commercial_allowed boolean not null,
  attribution text not null default '' check(char_length(attribution) <= 500),
  valid_from timestamptz not null, expires_at timestamptz,
  status text not null default 'staged' check(status in ('staged','active','revoked')),
  verified_by uuid references public.toon_profiles(id) on delete set null, created_at timestamptz not null default now(),
  check(expires_at is null or expires_at > valid_from),
  check(storage_path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.webp$')
);
create index toon_asset_licenses_work_idx on toon_private.toon_asset_licenses(work_id);
alter table public.toon_works add constraint works_cover_fk foreign key(cover_asset_id) references toon_private.toon_asset_licenses(id);
create table toon_private.toon_admin_audit_logs (
  id uuid primary key default gen_random_uuid(), actor_id uuid references public.toon_profiles(id) on delete set null,
  action text not null, target_type text not null, target_id uuid,
  reason text not null check(char_length(reason) between 2 and 1000),
  before_summary jsonb, after_summary jsonb, created_at timestamptz not null default now()
);
create index toon_admin_audit_latest_idx on toon_private.toon_admin_audit_logs(created_at desc,id desc);
create table public.toon_catalogue_submissions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.toon_profiles(id),
  kind text not null check(kind in ('new_work','correction','broken_link')),
  work_id uuid references public.toon_works(id), proposal text not null check(char_length(proposal) between 10 and 5000),
  source_url text not null, status text not null default 'pending' check(status in ('pending','accepted','rejected')),
  result_note text not null default '' check(char_length(result_note) <= 1000),
  result_work_id uuid references public.toon_works(id), reviewed_at timestamptz, created_at timestamptz not null default now(),
  check((kind = 'new_work') = (work_id is null))
);
create index toon_catalogue_submissions_owner_idx on public.toon_catalogue_submissions(user_id,created_at desc,id desc);
create index toon_catalogue_submissions_pending_idx on public.toon_catalogue_submissions(created_at,id) where status = 'pending';

alter table public.toon_platforms enable row level security;
alter table public.toon_creators enable row level security;
alter table public.toon_works enable row level security;
alter table public.toon_work_creators enable row level security;
alter table public.toon_work_genres enable row level security;
alter table public.toon_work_platforms enable row level security;
alter table public.toon_catalogue_submissions enable row level security;
alter table toon_private.toon_catalogue_sources enable row level security;
alter table toon_private.toon_asset_licenses enable row level security;
alter table toon_private.toon_admin_audit_logs enable row level security;
revoke all on public.toon_platforms,public.toon_creators,public.toon_works,public.toon_work_creators,public.toon_work_genres,public.toon_work_platforms,public.toon_catalogue_submissions from public,anon,authenticated;
revoke all on toon_private.toon_catalogue_sources,toon_private.toon_asset_licenses,toon_private.toon_admin_audit_logs from public,anon,authenticated;
grant select on public.toon_platforms,public.toon_creators,public.toon_works,public.toon_work_creators,public.toon_work_genres,public.toon_work_platforms to anon,authenticated;
grant select on public.toon_catalogue_submissions to authenticated;

create function toon_private.toon_catalogue_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select toon_private.toon_current_active() and exists(select 1 from toon_private.toon_user_access where user_id = auth.uid() and role = 'admin');
$$;
create function toon_private.toon_require_catalogue_admin() returns uuid
language plpgsql set search_path = '' as $$
declare v_uid uuid;
begin
 v_uid := toon_private.toon_require_current();
 if not toon_private.toon_catalogue_admin() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
 return v_uid;
end;
$$;
create function toon_private.toon_work_public(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.toon_works w where w.id = p_id and w.catalogue_status = 'published'
  and w.merged_into_id is null and w.age_rating in ('all','12','15') and not w.is_test
  and exists(select 1 from public.toon_work_platforms l join public.toon_platforms p on p.id = l.platform_id
    where l.work_id = w.id and l.active and p.active and l.age_rating in ('all','12','15') and l.verified_at <= now()));
$$;
grant execute on function toon_private.toon_catalogue_admin(),toon_private.toon_work_public(uuid) to anon,authenticated;
create policy platforms_read on public.toon_platforms for select to anon,authenticated using(active or (select toon_private.toon_catalogue_admin()));
create policy works_read on public.toon_works for select to anon,authenticated using(toon_private.toon_work_public(id) or (select toon_private.toon_catalogue_admin()));
create policy creators_read on public.toon_creators for select to anon,authenticated
 using((select toon_private.toon_catalogue_admin()) or exists(select 1 from public.toon_work_creators r where r.creator_id = toon_creators.id and toon_private.toon_work_public(r.work_id)));
create policy work_creators_read on public.toon_work_creators for select to anon,authenticated using(toon_private.toon_work_public(work_id) or (select toon_private.toon_catalogue_admin()));
create policy work_genres_read on public.toon_work_genres for select to anon,authenticated using(toon_private.toon_work_public(work_id) or (select toon_private.toon_catalogue_admin()));
create policy work_platforms_read on public.toon_work_platforms for select to anon,authenticated
 using((select toon_private.toon_catalogue_admin()) or (toon_private.toon_work_public(work_id) and active and age_rating in ('all','12','15') and verified_at <= now() and exists(select 1 from public.toon_platforms p where p.id = platform_id and p.active)));
create policy submissions_read on public.toon_catalogue_submissions for select to authenticated
 using((user_id = (select auth.uid()) and (select toon_private.toon_current_active())) or (select toon_private.toon_catalogue_admin()));

create function public.toon_get_my_catalogue_role() returns boolean
language sql stable security definer set search_path = '' as $$ select toon_private.toon_catalogue_admin(); $$;
create function toon_private.toon_assert_keys(p_value jsonb,p_allowed text[]) returns void
language plpgsql set search_path = '' as $$
begin
 if p_value is null or jsonb_typeof(p_value) <> 'object' or exists(select 1 from jsonb_object_keys(p_value) k where not k = any(p_allowed))
 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
end;
$$;
create function toon_private.toon_text_list(p_value jsonb,p_max integer,p_length integer) returns text[]
language plpgsql set search_path = '' as $$
declare v_result text[];
begin
 if p_value is null or jsonb_typeof(p_value) <> 'array' or jsonb_array_length(p_value) > p_max
  or exists(select 1 from jsonb_array_elements(p_value) e where jsonb_typeof(e) <> 'string' or char_length(btrim(e #>> '{}')) not between 1 and p_length)
  or jsonb_array_length(p_value) <> (select count(distinct btrim(e)) from jsonb_array_elements_text(p_value) e)
 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 select coalesce(array_agg(distinct btrim(e) order by btrim(e)), '{}') into v_result from jsonb_array_elements_text(p_value) e;
 return v_result;
end;
$$;
create function toon_private.toon_valid_source_url(p_url text) returns boolean
language sql immutable set search_path = '' as $$
 select p_url is not null and char_length(p_url) <= 2048 and p_url ~ '^https://[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(/[^[:space:]#]*)?$'
 and p_url !~ '[[:cntrl:]]' and p_url !~ '^https://(localhost|[^/]+\.local|[^/]+\.internal)(/|$)';
$$;
create function toon_private.toon_assert_official_link(p_platform uuid,p_url text,p_days smallint[]) returns void
language plpgsql set search_path = '' as $$
declare v_host text;
begin
 v_host := substring(p_url from '^https://([a-z0-9.-]+)(?:/|$)');
 if p_url is null or char_length(p_url) > 2048 or p_url !~ '^https://[a-z0-9.-]+(/[^[:space:]#]*)?$' or p_url ~ '[[:cntrl:]]'
  or not exists(select 1 from public.toon_platforms where id = p_platform and active and v_host = any(approved_hosts))
  or p_url ~ '[?&](utm_source|utm_medium|utm_campaign|utm_term|utm_content|gclid|fbclid)='
  or p_url ~ '[?&][^=&]*[^A-Za-z0-9_.?&=-][^=&]*='
  or p_days is null or cardinality(p_days) > 7 or cardinality(p_days) <> (select count(distinct d) from unnest(p_days) d)
  or exists(select 1 from unnest(p_days) d where d is null or d not between 0 and 6)
 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
end;
$$;
create function toon_private.toon_refresh_work_search(p_id uuid) returns void
language sql set search_path = '' as $$
 update public.toon_works w set search_text = lower(regexp_replace(
  w.title || ' ' || array_to_string(w.aliases,' ') || ' ' ||
  coalesce((select string_agg(c.name || ' ' || array_to_string(c.aliases,' '),' ') from public.toon_work_creators r join public.toon_creators c on c.id = r.creator_id where r.work_id = w.id),''),
  '[[:space:]]+',' ','g')) where w.id = p_id;
$$;
create function toon_private.toon_audit_catalogue(p_action text,p_id uuid,p_reason text,p_before jsonb,p_after jsonb) returns void
language sql set search_path = '' as $$
 insert into toon_private.toon_admin_audit_logs(actor_id,action,target_type,target_id,reason,before_summary,after_summary)
 values(auth.uid(),p_action,case when p_action = 'review_submission' then 'submission' else 'work' end,p_id,p_reason,p_before,p_after);
$$;
create function public.toon_admin_upsert_work(p_id uuid,p_expected_version bigint,p_payload jsonb,p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_id uuid := coalesce(p_id,gen_random_uuid()); v_old public.toon_works;
 v_item jsonb; v_creator uuid; v_genres text[]; v_days smallint[]; v_link_platform uuid; v_link_id uuid; v_url text; v_urls text[] := '{}'; v_external_keys text[] := '{}';
 v_verified timestamptz; v_fields text[];
begin
 v_uid := toon_private.toon_require_catalogue_admin(); perform toon_private.toon_take_rate('catalogue_write',30,60);
 if p_reason is null or char_length(btrim(p_reason)) not between 2 and 1000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 perform toon_private.toon_assert_keys(p_payload,array['slug','title','aliases','description','serialStatus','ageRating','catalogueStatus','creators','genreIds','links','source']);
 if octet_length(p_payload::text) > 262144 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 if p_id is not null then
  select * into v_old from public.toon_works where id = p_id for update;
  if not found or v_old.catalogue_status = 'merged' then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if p_expected_version is distinct from v_old.version then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
  if p_payload->>'slug' is distinct from v_old.slug then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 end if;
 if char_length(btrim(p_payload->>'title')) not between 1 and 200 or p_payload->>'title' is null
  or p_payload->>'description' is null or char_length(p_payload->>'description') > 2000
  or p_payload->>'slug' is null or p_payload->>'slug' !~ '^[a-z0-9][a-z0-9-]{2,79}$'
  or p_payload->>'serialStatus' is null or p_payload->>'serialStatus' not in ('ongoing','completed','hiatus','unknown')
  or p_payload->>'ageRating' is null or p_payload->>'ageRating' not in ('all','12','15','19','unknown')
  or p_payload->>'catalogueStatus' is null or p_payload->>'catalogueStatus' not in ('draft','published','hidden')
  or (p_payload->>'catalogueStatus' = 'published' and p_payload->>'ageRating' not in ('all','12','15'))
 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 perform toon_private.toon_text_list(p_payload->'aliases',20,200);
 if jsonb_typeof(p_payload->'creators') is distinct from 'array' or jsonb_array_length(p_payload->'creators') > 20
  or jsonb_typeof(p_payload->'links') is distinct from 'array' or jsonb_array_length(p_payload->'links') not between 1 and 20
 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 v_genres := toon_private.toon_text_list(p_payload->'genreIds',12,36);
 if exists(select 1 from unnest(v_genres) g where not exists(select 1 from public.toon_genres where id::text = g and active)) then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 v_item := p_payload->'source'; perform toon_private.toon_assert_keys(v_item,array['url','fields','verifiedAt','note']);
 v_fields := toon_private.toon_text_list(v_item->'fields',8,30); v_verified := (v_item->>'verifiedAt')::timestamptz;
 if not toon_private.toon_valid_source_url(v_item->>'url') or cardinality(v_fields) = 0 or not v_fields <@ array['title','aliases','creators','genres','serialStatus','ageRating','links','description']
  or not array['title','ageRating','links'] <@ v_fields
  or v_verified is null or v_verified > now() or v_item->>'note' is null or char_length(v_item->>'note') > 2000
 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 insert into public.toon_works(id,slug,title,aliases,original_description,serial_status,age_rating,catalogue_status)
 values(v_id,p_payload->>'slug',btrim(p_payload->>'title'),toon_private.toon_text_list(p_payload->'aliases',20,200),p_payload->>'description',
  (p_payload->>'serialStatus')::public.toon_serial_status,(p_payload->>'ageRating')::public.toon_age_rating,(p_payload->>'catalogueStatus')::public.toon_catalogue_status)
 on conflict(id) do update set slug = excluded.slug,title = excluded.title,aliases = excluded.aliases,original_description = excluded.original_description,
  serial_status = excluded.serial_status,age_rating = excluded.age_rating,catalogue_status = excluded.catalogue_status,version = public.toon_works.version + 1;
 delete from public.toon_work_creators where work_id = v_id;
 for v_item in select value from jsonb_array_elements(p_payload->'creators') loop
  perform toon_private.toon_assert_keys(v_item,array['id','name','aliases','role','order']);
  if v_item->>'role' is null or v_item->>'role' not in ('writer','artist','original','studio')
   or v_item->>'order' is null or (v_item->>'order')::integer not between 0 and 99
   or v_item->>'name' is null or char_length(btrim(v_item->>'name')) not between 1 and 100
  then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
  if v_item->>'id' is not null then
   v_creator := (v_item->>'id')::uuid;
   -- Existing creator identity/details may not be silently rewritten by a work edit.
   if not exists(select 1 from public.toon_creators where id = v_creator and name = btrim(v_item->>'name') and aliases = toon_private.toon_text_list(v_item->'aliases',20,100))
   then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
  else
   insert into public.toon_creators(name,aliases) values(btrim(v_item->>'name'),toon_private.toon_text_list(v_item->'aliases',20,100)) returning id into v_creator;
  end if;
  insert into public.toon_work_creators(work_id,creator_id,role,sort_order) values(v_id,v_creator,v_item->>'role',(v_item->>'order')::integer);
 end loop;
 delete from public.toon_work_genres where work_id = v_id;
 insert into public.toon_work_genres(work_id,genre_id) select v_id,g::uuid from unnest(v_genres) g;
 for v_item in select value from jsonb_array_elements(p_payload->'links') loop
  perform toon_private.toon_assert_keys(v_item,array['platformId','url','externalId','weekdays','serialStatus','ageRating','verifiedAt','active']);
  v_link_platform := (v_item->>'platformId')::uuid; v_url := v_item->>'url';
  if jsonb_typeof(v_item->'weekdays') is distinct from 'array' then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
  select coalesce(array_agg(d::smallint),'{}') into v_days from jsonb_array_elements_text(v_item->'weekdays') d;
  perform toon_private.toon_assert_official_link(v_link_platform,v_url,v_days);
  if v_url = any(v_urls) or v_item->>'serialStatus' is null or v_item->>'serialStatus' not in ('ongoing','completed','hiatus','unknown')
   or v_item->>'ageRating' is null or v_item->>'ageRating' not in ('all','12','15','19','unknown')
   or jsonb_typeof(v_item->'active') is distinct from 'boolean' or (v_item->>'verifiedAt')::timestamptz is null
   or (v_item->>'verifiedAt')::timestamptz > now()
   or (v_item->>'externalId' is not null and char_length(v_item->>'externalId') not between 1 and 100)
   or exists(select 1 from public.toon_work_platforms where official_url = v_url and (work_id <> v_id or platform_id <> v_link_platform))
  then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
  v_urls := array_append(v_urls,v_url);
  if v_item->>'externalId' is not null then
   if (v_link_platform::text || ':' || (v_item->>'externalId')) = any(v_external_keys) then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
   v_external_keys := array_append(v_external_keys,v_link_platform::text || ':' || (v_item->>'externalId'));
  end if;
  select id into v_link_id from public.toon_work_platforms
   where work_id = v_id and platform_id = v_link_platform
    and (official_url = v_url or (external_id is not null and external_id = v_item->>'externalId'))
   order by case when official_url = v_url then 0 else 1 end,id limit 1 for update;
  if v_link_id is null then
   -- A concurrent duplicate fails atomically; never update another work's link.
   insert into public.toon_work_platforms(work_id,platform_id,official_url,external_id,weekdays,serial_status,age_rating,verified_at,active)
   values(v_id,v_link_platform,v_url,v_item->>'externalId',v_days,(v_item->>'serialStatus')::public.toon_serial_status,
    (v_item->>'ageRating')::public.toon_age_rating,(v_item->>'verifiedAt')::timestamptz,(v_item->>'active')::boolean);
  else
   -- Changed official URL with the same platform ID keeps its reading preference ID.
   update public.toon_work_platforms set official_url = v_url,external_id = v_item->>'externalId',weekdays = v_days,
    serial_status = (v_item->>'serialStatus')::public.toon_serial_status,age_rating = (v_item->>'ageRating')::public.toon_age_rating,
    verified_at = (v_item->>'verifiedAt')::timestamptz,active = (v_item->>'active')::boolean where id = v_link_id;
  end if;
 end loop;
 -- Preserve IDs referenced by future reading records; removed links become inactive.
 update public.toon_work_platforms set active = false where work_id = v_id and not official_url = any(v_urls);
 insert into toon_private.toon_catalogue_sources(work_id,source_url,verified_fields,verified_at,verified_by,note)
 values(v_id,p_payload->'source'->>'url',v_fields,v_verified,v_uid,p_payload->'source'->>'note');
 perform toon_private.toon_refresh_work_search(v_id);
 if p_payload->>'catalogueStatus' = 'published' and not toon_private.toon_work_public(v_id) then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 perform toon_private.toon_audit_catalogue('upsert_work',v_id,p_reason,jsonb_build_object('title',v_old.title,'version',v_old.version),jsonb_build_object('title',p_payload->>'title','status',p_payload->>'catalogueStatus'));
 return v_id;
end;
$$;

create function toon_private.toon_cover_permitted(p_asset uuid,p_purpose text) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from toon_private.toon_asset_licenses a join public.toon_works w on w.cover_asset_id = a.id
  where a.id = p_asset and a.work_id = w.id and toon_private.toon_work_public(w.id)
  and a.status = 'active' and a.valid_from <= now() and (a.expires_at is null or a.expires_at > now())
  and case p_purpose when 'display' then a.display_allowed when 'og' then a.og_allowed when 'export' then a.export_allowed else false end);
$$;
create function toon_private.toon_work_card(p_id uuid) returns jsonb
language sql stable set search_path = '' as $$
 select jsonb_build_object('id',w.id,'slug',w.slug,'title',w.title,'aliases',w.aliases,
  'serialStatus',w.serial_status,'ageRating',w.age_rating,'createdAt',w.created_at,
  'coverAssetId',case when toon_private.toon_cover_permitted(w.cover_asset_id,'display') then w.cover_asset_id else null end,
  'coverAttribution',coalesce((select attribution from toon_private.toon_asset_licenses a where a.id = w.cover_asset_id and toon_private.toon_cover_permitted(a.id,'display')),''),
  'creators',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'role',r.role) order by r.sort_order,c.name,r.creator_id,r.role)
    from public.toon_work_creators r join public.toon_creators c on c.id = r.creator_id where r.work_id = w.id),'[]'),
  'genres',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'slug',g.slug,'name',g.name) order by g.sort_order)
    from public.toon_work_genres r join public.toon_genres g on g.id = r.genre_id where r.work_id = w.id and g.active),'[]'),
  'platforms',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'code',p.code,'name',p.name) order by p.name) from public.toon_platforms p
    where p.active and exists(select 1 from public.toon_work_platforms l where l.work_id = w.id and l.platform_id = p.id and l.active and l.age_rating in ('all','12','15') and l.verified_at <= now())),'[]'))
 from public.toon_works w where w.id = p_id;
$$;
create function public.toon_search_catalogue(p_q text,p_platforms text[],p_genres text[],p_status text,p_days integer[],p_age text,p_sort text,p_after jsonb,p_limit integer) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '3s' as $$
declare v_result jsonb; v_pattern text;
begin
 if p_q is null or char_length(btrim(p_q)) > 100 or p_limit is null or p_limit not between 1 and 50
  or p_platforms is null or cardinality(p_platforms) > 8 or exists(select 1 from unnest(p_platforms) c where not exists(select 1 from public.toon_platforms where code = c and active))
  or p_genres is null or cardinality(p_genres) > 12 or exists(select 1 from unnest(p_genres) s where not exists(select 1 from public.toon_genres where slug = s and active))
  or (p_status is not null and p_status not in ('ongoing','completed','hiatus','unknown'))
  or p_days is null or cardinality(p_days) > 7 or exists(select 1 from unnest(p_days) d where d is null or d not between 0 and 6)
  or (p_age is not null and p_age not in ('all','12','15')) or p_sort is null or p_sort not in ('latest','title')
 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 if p_after is not null then
  perform toon_private.toon_assert_keys(p_after,array['id','createdAt','title']);
  if p_after->>'id' is null or p_after->>'createdAt' is null or p_after->>'title' is null or char_length(p_after->>'title') > 200
  then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
  perform (p_after->>'id')::uuid; perform (p_after->>'createdAt')::timestamptz;
 end if;
 if toon_private.toon_session_live() then perform toon_private.toon_take_rate('catalogue_search',120,60); end if;
 v_pattern := '%' || replace(replace(replace(lower(regexp_replace(btrim(p_q),'[[:space:]]+',' ','g')),'\','\\'),'%','\%'),'_','\_') || '%';
 with filtered as (
  select w.* from public.toon_works w where toon_private.toon_work_public(w.id) and (p_q = '' or w.search_text like v_pattern)
   and (p_status is null or w.serial_status::text = p_status) and (p_age is null or w.age_rating::text = p_age)
   and (cardinality(p_genres) = 0 or exists(select 1 from public.toon_work_genres r join public.toon_genres g on g.id = r.genre_id where r.work_id = w.id and g.active and g.slug = any(p_genres)))
   and exists(select 1 from public.toon_work_platforms l join public.toon_platforms p on p.id = l.platform_id
    where l.work_id = w.id and l.active and p.active and l.age_rating in ('all','12','15') and l.verified_at <= now()
    and (cardinality(p_platforms) = 0 or p.code = any(p_platforms)) and (cardinality(p_days) = 0 or l.weekdays && p_days::smallint[]))
 ), page as (
  select w.* from filtered w where p_after is null
   or (p_sort = 'latest' and (w.created_at,w.id) < ((p_after->>'createdAt')::timestamptz,(p_after->>'id')::uuid))
   or (p_sort = 'title' and (lower(w.title),w.id) > (lower(p_after->>'title'),(p_after->>'id')::uuid))
  order by case when p_sort = 'latest' then w.created_at end desc,case when p_sort = 'title' then lower(w.title) end asc,
   case when p_sort = 'latest' then w.id end desc,case when p_sort = 'title' then w.id end asc limit p_limit + 1
 ), numbered as (
  select p.*, row_number() over(order by case when p_sort = 'latest' then p.created_at end desc,case when p_sort = 'title' then lower(p.title) end asc,
   case when p_sort = 'latest' then p.id end desc,case when p_sort = 'title' then p.id end asc) as n from page p
 )
 select jsonb_build_object('items',coalesce((select jsonb_agg(toon_private.toon_work_card(id) order by n) from numbered where n <= p_limit),'[]'),
  'total',(select count(*) from filtered),'next',case when (select count(*) from numbered) > p_limit then
   (select jsonb_build_object('id',id,'createdAt',created_at,'title',title) from numbered where n = p_limit) else null end) into v_result;
 return v_result;
end;
$$;
create function public.toon_get_catalogue_detail(p_slug text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_work public.toon_works; v_depth integer := 0;
begin
 if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{2,79}$' then return null; end if;
 select * into v_work from public.toon_works where slug = p_slug;
 if not found then return null; end if;
 while v_work.catalogue_status = 'merged' and v_depth < 8 loop
  select * into v_work from public.toon_works where id = v_work.merged_into_id; v_depth := v_depth + 1;
 end loop;
 if not toon_private.toon_work_public(v_work.id) then return null; end if;
 return toon_private.toon_work_card(v_work.id) || jsonb_build_object('description',v_work.original_description,
  'links',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'platformId',p.id,'platformName',p.name,'platformCode',p.code,
    'url',l.official_url,'weekdays',l.weekdays,'serialStatus',l.serial_status,'ageRating',l.age_rating,'verifiedAt',l.verified_at) order by p.name,l.id)
   from public.toon_work_platforms l join public.toon_platforms p on p.id = l.platform_id where l.work_id = v_work.id and l.active and p.active and l.age_rating in ('all','12','15') and l.verified_at <= now()),'[]'));
end;
$$;
create function public.toon_admin_catalogue_snapshot(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
 perform toon_private.toon_require_catalogue_admin();
 select jsonb_build_object('work',to_jsonb(w),
  'creators',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'aliases',c.aliases,'role',r.role,'order',r.sort_order) order by r.sort_order,c.id) from public.toon_work_creators r join public.toon_creators c on c.id = r.creator_id where r.work_id = w.id),'[]'),
  'genreIds',coalesce((select jsonb_agg(genre_id) from public.toon_work_genres where work_id = w.id),'[]'),
  'links',coalesce((select jsonb_agg(jsonb_build_object('platformId',platform_id,'url',official_url,'externalId',external_id,'weekdays',weekdays,'serialStatus',serial_status,'ageRating',age_rating,'verifiedAt',verified_at,'active',active) order by id) from public.toon_work_platforms where work_id = w.id),'[]'),
  'sources',coalesce((select jsonb_agg(to_jsonb(s) order by s.verified_at desc) from (select * from toon_private.toon_catalogue_sources where work_id = w.id order by verified_at desc,id desc limit 50) s),'[]'),
  'assets',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (select * from toon_private.toon_asset_licenses where work_id = w.id order by created_at desc,id desc limit 50) a),'[]'))
 into v_result from public.toon_works w where id = p_id;
 return v_result;
end;
$$;
create function public.toon_admin_find_duplicates(p_title text,p_urls text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 perform toon_private.toon_require_catalogue_admin(); perform toon_private.toon_take_rate('catalogue_duplicates',60,60);
 if p_title is null or char_length(p_title) > 200 or p_urls is null or cardinality(p_urls) > 20 or exists(select 1 from unnest(p_urls) u where char_length(u) > 2048)
 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 return coalesce((select jsonb_agg(to_jsonb(c)) from (
  select w.id,w.slug,w.title,w.catalogue_status,w.version from public.toon_works w
  where (btrim(p_title) <> '' and (lower(w.title) = lower(btrim(p_title)) or lower(btrim(p_title)) = any(select lower(a) from unnest(w.aliases) a)))
   or exists(select 1 from public.toon_work_platforms l where l.work_id = w.id and l.official_url = any(p_urls))
  order by w.updated_at desc,w.id limit 25
 ) c),'[]');
end;
$$;
create function public.toon_submit_catalogue_suggestion(p_kind text,p_work_id uuid,p_proposal text,p_source_url text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_id uuid;
begin
 v_uid := toon_private.toon_require_current(); perform toon_private.toon_take_rate('catalogue_suggestion',5,60);
 if p_kind is null or p_kind not in ('new_work','correction','broken_link')
  or (p_kind = 'new_work') is distinct from (p_work_id is null)
  or (p_work_id is not null and not toon_private.toon_work_public(p_work_id))
  or p_proposal is null or char_length(btrim(p_proposal)) not between 10 and 5000 or not toon_private.toon_valid_source_url(p_source_url)
 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 insert into public.toon_catalogue_submissions(user_id,kind,work_id,proposal,source_url) values(v_uid,p_kind,p_work_id,btrim(p_proposal),p_source_url) returning id into v_id;
 return v_id;
end;
$$;
create function public.toon_admin_review_submission(p_id uuid,p_status text,p_note text,p_work_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_row public.toon_catalogue_submissions;
begin
 perform toon_private.toon_require_catalogue_admin(); perform toon_private.toon_take_rate('catalogue_write',30,60);
 select * into v_row from public.toon_catalogue_submissions where id = p_id for update;
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
 if v_row.status <> 'pending' then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
 if p_status is null or p_status not in ('accepted','rejected') or p_note is null or char_length(btrim(p_note)) not between 2 and 1000
  or (p_status = 'accepted' and (p_work_id is null or not toon_private.toon_work_public(p_work_id)))
  or (p_status = 'rejected' and p_work_id is not null)
 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 update public.toon_catalogue_submissions set status = p_status,result_note = p_note,result_work_id = p_work_id,reviewed_at = now() where id = p_id;
 perform toon_private.toon_audit_catalogue('review_submission',p_id,p_note,jsonb_build_object('status','pending'),jsonb_build_object('status',p_status,'workId',p_work_id));
end;
$$;

create function public.toon_admin_merge_preview(p_source uuid,p_target uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_source public.toon_works; v_target public.toon_works; v_future boolean;
begin
 perform toon_private.toon_require_catalogue_admin();
 select * into v_source from public.toon_works where id = p_source; select * into v_target from public.toon_works where id = p_target;
 if v_source.id is null or v_target.id is null or p_source = p_target or v_source.catalogue_status = 'merged' or v_target.catalogue_status = 'merged'
 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 -- P3+ must add handlers before merges are allowed after personal domains exist.
 v_future := exists(select 1 from unnest(array['library_entries','library_private_details','user_evaluations','reviews','tier_list_drafts','tier_list_publications','posts']) t where to_regclass('public.toon_' || t) is not null);
 return jsonb_build_object('source',jsonb_build_object('id',v_source.id,'title',v_source.title,'version',v_source.version,'status',v_source.catalogue_status),
  'target',jsonb_build_object('id',v_target.id,'title',v_target.title,'version',v_target.version,'status',v_target.catalogue_status),'blockedByPersonalDomains',v_future,
  'sourceLinkCount',(select count(*) from public.toon_work_platforms where work_id = p_source),
  'sourceGenreCount',(select count(*) from public.toon_work_genres where work_id = p_source),'sourceCoverWillBeRevoked',v_source.cover_asset_id is not null);
end;
$$;
create function public.toon_admin_merge_works(p_source uuid,p_target uuid,p_source_version bigint,p_target_version bigint,p_reason text,p_confirm boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_source public.toon_works; v_target public.toon_works; v_preview jsonb; v_aliases text[];
begin
 perform toon_private.toon_require_catalogue_admin(); perform toon_private.toon_take_rate('catalogue_merge',10,60);
 if p_confirm is distinct from true or p_reason is null or char_length(btrim(p_reason)) not between 2 and 1000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 -- Serialize catalogue merges, and lock both works in stable UUID order.
 perform pg_catalog.pg_advisory_xact_lock(716231);
 perform id from public.toon_works where id in (p_source,p_target) order by id for update;
 v_preview := public.toon_admin_merge_preview(p_source,p_target);
 if (v_preview->>'blockedByPersonalDomains')::boolean then raise exception 'MERGE_REQUIRES_DOMAIN_HANDLERS' using errcode = 'P0001'; end if;
 select * into v_source from public.toon_works where id = p_source; select * into v_target from public.toon_works where id = p_target;
 if p_source_version is distinct from v_source.version or p_target_version is distinct from v_target.version then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
 if v_source.age_rating not in ('all','12','15') or v_target.age_rating not in ('all','12','15') or v_source.is_test or v_target.is_test
 then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
 select array_agg(distinct a order by a) into v_aliases from unnest(v_target.aliases || v_source.aliases || array[v_source.title]) a where a <> v_target.title;
 if cardinality(v_aliases) > 20 then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
 insert into public.toon_work_creators(work_id,creator_id,role,sort_order) select p_target,creator_id,role,sort_order from public.toon_work_creators where work_id = p_source on conflict do nothing;
 insert into public.toon_work_genres(work_id,genre_id) select p_target,genre_id from public.toon_work_genres where work_id = p_source on conflict do nothing;
 update public.toon_work_platforms set work_id = p_target where work_id = p_source;
 update toon_private.toon_catalogue_sources set work_id = p_target where work_id = p_source;
 update public.toon_catalogue_submissions set work_id = p_target where work_id = p_source;
 update public.toon_catalogue_submissions set result_work_id = p_target where result_work_id = p_source;
 update toon_private.toon_asset_licenses set status = 'revoked' where work_id = p_source;
 update public.toon_works set catalogue_status = 'merged',merged_into_id = p_target,cover_asset_id = null,version = version + 1 where id = p_source;
 update public.toon_works set aliases = coalesce(v_aliases,'{}'),age_rating = case when v_source.age_rating::text = '15' or v_target.age_rating::text = '15' then '15'::public.toon_age_rating
  when v_source.age_rating::text = '12' or v_target.age_rating::text = '12' then '12'::public.toon_age_rating else 'all'::public.toon_age_rating end,version = version + 1 where id = p_target;
 perform toon_private.toon_refresh_work_search(p_target);
 perform toon_private.toon_audit_catalogue('merge_work',p_source,p_reason,v_preview,jsonb_build_object('mergedInto',p_target));
end;
$$;

create function public.toon_admin_begin_cover(p_work_id uuid,p_license jsonb,p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_id uuid := gen_random_uuid(); v_path text; v_from timestamptz; v_until timestamptz;
begin
 v_uid := toon_private.toon_require_catalogue_admin(); perform toon_private.toon_take_rate('catalogue_asset',10,60);
 perform id from public.toon_works where id = p_work_id and catalogue_status <> 'merged' for update;
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
 perform toon_private.toon_assert_keys(p_license,array['rightsHolder','evidence','display','og','export','commercial','attribution','validFrom','expiresAt']);
 v_from := (p_license->>'validFrom')::timestamptz; v_until := (p_license->>'expiresAt')::timestamptz;
 if p_reason is null or char_length(btrim(p_reason)) not between 2 and 1000
  or p_license->>'rightsHolder' is null or char_length(btrim(p_license->>'rightsHolder')) not between 1 and 200
  or p_license->>'evidence' is null or char_length(btrim(p_license->>'evidence')) not between 1 and 2000
  or p_license->>'attribution' is null or char_length(p_license->>'attribution') > 500
  or v_from is null or (v_until is not null and v_until <= v_from)
  or jsonb_typeof(p_license->'display') is distinct from 'boolean' or jsonb_typeof(p_license->'og') is distinct from 'boolean'
  or jsonb_typeof(p_license->'export') is distinct from 'boolean' or jsonb_typeof(p_license->'commercial') is distinct from 'boolean'
 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 v_path := p_work_id::text || '/' || v_id::text || '.webp';
 insert into toon_private.toon_asset_licenses(id,work_id,storage_path,rights_holder,evidence_reference,display_allowed,og_allowed,export_allowed,commercial_allowed,attribution,valid_from,expires_at,verified_by)
 values(v_id,p_work_id,v_path,btrim(p_license->>'rightsHolder'),p_license->>'evidence',(p_license->>'display')::boolean,(p_license->>'og')::boolean,
  (p_license->>'export')::boolean,(p_license->>'commercial')::boolean,p_license->>'attribution',v_from,v_until,v_uid);
 perform toon_private.toon_audit_catalogue('stage_cover',p_work_id,p_reason,null,jsonb_build_object('assetId',v_id));
 return jsonb_build_object('id',v_id,'path',v_path);
end;
$$;
create function public.toon_admin_activate_cover(p_id uuid,p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_asset toon_private.toon_asset_licenses;
begin
 perform toon_private.toon_require_catalogue_admin();
 select * into v_asset from toon_private.toon_asset_licenses where id = p_id;
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
 -- All cover/merge operations lock the work before its licenses.
 perform id from public.toon_works where id = v_asset.work_id for update;
 select * into v_asset from toon_private.toon_asset_licenses where id = p_id for update;
 if not found or v_asset.status <> 'staged' then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
 if p_reason is null or char_length(btrim(p_reason)) not between 2 and 1000 or not exists(
  select 1 from storage.objects where bucket_id = 'toon_licensed_covers' and name = v_asset.storage_path and metadata->>'mimetype' = 'image/webp')
 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 perform id from public.toon_works where id = v_asset.work_id and catalogue_status <> 'merged' for update;
 if not found then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
 update toon_private.toon_asset_licenses set status = 'active' where id = p_id;
 update public.toon_works set cover_asset_id = p_id,version = version + 1 where id = v_asset.work_id;
 perform toon_private.toon_audit_catalogue('activate_cover',v_asset.work_id,p_reason,null,jsonb_build_object('assetId',p_id));
end;
$$;
create function public.toon_admin_revoke_cover(p_id uuid,p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_asset toon_private.toon_asset_licenses;
begin
 perform toon_private.toon_require_catalogue_admin();
 if p_reason is null or char_length(btrim(p_reason)) not between 2 and 1000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
 select * into v_asset from toon_private.toon_asset_licenses where id = p_id;
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
 perform id from public.toon_works where id = v_asset.work_id for update;
 select * into v_asset from toon_private.toon_asset_licenses where id = p_id for update;
 if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
 update toon_private.toon_asset_licenses set status = 'revoked' where id = p_id;
 update public.toon_works set cover_asset_id = null,version = version + 1 where id = v_asset.work_id and cover_asset_id = p_id;
 perform toon_private.toon_audit_catalogue('revoke_cover',v_asset.work_id,p_reason,jsonb_build_object('assetId',p_id),null);
end;
$$;
create function public.toon_get_cover_access(p_asset uuid,p_purpose text) returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('path',storage_path,'attribution',attribution,'commercialAllowed',commercial_allowed)
 from toon_private.toon_asset_licenses where id = p_asset and toon_private.toon_cover_permitted(p_asset,p_purpose);
$$;
create function public.toon_admin_catalogue_audit() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 perform toon_private.toon_require_catalogue_admin();
 return coalesce((select jsonb_agg(to_jsonb(a)) from (select * from toon_private.toon_admin_audit_logs order by created_at desc,id desc limit 50) a),'[]');
end;
$$;
revoke execute on all functions in schema toon_private from public,anon,authenticated;
-- Restore the P1 policy helpers, without granting direct private schema access.
grant execute on function toon_private.toon_session_live(),toon_private.toon_profile_visible(uuid),toon_private.toon_current_active(),toon_private.toon_catalogue_admin(),toon_private.toon_work_public(uuid) to anon,authenticated;
revoke execute on function public.toon_get_my_catalogue_role(),public.toon_search_catalogue(text,text[],text[],text,integer[],text,text,jsonb,integer),
 public.toon_get_catalogue_detail(text),public.toon_admin_upsert_work(uuid,bigint,jsonb,text),public.toon_admin_catalogue_snapshot(uuid),
 public.toon_admin_find_duplicates(text,text[]),public.toon_submit_catalogue_suggestion(text,uuid,text,text),public.toon_admin_review_submission(uuid,text,text,uuid),
 public.toon_admin_merge_preview(uuid,uuid),public.toon_admin_merge_works(uuid,uuid,bigint,bigint,text,boolean),
 public.toon_admin_begin_cover(uuid,jsonb,text),public.toon_admin_activate_cover(uuid,text),public.toon_admin_revoke_cover(uuid,text),
 public.toon_get_cover_access(uuid,text),public.toon_admin_catalogue_audit() from public,anon,authenticated;
grant execute on function public.toon_search_catalogue(text,text[],text[],text,integer[],text,text,jsonb,integer),public.toon_get_catalogue_detail(text),public.toon_get_cover_access(uuid,text) to anon,authenticated;
grant execute on function public.toon_get_my_catalogue_role(),public.toon_admin_upsert_work(uuid,bigint,jsonb,text),public.toon_admin_catalogue_snapshot(uuid),
 public.toon_admin_find_duplicates(text,text[]),public.toon_submit_catalogue_suggestion(text,uuid,text,text),public.toon_admin_review_submission(uuid,text,text,uuid),
 public.toon_admin_merge_preview(uuid,uuid),public.toon_admin_merge_works(uuid,uuid,bigint,bigint,text,boolean),
 public.toon_admin_begin_cover(uuid,jsonb,text),public.toon_admin_activate_cover(uuid,text),public.toon_admin_revoke_cover(uuid,text),public.toon_admin_catalogue_audit() to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('toon_licensed_covers','toon_licensed_covers',false,2097152,array['image/webp']);
create policy toon_covers_server_read on storage.objects as restrictive for select to anon,authenticated using(bucket_id <> 'toon_licensed_covers');
create policy toon_covers_server_insert on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id <> 'toon_licensed_covers');
create policy toon_covers_server_update on storage.objects as restrictive for update to anon,authenticated using(bucket_id <> 'toon_licensed_covers') with check(bucket_id <> 'toon_licensed_covers');
create policy toon_covers_server_delete on storage.objects as restrictive for delete to anon,authenticated using(bucket_id <> 'toon_licensed_covers');
commit;
