/**
 * Cloudflare Turnstile server-side verification (free, unlimited). Gates space
 * creation and joins. Fails OPEN when no secret is configured (local dev) or on
 * a Cloudflare infra error — we never lock out real users for our infra hiccups.
 */
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(
  secret: string | undefined,
  token: string | undefined,
  ip: string | null,
): Promise<boolean> {
  if (!secret) return true; // not configured → dev/testing mode
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return true; // fail open on network/infra error
  }
}
