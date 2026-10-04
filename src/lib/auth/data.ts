import "server-only";
import { createClient } from "@/lib/supabase/server";
import { databaseError } from "./errors";
import { requireAccount } from "./session";
export async function getGenres() {
  const {data,error} = await (await createClient()).from("genres").select("*").eq("active",true).order("sort_order");
  databaseError(error); return data ?? [];
}
export async function getMyProfile(allowPending = false) {
  const {client,user} = await requireAccount(!allowPending);
  const {data,error} = await client.from("profiles").select("id,username,display_name,bio,avatar_path,discovery_opt_in,onboarding_completed_at,created_at,updated_at").eq("id",user.id).single();
  databaseError(error); return data;
}
export async function getMySettings() {
  const {client,user} = await requireAccount();
  const {data,error} = await client.from("user_settings").select("*").eq("user_id",user.id).single();
  databaseError(error); return data;
}
