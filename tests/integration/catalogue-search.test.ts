// @vitest-environment node
// Mock DAL boundaries only; not live Supabase, permissions, or browser checks.
import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks = vi.hoisted(()=>({client:vi.fn(),rpc:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createClient:mocks.client}));
import { searchWorks } from "@/lib/catalogue/data";
import { parseFilters } from "@/lib/catalogue/model";
import { readCursor,writeCursor } from "@/lib/catalogue/cursor";

const card = {id:"10000000-0000-4000-8000-000000000001",slug:"sample-work",title:"[테스트] 작품",aliases:[],serialStatus:"ongoing",ageRating:"all",createdAt:"2020-01-01T00:00:00Z",coverAssetId:null,coverAttribution:"",creators:[],genres:[],platforms:[],rating:{average:4.5,ratingCount:2}};
describe("catalogue rating search boundary",()=>{
  beforeEach(()=>{vi.resetAllMocks();mocks.client.mockResolvedValue({rpc:mocks.rpc});mocks.rpc.mockResolvedValue({data:{items:[card],total:1,next:null},error:null});});
  it("fetches summaries and the page together through the user's existing RPC client",async()=>{
    const filters = parseFilters({sort:"rating",q:"작품",platform:"ridi",genre:"fantasy",status:"ongoing",day:"1",age:"15"});
    const result = await searchWorks(filters,undefined);
    expect(mocks.client).toHaveBeenCalledTimes(1);expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("search_catalogue",{p_q:"작품",p_platforms:["ridi"],p_genres:["fantasy"],p_status:"ongoing",p_days:[1],p_age:"15",p_sort:"rating",p_after:null,p_limit:24});
    expect(result.items[0].rating).toEqual({average:4.5,ratingCount:2});expect(result.nextCursor).toBe(null);
  });
  it("rejects invalid filters, oversized pages, and changed cursor conditions before contacting Supabase",async()=>{
    const filters = parseFilters({sort:"rating"});
    const cursor = writeCursor({id:card.id,ratingSum:9,ratingCount:1,viewerId:null},filters);
    await expect(searchWorks({...filters,q:"😀".repeat(101)},undefined)).rejects.toThrow();
    await expect(searchWorks(filters,undefined,51)).rejects.toThrow();
    await expect(searchWorks({...filters,age:"19"} as unknown as typeof filters,undefined)).rejects.toThrow();
    await expect(searchWorks({...filters,genre:["fantasy"]},cursor)).rejects.toMatchObject({code:"VALIDATION_ERROR"});
    expect(mocks.client).not.toHaveBeenCalled();expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("preserves exact public sums and caller scope when producing the next cursor",async()=>{
    const filters = parseFilters({sort:"rating"});
    const position = {id:card.id,ratingSum:13,ratingCount:3,viewerId:"30000000-0000-4000-8000-000000000001"};
    mocks.rpc.mockResolvedValue({data:{items:[{...card,rating:{average:13/6,ratingCount:3}}],total:4,next:position},error:null});
    const result = await searchWorks(filters,undefined);
    expect(readCursor(result.nextCursor,filters)).toEqual(position);
    await searchWorks(filters,result.nextCursor);
    expect(mocks.rpc).toHaveBeenLastCalledWith("search_catalogue",expect.objectContaining({p_after:position}));
  });
  it("asks for a new page when the DB rejects a changed rating or viewer cursor",async()=>{
    mocks.rpc.mockResolvedValue({data:null,error:{code:"P0001",message:"VALIDATION_ERROR"}});
    await expect(searchWorks(parseFilters({sort:"rating"}),undefined)).rejects.toMatchObject({code:"VALIDATION_ERROR",message:expect.stringContaining("첫 페이지")});
  });
  it("rejects malformed public summaries and keeps raw DB details out of errors",async()=>{
    mocks.rpc.mockResolvedValue({data:{items:[{...card,rating:{average:5,ratingCount:0}}],total:1,next:null},error:null});
    await expect(searchWorks(parseFilters({}),undefined)).rejects.toThrow();
    mocks.rpc.mockResolvedValue({data:null,error:{code:"XX000",message:"private SQL text and secret note"}});
    await expect(searchWorks(parseFilters({}),undefined)).rejects.toMatchObject({code:"INTERNAL_ERROR",message:expect.not.stringContaining("secret note")});
  });
});
