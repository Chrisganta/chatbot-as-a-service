import { config, llmAuthHeaders } from "@/lib/config";

export async function GET() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  let reachable = false;

  try {
    const res = await fetch(`${config.llmBaseUrl}/models`, {
      signal: controller.signal,
      headers: llmAuthHeaders(),
    });
    reachable = res.ok;
  } catch {
    reachable = false;
  } finally {
    clearTimeout(timeout);
  }

  return Response.json({ model: config.llmModel, reachable });
}
