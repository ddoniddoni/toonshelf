import "server-only";
import { createCipheriv,createDecipheriv,createHash,randomBytes,timingSafeEqual } from "node:crypto";
import { ConfigurationError } from "@/lib/env/schema";
import { uuidSchema } from "@/lib/catalogue/model";
import { envelopeSchema,shareTokenSchema,type ShareEnvelope } from "./publication-model";

function encryptionKey() {
 const value=process.env.SHARE_TOKEN_ENCRYPTION_KEY;
 if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value)) throw new ConfigurationError(["SHARE_TOKEN_ENCRYPTION_KEY"]);
 const key=Buffer.from(value,"base64");
 if (key.length !== 32 || key.toString("base64") !== value) throw new ConfigurationError(["SHARE_TOKEN_ENCRYPTION_KEY"]);
 return key;
}
const aad=(id:string)=>Buffer.from("toonshelf:tier:"+uuidSchema.parse(id).toLowerCase()+":v1","utf8");
export function hashShareToken(value:string) {return createHash("sha256").update(shareTokenSchema.parse(value),"utf8").digest("hex");}
export function issueShareToken(id:string):ShareEnvelope {
 const key=encryptionKey(),token=randomBytes(32).toString("base64url"),nonce=randomBytes(12);
 const cipher=createCipheriv("aes-256-gcm",key,nonce);cipher.setAAD(aad(id));
 const encrypted=Buffer.concat([cipher.update(token,"utf8"),cipher.final(),cipher.getAuthTag()]);
 return envelopeSchema.parse({hash:hashShareToken(token),ciphertext:encrypted.toString("hex"),nonce:nonce.toString("hex")});
}
export function recoverShareToken(id:string,input:unknown) {
 const envelope=envelopeSchema.parse(input),data=Buffer.from(envelope.ciphertext,"hex");
 const decipher=createDecipheriv("aes-256-gcm",encryptionKey(),Buffer.from(envelope.nonce,"hex"));
 decipher.setAAD(aad(id));decipher.setAuthTag(data.subarray(-16));
 const token=shareTokenSchema.parse(Buffer.concat([decipher.update(data.subarray(0,-16)),decipher.final()]).toString("utf8"));
 if (!timingSafeEqual(Buffer.from(hashShareToken(token),"hex"),Buffer.from(envelope.hash,"hex"))) throw new Error("INVALID_SHARE_ENVELOPE");
 return token;
}
