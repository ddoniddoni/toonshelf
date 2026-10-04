import { z } from "zod";
import { uuidSchema } from "@/lib/catalogue/model";
import { versionSchema } from "./model";

export const featuredStateSchema=z.object({id:uuidSchema.nullable(),version:versionSchema});
export type FeaturedState=z.infer<typeof featuredStateSchema>;
export const featuredInputSchema=z.strictObject({id:uuidSchema.nullable(),tierVersion:versionSchema.nullable(),featuredVersion:versionSchema})
 .refine(v=>(v.id === null) === (v.tierVersion === null),{message:"선택한 티어표의 현재 버전을 확인해 주세요."});
