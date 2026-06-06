/**
 * Optional image moderation via Workers AI (within the free 10k-neurons/day
 * budget). A pluggable hook in the upload path:
 *
 *   MODERATION_MODE=off  → no-op (default)
 *   MODERATION_MODE=on   → screen each upload with `MODERATION_MODEL`
 *
 * Always FAILS OPEN: if the model errors, the binding is missing, or the daily
 * neuron budget is exhausted, the upload is allowed — moderation is a safety net,
 * never a hard dependency on the capture path.
 *
 * The default model is a generic image classifier used as a coarse gate; for real
 * safety set `MODERATION_MODEL` to an appropriate content-safety model.
 */
import type { AppEnv } from "./env";
import { moderationOn } from "./env";

export interface ModerationVerdict {
  allowed: boolean;
  reason?: string;
}

const DEFAULT_MODEL = "@cf/microsoft/resnet-50";
const UNSAFE = /nsfw|explicit|porn|nudity|sexual|gore|violence|weapon/i;

/** Minimal structural type so we don't couple to the generated per-model overloads. */
interface AiRunner {
  run(model: string, inputs: unknown): Promise<unknown>;
}

export async function moderateImage(
  env: AppEnv,
  bytes: Uint8Array,
): Promise<ModerationVerdict> {
  if (!moderationOn(env) || !env.AI) return { allowed: true };
  const model = env.MODERATION_MODEL ?? DEFAULT_MODEL;
  try {
    const ai = env.AI as unknown as AiRunner;
    const out = await ai.run(model, { image: Array.from(bytes) });
    return isUnsafe(out)
      ? { allowed: false, reason: "flagged by moderation" }
      : { allowed: true };
  } catch {
    return { allowed: true }; // fail-open
  }
}

/** Interpret the common Workers AI output shapes into a binary safe/unsafe call. */
function isUnsafe(out: unknown): boolean {
  if (Array.isArray(out)) {
    return out
      .slice(0, 3)
      .some((x) => UNSAFE.test(String((x as { label?: string }).label ?? "")));
  }
  if (out && typeof out === "object") {
    const o = out as { safe?: boolean; label?: string };
    if (o.safe === false) return true;
    if (typeof o.label === "string" && UNSAFE.test(o.label)) return true;
  }
  return false;
}
