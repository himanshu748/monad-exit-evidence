import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import App from "../src/App";
import { ActivityPanel } from "../src/ActivityPanel";
import type { Activity, Api, Observation } from "../src/types";

// Deliberate offline DOM inputs only, never runtime or integration evidence.
const timestamp = new Date().toISOString(),
  hash = "0x" + "a".repeat(64);
function observation(missing: boolean): Observation {
  return {
    schema: "exit-evidence-observation/v1",
    network: "mainnet",
    chainId: 143,
    verifiedAt: timestamp,
    sourceUrl: "https://rpc.monad.xyz",
    outcome: missing ? "SOURCE_MISMATCH" : "CHAIN_OBSERVED",
    observation: {
      id: `143:${hash}:3`,
      transactionHash: hash,
      blockHash: "0x" + "b".repeat(64),
      blockNumber: 80,
      logIndex: 3,
      kind: "PositionClosed",
      marketId: null,
      accountId: null,
      quantity: null,
      observedAt: timestamp,
      source: "MONAD_PUBLIC_RPC",
      decoded: {},
    },
    envio: {
      status: missing ? "MISSING_IN_INDEX" : "NOT_IN_CURRENT_PAGE",
      watermark: 80,
      checkedAt: timestamp,
    },
    checks: [
      {
        name: "Envio indexed values",
        result: missing ? "FAIL" : "UNKNOWN",
        observed: missing ? "MISSING_IN_INDEX" : "NOT_IN_CURRENT_PAGE",
      },
    ],
    limitations: [],
    integrity: { algorithm: "SHA-256", digest: "offline-dom-input" },
  };
}
function offlineApi(missing: boolean): Api {
  return {
    markets: async () => ({
      network: "mainnet",
      chainId: 143,
      source: "OFFLINE_UNIT_INPUT",
      sourceUrl: "",
      receivedAt: timestamp,
      observedAt: timestamp,
      stale: false,
      markets: [],
    }),
    activity: async () => ({
      status: "unavailable",
      source: "ENVIO",
      chainId: 143,
      watermark: null,
      receivedAt: timestamp,
      events: [],
    }),
    book: async () => {
      throw new Error("Unused offline read");
    },
    liquidity: async () => {
      throw new Error("Unused offline read");
    },
    observe: async () => observation(missing),
  };
}
it("covered missing indexed event displays source disagreement and failed check", async () => {
  render(<App api={offlineApi(true)} />);
  fireEvent.change(screen.getByLabelText("Transaction hash"), {
    target: { value: hash },
  });
  fireEvent.click(screen.getByRole("button", { name: "Read transaction" }));
  await screen.findByText("Chain event missing from Envio query");
  expect(
    screen.getByText(/completed a query covering this exact block/),
  ).toBeVisible();
  expect(screen.getByText("FAIL")).toBeVisible();
  expect(
    screen.queryByText(
      /No matching entity was returned from the current index window/,
    ),
  ).not.toBeInTheDocument();
});
it("HyperIndex current-window warning remains an unknown comparison", async () => {
  render(<App api={offlineApi(false)} />);
  fireEvent.change(screen.getByLabelText("Transaction hash"), {
    target: { value: hash },
  });
  fireEvent.click(screen.getByRole("button", { name: "Read transaction" }));
  await screen.findByText(
    /No matching entity was returned from the current index window/,
  );
  expect(screen.getByText("UNKNOWN")).toBeVisible();
  expect(
    screen.queryByText("Chain event missing from Envio query"),
  ).not.toBeInTheDocument();
});
it("finite HyperSync preview caption reports the actual range, spaced limitation and honest empty state", () => {
  const activity: Activity = {
    status: "live",
    source: "ENVIO",
    engine: "HYPERSYNC",
    chainId: 143,
    watermark: 119,
    windowStartBlock: 104,
    receivedAt: timestamp,
    events: [],
  };
  render(
    <ActivityPanel
      activity={activity}
      error=""
      network="mainnet"
      onInspect={() => {}}
    />,
  );
  expect(screen.getByText(/finite 16-block/)).toBeVisible();
  expect(screen.getByText(/starts at block 104\./)).toHaveTextContent(
    "This query starts at block 104. This preview does not claim complete history.",
  );
  expect(
    screen.getByText(/No events in this finite HyperSync preview/),
  ).toBeVisible();
});

it.each(["resolve", "reject"] as const)(
  "keeps observation work locked across input, network and refresh changes until %s",
  async (settlement) => {
    let resolve!: (value: Observation) => void;
    let reject!: (error: Error) => void;
    const pending = new Promise<Observation>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    const api = offlineApi(false);
    const observe = vi
      .fn()
      .mockImplementationOnce(() => pending)
      .mockResolvedValue(observation(false));
    api.observe = observe;
    api.activity = async (network) => ({
      status: "live",
      source: "ENVIO",
      chainId: network === "mainnet" ? 143 : 10143,
      watermark: 80,
      receivedAt: new Date().toISOString(),
      events: [hash, "0x" + "c".repeat(64)].map((transactionHash, index) => ({
        id: `${network}:${index}`,
        transactionHash,
        blockNumber: 80,
        logIndex: index,
        kind: "PositionClosed",
        marketId: null,
        accountId: null,
        quantity: null,
        source: "ENVIO",
      })),
    });
    render(<App api={api} />);
    // jsdom has no layout/scroll implementation; this is a DOM-only stub.
    document.getElementById("evidence")!.scrollIntoView = vi.fn();
    const first = await screen.findByRole("button", {
      name: "Inspect mainnet:0",
    });
    const second = screen.getByRole("button", { name: "Inspect mainnet:1" });
    // Two native calls in one React batch exercise the synchronous ref guard,
    // before a disabled-button render can prevent the second handler.
    await act(async () => {
      first.click();
      second.click();
    });
    expect(observe).toHaveBeenCalledTimes(1);
    const assertBusy = () => {
      expect(
        screen.getByRole("button", { name: "Reading transaction…" }),
      ).toBeDisabled();
      for (const button of screen.getAllByRole("button", {
        name: /^Inspect /,
      })) {
        expect(button).toBeDisabled();
      }
    };
    assertBusy();
    fireEvent.change(screen.getByLabelText("Transaction hash"), {
      target: { value: "0x" + "d".repeat(64) },
    });
    assertBusy();
    fireEvent.change(screen.getByLabelText("Network"), {
      target: { value: "testnet" },
    });
    await screen.findByRole("button", { name: "Inspect testnet:0" });
    assertBusy();
    fireEvent.click(screen.getByRole("button", { name: "Refresh reads" }));
    await screen.findByRole("button", { name: "Inspect testnet:0" });
    assertBusy();
    expect(observe).toHaveBeenCalledTimes(1);
    await act(async () => {
      if (settlement === "resolve") resolve(observation(false));
      else reject(new Error("Offline stale request rejected"));
      await pending.catch(() => {});
    });
    expect(
      screen.getByRole("button", { name: "Read transaction" }),
    ).not.toHaveTextContent("Reading");
    expect(
      screen.queryByText(
        /No matching entity was returned from the current index window/,
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Offline stale request rejected"),
    ).not.toBeInTheDocument();
    const next = screen.getByRole("button", { name: "Inspect testnet:0" });
    expect(next).toBeEnabled();
    fireEvent.click(next);
    await screen.findByText(
      /No matching entity was returned from the current index window/,
    );
    expect(observe).toHaveBeenCalledTimes(2);
    expect(observe.mock.calls[1][0]).toBe("testnet");
  },
);
