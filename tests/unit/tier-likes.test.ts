import { describe,expect,it } from "vitest";
import { likeInputSchema,likeStateSchema } from "@/lib/tiers/like-model";
import { publicationSchema } from "@/lib/tiers/publication-model";
const id="20000000-0000-4000-8000-000000000001";
describe("tier like contracts",()=>{
 it("accepts an explicit desired boolean and rejects actor/count/token injection",()=>{
  const input={id,version:2,liked:true};expect(likeInputSchema.parse(input)).toEqual(input);
  expect(likeInputSchema.parse({...input,liked:false}).liked).toBe(false);
  for (const invalid of [{...input,liked:"true"},{...input,liked:1},{...input,version:0},{...input,userId:id},{...input,likeCount:100},{...input,token:"secret"}])
   expect(likeInputSchema.safeParse(invalid).success).toBe(false);
 });
 it("requires a real nonnegative count and strips liker identities/private fields",()=>{
  const state={id,version:2,liked:true,canLike:true,likeCount:3,likers:["private-user"],token:"secret"};
  expect(likeStateSchema.parse(state)).toEqual({id,version:2,liked:true,canLike:true,likeCount:3});
  for (const count of [undefined,null,-1,0.5,"3",Number.MAX_SAFE_INTEGER+1]) expect(likeStateSchema.safeParse({...state,likeCount:count}).success).toBe(false);
 });
 it("keeps link-publication counts unavailable and does not synthesize zero for old DTOs",()=>{
  const publication={id,version:2,publishedVersion:1,publishedAt:"2026-10-04T00:00:00Z",authorId:id,username:"author",name:"작가",isSpoiler:true,body:null};
  expect(publicationSchema.safeParse(publication).success).toBe(false);
  expect(publicationSchema.parse({...publication,likeCount:null}).likeCount).toBeNull();
  expect(publicationSchema.parse({...publication,likeCount:0}).body).toBeNull();
 });
});
