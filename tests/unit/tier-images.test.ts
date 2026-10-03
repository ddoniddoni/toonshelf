// Written only. Image pagination/format tests are not a live rendering result.
import { describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
import { defaultDraft } from "@/lib/tiers/model";
import { imageRequestSchema,imageSourceSchema,paginateTierImage,imageText,escapeImageText,type TierImageSource } from "@/lib/tiers/image-model";
import { pngCrc32,zipTierPngs } from "@/lib/tiers/image-zip";
const id="20000000-0000-4000-8000-000000000001";
let n=0;const uuid=()=>`60000000-0000-4000-8000-${String(++n).padStart(12,"0")}`;
function source():TierImageSource {
  const draft=defaultDraft(uuid);
  return {id,version:1,source:"draft",isSpoiler:true,body:{title:draft.title,description:"",tags:[],rows:draft.rows.map(r=>({...r,items:[]}))},unplaced:[]};
}
describe("tier image boundaries",()=>{
  it("splits long rows without dropping or repeating works and labels continuations",()=>{
    const value=source();value.body.rows[0]!.items=Array.from({length:300},(_,i)=>({title:"작품 "+i}));
    const pages=paginateTierImage(imageSourceSchema.parse(value)),lines=pages.flat();
    expect(pages.length).toBeLessThanOrEqual(8);expect(pages.every(p=>p.length <= 7)).toBe(true);
    expect(lines.flatMap(l=>l.items.map(w=>w?.title))).toEqual(Array.from({length:300},(_,i)=>"작품 "+i));
    expect(lines[0]!.continued).toBe(false);expect(lines[1]).toMatchObject({label:"S",continued:true});
    expect(lines.slice(-5).map(l=>l.label)).toEqual(["A","B","C","D","F"]);
  });
  it("keeps unplaced work only in owner draft images, and preserves hidden placeholders",()=>{
    const value=source();value.body.rows[0]!.items=[null,{title:"공개 작품"}];value.unplaced=[{title:"미배치 작품"}];
    expect(paginateTierImage(value).flat().at(-1)).toMatchObject({label:"미배치",items:[{title:"미배치 작품"}]});
    expect(paginateTierImage(value).flat()[0]!.items[0]).toBeNull();
    expect(imageSourceSchema.safeParse({...value,source:"publication"}).success).toBe(false);
    value.unplaced=Array.from({length:300},()=>null);expect(imageSourceSchema.safeParse(value).success).toBe(false);
  });
  it("rejects injected image URLs, ownership, arbitrary bodies and token-bearing drafts",()=>{
    const request={source:"publication",version:1,token:null,confirm:true,confirmSpoiler:false};
    expect(imageRequestSchema.safeParse(request).success).toBe(true);
    for(const extra of [{userId:id},{body:{title:"injected"}},{url:"https://example.test/cover"}])
      expect(imageRequestSchema.safeParse({...request,...extra}).success).toBe(false);
    expect(imageRequestSchema.safeParse({...request,source:"draft",token:"A".repeat(43)}).success).toBe(false);
    expect(imageRequestSchema.safeParse({...request,confirm:false}).success).toBe(false);
    const value=source();value.body.rows[0]!.items=[{title:"作品",url:"https://example.test"} as {title:string}];
    expect(imageSourceSchema.safeParse(value).success).toBe(false);
  });
  it("treats markup as plain text, bounds Unicode and removes bidi/control layout tricks",()=>{
    expect(escapeImageText('<span foreground="red">&file;</span>')).toBe("&lt;span foreground=&quot;red&quot;&gt;&amp;file;&lt;/span&gt;");
    expect(imageText("🙂".repeat(10),4)).toBe("🙂🙂🙂…");
    expect(imageText("가\u202e나\u0000다",30)).toBe("가 나 다");
  });
  it("writes bounded PNG archives with valid CRC and fixed ASCII filenames",()=>{
    expect(pngCrc32(Buffer.from("123456789"))).toBe(0xcbf43926);
    const files=[Buffer.from("first PNG"),Buffer.from("second PNG")],zip=zipTierPngs(files);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    const nameLength=zip.readUInt16LE(26);expect(zip.subarray(30,30+nameLength).toString()).toBe("toonshelf-page-01.png");
    expect(zip.subarray(30+nameLength,30+nameLength+files[0]!.length)).toEqual(files[0]);
    const end=zip.subarray(-22);expect(end.readUInt32LE(0)).toBe(0x06054b50);expect(end.readUInt16LE(10)).toBe(2);
    expect(zip.readUInt32LE(end.readUInt32LE(16))).toBe(0x02014b50);
    expect(()=>zipTierPngs(Array.from({length:9},()=>Buffer.from("png")))).toThrow();
    expect(()=>zipTierPngs([Buffer.alloc(16*1024*1024),Buffer.from("x")])).toThrow();
  });
});
