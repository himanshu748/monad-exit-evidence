import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LandingPage, { activityAvailability } from "../src/LandingPage";
import type { Activity, Network } from "../src/types";

// Offline DOM inputs only. These are never served by the running application
// and are not provider, rendered-browser or live integration evidence.
const now = Date.parse("2026-10-04T15:00:00Z");
function activity(network: Network): Activity {
  return {
    status: "live",
    source: "ENVIO",
    chainId: network === "mainnet" ? 143 : 10143,
    watermark: 120,
    windowStartBlock: 104,
    receivedAt: new Date(now).toISOString(),
    events: [],
  };
}
afterEach(() => {
  vi.useRealTimers();
});
describe("overview DOM and real-read state handling", () => {
  it("reads only indexed activity once per network and labels source-scoped availability", async () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    const api = {
      activity: vi.fn(async (network: Network) => ({
        ...activity(network),
        receivedAt: new Date(now + 123).toISOString(),
      })),
    };
    render(<LandingPage api={api} />);
    await screen.findAllByText("Indexed activity: Available");
    expect(api.activity.mock.calls.map(([network]) => [network])).toEqual([
      ["mainnet"],
      ["testnet"],
    ]);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "A quote isnot a fill.",
    );
    expect(
      screen.getAllByRole("link", { name: "Open live workbench" }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole("link", { name: "Open live workbench" })[0],
    ).toHaveAttribute("href", "#workbench");
    expect(
      screen.getByRole("link", { name: "View source on GitHub" }),
    ).toHaveAttribute(
      "href",
      "https://github.com/himanshu748/monad-exit-evidence",
    );
    expect(screen.getByRole("main")).toHaveAttribute("id", "overview");
    expect(screen.getAllByRole("status")).toHaveLength(2);
    expect(
      screen
        .getByRole("region", { name: "Monad mainnet" })
        .querySelector("time"),
    ).toHaveAttribute("datetime", new Date(now + 123).toISOString());
    const mainnet = screen.getByRole("region", { name: "Monad mainnet" });
    expect(mainnet.querySelector("time")).toHaveTextContent(
      "2026-10-04 15:00:00.123 UTC",
    );
    expect(within(mainnet).getByText("Coverage starts")).toBeVisible();
    expect(within(mainnet).getByText("Block 104")).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.getAllByText(/Quote and receipt sources are checked separately/, {
        selector: "p",
      }),
    ).toHaveLength(2);
  });
  it("keeps loading, provider-unavailable and request-error states distinct per network", async () => {
    let resolveMain!: (value: Activity) => void;
    const api = {
      activity: vi.fn((network: Network) =>
        network === "mainnet"
          ? new Promise<Activity>((resolve) => {
              resolveMain = resolve;
            })
          : Promise.reject(new Error("Provider read failed")),
      ),
    };
    render(<LandingPage api={api} />);
    expect(
      screen.getByRole("button", { name: "Checking sources…" }),
    ).toBeDisabled();
    expect(
      within(screen.getByRole("region", { name: "Monad mainnet" })).getByText(
        "Indexed activity: Checking source…",
      ),
    ).toBeVisible();
    await screen.findByText("Indexed activity: Read failed");
    await act(async () => {
      resolveMain({
        ...activity("mainnet"),
        status: "unavailable",
        watermark: null,
        error: "Indexer is unavailable",
      });
    });
    expect(screen.getByText("Indexed activity: Unavailable")).toBeVisible();
    expect(screen.getByText("Indexer is unavailable")).toBeVisible();
    expect(screen.getByText("Provider read failed")).toBeVisible();
    expect(screen.queryByText(/Block 120/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refresh activity" }),
    ).toBeEnabled();
  });
  it("expires the original timestamp locally without polling or manufacturing another check", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const api = {
      activity: vi.fn(async (network: Network) => activity(network)),
    };
    render(<LandingPage api={api} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getAllByText("Indexed activity: Available")).toHaveLength(2);
    await act(async () => {
      vi.advanceTimersByTime(125000);
    });
    expect(screen.getAllByText("Indexed activity: Stale")).toHaveLength(2);
    expect(api.activity).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/Block 120/)).not.toBeInTheDocument();
    expect(
      screen
        .getByRole("region", { name: "Monad mainnet" })
        .querySelector("time"),
    ).toHaveAttribute("datetime", new Date(now).toISOString());
  });
  it("manual refresh clears old successful evidence before failures and allows recovery", async () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    let round = 0;
    const api = {
      activity: vi.fn(async (network: Network) => {
        if (round === 1) throw new Error("Source disconnected");
        return activity(network);
      }),
    };
    render(<LandingPage api={api} />);
    await screen.findAllByText("Indexed activity: Available");
    round = 1;
    fireEvent.click(screen.getByRole("button", { name: "Refresh activity" }));
    expect(
      screen.queryByText("Indexed activity: Available"),
    ).not.toBeInTheDocument();
    await screen.findAllByText("Indexed activity: Read failed");
    expect(screen.queryByText(/Block 120/)).not.toBeInTheDocument();
    round = 2;
    fireEvent.click(screen.getByRole("button", { name: "Refresh activity" }));
    await screen.findAllByText("Indexed activity: Available");
    expect(api.activity.mock.calls.map(([network]) => [network])).toEqual([
      ["mainnet"],
      ["testnet"],
      ["mainnet"],
      ["testnet"],
      ["mainnet"],
      ["testnet"],
    ]);
  });
  it("fails closed on wrong network, bad coverage and stale provider head", () => {
    expect(
      activityAvailability(activity("mainnet"), "testnet", now).label,
    ).toBe("Unavailable");
    expect(
      activityAvailability(
        { ...activity("mainnet"), watermark: -1 },
        "mainnet",
        now,
      ).label,
    ).toBe("Unavailable");
    expect(
      activityAvailability(
        { ...activity("mainnet"), receivedAt: "invalid" },
        "mainnet",
        now,
      ).label,
    ).toBe("Stale");
    expect(
      activityAvailability(
        {
          ...activity("mainnet"),
          receivedAt: new Date(now + 16000).toISOString(),
        },
        "mainnet",
        now,
      ).label,
    ).toBe("Stale");
    const hypersync = {
      ...activity("mainnet"),
      engine: "HYPERSYNC" as const,
      providerHead: 120,
      windowStartBlock: 105,
      providerHeadObservedAt: new Date(now - 301000).toISOString(),
    };
    expect(activityAvailability(hypersync, "mainnet", now).label).toBe("Stale");
    expect(
      activityAvailability(
        {
          ...hypersync,
          providerHeadObservedAt: new Date(now).toISOString(),
          providerHead: 119,
        },
        "mainnet",
        now,
      ).label,
    ).toBe("Unavailable");
  });
  it("does not update an unmounted overview when late reads settle", async () => {
    let resolveRead!: (value: Activity) => void;
    const api = {
      activity: vi.fn(
        () =>
          new Promise<Activity>((resolve) => {
            resolveRead = resolve;
          }),
      ),
    };
    const { unmount } = render(<LandingPage api={api} />);
    unmount();
    await act(async () => {
      resolveRead(activity("testnet"));
    });
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
    expect(api.activity).toHaveBeenCalledTimes(2);
  });
});

it("aborts pending landing reads on unmount and replaces previous refresh signals locally", async () => {
  // Cancellation of the local client promise is not proof of server cancellation.
  vi.spyOn(Date, "now").mockReturnValue(now);
  const signals: AbortSignal[] = [];
  const pending = {
    activity: vi.fn((_network: Network, signal?: AbortSignal) => {
      signals.push(signal!);
      return new Promise<Activity>(() => {});
    }),
  };
  const first = render(<LandingPage api={pending} />);
  expect(signals).toHaveLength(2);
  expect(signals.every((signal) => !signal.aborted)).toBe(true);
  first.unmount();
  expect(signals.every((signal) => signal.aborted)).toBe(true);
  const completedSignals: AbortSignal[] = [];
  const completed = {
    activity: vi.fn(async (network: Network, signal?: AbortSignal) => {
      completedSignals.push(signal!);
      return activity(network);
    }),
  };
  render(<LandingPage api={completed} />);
  await screen.findAllByText("Indexed activity: Available");
  fireEvent.click(screen.getByRole("button", { name: "Refresh activity" }));
  await screen.findAllByText("Indexed activity: Available");
  expect(completedSignals).toHaveLength(4);
  expect(completedSignals.slice(0, 2).every((signal) => signal.aborted)).toBe(
    true,
  );
  expect(completedSignals.slice(2).every((signal) => !signal.aborted)).toBe(
    true,
  );
});
