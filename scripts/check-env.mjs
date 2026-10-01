import { existsSync } from "node:fs";
import { parseServerEnv } from "../src/lib/env/schema.ts";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}
try {
  const env = parseServerEnv(process.env);
  console.log(`환경: ${env.APP_ENV}`);
  console.log(`Supabase: ${env.supabase ? "공개 설정 확인됨 (연결 검증 아님)" : "미설정 — P0 공개 화면만 실행 가능"}`);
  if (!env.supabase) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : "환경변수 검증 실패");
  process.exitCode = 1;
}
