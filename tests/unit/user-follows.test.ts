import { describe,expect,it } from "vitest";
import { followAccessSchema,followInputSchema,followListInputSchema,followListSchema,followStateSchema } from "@/lib/social/model";
const id="32000000-0000-4000-8000-000000000001";
const profile={id,username:"reader_one",name:"독자",avatarPath:null};
const state={...profile,followerCount:0,followingCount:1,following:false,canFollow:true,isSelf:false};
describe("public follow contracts (written only)",()=>{
 it("accepts explicit desired states and rejects injected actor, counts or string booleans",()=>{
  expect(followInputSchema.parse({id,following:false})).toEqual({id,following:false});
  for (const bad of [{id,following:"true"},{id,following:1},{id,following:true,followerId:id},{id,following:true,followerCount:99},{following:true},{id:"invalid",following:true}])
   expect(followInputSchema.safeParse(bad).success).toBe(false);
 });
 it("validates route usernames and bounded literal list inputs",()=>{
  expect(followAccessSchema.safeParse({username:"reader_one"}).success).toBe(true);
  for (const username of ["../admin","Reader","ab","admin"]) expect(followAccessSchema.safeParse({username}).success).toBe(false);
  for (const bad of [{username:"reader_one",kind:"likes",page:1},{username:"reader_one",kind:"followers",page:0},{username:"reader_one",kind:"following",page:1001},{username:"reader_one",kind:"following",page:1,userId:id}])
   expect(followListInputSchema.safeParse(bad).success).toBe(false);
 });
 it("requires real counts, filters extra private fields and respects Unicode display names",()=>{
  expect(followStateSchema.parse({...state,email:"private@example.test",privateMemo:"secret"})).toEqual(state);
  expect(followStateSchema.safeParse({...state,name:"😀".repeat(30)}).success).toBe(true);
  for (const followerCount of [undefined,null,-1,0.5,"3",Number.MAX_SAFE_INTEGER+1]) expect(followStateSchema.safeParse({...state,followerCount}).success).toBe(false);
  expect(followStateSchema.safeParse({...state,isSelf:true,canFollow:true}).success).toBe(false);
  expect(followStateSchema.safeParse({...state,isSelf:true,canFollow:false,following:true}).success).toBe(false);
 });
 it("keeps only public profile fields in lists and rejects inconsistent counts",()=>{
  const list={profile:state,kind:"following",page:1,total:1,hasNext:false,items:[{...profile,role:"admin",email:"secret"}],blocks:[id]};
  const result=followListSchema.parse(list);
  expect(result.items).toEqual([profile]);expect(result).not.toHaveProperty("blocks");
  expect(followListSchema.safeParse({...list,total:10}).success).toBe(false);
  expect(followListSchema.safeParse({...list,items:Array.from({length:21},()=>profile)}).success).toBe(false);
 });
});
