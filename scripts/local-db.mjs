import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { assertLocalDatabase } from "./local-db-policy.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
for (const file of [".env.local", ".env"]) if (existsSync(file)) process.loadEnvFile(file);
const [action, ...args] = process.argv.slice(2);
const commands = {
  start: ["start"], stop: ["stop"], status: ["status"],
  reset: ["db", "reset", "--local"],
  types: ["gen", "types", "--local", "--lang", "typescript", "--schema", "public"],
  test: ["test", "db", "--local"],
};

try {
  assertLocalDatabase({ env: process.env, args, linked: existsSync("supabase/.temp/project-ref") });
  if (!Object.hasOwn(commands, action)) throw new Error("지원하지 않는 DB 명령입니다.");
  const docker = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], { encoding: "utf8", timeout: 10000 });
  if (docker.error || docker.status !== 0) throw new Error("Docker 엔진에 연결할 수 없습니다. Docker 호환 런타임을 설치·실행한 뒤 다시 시도하세요. DB 작업은 실행되지 않았습니다.");
  const cli = resolve("node_modules/.bin", process.platform === "win32" ? "supabase.cmd" : "supabase");
  const command = [...commands[action], "--workdir", root];
  const result = spawnSync(cli, command, { encoding: "utf8", stdio: action === "types" ? ["inherit", "pipe", "pipe"] : "inherit" });
  if (result.error || result.status !== 0) {
    // CLI stderr can contain connection details. Never print env or credentials.
    throw new Error("Supabase 로컬 명령이 실패했습니다. Docker 상태와 supabase/config.toml을 확인해 주세요.");
  }
  if (action === "types") {
    if (!/export type Database\s*=/.test(result.stdout)) throw new Error("타입 생성 결과가 올바르지 않습니다. 기존 타입 파일은 보존했습니다.");
    const target = "src/types/database.generated.ts";
    writeFileSync(`${target}.tmp`, result.stdout);
    renameSync(`${target}.tmp`, target);
    console.log("src/types/database.generated.ts 생성 완료");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "DB 명령 실패");
  process.exitCode = 1;
}
