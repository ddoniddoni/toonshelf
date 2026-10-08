import { z } from "zod";
import { cardSchema,uuidSchema } from "@/lib/catalogue/model";
import { versionSchema } from "@/lib/library/model";
import { moderationSchema as reviewModerationSchema,reportReasonSchema,reportRowSchema as reviewReportSchema } from "@/lib/reviews/model";
const text=(min:number,max:number)=>z.string().refine(value=>[...value].length>=min && [...value].length<=max,`${min}~${max}자로 입력해 주세요.`);
export const categorySchema=z.enum(["request","recommendation","information","general"]);
export const categoryLabels={request:"추천 요청",recommendation:"작품 추천",information:"정보",general:"자유"} as const;
export const draftPayloadSchema=z.strictObject({title:text(0,100),body:text(0,10000),category:categorySchema,isSpoiler:z.boolean(),workIds:z.array(uuidSchema).max(5).refine(ids=>new Set(ids).size===ids.length,"연결 작품이 중복됐어요.")});
export const publishPayloadSchema=draftPayloadSchema.refine(v=>[...v.title.trim()].length>=5 && [...v.body.trim()].length>=20,"게시하려면 제목 5자, 본문 20자 이상 작성해 주세요.");
const cardBase=z.object({id:uuidSchema,authorId:uuidSchema,username:z.string(),name:z.string(),avatar:z.string().nullable(),title:text(5,100).nullable(),excerpt:text(0,240).nullable(),category:categorySchema,isSpoiler:z.boolean(),version:versionSchema,publishedAt:z.string(),updatedAt:z.string(),works:z.array(cardSchema).max(5)});
export const postCardSchema=cardBase.refine(v=>v.isSpoiler ? v.title===null && v.excerpt===null && v.works.length===0 : v.title!==null && v.excerpt!==null,"스포일러 내용이 공개 목록에 포함됐어요.");
export const postDetailSchema=cardBase.extend({body:text(20,10000).nullable()});
const countSchema=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const postListingCardSchema=cardBase.extend({likeCount:countSchema,recentLikeCount:countSchema,recentCommenterCount:countSchema,popularityScore:countSchema})
 .refine(v=>postCardSchema.safeParse(v).success && v.recentLikeCount<=v.likeCount && v.popularityScore===v.recentLikeCount+2*v.recentCommenterCount,"공개 목록과 집계 범위를 확인해 주세요.");
export type PostListingCard=z.infer<typeof postListingCardSchema>;
export const postListSchema=z.object({items:z.array(postListingCardSchema).max(20),hasNext:z.boolean()});
export type PostCard=z.infer<typeof postCardSchema>;
export type PostDetail=z.infer<typeof postDetailSchema>;
export const editorSchema=z.object({id:uuidSchema,postVersion:versionSchema,publicationStatus:z.enum(["draft","published"]),moderationStatus:z.enum(["visible","hidden"]),draftVersion:versionSchema,draft:draftPayloadSchema,draftUpdatedAt:z.string(),publishedTitle:z.string(),publishedBody:z.string(),publishedSpoiler:z.boolean(),works:z.array(z.object({id:uuidSchema,card:cardSchema.nullable()})).max(5)});
export type PostEditor=z.infer<typeof editorSchema>;
export const myPostListSchema=z.object({items:z.array(z.object({id:uuidSchema,title:z.string(),publicationStatus:z.enum(["draft","published"]),moderationStatus:z.enum(["visible","hidden"]),updatedAt:z.string()})).max(20),hasNext:z.boolean()});
export const filtersSchema=z.strictObject({q:text(0,100),category:categorySchema.nullable(),work:uuidSchema.nullable(),page:z.number().int().min(1).max(1000),sort:z.enum(["latest","popular"]).default("latest")});
export type PostFilters=z.infer<typeof filtersSchema>;
export function communityUrl(filters:Omit<PostFilters,"sort"> & {sort?:PostFilters["sort"]}) {
 const q=new URLSearchParams();if(filters.q)q.set("q",filters.q);if(filters.category)q.set("category",filters.category);if(filters.work)q.set("work",filters.work);if(filters.page>1)q.set("page",String(filters.page));if(filters.sort==="popular")q.set("sort","popular");
 return "/community"+(q.size ? "?"+q : "");
}
export const reportInputSchema=z.strictObject({postId:uuidSchema,reason:reportReasonSchema,detail:text(10,2000)});
export const reportRowSchema=reviewReportSchema.omit({review_id:true}).extend({post_id:uuidSchema});
export const reportListSchema=z.object({items:z.array(reportRowSchema).max(20),hasNext:z.boolean()});
export const reportQueueSchema=z.object({items:z.array(reportRowSchema.pick({id:true,post_id:true,reason:true,detail:true,status:true,created_at:true})).max(20),hasNext:z.boolean()});
export const moderationSchema=reviewModerationSchema.extend({title:z.string().nullable()});
export type PostModeration=z.infer<typeof moderationSchema>;
export type PostContentResult={ok:true;title:string;body:string;works:z.infer<typeof cardSchema>[]}|{ok:false;message:string};
export type WorkOption={id:string;title:string;slug:string};
export type WorkSearchResult={ok:true;items:WorkOption[]}|{ok:false;message:string};
