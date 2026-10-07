import { describe,expect,it } from "vitest";
import { parseTierDiscovery,tierDiscoveryUrl } from "@/lib/tiers/discovery-model";
import { publicTierCardSchema,publicTierDiscoveryCardSchema } from "@/lib/tiers/publication-model";
const id="20000000-0000-4000-8000-000000000001";
const card={id,version:2,publishedVersion:1,publishedAt:"2026-10-05T00:00:00Z",authorId:id,username:"author",name:"작가",isSpoiler:false,title:"공개 표",tags:["판타지"],likeCount:3,recentLikeCount:1,recentCommenterCount:2,popularityScore:5};
describe("tier discovery boundaries",()=>{
 it("defaults to latest and preserves literal case/spacing and Unicode code points",()=>{
  expect(parseTierDiscovery({})).toEqual({filters:{sort:"latest",tag:null},page:1});
  expect(parseTierDiscovery({sort:"",tag:""})).toEqual({filters:{sort:"latest",tag:null},page:1});
  expect(parseTierDiscovery({sort:"popular",tag:" Fantasy ",page:"2"})).toEqual({filters:{sort:"popular",tag:" Fantasy "},page:2});
  expect(parseTierDiscovery({tag:"😀".repeat(20)}).filters.tag).toBe("😀".repeat(20));
  expect(()=>parseTierDiscovery({tag:"😀".repeat(21)})).toThrow();
 });
 it("rejects duplicate and unsupported filters, pages and reveal/counter injection",()=>{
  for(const query of [{sort:["latest","popular"]},{tag:["a","b"]},{page:["1","2"]},{sort:"rating"},{page:"0"},{page:"01"},{page:"1001"},{page:"1.5"},{token:"secret"},{reveal:"true"},{userId:id},{likeCount:"100"},{recentCommenterCount:"100"},{popularityScore:"100"}])
   expect(()=>parseTierDiscovery(query)).toThrow();
 });
 it("keeps filters on page changes and resets a changed tag to the first page",()=>{
  const filters={sort:"popular" as const,tag:"판타지 & 100%_?"};
  const url=new URL(tierDiscoveryUrl(filters,3),"https://example.test");
  expect(url.pathname).toBe("/tiers");expect(url.searchParams.get("sort")).toBe("popular");expect(url.searchParams.get("tag")).toBe(filters.tag);expect(url.searchParams.get("page")).toBe("3");
  expect(new URL(tierDiscoveryUrl({...filters,tag:"Fantasy"}),url).searchParams.has("page")).toBe(false);
  expect(tierDiscoveryUrl({sort:"latest",tag:null})).toBe("/tiers");expect(()=>tierDiscoveryUrl(filters,1001)).toThrow();
 });
 it("requires computed counts and rejects spoiler metadata while stripping unrelated data",()=>{
  expect(publicTierDiscoveryCardSchema.parse({...card,body:{title:"private"},likers:["private-member"],commenters:["private-member"],token:"secret"})).toEqual(card);
  expect(publicTierDiscoveryCardSchema.parse({...card,isSpoiler:true,title:null,tags:null}).tags).toBeNull();
  for(const invalid of [{...card,isSpoiler:true},{...card,isSpoiler:true,title:null},{...card,tags:null},{...card,likeCount:undefined},{...card,recentLikeCount:undefined},{...card,recentLikeCount:4},
   {...card,recentCommenterCount:undefined},{...card,popularityScore:undefined},{...card,recentCommenterCount:-1},{...card,recentCommenterCount:1.5},
   {...card,popularityScore:6},{...card,popularityScore:Number.MAX_SAFE_INTEGER+1}])
   expect(publicTierDiscoveryCardSchema.safeParse(invalid).success).toBe(false);
 });
 it("accepts genuinely empty counts and rejects inconsistent totals even with no recent likes",()=>{
  expect(publicTierDiscoveryCardSchema.parse({...card,likeCount:0,recentLikeCount:0,recentCommenterCount:0,popularityScore:0}).popularityScore).toBe(0);
  expect(publicTierDiscoveryCardSchema.parse({...card,recentLikeCount:0,recentCommenterCount:4,popularityScore:8}).recentCommenterCount).toBe(4);
  expect(publicTierDiscoveryCardSchema.safeParse({...card,recentLikeCount:0,recentCommenterCount:4,popularityScore:4}).success).toBe(false);
 });
 it("keeps the featured-card contract independent from discovery-only metrics",()=>{
  const {recentCommenterCount,popularityScore,...featured}=card;
  expect(recentCommenterCount).toBe(2);expect(popularityScore).toBe(5);
  expect(publicTierCardSchema.parse(featured)).toEqual(featured);
  expect(publicTierDiscoveryCardSchema.safeParse(featured).success).toBe(false);
 });
});
