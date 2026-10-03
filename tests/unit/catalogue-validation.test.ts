// @vitest-environment node
import { describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
import { canonicalOfficialUrl,catalogueRatingSchema,filterUrl,parseFilters,ratingCursorPositionSchema,suggestionSchema,workPayloadSchema } from "@/lib/catalogue/model";
import { readCursor,writeCursor } from "@/lib/catalogue/cursor";
const platform = {approved_hosts:["comic.naver.com"]};
const payload = {
  slug:"sample-work",title:"테스트 작품",aliases:[],description:"직접 쓴 소개",serialStatus:"ongoing",ageRating:"all",catalogueStatus:"published",creators:[],genreIds:[],
  links:[{platformId:"10000000-0000-4000-8000-000000000001",url:"https://comic.naver.com/webtoon/list?titleId=123",externalId:"123",weekdays:[1],serialStatus:"ongoing",ageRating:"all",verifiedAt:"2020-01-01T00:00:00Z",active:true}],
  source:{url:"https://example.test/source",fields:["title","ageRating","links"],verifiedAt:"2020-01-01T00:00:00Z",note:""}
};
describe("catalogue input boundaries",()=>{
  it("removes only documented tracking keys and fragments",()=>{
    expect(canonicalOfficialUrl("https://comic.naver.com/webtoon/list?titleId=123&utm_source=x&sort=ASC#read",platform)).toBe("https://comic.naver.com/webtoon/list?titleId=123&sort=ASC");
  });
  it.each(["http://comic.naver.com/x","https://comic.naver.com.evil.test/x","https://comic.naver.com@evil.test/x","https://comic.naver.com:8443/x","https://127.0.0.1/x","https://comic.naver.com/x\n"])("rejects unapproved official URLs: %s",url=>{
    expect(()=>canonicalOfficialUrl(url,platform)).toThrow();
  });
  it("keeps percent and underscore search characters literal for the RPC",()=>{
    expect(parseFilters({q:"  100%_완독  "}).q).toBe("100%_완독");
  });
  it("rejects adult/unknown filters, repeated scalar fields and invalid days",()=>{
    expect(()=>parseFilters({age:"19"})).toThrow();
    expect(()=>parseFilters({q:["first","second"]})).toThrow();
    expect(()=>parseFilters({day:"-1"})).toThrow();
    expect(()=>parseFilters({sort:"popular"})).toThrow();
    expect(()=>parseFilters({sort:["rating","latest"]})).toThrow();
  });
  it("deduplicates multi-select values and bounds Unicode search length",()=>{
    expect(parseFilters({platform:["ridi","ridi"]}).platform).toEqual(["ridi"]);
    expect(()=>parseFilters({q:"😀".repeat(100)})).not.toThrow();
    expect(()=>parseFilters({q:"😀".repeat(101)})).toThrow();
  });
  it("cannot publish unverified/adult works or save without required source fields",()=>{
    expect(workPayloadSchema.safeParse(payload).success).toBe(true);
    expect(workPayloadSchema.safeParse({...payload,ageRating:"19"}).success).toBe(false);
    expect(workPayloadSchema.safeParse({...payload,ageRating:"unknown"}).success).toBe(false);
    expect(workPayloadSchema.safeParse({...payload,source:{...payload.source,fields:["title"]}}).success).toBe(false);
  });
  it("rejects future verification, duplicate links and role fields in payload",()=>{
    expect(workPayloadSchema.safeParse({...payload,links:[...payload.links,...payload.links]}).success).toBe(false);
    expect(workPayloadSchema.safeParse({...payload,links:[payload.links[0],{...payload.links[0],url:"https://comic.naver.com/webtoon/list?titleId=456"}]}).success).toBe(false);
    expect(workPayloadSchema.safeParse({...payload,isAdmin:true}).success).toBe(false);
    expect(workPayloadSchema.safeParse({...payload,source:{...payload.source,verifiedAt:"2999-01-01T00:00:00Z"}}).success).toBe(false);
  });
  it("requires a work for corrections and forbids private/unsafe source addresses",()=>{
    expect(suggestionSchema.safeParse({kind:"correction",workId:null,proposal:"정정할 내용을 충분히 입력했어요.",sourceUrl:"https://example.test/source"}).success).toBe(false);
    expect(suggestionSchema.safeParse({kind:"new_work",workId:null,proposal:"추가할 작품과 정보를 입력했어요.",sourceUrl:"https://localhost/source"}).success).toBe(false);
  });
  it("binds cursor positions to the same search/filter set",()=>{
    const filters = parseFilters({q:"작품",platform:"ridi"});
    const position = {id:"10000000-0000-4000-8000-000000000001",createdAt:"2020-01-01T00:00:00Z",title:"작품"};
    const cursor = writeCursor(position,filters);
    expect(readCursor(cursor,filters)).toEqual(position);
    expect(()=>readCursor(cursor,parseFilters({q:"다른 작품",platform:"ridi"}))).toThrow();
    expect(()=>readCursor("x".repeat(3000),filters)).toThrow();
  });
  it("preserves every filter and rating sort while starting a new search on page one",()=>{
    const filters = parseFilters({q:"작품 %_",sort:"rating",platform:["ridi","naver_webtoon"],genre:"fantasy",status:"ongoing",day:["1","2"],age:"15"});
    const query = new URL(filterUrl(filters,"old-page"),"https://example.test").searchParams;
    expect(query.get("sort")).toBe("rating");expect(query.getAll("platform")).toEqual(filters.platform);
    expect(query.get("q")).toBe(filters.q);expect(query.getAll("genre")).toEqual(filters.genre);
    expect(query.get("status")).toBe(filters.status);expect(query.getAll("day")).toEqual(["1","2"]);expect(query.get("age")).toBe("15");
    expect(new URL(filterUrl(filters),"https://example.test").searchParams.has("cursor")).toBe(false);
  });
  it("keeps exact rating sums and separate cursor versions for changing sort orders",()=>{
    const filters = parseFilters({sort:"rating"});
    const position = {id:"10000000-0000-4000-8000-000000000001",ratingSum:13,ratingCount:3,viewerId:null};
    const cursor = writeCursor(position,filters);
    expect(readCursor(cursor,filters)).toEqual(position);
    expect(()=>readCursor(cursor,parseFilters({sort:"latest"}))).toThrow();
    expect(()=>readCursor(cursor,parseFilters({sort:"rating",genre:"fantasy"}))).toThrow();
    const envelope = JSON.parse(Buffer.from(cursor!,"base64url").toString("utf8"));
    const forged = (patch:Record<string,unknown>)=>Buffer.from(JSON.stringify({...envelope,...patch})).toString("base64url");
    expect(()=>readCursor(forged({v:1}),filters)).toThrow();
    expect(()=>readCursor(forged({position:{...position,ratingSum:13.1}}),filters)).toThrow();
    expect(()=>readCursor(forged({position:{...position,privateNote:"secret"}}),filters)).toThrow();
  });
  it("handles the unrated boundary and rejects impossible/unsafe rating positions",()=>{
    const position = {id:"10000000-0000-4000-8000-000000000001",ratingSum:0,ratingCount:0,viewerId:null};
    const filters = parseFilters({sort:"rating"});
    expect(readCursor(writeCursor(position,filters),filters)).toEqual(position);
    for(const patch of [{ratingSum:1},{ratingCount:1},{ratingSum:11,ratingCount:1},{ratingCount:-1},{ratingCount:Number.MAX_SAFE_INTEGER+1},{viewerId:"someone-else"}]) {
      expect(ratingCursorPositionSchema.safeParse({...position,...patch}).success).toBe(false);
    }
  });
  it("keeps the legacy latest/title cursor valid for Unicode work titles",()=>{
    for(const sort of ["latest","title"] as const) {
      const filters = parseFilters({sort});
      const position = {id:"10000000-0000-4000-8000-000000000001",createdAt:"2020-01-01T00:00:00Z",title:"😀".repeat(200)};
      expect(readCursor(writeCursor(position,filters),filters)).toEqual(position);
      expect(()=>writeCursor({...position,title:"😀".repeat(201)},filters)).toThrow();
    }
  });
  it("distinguishes no public ratings from a real average without exposing per-user fields",()=>{
    expect(catalogueRatingSchema.safeParse({average:null,ratingCount:0}).success).toBe(true);
    expect(catalogueRatingSchema.safeParse({average:4.5,ratingCount:1}).success).toBe(true);
    for(const rating of [{average:0,ratingCount:0},{average:4.5,ratingCount:0},{average:null,ratingCount:1},{average:5.5,ratingCount:2},{average:4,ratingCount:2,userId:"private-owner"}]) {
      expect(catalogueRatingSchema.safeParse(rating).success).toBe(false);
    }
  });
});
