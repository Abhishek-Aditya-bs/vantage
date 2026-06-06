/**
 * Admin auth — a single-admin dashboard gated by email OTP (with a master
 * passcode fallback so it works before Resend is configured).
 *
 * Flow: request → a 6-digit code is stored (hashed) in KV for 10 min and emailed
 * to the allowlisted ADMIN_EMAIL; verify → on a correct code (or the ADMIN_PASSCODE)
 * we issue a 2-hour admin JWT, signed with JWT_SECRET and carrying an `adm` claim.
 */
import { SignJWT, jwtVerify } from "jose";
import type { AppEnv } from "./env";
import { adminEmail } from "./env";
import { DEV_JWT_SECRET } from "./auth";

const ISS = "vantage";
const AUD = "vantage-admin";
const ADMIN_TTL = 2 * 60 * 60; // 2h
const OTP_TTL = 600; // 10 min
const OTP_MAX_ATTEMPTS = 5;

const keyBytes = (s: string) => new TextEncoder().encode(s);
const secretOf = (env: AppEnv) => env.JWT_SECRET ?? DEV_JWT_SECRET;
const otpKey = (email: string) => `admin:otp:${email.toLowerCase()}`;

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function isAdminEmail(env: AppEnv, email: string): boolean {
  return email.trim().toLowerCase() === adminEmail(env);
}

export async function issueAdminToken(env: AppEnv, email: string): Promise<string> {
  return new SignJWT({ adm: true })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(email.toLowerCase())
    .setIssuer(ISS)
    .setAudience(AUD)
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_TTL}s`)
    .sign(keyBytes(secretOf(env)));
}

export async function verifyAdminToken(env: AppEnv, token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, keyBytes(secretOf(env)), {
      issuer: ISS,
      audience: AUD,
      algorithms: ["HS256"],
    });
    if (payload.adm !== true || typeof payload.sub !== "string") return null;
    if (payload.sub !== adminEmail(env)) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

/** Generate + store a 6-digit OTP for the admin email. Returns the code so the caller can email it. */
export async function createOtp(env: AppEnv, email: string): Promise<string> {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 900000;
  const code = String(100000 + n);
  const hash = await sha256Hex(`${code}:${email.toLowerCase()}:${secretOf(env)}`);
  await env.KV.put(otpKey(email), JSON.stringify({ hash, attempts: 0 }), { expirationTtl: OTP_TTL });
  return code;
}

/** Verify an OTP (or the master passcode). Single-use: a correct OTP is consumed. */
export async function verifyOtp(env: AppEnv, email: string, code: string): Promise<boolean> {
  const trimmed = code.trim();
  if (!trimmed) return false;
  // master passcode bypass (bootstrap / no email configured)
  if (env.ADMIN_PASSCODE && timingSafeEqual(trimmed, env.ADMIN_PASSCODE)) return true;

  const raw = await env.KV.get(otpKey(email));
  if (!raw) return false;
  let rec: { hash: string; attempts: number };
  try {
    rec = JSON.parse(raw) as { hash: string; attempts: number };
  } catch {
    return false;
  }
  if (rec.attempts >= OTP_MAX_ATTEMPTS) {
    await env.KV.delete(otpKey(email));
    return false;
  }
  const hash = await sha256Hex(`${trimmed}:${email.toLowerCase()}:${secretOf(env)}`);
  if (timingSafeEqual(hash, rec.hash)) {
    await env.KV.delete(otpKey(email)); // single-use
    return true;
  }
  await env.KV.put(
    otpKey(email),
    JSON.stringify({ hash: rec.hash, attempts: rec.attempts + 1 }),
    { expirationTtl: OTP_TTL },
  );
  return false;
}
