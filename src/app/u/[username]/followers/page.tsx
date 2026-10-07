import { FollowDirectory } from "@/components/social/follow-directory";
import type { SearchParams } from "@/lib/catalogue/model";
export const dynamic = "force-dynamic";
export const metadata = {title:"팔로워",robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{username:string}>;searchParams:Promise<SearchParams>}) {
 const [{username},query]=await Promise.all([params,searchParams]);
 return <FollowDirectory username={username} kind="followers" searchParams={query}/>;
}
