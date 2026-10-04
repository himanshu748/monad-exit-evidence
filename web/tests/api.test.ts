import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/api";

// Offline fetch/timer tests, not live provider or browser performance evidence.
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function pendingFetch() {
  const signals: AbortSignal[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_path: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          const signal = init.signal as AbortSignal;
          signals.push(signal);
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    ),
  );
  return signals;
}
describe("public read deadlines", () => {
  it("keeps normal activity reads bounded at 35 seconds and clears the timer", async () => {
    const signals = pendingFetch();
    const read = api.activity("mainnet");
    const rejected = expect(read).rejects.toThrow("Public read timed out");
    await vi.advanceTimersByTimeAsync(34999);
    expect(signals[0].aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await rejected;
    expect(signals[0].aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("allows the server's complete observation budget and aborts only at 65 seconds", async () => {
    const signals = pendingFetch();
    const read = api.observe("testnet", "0x" + "a".repeat(64), "3");
    const rejected = expect(read).rejects.toThrow("Public read timed out");
    await vi.advanceTimersByTimeAsync(52000);
    expect(signals[0].aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(12999);
    expect(signals[0].aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await rejected;
    expect(signals[0].aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("clears observation timers after success and provider errors without retries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: { outcome: "CHAIN_OBSERVED" } }),
      })),
    );
    expect(await api.observe("mainnet", "0x" + "a".repeat(64), "")).toEqual({
      outcome: "CHAIN_OBSERVED",
    });
    expect(vi.getTimerCount()).toBe(0);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: { message: "Provider unavailable" } }),
      })),
    );
    await expect(api.activity("mainnet")).rejects.toThrow(
      "Provider unavailable",
    );
    expect(vi.getTimerCount()).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

it("activity cancellation preserves AbortError and cleans timers/listeners without retrying", async () => {
  const signals = pendingFetch(),
    controller = new AbortController();
  const remove = vi.spyOn(controller.signal, "removeEventListener");
  const read = api.activity("mainnet", controller.signal);
  const cancelled = expect(read).rejects.toMatchObject({
    name: "AbortError",
    message: "Public read cancelled",
  });
  controller.abort();
  await cancelled;
  expect(signals[0].aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
  expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("already cancelled activity never starts another request", async () => {
  pendingFetch();
  const controller = new AbortController();
  controller.abort();
  await expect(
    api.activity("testnet", controller.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(fetch).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
it("non-JSON function errors show meaningful HTTP status without exposing body or parser details", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: false,
      status: 504,
      json: async () => {
        throw new SyntaxError("raw-html-secret-marker");
      },
    })),
  );
  await expect(
    api.observe("mainnet", "0x" + "a".repeat(64), ""),
  ).rejects.toThrow("Read failed (504): public response was not valid JSON");
  expect(vi.getTimerCount()).toBe(0);
  expect(fetch).toHaveBeenCalledTimes(1);
});
