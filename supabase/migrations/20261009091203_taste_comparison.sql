-- DISC-01/05, SOC-06: a viewer's own evaluations vs one visible public profile.
-- Additive RPC only. No shared Auth, baseline, table grants or default ACL changes.
begin;
set local lock_timeout = '3s';

-- Explicit authorization is needed for a bounded projection across independent
-- library/evaluation visibility. Never accepts a caller-supplied viewer identity.
create function public.toon_compare_taste(p_username text,p_section text,p_page integer) returns jsonb
language plpgsql stable security definer set search_path='' set statement_timeout='5s' as $$
declare v_uid uuid:=auth.uid();v_target public.toon_profiles;v_result jsonb;
begin
 if not toon_private.toon_session_live() then raise exception 'AUTH_REQUIRED' using errcode='P0001';end if;
 if not toon_private.toon_current_active() then raise exception 'FORBIDDEN' using errcode='P0001';end if;
 if p_username is null or p_username !~ '^[a-z0-9_]{3,20}$'
  or p_username in ('admin','auth','api','support','settings','onboarding','toonshelf','system','moderator')
  or p_section is null or p_section not in ('all','common_s','different')
  or p_page is null or p_page not between 1 and 1000 then raise exception 'VALIDATION_ERROR' using errcode='P0001';end if;
 select * into v_target from public.toon_profiles where username=p_username and toon_private.toon_profile_visible(id);
 if not found then return null;end if;
 if v_target.id=v_uid then raise exception 'SELF_COMPARE' using errcode='P0001';end if;
 -- discovery_opt_in governs recommendation candidates, not a requested profile.
 -- Both library statuses may be private; neither status is exposed by this RPC.
 with pairs as materialized (
  select w.id,w.slug,w.title,m.canonical_tier my_tier,o.canonical_tier other_tier,
   m.rating_steps my_rating,o.rating_steps other_rating,
   case when m.canonical_tier is not null and o.canonical_tier is not null then 'tier' else 'rating' end signal
  from public.toon_user_evaluations m
  join public.toon_user_evaluations o on o.work_id=m.work_id and o.user_id=v_target.id and o.visibility='public'
  join public.toon_library_entries ml on ml.user_id=m.user_id and ml.work_id=m.work_id and ml.status<>'planned'
  join public.toon_library_entries ol on ol.user_id=o.user_id and ol.work_id=o.work_id and ol.status<>'planned'
  join public.toon_works w on w.id=m.work_id
  where m.user_id=v_uid and toon_private.toon_work_public(w.id)
   and ((m.canonical_tier is not null and o.canonical_tier is not null) or (m.rating_steps is not null and o.rating_steps is not null))
 ), normalized as (
  select *,case when signal='tier' then
    abs(array_position(array['F','D','C','B','A','S'],my_tier::text)-array_position(array['F','D','C','B','A','S'],other_tier::text))/5.0
   else abs(my_rating-other_rating)/9.0 end difference from pairs
 ), compared as materialized (
  select *,jsonb_build_object('work',jsonb_build_object('id',id,'slug',slug,'title',title),'signal',signal,'difference',difference)||
   case when signal='tier' then jsonb_build_object('mine',my_tier,'other',other_tier)
    else jsonb_build_object('mine',my_rating,'other',other_rating) end card from normalized
 ), summary as (
  select count(*) n,count(*) filter(where signal='tier') tiers,count(*) filter(where signal='rating') ratings,
   count(*) filter(where signal='tier' and my_tier='S' and other_tier='S') common_s,
   count(*) filter(where difference>=0.4) different,
   case when count(*)>=5 then greatest(0,least(100,round(100*(1-avg(difference))))) else null end similarity
  from compared
 ), selected as (
  select * from compared where p_section='all' or (p_section='common_s' and signal='tier' and my_tier='S' and other_tier='S')
   or (p_section='different' and difference>=0.4)
 ), page as (
  select * from selected order by case when p_section='different' then difference else 0 end desc,title collate "C",id
  limit 20 offset (p_page-1)*20
 ) select jsonb_build_object(
  'profile',jsonb_build_object('id',v_target.id,'username',v_target.username,'name',v_target.display_name),
  'commonCount',s.n,'tierCount',s.tiers,'ratingCount',s.ratings,'commonSCount',s.common_s,'differentCount',s.different,
  'similarity',s.similarity,'confidence',s.n::numeric/(s.n+10),
  'section',p_section,'page',p_page,
  'hasNext',(case p_section when 'common_s' then s.common_s when 'different' then s.different else s.n end)>p_page*20,
  'items',coalesce((select jsonb_agg(card order by case when p_section='different' then difference else 0 end desc,title collate "C",id) from page),'[]'::jsonb)
 ) into v_result from summary s;
 return v_result;
end;$$;
revoke all on function public.toon_compare_taste(text,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.toon_compare_taste(text,text,integer) to authenticated;
commit;
