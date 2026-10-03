import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AuthFailure } from "@/lib/auth/errors";
import { guardPage,requireAccount } from "@/lib/auth/session";
import { getPublicEnv } from "@/lib/env/public";
import { catalogueError } from "./errors";
import { ageSchema,creatorInputSchema,linkInputSchema,serialSchema,slugSchema,uuidSchema } from "./model";
import { mergePreviewSchema } from "./merge-model";

export const catalogueAdminAccount = cache(async ()=>{
  const account = await requireAccount();
  const {data,error} = await account.client.rpc("get_my_catalogue_role");
  catalogueError(error);
  if (data !== true) throw new AuthFailure("FORBIDDEN","카탈로그 관리자만 사용할 수 있어요.");
  return account;
});
export async function guardAdminPage(path:string) {
  if (!getPublicEnv().supabase) return null;
  const account = await guardPage(path);
  if (!account) return null;
  const {data,error} = await account.client.rpc("get_my_catalogue_role");
  catalogueError(error);
  if (data !== true) notFound();
  return account;
}
export const adminWorkSchema = z.object({
  id:uuidSchema,slug:slugSchema,title:z.string(),aliases:z.array(z.string()),original_description:z.string(),
  serial_status:serialSchema,age_rating:ageSchema,catalogue_status:z.enum(["draft","published","hidden","merged"]),
  version:z.number().int(),is_test:z.boolean(),cover_asset_id:uuidSchema.nullable()
});
export const assetSchema = z.object({id:uuidSchema,work_id:uuidSchema,rights_holder:z.string(),evidence_reference:z.string(),
  display_allowed:z.boolean(),og_allowed:z.boolean(),export_allowed:z.boolean(),commercial_allowed:z.boolean(),
  attribution:z.string(),valid_from:z.string(),expires_at:z.string().nullable(),status:z.enum(["staged","active","revoked"])});
export const snapshotSchema = z.object({work:adminWorkSchema,creators:z.array(creatorInputSchema),genreIds:z.array(uuidSchema),
  links:z.array(linkInputSchema),sources:z.array(z.object({source_url:z.string(),verified_at:z.string(),verified_fields:z.array(z.string()),note:z.string()})),
  assets:z.array(assetSchema)});
export type AdminSnapshot = z.infer<typeof snapshotSchema>;
export async function getAdminSnapshot(id:string) {
  const account = await catalogueAdminAccount();
  const {data,error} = await account.client.rpc("admin_catalogue_snapshot",{p_id:uuidSchema.parse(id)});
  catalogueError(error);
  return data === null ? null : snapshotSchema.parse(data);
}
export async function getMergePreview(source:string,target:string) {
  const {client} = await catalogueAdminAccount();
  const {data,error} = await client.rpc("admin_merge_preview",{p_source:uuidSchema.parse(source),p_target:uuidSchema.parse(target)});
  catalogueError(error);return mergePreviewSchema.parse(data);
}
