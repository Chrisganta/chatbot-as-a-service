export type ChatRole = "user" | "assistant" | "system";
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY = 20;
const MAX_CONTEXT_LENGTH = 8000;

export class ValidationError extends Error {}

export function validateAndTrim(body: unknown): ChatMessage[] {
  if (typeof body !== "object" || body === null || !("messages" in body)) {
    throw new ValidationError(
      'Request body must be an object with a "messages" array.'
    );
  }
  const { messages } = body as { messages: unknown };
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new ValidationError('"messages" must be a non-empty array.');
  }

  const cleaned: ChatMessage[] = [];
  for (const m of messages) {
    if (
      typeof m !== "object" ||
      m === null ||
      !("role" in m) ||
      !("content" in m) ||
      !["user", "assistant", "system"].includes((m as any).role) ||
      typeof (m as any).content !== "string"
    ) {
      throw new ValidationError(
        "Each message needs a valid role (user|assistant|system) and string content."
      );
    }
    const content = (m as any).content.trim();
    if (content.length === 0) continue;
    if (content.length > MAX_MESSAGE_LENGTH) {
      throw new ValidationError(
        `Message content exceeds ${MAX_MESSAGE_LENGTH} characters.`
      );
    }
    cleaned.push({ role: (m as any).role, content });
  }

  if (cleaned.length === 0) {
    throw new ValidationError('"messages" contained no usable content.');
  }

  return cleaned.slice(-MAX_HISTORY);
}

// Context is an opaque string supplied by the embedding host app (e.g. via
// widget.js's data-context-url mechanism). The chatbot service never
// interprets its contents — it's just grounding text handed to the model.
export function validateContext(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null || !("context" in body)) {
    return undefined;
  }
  const { context } = body as { context: unknown };
  if (context === undefined || context === null) return undefined;
  if (typeof context !== "string") {
    throw new ValidationError('"context" must be a string if provided.');
  }
  const trimmed = context.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > MAX_CONTEXT_LENGTH) {
    throw new ValidationError(
      `"context" exceeds ${MAX_CONTEXT_LENGTH} characters.`
    );
  }
  return trimmed;
}
