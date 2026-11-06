import { config } from "@/lib/config";
import { checkRateLimit } from "@/lib/rateLimit";
import { issueSessionToken } from "@/lib/session";

export const runtime = "nodejs";

// Server-to-server only: an embedding host's OWN backend calls this with an
// EMBED_SERVER_KEYS secret (never exposed to its browser clients) to mint a
// short-lived token, then hands that token to its frontend. No CORS headers
// are set, so a browser calling this cross-origin directly will be blocked
// by the same-origin policy — that's intentional, not an oversight.
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!checkRateLimit(ip)) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  if (!config.sessionSigningSecret) {
    return Response.json(
      { error: "Session issuance is not configured (SESSION_SIGNING_SECRET unset)." },
      { status: 500 }
    );
  }

  const auth = req.headers.get("authorization");
  const key = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!key || !config.embedServerKeys.includes(key)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = issueSessionToken();
  return Response.json({ token, expiresInMinutes: config.sessionTtlMinutes });
}
