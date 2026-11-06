import { config } from "@/lib/config";
import { checkRateLimit } from "@/lib/rateLimit";

// Lets the chat UI check an access code against SERVICE_API_KEYS before
// unlocking the chat, giving immediate "invalid code" feedback without
// requiring a full /api/chat round-trip. The code itself then doubles as
// the Bearer token the UI sends on every subsequent /api/chat call — this
// endpoint doesn't mint a separate session token, it just validates one of
// the already-configured keys.
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!checkRateLimit(ip)) {
    return Response.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429 }
    );
  }

  let code: unknown;
  try {
    const body = await req.json();
    code = (body as { code?: unknown }).code;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof code !== "string" || !code.trim()) {
    return Response.json({ valid: false }, { status: 400 });
  }

  const valid = config.serviceApiKeys.includes(code.trim());
  return Response.json({ valid }, { status: valid ? 200 : 401 });
}
