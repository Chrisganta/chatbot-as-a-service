import { createHmac, timingSafeEqual } from "crypto";
import { config } from "./config";

// Stateless, signed, short-lived tokens — no DB/session store needed, which
// matters since this runs as serverless functions with no shared memory.
// Format: "<expiresAtMs>.<hmacHex>". Verifying just recomputes the HMAC over
// the claimed expiry and checks it hasn't passed; there's no server-side
// revocation, by design — that's the TTL's job.
export function issueSessionToken(ttlMinutes: number = config.sessionTtlMinutes): string {
  const expiresAt = Date.now() + ttlMinutes * 60_000;
  const sig = createHmac("sha256", config.sessionSigningSecret)
    .update(String(expiresAt))
    .digest("hex");
  return `${expiresAt}.${sig}`;
}

export function verifySessionToken(token: string): boolean {
  if (!config.sessionSigningSecret) return false;
  const [expiresAtStr, sig] = token.split(".");
  if (!expiresAtStr || !sig) return false;

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  const expected = createHmac("sha256", config.sessionSigningSecret)
    .update(expiresAtStr)
    .digest("hex");
  if (expected.length !== sig.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}
