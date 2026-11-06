import { config } from "./config";

export function resolveAllowedOrigin(requestOrigin: string | null): string | null {
  if (config.allowedOrigins.includes("*")) return "*";
  if (requestOrigin && config.allowedOrigins.includes(requestOrigin))
    return requestOrigin;
  return null;
}

export function corsHeaders(requestOrigin: string | null): HeadersInit {
  const origin = resolveAllowedOrigin(requestOrigin);
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    ...(origin !== "*" ? { Vary: "Origin" } : {}),
  };
}
