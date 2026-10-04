import { z } from "zod";
import type { SearchParams } from "@/lib/catalogue/model";
import { parsePage } from "@/lib/library/model";

export const tierDiscoverySortSchema=z.enum(["latest","popular"]);
// Match the published tag literally, including case/spacing. No substring,
// wildcard, draft tag, or spoiler-reveal query is accepted.
export const tierThemeTagSchema=z.string().refine(v=>Array.from(v).length >= 1 && Array.from(v).length <= 20,"태그는 1~20자로 입력해 주세요.");
export const tierDiscoveryFiltersSchema=z.strictObject({sort:tierDiscoverySortSchema,tag:tierThemeTagSchema.nullable()});
export type TierDiscoveryFilters=z.infer<typeof tierDiscoveryFiltersSchema>;
const querySchema=z.strictObject({sort:z.string().optional(),tag:z.string().optional(),page:z.string().optional()});
export function parseTierDiscovery(params:SearchParams) {
 const query=querySchema.parse(params);
 return {filters:tierDiscoveryFiltersSchema.parse({sort:query.sort || "latest",tag:query.tag || null}),page:parsePage(query.page)};
}
export function tierDiscoveryUrl(filters:TierDiscoveryFilters,page=1) {
 const value=tierDiscoveryFiltersSchema.parse(filters);
 z.number().int().min(1).max(1000).parse(page);
 const query=new URLSearchParams();
 if (value.sort !== "latest") query.set("sort",value.sort);
 if (value.tag !== null) query.set("tag",value.tag);
 if (page > 1) query.set("page",String(page));
 const suffix=query.toString();return suffix ? `/tiers?${suffix}` : "/tiers";
}
