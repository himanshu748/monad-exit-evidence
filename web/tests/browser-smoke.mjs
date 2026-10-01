import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidence = process.env.EVIDENCE_DIR ?? resolve(root, "web/design");
await mkdir(evidence, { recursive: true });
const port = process.env.SMOKE_PORT ?? "4180";
const server = spawn(process.execPath, ["src/server.ts"], {
  cwd: root,
  env: { ...process.env, PORT: port },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", (x) => (serverLog += x));
server.stderr.on("data", (x) => (serverLog += x));
const base = `http://127.0.0.1:${port}`;
let browser;
try {
  for (let count = 0; count < 50; count++) {
    try {
      const r = await fetch(base + "/api/health");
      if (r.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ??
      (existsSync("/usr/bin/chromium")
        ? "/usr/bin/chromium"
        : chromium.executablePath()),
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1536, height: 1024 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.getByRole("heading", { name: "Live liquidity" }).waitFor();
  await page
    .getByRole("option", { name: "BTC", exact: true })
    .waitFor({ state: "attached", timeout: 25000 });
  if (await page.getByRole("button", { name: "Review limits" }).isDisabled())
    throw new Error(
      "Live market response did not permit review: " +
        (await page.locator("main").innerText()),
    );
  await page
    .getByText("Snapshot estimate", { exact: true })
    .waitFor({ timeout: 25000 });
  await page.screenshot({
    path: resolve(evidence, "desktop-initial.png"),
    fullPage: true,
  });
  const results = [];
  for (const [scenario, status] of [
    ["partial", "Partial outcome"],
    ["interrupted", "Outcome unknown"],
    ["unauthorized", "Request rejected"],
    ["duplicate", "Rehearsal completed"],
    ["valid", "Rehearsal completed"],
    ["tampered", "Rehearsal completed"],
  ]) {
    const separate = page.getByRole("button", {
      name: "Start a separate rehearsal",
    });
    if (await separate.isVisible()) await separate.click();
    await page.getByLabel("Rehearsal scenario").selectOption(scenario);
    await page.getByRole("button", { name: "Review limits" }).click();
    await page
      .getByRole("button", { name: "Run rehearsal", exact: true })
      .click();
    await page.getByText(status, { exact: true }).waitFor({ timeout: 20000 });
    await page
      .getByRole("button", { name: "Verify receipt", exact: true })
      .click();
    await page
      .getByText(
        scenario === "tampered"
          ? "Integrity check failed"
          : "Receipt integrity verified",
        { exact: true },
      )
      .waitFor();
    const json = JSON.parse(await page.locator("#receipt-json").inputValue());
    results.push({
      scenario,
      status: json.execution.status,
      providerWrites: json.execution.providerWrites,
      filledQuantity: json.execution.filledQuantity,
      reservedQuantity: json.execution.reservedQuantity,
    });
    if (json.execution.providerWrites !== 0)
      throw new Error("A replay reported provider writes");
    if (scenario === "partial") {
      await page.screenshot({
        path: resolve(evidence, "desktop-partial.png"),
        fullPage: true,
      });
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "Export JSON" }).click();
      const download = await downloadPromise;
      const path = await download.path();
      const exported = JSON.parse(await readFile(path, "utf8"));
      if (JSON.stringify(exported) !== JSON.stringify(json))
        throw new Error("Export changed the returned receipt");
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: resolve(evidence, "mobile-partial.png"),
        fullPage: true,
      });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      if (overflow) throw new Error("Mobile horizontal overflow");
      await page.setViewportSize({ width: 1536, height: 1024 });
    }
  }
  // Verify a lost-response recovery uses the same recorded server receipt after reload.
  const before = JSON.parse(await page.locator("#receipt-json").inputValue());
  await page.reload();
  await page.getByRole("button", { name: "Retry same request" }).click();
  await page.getByText("Rehearsal completed", { exact: true }).waitFor();
  const after = JSON.parse(await page.locator("#receipt-json").inputValue());
  if (before.id !== after.id)
    throw new Error("Reload recovery created another receipt");
  await page.getByRole("combobox", { name: /Network/ }).selectOption("testnet");
  if (
    !(await page
      .getByRole("button", { name: "Run rehearsal", exact: true })
      .isDisabled())
  )
    throw new Error("Network change retained review");
  await page.screenshot({
    path: resolve(evidence, "desktop-network-reset.png"),
    fullPage: true,
  });
  if (errors.length) throw new Error("Browser errors: " + errors.join("; "));
  const result = {
    url: base,
    title: await page.title(),
    viewport: { desktop: "1536x1024", mobile: "390x844" },
    provider: "Real public Perpl reads",
    results,
    exportUnchanged: true,
    reloadIdempotency: true,
    networkReset: true,
    mobileOverflow: false,
    browserErrors: errors,
    method:
      "Local Playwright Chromium on macOS using the production Node server and real public Perpl reads.",
  };
  await writeFile(
    resolve(evidence, "browser-results.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser?.close();
  server.kill();
  if (serverLog) console.log(serverLog);
}
