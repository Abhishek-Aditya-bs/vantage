/**
 * Capability tokens — the join link IS the credential. Short-lived HS256 JWTs
 * (via `jose`, Web-Crypto based, runs natively on Workers). The Durable Object
 * validates the signature + claims and enforces per-role permissions.
 */
import { SignJWT, jwtVerify } from "jose";
import type { Role, TokenClaims } from "@shared/protocol";

const ISS = "vantage";
const AUD = "vantage-app";
const HOST_TTL_SECONDS = 6 * 60 * 60; // hosts: 6h
const GUEST_TTL_SECONDS = 4 * 60 * 60; // guests: 4h

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export interface IssueArgs {
  memberId: string;
  spaceCode: string;
  role: Role;
  displayName: string;
  avatarSeed: string;
}

export async function issueToken(secret: string, args: IssueArgs): Promise<string> {
  const ttl = args.role === "host" ? HOST_TTL_SECONDS : GUEST_TTL_SECONDS;
  return new SignJWT({
    spaceCode: args.spaceCode,
    role: args.role,
    displayName: args.displayName,
    avatarSeed: args.avatarSeed,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(args.memberId)
    .setIssuer(ISS)
    .setAudience(AUD)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(secretKey(secret));
}

export async function verifyToken(secret: string, token: string): Promise<TokenClaims> {
  const { payload } = await jwtVerify(token, secretKey(secret), {
    issuer: ISS,
    audience: AUD,
    algorithms: ["HS256"],
  });
  return payload as unknown as TokenClaims;
}

/** Development fallback secret — overridden in every real environment via `wrangler secret put JWT_SECRET`. */
export const DEV_JWT_SECRET = "vantage-dev-only-insecure-secret-change-me";
