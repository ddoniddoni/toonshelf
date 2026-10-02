// @vitest-environment node
import { describe,expect,it } from "vitest";
import { draftPayloadSchema,publishPayloadSchema,reportInputSchema,moderationInputSchema,safeReviewLink } from "@/lib/reviews/model";
const id = "10000000-0000-4000-8000-000000000001";
describe("review input and plain-text link boundaries",()=>{
 it("allows an empty private draft but requires a substantive publication",()=>{
  expect(draftPayloadSchema.safeParse({body:"",isSpoiler:false,episode:null}).success).toBe(true);
  expect(publishPayloadSchema.safeParse({body:" ".repeat(100),isSpoiler:false,episode:null}).success).toBe(false);
  expect(publishPayloadSchema.safeParse({body:"\t\n\u00a0\u3000".repeat(20),isSpoiler:false,episode:null}).success).toBe(false);
  expect(publishPayloadSchema.safeParse({body:"😀".repeat(20),isSpoiler:true,episode:0}).success).toBe(true);
 });
 it("bounds Unicode body/progress and refuses owner/moderation fields",()=>{
  expect(draftPayloadSchema.safeParse({body:"😀".repeat(5001),isSpoiler:false,episode:null}).success).toBe(false);
  expect(draftPayloadSchema.safeParse({body:"text",isSpoiler:true,episode:-1}).success).toBe(false);
  expect(draftPayloadSchema.safeParse({body:"text",isSpoiler:true,episode:null,userId:id}).success).toBe(false);
  expect(draftPayloadSchema.safeParse({body:"text",isSpoiler:true,episode:null,moderationStatus:"visible"}).success).toBe(false);
 });
 it("restricts reports and requires an explicit target and explanation",()=>{
  expect(reportInputSchema.safeParse({reviewId:id,reason:"personal_information",detail:"개인정보가 포함된 부분을 설명해요."}).success).toBe(true);
  expect(reportInputSchema.safeParse({reviewId:id,reason:"admin",detail:"내용"}).success).toBe(false);
 });
 it("requires a pending report selection and result message for rejection",()=>{
  const input = {reviewId:id,version:1,action:"reject_report",reason:"검토 완료",reportId:null,result:""};
  expect(moderationInputSchema.safeParse(input).success).toBe(false);
  expect(moderationInputSchema.safeParse({...input,reportId:id,result:"위반으로 판단하기 어려워요."}).success).toBe(true);
 });
 it("turns only credential-free HTTP(S) addresses into links",()=>{
  expect(safeReviewLink("https://example.test/a")).toBe("https://example.test/a");
  for (const url of ["javascript:alert(1)","data:text/html,<script>","https://user:secret@example.test","https://example.test/a\n"]) expect(safeReviewLink(url)).toBeNull();
 });
});
