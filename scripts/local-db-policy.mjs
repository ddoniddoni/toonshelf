export function assertLocalDatabase({ env, args, linked }) {
  if (args.length > 0) throw new Error("추가 인자를 허용하지 않습니다. 로컬 DB 전용 명령입니다.");
  if ((env.APP_ENV ?? "local") !== "local" || env.NODE_ENV === "production") {
    throw new Error("로컬 환경에서만 DB 명령을 실행할 수 있습니다.");
  }
  if (linked || env.SUPABASE_PROJECT_REF || env.SUPABASE_DB_URL) {
    throw new Error("원격 Supabase 연결 설정이 감지되었습니다. 별도의 로컬 작업 폴더를 사용하세요.");
  }
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "DATABASE_URL", "DIRECT_URL"]) {
    if (!env[key]) continue;
    let url;
    try { url = new URL(env[key]); } catch { throw new Error(`${key} 형식이 올바르지 않습니다.`); }
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
      throw new Error(`${key}가 로컬 주소가 아닙니다. 실행을 중단합니다.`);
    }
  }
}
