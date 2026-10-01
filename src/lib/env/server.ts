import "server-only";
import { parseServerEnv } from "./schema";

export function getServerEnv() {
  return parseServerEnv(process.env);
}
