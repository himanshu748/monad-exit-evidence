import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Site, { viewForHash } from "../src/Site";
import type { Activity, Network } from "../src/types";

// Offline route harness only; existing App tests exercise the real workbench.
vi.mock("../src/App", () => ({
  default: () => (
    <main id="workbench">
      <h1>Workbench route harness</h1>
      <section id="activity">Activity route target</section>
      <section id="evidence">Evidence route target</section>
      <input aria-label="Route state" defaultValue="" />
      <a href="#overview">Overview</a>
    </main>
  ),
}));
const api = {
  activity: vi.fn(async (network: Network): Promise<Activity> => ({
    status: "unavailable",
    source: "ENVIO",
    chainId: network === "mainnet" ? 143 : 10143,
    watermark: null,
    receivedAt: new Date().toISOString(),
    events: [],
  })),
};
beforeEach(() => {
  window.history.replaceState(null, "", "/");
  api.activity.mockClear();
});
async function navigate(hash: string) {
  await act(async () => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}
describe("native hash route handling", () => {
  it("makes the overview the root and preserves all workbench section routes", () => {
    expect(viewForHash("")).toBe("overview");
    for (const hash of ["#overview", "#how-it-works", "#unknown"])
      expect(viewForHash(hash)).toBe("overview");
    for (const hash of ["#workbench", "#activity", "#evidence"])
      expect(viewForHash(hash)).toBe("workbench");
  });
  it("opens the lazy workbench, focuses its section, preserves form state between deep links and returns to the overview", async () => {
    render(<Site api={api} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "A quote isnot a fill.",
    );
    await navigate("#workbench");
    await screen.findByRole("heading", { name: "Workbench route harness" });
    expect(screen.getByRole("main")).toHaveFocus();
    expect(document.title).toBe("Exit evidence · Monad workbench");
    fireEvent.change(screen.getByLabelText("Route state"), {
      target: { value: "retained" },
    });
    await navigate("#evidence");
    expect(document.getElementById("evidence")).toHaveFocus();
    expect(screen.getByLabelText("Route state")).toHaveValue("retained");
    await navigate("#activity");
    expect(document.getElementById("activity")).toHaveFocus();
    await navigate("#overview");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "A quote isnot a fill.",
    );
    expect(screen.getByRole("main")).toHaveFocus();
    expect(document.title).toBe("Exit evidence · Follow the evidence on Monad");
  });
  it("mounts a direct evidence link into the workbench without overview source requests", async () => {
    window.history.replaceState(null, "", "/#evidence");
    render(<Site api={api} />);
    await screen.findByRole("heading", { name: "Workbench route harness" });
    expect(document.getElementById("evidence")).toHaveFocus();
    expect(api.activity).not.toHaveBeenCalled();
  });
});
