// @vitest-environment node
// Session/RPC contract mocks; written only, not live database evidence.
import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({account:vi.fn(),rpc:vi.fn(),hash:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAccount:mocks.account}));
vi.mock("@/lib/tiers/share-token",()=>({hashShareToken:mocks.hash}));
import { readTierImageSource } from "@/lib/tiers/image-data";
import { AuthFailure } from "@/lib/auth/errors";
const id="20000000-0000-4000-8000-000000000001",token="A".repeat(43),hash="b".repeat(64);
const input={source:"publication",version:2,token,confirm:true,confirmSpoiler:true};
describe("tier image data contract",()=>{
  beforeEach(()=>{vi.resetAllMocks();mocks.account.mockResolvedValue({client:{rpc:mocks.rpc}});mocks.hash.mockReturnValue(hash);mocks.rpc.mockResolvedValue({data:null,error:null});});
  it("requires a verified active session even for a token-visible PNG",async()=>{
    mocks.account.mockRejectedValue(new AuthFailure("AUTH_REQUIRED","로그인이 필요해요."));
    await expect(readTierImageSource(id,input,true)).rejects.toMatchObject({code:"AUTH_REQUIRED"});expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("sends only a token hash and expected version, never a user ID or raw token",async()=>{
    await expect(readTierImageSource(id,input,true)).rejects.toMatchObject({code:"NOT_FOUND"});
    expect(mocks.rpc).toHaveBeenCalledWith("toon_begin_tier_image_export",{p_id:id,p_source:"publication",p_version:2,p_hash:hash,p_confirm_spoiler:true});
    expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain(token);
  });
  it("rechecks with the read-only RPC and rejects stale versions safely",async()=>{
    mocks.rpc.mockResolvedValue({data:null,error:{message:"CONFLICT",details:"raw draft"}});
    await expect(readTierImageSource(id,input)).rejects.toMatchObject({code:"CONFLICT"});
    expect(mocks.rpc.mock.calls[0]![0]).toBe("toon_get_tier_image_source");
  });
});
