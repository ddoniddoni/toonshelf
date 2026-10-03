// @vitest-environment node
import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
import { issueShareToken,recoverShareToken,hashShareToken } from "@/lib/tiers/share-token";
import { shareTokenSchema } from "@/lib/tiers/publication-model";
const id="20000000-0000-4000-8000-000000000001",other="20000000-0000-4000-8000-000000000002";
describe("tier share token secrecy and recovery",()=>{
 beforeEach(()=>vi.stubEnv("SHARE_TOKEN_ENCRYPTION_KEY",Buffer.alloc(32,7).toString("base64")));
 afterEach(()=>vi.unstubAllEnvs());
 it("stores authenticated ciphertext only and issues independent tokens/nonces",()=>{
  const first=issueShareToken(id),second=issueShareToken(id),token=recoverShareToken(id,first);
  expect(shareTokenSchema.parse(token)).toHaveLength(43);expect(first.hash).toBe(hashShareToken(token));
  expect(JSON.stringify(first)).not.toContain(token);expect(first.nonce).not.toBe(second.nonce);expect(first.hash).not.toBe(second.hash);
 });
 it("binds ciphertext to its tier and detects payload, nonce, tag and digest tampering",()=>{
  const envelope=issueShareToken(id);
  expect(()=>recoverShareToken(other,envelope)).toThrow();
  const flip=(value:string)=>(value[0] === "0" ? "1" : "0")+value.slice(1);
  for (const key of ["ciphertext","nonce","hash"] as const) expect(()=>recoverShareToken(id,{...envelope,[key]:flip(envelope[key])})).toThrow();
  expect(()=>recoverShareToken(id,{...envelope,ciphertext:envelope.ciphertext.slice(0,-1)})).toThrow();
 });
 it("fails closed on missing, malformed, noncanonical or wrong-size encryption keys",()=>{
  for (const key of ["","plain-key",Buffer.alloc(31).toString("base64"),Buffer.alloc(33).toString("base64"),"A".repeat(42)+"B="]) {
   vi.stubEnv("SHARE_TOKEN_ENCRYPTION_KEY",key);expect(()=>issueShareToken(id)).toThrow();
  }
 });
 it("rejects token aliases, short tokens, padding and URL injection",()=>{
  for (const token of ["A".repeat(42),"A".repeat(42)+"B","A".repeat(43)+"=","../"+"A".repeat(40),"A".repeat(43)+"?secret"]) expect(()=>hashShareToken(token)).toThrow();
 });
});
