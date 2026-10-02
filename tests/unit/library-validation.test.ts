// @vitest-environment node
import { describe,expect,it } from "vitest";
import { recordPayloadSchema,parseLibraryFilters,selectionSchema,parsePage,parsePublicLibraryFilters,publicLibraryFiltersSchema,publicLibraryUrl } from "@/lib/library/model";
const payload = {status:"reading",libraryVisibility:"private",evaluationVisibility:"public",ratingSteps:9,canonicalTier:"A",episode:0,startedOn:"2026-10-01",finishedOn:null,note:"",tags:[],preferredLink:null};
describe("reading input boundaries",()=>{
 it("allows independent visibility and half-star steps",()=>{
  expect(recordPayloadSchema.safeParse(payload).success).toBe(true);
  expect(recordPayloadSchema.safeParse({...payload,ratingSteps:0}).success).toBe(false);
  expect(recordPayloadSchema.safeParse({...payload,ratingSteps:2.5}).success).toBe(false);
 });
 it("requires an actual reading state for rating or tier",()=>{
  expect(recordPayloadSchema.safeParse({...payload,status:"planned"}).success).toBe(false);
  expect(recordPayloadSchema.safeParse({...payload,status:"planned",ratingSteps:null,canonicalTier:null}).success).toBe(true);
 });
 it("rejects forged ownership and invalid progress dates",()=>{
  expect(recordPayloadSchema.safeParse({...payload,userId:"victim"}).success).toBe(false);
  expect(recordPayloadSchema.safeParse({...payload,finishedOn:"2026-09-01"}).success).toBe(false);
  expect(recordPayloadSchema.safeParse({...payload,episode:-1}).success).toBe(false);
 });
 it("bounds Unicode notes and unique private tags",()=>{
  expect(recordPayloadSchema.safeParse({...payload,note:"😀".repeat(5000),tags:["😀".repeat(20)]}).success).toBe(true);
  expect(recordPayloadSchema.safeParse({...payload,note:"😀".repeat(5001)}).success).toBe(false);
  expect(recordPayloadSchema.safeParse({...payload,tags:["좋아함","좋아함"]}).success).toBe(false);
 });
 it("rejects repeated scalar filters, fractional ratings and unbounded pages",()=>{
  expect(()=>parseLibraryFilters({rating:"2.5"})).toThrow();
  expect(()=>parseLibraryFilters({q:["one","two"]})).toThrow();
  expect(()=>parsePage("1001")).toThrow();
  expect(parseLibraryFilters({q:"100%_작품"}).q).toBe("100%_작품");
 });
 it("rejects duplicate work selection and missing record versions",()=>{
  const selection = {id:"10000000-0000-4000-8000-000000000001",version:1};
  expect(selectionSchema.safeParse([selection,selection]).success).toBe(false);
  expect(selectionSchema.safeParse([{id:selection.id}]).success).toBe(false);
 });
});
describe("public library search boundaries",()=>{
 it("rejects private fields and private activity sorting",()=>{
  for (const key of ["tag","note","episode","startedOn","finishedOn","preferredLink","userId"]) {
   expect(()=>parsePublicLibraryFilters({[key]:"private-value"})).toThrow();
  }
  for (const sort of ["updated","added"]) expect(()=>parsePublicLibraryFilters({sort})).toThrow();
  expect(publicLibraryFiltersSchema.safeParse({...parsePublicLibraryFilters({}),tag:"private-tag"}).success).toBe(false);
 });
 it("rejects repeated scalars, invalid ratings and oversized Unicode searches",()=>{
  expect(()=>parsePublicLibraryFilters({status:["reading","completed"]})).toThrow();
  for (const rating of ["0","11","2.5","1e1","01"]) expect(()=>parsePublicLibraryFilters({rating})).toThrow();
  expect(()=>parsePublicLibraryFilters({q:"😀".repeat(101)})).toThrow();
  expect(parsePublicLibraryFilters({q:"😀".repeat(100),rating:"10",tier:"S"}).rating).toBe(10);
 });
 it("preserves all public filters through pagination and encodes literal search text",()=>{
  const filters = parsePublicLibraryFilters({q:"  하늘 & 100%_  ",status:"completed",platform:"naver_webtoon",genre:"fantasy",rating:"9",tier:"A",sort:"rating"});
  const url = new URL(publicLibraryUrl("reader_1",filters,3),"https://example.test");
  expect(url.pathname).toBe("/u/reader_1/library");
  expect(url.searchParams.get("page")).toBe("3");
  expect(parsePublicLibraryFilters(Object.fromEntries(url.searchParams))).toEqual(filters);
  expect(new URL(publicLibraryUrl("reader_1",filters),"https://example.test").searchParams.has("page")).toBe(false);
 });
});
