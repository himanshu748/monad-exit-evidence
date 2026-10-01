import type { Api } from "./types";
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(path, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    const body = await response.json();
    if (!response.ok || body.error || body.data == null)
      throw new Error(
        body.error?.message || `Read failed (${response.status})`,
      );
    return body.data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw new Error(
        "Request timed out. Retry the same request to recover its recorded result.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
export const api: Api = {
  markets: (network) => request(`/api/markets?network=${network}`),
  liquidity: (input) =>
    request(
      `/api/liquidity?${new URLSearchParams({ network: input.network, marketId: String(input.marketId), quantity: input.quantity, direction: input.direction })}`,
    ),
  activity: (network) => request(`/api/activity?network=${network}`),
  rehearse: (input, key) =>
    request("/api/rehearsals", {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify(input),
    }),
  verify: (receipt) =>
    request("/api/receipts/verify", {
      method: "POST",
      body: JSON.stringify({ receipt }),
    }),
};
