import type { Api } from "./types";
async function request<T>(
  path: string,
  init?: RequestInit,
  timeout = 35000,
): Promise<T> {
  const controller = new AbortController(),
    external = init?.signal;
  const cancel = () => controller.abort();
  if (external?.aborted) cancel();
  else external?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    if (controller.signal.aborted)
      throw new DOMException("Public read cancelled", "AbortError");
    const response = await fetch(path, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    let body;
    try {
      body = await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
      throw new Error(
        `Read failed (${response.status}): public response was not valid JSON`,
      );
    }
    if (
      !response.ok ||
      !body ||
      typeof body !== "object" ||
      body.error ||
      body.data == null
    )
      throw new Error(
        body?.error?.message || `Read failed (${response.status})`,
      );
    return body.data as T;
  } catch (error) {
    if (controller.signal.aborted && external?.aborted)
      throw new DOMException("Public read cancelled", "AbortError");
    if (
      controller.signal.aborted ||
      (error instanceof DOMException && error.name === "AbortError")
    )
      throw new Error(
        "Public read timed out. Refresh or retry the transaction read; no order was submitted.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
    external?.removeEventListener("abort", cancel);
  }
}
export const api: Api = {
  markets: (network) => request(`/api/markets?network=${network}`),
  liquidity: (input) =>
    request(
      `/api/liquidity?${new URLSearchParams({ network: input.network, marketId: String(input.marketId), quantity: input.quantity, direction: input.direction })}`,
    ),
  activity: (network, signal) =>
    request(`/api/activity?network=${network}`, { signal }),
  book: (network, marketId) =>
    request(
      `/api/book?${new URLSearchParams({ network, marketId: String(marketId) })}`,
    ),
  observe: (network, transactionHash, logIndex) =>
    request(
      `/api/observations?${new URLSearchParams({ network, transactionHash, ...(logIndex ? { logIndex } : {}) })}`,
      undefined,
      65000,
    ),
};
