import {
  render,
  screen,
  waitFor,
  within,
  fireEvent,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { markets, liquidity, activity, receipt } from "./fixtures";
function client() {
  return {
    markets: vi.fn().mockResolvedValue(markets),
    liquidity: vi.fn().mockResolvedValue(liquidity),
    activity: vi.fn().mockResolvedValue(activity),
    rehearse: vi.fn().mockResolvedValue(receipt),
    verify: vi.fn().mockResolvedValue({
      valid: true,
      checks: [],
      meaning: "Integrity only",
    }),
  };
}
async function ready(api = client()) {
  render(<App api={api} />);
  await screen.findByRole("option", { name: "BTC" });
  return { api, user: userEvent.setup() };
}
beforeEach(() => {
  sessionStorage.clear();
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-01T00:00:00Z"));
});
afterEach(() => vi.restoreAllMocks());
describe("exit-evidence workflow", () => {
  it("separates live reads from hypothetical state with accessible labels", async () => {
    await ready();
    expect(
      screen.getByRole("heading", { name: "Live liquidity" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Existing position")).toBeVisible();
    expect(screen.getByText("Hypothetical position")).toBeVisible();
    expect(screen.getByText("Simulated approval and execution")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Run rehearsal" }),
    ).toBeDisabled();
  });
  it("shows errors for malformed quantities before review", async () => {
    const { user } = await ready();
    await user.clear(screen.getByLabelText("Close quantity"));
    await user.type(screen.getByLabelText("Close quantity"), "1e-2");
    await user.click(screen.getByRole("button", { name: "Review limits" }));
    expect(await screen.findByText(/plain positive decimal/i)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Run rehearsal" }),
    ).toBeDisabled();
  });
  it("reviews exact integers then disables pending execution and duplicate clicks", async () => {
    const api = client();
    let complete: (r: any) => void = () => {};
    api.rehearse.mockImplementation(
      () =>
        new Promise((r) => {
          complete = r;
        }),
    );
    const { user } = await ready(api);
    await user.click(screen.getByRole("button", { name: "Review limits" }));
    expect(screen.getByTestId("review-close")).toHaveTextContent("2000");
    await user.click(screen.getByRole("button", { name: "Run rehearsal" }));
    expect(
      screen.getByRole("button", { name: "Running rehearsal…" }),
    ).toBeDisabled();
    expect(api.rehearse).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Existing position")).toBeDisabled();
    expect(screen.getByLabelText("Market")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Refresh reads" }),
    ).toBeDisabled();
    complete(receipt);
    await screen.findByText("Partial outcome");
  });
  it("preserves partial and reserved quantities as unresolved", async () => {
    const { user } = await ready();
    await user.click(screen.getByRole("button", { name: "Review limits" }));
    await user.click(screen.getByRole("button", { name: "Run rehearsal" }));
    await screen.findByText("Partial outcome");
    expect(screen.getByText(/partial result is not completion/i)).toBeVisible();
    expect(
      within(screen.getByTestId("reserved-row")).getByText("0.01000 BTC"),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Run rehearsal" }),
    ).toBeDisabled();
  });
  it("does not silently retry an interrupted outcome", async () => {
    const api = client();
    api.rehearse.mockResolvedValue({
      ...receipt,
      execution: { ...receipt.execution, status: "UNKNOWN" },
    });
    const { user } = await ready(api);
    await user.click(screen.getByRole("button", { name: "Review limits" }));
    await user.click(screen.getByRole("button", { name: "Run rehearsal" }));
    await screen.findByText("Outcome unknown");
    expect(screen.getByText(/reservation remains held/i)).toBeVisible();
    expect(api.rehearse).toHaveBeenCalledTimes(1);
  });
  it("invalidates reviewed limits on network and scenario change", async () => {
    const { user } = await ready();
    await user.click(screen.getByRole("button", { name: "Review limits" }));
    await user.selectOptions(
      screen.getByLabelText("Rehearsal scenario"),
      "partial",
    );
    expect(
      screen.getByRole("button", { name: "Run rehearsal" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Review limits" }));
    await user.selectOptions(screen.getByLabelText("Network"), "testnet");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Run rehearsal" }),
      ).toBeDisabled(),
    );
    expect(screen.queryByTestId("review-close")).not.toBeInTheDocument();
  });
  it("retains one idempotency key after an unavailable response", async () => {
    const api = client();
    api.rehearse
      .mockRejectedValueOnce(new Error("Connection lost"))
      .mockResolvedValueOnce(receipt);
    const { user } = await ready(api);
    await user.click(screen.getByRole("button", { name: "Review limits" }));
    await user.click(screen.getByRole("button", { name: "Run rehearsal" }));
    await screen.findByText("Connection lost");
    await user.click(
      screen.getByRole("button", { name: "Retry same request" }),
    );
    await screen.findByText("Partial outcome");
    expect(api.rehearse.mock.calls[0][1]).toBe(api.rehearse.mock.calls[1][1]);
  });
  it("restores an attempted request after remount and reuses its original key", async () => {
    const api = client();
    api.rehearse
      .mockRejectedValueOnce(new Error("Connection lost"))
      .mockResolvedValueOnce(receipt);
    const user = userEvent.setup();
    const first = render(<App api={api} />);
    await screen.findByRole("option", { name: "BTC" });
    await user.click(screen.getByRole("button", { name: "Review limits" }));
    await user.click(screen.getByRole("button", { name: "Run rehearsal" }));
    await screen.findByText("Connection lost");
    first.unmount();
    render(<App api={api} />);
    await screen.findByRole("option", { name: "BTC" });
    await user.click(
      screen.getByRole("button", { name: "Retry same request" }),
    );
    await screen.findByText("Partial outcome");
    expect(api.rehearse.mock.calls[0][1]).toBe(api.rehearse.mock.calls[1][1]);
    expect(api.rehearse.mock.calls[0][0]).toEqual(
      api.rehearse.mock.calls[1][0],
    );
  });
  it("does not regenerate a reviewed request on repeated review clicks", async () => {
    const { api, user } = await ready();
    await user.click(screen.getByRole("button", { name: "Review limits" }));
    const stored = sessionStorage.getItem("exit-evidence.review.v1");
    await user.click(screen.getByRole("button", { name: "Review limits" }));
    expect(sessionStorage.getItem("exit-evidence.review.v1")).toBe(stored);
    await user.click(screen.getByRole("button", { name: "Run rehearsal" }));
    await screen.findByText("Partial outcome");
    await user.click(screen.getByRole("button", { name: "Review limits" }));
    expect(
      screen.getByRole("button", { name: "Run rehearsal" }),
    ).toBeDisabled();
    expect(api.rehearse).toHaveBeenCalledTimes(1);
  });
  it("shows provider failures and never substitutes public fixtures", async () => {
    const api = client();
    api.markets.mockRejectedValue(new Error("Public read unavailable"));
    render(<App api={api} />);
    expect(await screen.findByText("Public read unavailable")).toBeVisible();
    expect(screen.queryByText("59990")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Review limits" }),
    ).toBeDisabled();
  });
  it("does not invent indexed activity or completed integrations", async () => {
    await ready();
    expect(
      await screen.findByText(/Envio pipeline not configured/),
    ).toBeVisible();
    expect(screen.getByText("Access required")).toBeVisible();
  });
  it("verifies edited receipt JSON without treating integrity as execution", async () => {
    const api = client();
    api.verify.mockResolvedValue({
      valid: false,
      checks: [],
      meaning: "Digest mismatch",
    });
    const { user } = await ready(api);
    await user.click(screen.getByRole("button", { name: "Review limits" }));
    await user.click(screen.getByRole("button", { name: "Run rehearsal" }));
    await screen.findByText("Partial outcome");
    await user.click(screen.getByRole("button", { name: "Verify receipt" }));
    await screen.findByText("Integrity check failed");
    expect(
      screen.getByText(
        "Receipt integrity does not prove real-world execution.",
      ),
    ).toBeVisible();
  });
});

describe("review fixes", () => {
  it("refresh preserves lost-response identity and requires explicit separate rehearsal", async () => {
    const api = client();
    api.rehearse
      .mockRejectedValueOnce(new Error("Connection lost"))
      .mockResolvedValueOnce(receipt);
    const { user } = await ready(api);
    await user.click(screen.getByRole("button", { name: "Review limits" }));
    await user.click(screen.getByRole("button", { name: "Run rehearsal" }));
    await screen.findByText("Connection lost");
    await user.click(screen.getByRole("button", { name: "Refresh reads" }));
    await screen.findByRole("option", { name: "BTC" });
    expect(
      screen.getByRole("button", { name: "Review limits" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Network")).toBeDisabled();
    await user.click(
      screen.getByRole("button", { name: "Retry same request" }),
    );
    await screen.findByText("Partial outcome");
    expect(api.rehearse.mock.calls[0][1]).toBe(api.rehearse.mock.calls[1][1]);
  });
  it("source freshness expires on clock updates without deleting a recovery record", async () => {
    await ready();
    vi.mocked(Date.now).mockReturnValue(Date.parse("2026-10-01T00:10:00Z"));
    fireEvent(window, new Event("focus"));
    await screen.findByText("Stale snapshot");
    expect(screen.getByText("Stale order book")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Review limits" }),
    ).toBeDisabled();
  });
  it("old verification cannot certify newly edited JSON", async () => {
    const api = client();
    let resolve: (value: any) => void = () => {};
    api.verify.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const { user } = await ready(api);
    await user.click(screen.getByRole("button", { name: "Review limits" }));
    await user.click(screen.getByRole("button", { name: "Run rehearsal" }));
    await screen.findByText("Partial outcome");
    await user.click(screen.getByRole("button", { name: "Verify receipt" }));
    fireEvent.change(screen.getByLabelText("Receipt JSON"), {
      target: { value: "THIS IS NOT A RECEIPT" },
    });
    await act(async () =>
      resolve({ valid: true, checks: [], meaning: "Integrity only" }),
    );
    expect(
      screen.queryByText("Receipt integrity verified"),
    ).not.toBeInTheDocument();
  });
});
