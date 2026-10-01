import { NextResponse,type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env/public";
import { actionError } from "@/lib/auth/errors";
import { parseFilters,type SearchParams } from "@/lib/catalogue/model";
import { searchWorks } from "@/lib/catalogue/data";

export const dynamic = "force-dynamic";
const headers = {"Cache-Control":"private, no-store"};
export async function GET(request:NextRequest) {
  if (!getPublicEnv().supabase) return NextResponse.json({ok:false,error:{code:"CONFIG_REQUIRED",message:"카탈로그 연결 준비 중이에요."}},{status:503,headers});
  try {
    const params:SearchParams = Object.create(null);
    for (const key of new Set(request.nextUrl.searchParams.keys())) {
      const values = request.nextUrl.searchParams.getAll(key);params[key] = values.length === 1 ? values[0] : values;
    }
    const filters = parseFilters(params);
    const result = await searchWorks(filters,params.cursor,8);
    return NextResponse.json({ok:true,data:result},{headers});
  } catch(error) {
    const result = actionError(error);
    const status = result.error.code === "RATE_LIMITED" ? 429 : result.error.code === "VALIDATION_ERROR" ? 422 : 500;
    return NextResponse.json(result,{status,headers});
  }
}
