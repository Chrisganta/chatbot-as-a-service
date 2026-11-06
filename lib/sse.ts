// Parses an OpenAI-style SSE byte stream ("data: {...}\n\n" lines, terminated
// by "data: [DONE]") into plain assistant-text chunks, handling partial lines
// that straddle two network reads.
export function createSseToTextTransform(): TransformStream<Uint8Array, string> {
  const decoder = new TextDecoder();
  let buffer = "";

  return new TransformStream<Uint8Array, string>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });

      // SSE events are separated by \n\n; within an event, lines start with "data: ".
      const lines = buffer.split("\n");
      // Keep the last (possibly incomplete) line in the buffer for next time.
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice("data:".length).trim();
        if (data === "[DONE]") continue;
        if (data.length === 0) continue;

        try {
          const json = JSON.parse(data);
          const delta = json?.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            controller.enqueue(delta);
          }
        } catch {
          // Ignore malformed JSON lines
        }
      }
    },
    flush(controller) {
      // Process any trailing complete "data:" line left in the buffer
      const trimmed = buffer.trim();
      if (trimmed.startsWith("data:")) {
        const data = trimmed.slice("data:".length).trim();
        if (data && data !== "[DONE]") {
          try {
            const json = JSON.parse(data);
            const delta = json?.choices?.[0]?.delta?.content;
            if (typeof delta === "string") controller.enqueue(delta);
          } catch {}
        }
      }
    },
  });
}
