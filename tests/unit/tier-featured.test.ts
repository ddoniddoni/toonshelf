// Written only; no runtime or live DB verification.
import { describe,expect,it } from "vitest";
import { featuredInputSchema,featuredStateSchema } from "@/lib/tiers/featured-model";
const id="20000000-0000-4000-8000-000000000001";
describe("featured tier input boundaries",()=>{
 it("requires both the selected lifecycle and the current profile revision",()=>{
  expect(featuredInputSchema.parse({id,tierVersion:2,featuredVersion:1})).toEqual({id,tierVersion:2,featuredVersion:1});
  expect(featuredInputSchema.parse({id:null,tierVersion:null,featuredVersion:3})).toEqual({id:null,tierVersion:null,featuredVersion:3});
  for (const input of [{id,tierVersion:null,featuredVersion:1},{id:null,tierVersion:2,featuredVersion:1},{id,tierVersion:0,featuredVersion:1},
   {id,tierVersion:2,featuredVersion:0},{id,tierVersion:2,featuredVersion:Number.MAX_SAFE_INTEGER+1},{id,tierVersion:2},
   {id,tierVersion:2,featuredVersion:1,userId:id},{id,tierVersion:2,featuredVersion:1,visibility:"public"}])
   expect(featuredInputSchema.safeParse(input).success).toBe(false);
 });
 it("keeps an unset revision and strips non-contract state fields",()=>{
  expect(featuredStateSchema.parse({id:null,version:4,token:"secret",title:"private"})).toEqual({id:null,version:4});
  expect(featuredStateSchema.safeParse({id:null}).success).toBe(false);
 });
});
