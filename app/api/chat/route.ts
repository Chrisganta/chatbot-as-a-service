import { config, llmAuthHeaders } from "@/lib/config";
import { corsHeaders } from "@/lib/cors";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  validateAndTrim,
  validateContext,
  ValidationError,
} from "@/lib/validateMessages";
import { createSseToTextTransform } from "@/lib/sse";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  // 1. Optional API key auth for external callers
  if (config.serviceApiKeys.length > 0) {
    const auth = req.headers.get("authorization");
    const key = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!key || !config.serviceApiKeys.includes(key)) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers });
    }
  }

  // 2. Rate limit (IP from x-forwarded-for header set by Vercel/proxies)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!checkRateLimit(ip)) {
    return Response.json(
      { error: "Rate limit exceeded. Try again shortly." },
      { status: 429, headers }
    );
  }

  // 3. Validate body
  let messages;
  let context: string | undefined;
  try {
    const body = await req.json();
    messages = validateAndTrim(body);
    context = validateContext(body);
  } catch (err) {
    const message =
      err instanceof ValidationError ? err.message : "Invalid JSON body.";
    return Response.json({ error: message }, { status: 400, headers });
  }

  // When a host app supplies context (see public/widget.js's data-context-url),
  // ground the model strictly in that context instead of letting it answer
  // from general knowledge. With no context, it behaves as a normal assistant.
  const systemContent = context
    ? `${config.systemPrompt}\n\nAnswer the user's question using ONLY the context below. If the question cannot be answered from this context, say you don't have that information rather than guessing or using outside knowledge.\n\nContext:\n${context}`
    : config.systemPrompt;

  // 4. Call upstream LLM
  let upstream: Response;
  try {
    upstream = await fetch(`${config.llmBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...llmAuthHeaders(),
      },
      body: JSON.stringify({
        model: config.llmModel,
        stream: true,
        messages: [{ role: "system", content: systemContent }, ...messages],
      }),
      signal: req.signal,
    });
  } catch {
    return Response.json(
      {
        error: `Could not reach the LLM endpoint at ${config.llmBaseUrl}. Is Ollama running?`,
      },
      { status: 502, headers }
    );
  }

  if (!upstream.ok || !upstream.body) {
    const details = await upstream.text().catch(() => "");
    return Response.json(
      { error: "The LLM endpoint returned an error.", details },
      { status: 502, headers }
    );
  }

  // 5. Stream SSE response back as plain text
  const textStream = upstream.body.pipeThrough(createSseToTextTransform());
  const encoder = new TextEncoder();
  const outStream = textStream.pipeThrough(
    new TransformStream<string, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(encoder.encode(chunk));
      },
    })
  );

  return new Response(outStream, {
    headers: {
      ...headers,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export async function OPTIONS(req: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}
