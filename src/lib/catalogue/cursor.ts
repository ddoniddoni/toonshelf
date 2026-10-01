import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { cursorPositionSchema, type CatalogueFilters } from "./model";
import { AuthFailure } from "@/lib/auth/errors";

const cursorSchema = z.strictObject({v:z.literal(1),filters:z.string().regex(/^[a-f0-9]{64}$/),position:cursorPositionSchema});
const fingerprint = (filters:CatalogueFilters) => createHash("sha256").update(JSON.stringify(filters)).digest("hex");
export function readCursor(value:unknown,filters:CatalogueFilters) {
  if (value === undefined || value === "") return null;
  try {
    if (typeof value !== "string" || value.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const cursor = cursorSchema.parse(JSON.parse(Buffer.from(value,"base64url").toString("utf8")));
    if (cursor.filters !== fingerprint(filters)) throw new Error();
    return cursor.position;
  } catch { throw new AuthFailure("VALIDATION_ERROR","검색 조건이 바뀌었거나 페이지 주소가 올바르지 않아요. 첫 페이지부터 다시 찾아 주세요."); }
}
export function writeCursor(position:z.infer<typeof cursorPositionSchema>|null,filters:CatalogueFilters) {
  return position ? Buffer.from(JSON.stringify({v:1,filters:fingerprint(filters),position})).toString("base64url") : null;
}
