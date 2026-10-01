import { getPublicEnv } from "@/lib/env/public";
export function UserAvatar({path,name}: {path:string|null;name:string}) {
  const env = getPublicEnv().supabase;
  const url = path && env ? `${env.url}/storage/v1/object/public/avatars/${path}` : null;
  return <div className="user-avatar">{url ? <picture><img src={url} alt={`${name}의 프로필 사진`} width={96} height={96} referrerPolicy="no-referrer"/></picture> : <span aria-label="기본 프로필 사진">{[...name][0] ?? "나"}</span>}</div>;
}
