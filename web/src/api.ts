import type { Api } from "./types";
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35000);
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
        "Public read timed out. Refresh or retry the transaction read; no order was submitted.",
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
  book: (network, marketId) =>
    request(
      `/api/book?${new URLSearchParams({ network, marketId: String(marketId) })}`,
    ),
  observe: (network, transactionHash, logIndex) =>
    request(
      `/api/observations?${new URLSearchParams({ network, transactionHash, ...(logIndex ? { logIndex } : {}) })}`,
    ),
};
