import { z } from "zod";
import { uuidSchema } from "@/lib/catalogue/model";
import { usernameSchema } from "@/lib/auth/validation";

export const followKindSchema = z.enum(["followers","following"]);
const countSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const followAccessSchema = z.strictObject({username:usernameSchema});
export const followInputSchema = z.strictObject({id:uuidSchema,following:z.boolean()});
export const followListInputSchema = followAccessSchema.extend({kind:followKindSchema,page:z.number().int().min(1).max(1000)});
export const followProfileSchema = z.object({id:uuidSchema,username:usernameSchema,name:z.string().refine(s=>[...s].length >= 2 && [...s].length <= 30),avatarPath:z.string().nullable()});
export const followStateSchema = followProfileSchema.extend({followerCount:countSchema,followingCount:countSchema,following:z.boolean(),canFollow:z.boolean(),isSelf:z.boolean()})
 .refine(s=>!s.isSelf || (!s.following && !s.canFollow),{message:"자신을 팔로우할 수 없어요."});
export const followListSchema = z.object({profile:followStateSchema,kind:followKindSchema,page:z.number().int().min(1).max(1000),
 total:countSchema,hasNext:z.boolean(),items:z.array(followProfileSchema).max(20)})
 .refine(s=>s.total === (s.kind === "followers" ? s.profile.followerCount : s.profile.followingCount),{message:"목록과 팔로우 수가 일치하지 않아요."});
export type FollowState = z.infer<typeof followStateSchema>;
export type FollowList = z.infer<typeof followListSchema>;
export type FollowKind = z.infer<typeof followKindSchema>;
