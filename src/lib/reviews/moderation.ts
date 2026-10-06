import "server-only";
import { notFound } from "next/navigation";
import { requireAccount,guardPage } from "@/lib/auth/session";
import { AuthFailure } from "@/lib/auth/errors";
import { reviewError } from "./errors";
import { moderationSchema,reportQueueSchema } from "./model";
export async function requireModerator() {
 const account = await requireAccount();const {data,error} = await account.client.rpc("toon_get_my_review_moderator_role");
 reviewError(error);if (data !== true) throw new AuthFailure("FORBIDDEN","콘텐츠 운영자 권한이 필요해요.");return account;
}
export async function guardModeratorPage(path:string) {
 const account = await guardPage(path);if (!account) return null;
 const {data,error} = await account.client.rpc("toon_get_my_review_moderator_role");reviewError(error);if (data !== true) notFound();return account;
}
export async function getModerationSnapshot(id:string) {
 const {client} = await requireModerator();const {data,error} = await client.rpc("toon_moderation_review_snapshot",{p_id:id,p_reveal:false,p_expected_version:null});
 reviewError(error);return data === null ? null : moderationSchema.parse(data);
}
export async function listReviewReports(page:number) {
 const {client} = await requireModerator();const {data,error} = await client.rpc("toon_list_review_reports",{p_page:page});
 reviewError(error);return reportQueueSchema.parse(data);
}
