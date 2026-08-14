export interface AdapterResponse {
  status: number;
  headers: Headers;
  json: unknown;
}

export async function fetchJson(
  url: string,
  init: RequestInit = {},
  timeoutMs = 10_000,
): Promise<AdapterResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const json = await res.json().catch(() => null);
    return { status: res.status, headers: res.headers, json };
  } finally {
    clearTimeout(timer);
  }
}

export function csvEnv(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
