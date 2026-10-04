import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../..", import.meta.url));
const evidence =
  process.env.EVIDENCE_DIR ?? resolve(root, "web/design/real-integration");
await mkdir(evidence, { recursive: true });
const port = process.env.SMOKE_PORT ?? "4180",
  base = process.env.SMOKE_BASE_URL ?? `http://127.0.0.1:${port}`;
const server = process.env.SMOKE_BASE_URL
  ? undefined
  : spawn(process.execPath, ["src/server.ts"], {
      cwd: root,
      env: { ...process.env, PORT: port },
      stdio: "ignore",
    });
let browser;
try {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(base + "/api/health");
      if (r.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const recording = process.env.RECORD_REAL_DEMO === "1";
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1200 },
    acceptDownloads: true,
    ...(recording
      ? { recordVideo: { dir: evidence, size: { width: 1600, height: 1200 } } }
      : {}),
  });
  const page = await context.newPage(),
    errors = [],
    mutations = [],
    observations = [],
    scenes = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (r) => {
    if (r.url().includes("/api/") && r.method() !== "GET")
      mutations.push({ url: r.url(), method: r.method() });
  });
  const started = Date.now();
  async function hold(scene, seconds) {
    scenes.push({ name: scene, atSeconds: (Date.now() - started) / 1000 });
    if (recording) await page.waitForTimeout(seconds * 1000);
  }
  await page.goto(base);
  await page
    .getByRole("option", { name: "BTC", exact: true })
    .waitFor({ state: "attached", timeout: 30000 });
  await page
    .getByText(
      "Actual public quotes. No position quantity or execution outcome is assumed.",
      { exact: true },
    )
    .waitFor({ timeout: 30000 });
  if ((await page.getByLabel("Requested quantity").inputValue()) !== "")
    throw new Error("Prefilled sample quantity");
  if ((await page.getByLabel("Transaction hash").inputValue()) !== "")
    throw new Error("Prefilled sample transaction");
  if (await page.getByLabel("Rehearsal scenario").count())
    throw new Error("Simulated runtime UI remains");
  await page.screenshot({
    path: resolve(evidence, "desktop-real-markets.png"),
    fullPage: true,
  });
  await hold("actual-public-market-and-book", 12);
  await page.getByLabel("Requested quantity").fill("0.001");
  await page
    .getByRole("button", { name: "Calculate depth", exact: true })
    .click();
  await page
    .getByText("Current book estimate", { exact: true })
    .waitFor({ timeout: 30000 });
  await hold("user-requested-depth-on-real-quotes", 14);
  async function inspect(network) {
    for (let attempt = 0; attempt < 3; attempt++) {
      await page
        .getByRole("button", { name: "Refresh reads", exact: true })
        .click();
      const button = page
        .getByRole("button", {
          name: new RegExp(`^Inspect ${network === "mainnet" ? 143 : 10143}:`),
        })
        .first();
      await button.waitFor({ timeout: 30000 });
      await page.waitForTimeout(7000); // A human-scale delay must not lose the genuine indexed comparison.
      const response = page.waitForResponse((r) =>
        r.url().includes("/api/observations?"),
      );
      await button.click();
      const r = await response,
        body = await r.json();
      if (!r.ok() || body.error) throw new Error(JSON.stringify(body.error));
      if (body.data.observation.source !== "MONAD_PUBLIC_RPC")
        throw new Error("Non-RPC observation");
      if (body.data.outcome === "INDEX_AND_CHAIN_MATCH") {
        await page
          .getByText("Envio and chain values match", { exact: true })
          .waitFor();
        observations.push(body.data);
        return body.data;
      }
    }
    throw new Error(`Could not establish live Envio/chain match on ${network}`);
  }
  const first = await inspect("mainnet");
  await page.locator("#evidence").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: resolve(evidence, "desktop-real-observation.png"),
    fullPage: true,
  });
  await hold("real-indexed-event-and-canonical-receipt-match", 18);
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export observation JSON", exact: true })
    .click();
  const download = await downloadPromise,
    path = resolve(evidence, download.suggestedFilename());
  await download.saveAs(path);
  const exported = JSON.parse(await readFile(path, "utf8"));
  if (JSON.stringify(exported) !== JSON.stringify(first))
    throw new Error("Export changed the real observation");
  await page.getByText("Inspect decoded event", { exact: true }).click();
  await hold("exact-export-and-decoded-abi-values", 14);
  await page
    .getByRole("combobox", { name: "Network", exact: true })
    .selectOption("testnet");
  if (
    (await page.getByLabel("Transaction hash").inputValue()) !== "" ||
    (await page.getByLabel("Requested quantity").inputValue()) !== ""
  )
    throw new Error("Network change retained inputs");
  await inspect("testnet");
  await page.locator("#evidence").scrollIntoViewIfNeeded();
  await hold("real-testnet-index-and-chain-match", 14);
  const video = page.video();
  await context.close();
  const videoPath = video ? await video.path() : null;
  const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    small = await mobile.newPage();
  await small.goto(base);
  await small
    .getByRole("option", { name: "BTC", exact: true })
    .waitFor({ state: "attached", timeout: 30000 });
  await small
    .getByText(
      "Actual public quotes. No position quantity or execution outcome is assumed.",
      { exact: true },
    )
    .waitFor({ timeout: 30000 });
  const overflow = await small.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  await small.screenshot({
    path: resolve(evidence, "mobile-real-markets.png"),
    fullPage: true,
  });
  await mobile.close();
  const report = {
    checkedAt: new Date().toISOString(),
    mode: "LIVE_READ_ONLY",
    actualProviderData: true,
    simulationControls: false,
    sampleInputs: false,
    exportUnchanged: true,
    networkReset: true,
    mobileOverflow: overflow,
    browserErrors: errors,
    browserMutationRequests: mutations,
    observations,
    videoPath,
    scenes,
  };
  await writeFile(
    resolve(evidence, "browser-results.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  if (errors.length || mutations.length || overflow)
    throw new Error("Browser safety/layout check failed");
  console.log(
    JSON.stringify(
      {
        checkedAt: report.checkedAt,
        networks: observations.map((o) => ({
          network: o.network,
          outcome: o.outcome,
          transactionHash: o.observation.transactionHash,
          logIndex: o.observation.logIndex,
        })),
        exportUnchanged: true,
        networkReset: true,
        mobileOverflow: overflow,
        browserErrors: errors,
        browserMutationRequests: mutations,
        videoPath,
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
