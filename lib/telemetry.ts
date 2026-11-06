// Structured usage logging — counts/latency/outcomes only, never message
// content. Lines land in Vercel's log stream (Project -> Logs) as JSON, so
// they're filterable by `event` without any extra telemetry infra.
export function track(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ event, ts: Date.now(), ...data }));
}
