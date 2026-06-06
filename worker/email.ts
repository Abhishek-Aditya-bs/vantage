/**
 * Transactional email via Resend (free tier). Cloudflare can't send arbitrary
 * mail from a *.workers.dev host, so we use Resend's API. With the default
 * `onboarding@resend.dev` sender you can email the address that owns the Resend
 * account without verifying a domain — perfect for a single-admin OTP.
 *
 * Returns true on success; callers treat email as best-effort and fall back to
 * the passcode path when RESEND_API_KEY is unset.
 */
import type { AppEnv } from "./env";

const RESEND_URL = "https://api.resend.com/emails";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(env: AppEnv, msg: EmailMessage): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Vantage <onboarding@resend.dev>",
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        ...(msg.html ? { html: msg.html } : {}),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Build the OTP email body. */
export function otpEmail(code: string): { subject: string; text: string; html: string } {
  return {
    subject: `Vantage admin code: ${code}`,
    text: `Your Vantage admin sign-in code is ${code}. It expires in 10 minutes. If you didn't request this, ignore this email.`,
    html: `<div style="font-family:ui-monospace,monospace;background:#0c0c0c;color:#fafafa;padding:32px;border-radius:12px">
      <p style="letter-spacing:.2em;text-transform:uppercase;font-size:12px;color:#8a8a8a;margin:0 0 12px">Vantage · admin</p>
      <p style="margin:0 0 8px;font-size:14px">Your sign-in code:</p>
      <p style="font-size:40px;font-weight:700;letter-spacing:.25em;margin:0 0 16px">${code}</p>
      <p style="font-size:12px;color:#8a8a8a;margin:0">Expires in 10 minutes. If this wasn't you, ignore it.</p>
    </div>`,
  };
}
