import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import App from "../src/App";
import type { Api } from "../src/types";
const base = "http://127.0.0.1:4192";
let server: ChildProcess;
async function read<T>(path: string): Promise<T> {
  const response = await fetch(base + path);
  const body = await response.json();
  if (!response.ok || body.error)
    throw new Error(body.error?.message ?? "Actual integration read failed");
  return body.data as T;
}
const liveApi: Api = {
  markets: (network) => read(`/api/markets?network=${network}`),
  book: (network, id) => read(`/api/book?network=${network}&marketId=${id}`),
  activity: (network) => read(`/api/activity?network=${network}`),
  liquidity: (input) =>
    read(
      `/api/liquidity?${new URLSearchParams({ ...input, marketId: String(input.marketId) })}`,
    ),
  observe: (network, transactionHash, logIndex) =>
    read(
      `/api/observations?${new URLSearchParams({ network, transactionHash, ...(logIndex ? { logIndex } : {}) })}`,
    ),
};
beforeAll(async () => {
  server = spawn(process.execPath, ["src/server.ts"], {
    cwd: resolve(process.cwd(), ".."),
    env: { ...process.env, PORT: "4192" },
    stdio: "ignore",
  });
  for (let count = 0; count < 80; count++) {
    try {
      await read("/api/health");
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Real local integration server did not start");
}, 15000);
afterAll(() => {
  server?.kill("SIGTERM");
});
async function ready() {
  render(<App api={liveApi} />);
  await screen.findByRole("option", { name: "BTC" }, { timeout: 30000 });
  return userEvent.setup();
}
describe("real integration UI", () => {
  it("shows real markets without prefilled positions, transactions or simulated outcomes", async () => {
    await ready();
    expect(screen.getByLabelText("Requested quantity")).toHaveValue("");
    expect(screen.getByLabelText("Transaction hash")).toHaveValue("");
    expect(
      screen.queryByLabelText("Rehearsal scenario"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Existing position"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Read transaction" }),
    ).toBeDisabled();
    await screen.findByText(
      "Actual public quotes. No position quantity or execution outcome is assumed.",
      {},
      { timeout: 30000 },
    );
  }, 40000);
  it("calculates user-supplied depth against the actual public order book", async () => {
    const user = await ready();
    await user.type(screen.getByLabelText("Requested quantity"), "0.001");
    await user.click(screen.getByRole("button", { name: "Calculate depth" }));
    await screen.findByText("Current book estimate", {}, { timeout: 30000 });
    expect(screen.getByText("Average price")).toBeVisible();
  }, 40000);
  it("invalid transaction input stays disabled without creating an outcome", async () => {
    const user = await ready();
    await user.type(
      screen.getByLabelText("Transaction hash"),
      "not-a-transaction",
    );
    expect(
      screen.getByRole("button", { name: "Read transaction" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Export observation JSON" }),
    ).not.toBeInTheDocument();
  }, 40000);
  it("network change clears entered quantity and transaction evidence", async () => {
    const user = await ready();
    await user.type(screen.getByLabelText("Requested quantity"), "0.001");
    await user.type(screen.getByLabelText("Transaction hash"), "entered-value");
    await user.selectOptions(screen.getByLabelText("Network"), "testnet");
    expect(screen.getByLabelText("Requested quantity")).toHaveValue("");
    expect(screen.getByLabelText("Transaction hash")).toHaveValue("");
    await waitFor(
      () =>
        expect(
          screen.getByText("Public Perpl snapshot · Chain 10143"),
        ).toBeVisible(),
      { timeout: 30000 },
    );
  }, 40000);
});
