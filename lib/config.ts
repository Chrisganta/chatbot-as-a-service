function envOr(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : fallback;
}

export const config = {
  llmBaseUrl: envOr("LLM_BASE_URL", "http://localhost:11434/v1").replace(/\/+$/, ""),
  llmModel: envOr("LLM_MODEL", "qwen3:4b-instruct"),
  llmApiKey: process.env.LLM_API_KEY || "",
  // Optional "user:pass" credential for LLM_BASE_URL hosts protected by HTTP
  // Basic Auth (e.g. an ngrok tunnel using --basic-auth). Unrelated to
  // llmApiKey, which is for Bearer-token LLM providers like Groq/OpenRouter.
  llmTunnelAuth: process.env.LLM_TUNNEL_AUTH || "",
  systemPrompt: envOr("SYSTEM_PROMPT", "You are a friendly, helpful assistant."),
  allowedOrigins: envOr("ALLOWED_ORIGINS", "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  serviceApiKeys: (process.env.SERVICE_API_KEYS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  rateLimitPerMinute: Number(envOr("RATE_LIMIT_PER_MINUTE", "20")),
  // Server-to-server secrets for embedding hosts to call /api/issue-session.
  // Never sent to a browser — distinct from serviceApiKeys, which are the
  // (browser-visible) static codes used by the standalone site's gate.
  embedServerKeys: (process.env.EMBED_SERVER_KEYS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  // HMAC key used to sign/verify short-lived session tokens. Required for
  // /api/issue-session to work; left unset, it refuses to issue tokens
  // rather than silently signing with an empty key.
  sessionSigningSecret: process.env.SESSION_SIGNING_SECRET || "",
  sessionTtlMinutes: Number(envOr("SESSION_TTL_MINUTES", "60")),
} as const;

// Builds the auth header(s) to send to LLM_BASE_URL. Bearer token (for
// hosted providers like Groq/OpenRouter) and Basic auth (for a dev tunnel
// like ngrok's --basic-auth) are mutually exclusive in practice, so either
// may be set but not both.
export function llmAuthHeaders(): Record<string, string> {
  if (config.llmApiKey) {
    return { Authorization: `Bearer ${config.llmApiKey}` };
  }
  if (config.llmTunnelAuth) {
    const encoded = Buffer.from(config.llmTunnelAuth).toString("base64");
    return { Authorization: `Basic ${encoded}` };
  }
  return {};
}
