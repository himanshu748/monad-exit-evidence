import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFile } from "node:fs/promises";
import { mkdirSync, existsSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { RehearsalLedger, IdempotencyConflict } from "./core/ledger.ts";
import { validateInput } from "./core/rehearsal.ts";
import { verifyReceipt } from "./core/receipt.ts";
import type { RehearsalInput, Network } from "./core/types.ts";
import {
  getMarkets,
  getLiquidity,
  requireNetwork,
  snapshots,
  type MarketContext,
} from "./data/perpl.ts";
import { getEnvioActivity } from "./data/envio.ts";
import { getNansenStatus } from "./data/nansen.ts";
class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DIST = resolve(ROOT, "web/dist");
async function jsonBody(req: IncomingMessage): Promise<any> {
  if (!req.headers["content-type"]?.startsWith("application/json"))
    throw new HttpError(415, "JSON_REQUIRED", "Use application/json");
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > 65536)
      throw new HttpError(413, "BODY_TOO_LARGE", "Request limit is 64 KB");
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Invalid JSON body");
  }
}
function send(
  res: ServerResponse,
  status: number,
  data: unknown,
  error: unknown = null,
) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(
    JSON.stringify({
      data,
      error,
      meta: { receivedAt: new Date().toISOString() },
    }),
  );
}
type Dependencies = {
  ledger: RehearsalLedger;
  markets?: (n: Network) => Promise<MarketContext>;
  liquidity?: typeof getLiquidity;
  activity?: typeof getEnvioActivity;
};
export function createApp(options: Dependencies) {
  const markets = options.markets ?? getMarkets,
    liquidity = options.liquidity ?? getLiquidity,
    activity = options.activity ?? getEnvioActivity;
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const path = url.pathname;
      if (req.method === "POST") {
        const origin = req.headers.origin;
        const own = new Set([
          `http://${req.headers.host}`,
          `https://${req.headers.host}`,
          "http://localhost:5173",
          "http://127.0.0.1:5173",
          "http://localhost:4173",
          "http://127.0.0.1:4173",
        ]);
        if (process.env.PUBLIC_ORIGIN) own.add(process.env.PUBLIC_ORIGIN);
        if (origin && !own.has(origin))
          throw new HttpError(
            403,
            "ORIGIN_DENIED",
            "Cross-origin mutation is disabled",
          );
      }
      if (req.method === "GET" && path === "/api/health") {
        const [mainnet, testnet] = await Promise.all([
          activity("mainnet"),
          activity("testnet"),
        ]);
        return send(res, 200, {
          mode: "READ_ONLY",
          tradingEnabled: false,
          integrations: {
            perpl: "live-public-read",
            envio:
              mainnet.status === "live" || testnet.status === "live"
                ? "live"
                : "unavailable",
            cre: "login-required",
            nansen: "access-required",
          },
          envioNetworks: { mainnet: mainnet.status, testnet: testnet.status },
        });
      }
      if (req.method === "GET" && path === "/api/nansen/status")
        return send(res, 200, getNansenStatus());
      if (req.method === "GET" && path === "/api/markets")
        return send(
          res,
          200,
          await markets(requireNetwork(url.searchParams.get("network"))),
        );
      if (req.method === "GET" && path === "/api/liquidity")
        return send(
          res,
          200,
          await liquidity(
            requireNetwork(url.searchParams.get("network")),
            Number(url.searchParams.get("marketId")),
            url.searchParams.get("quantity") ?? "",
            url.searchParams.get("direction") ?? "",
          ),
        );
      if (req.method === "GET" && path === "/api/activity")
        return send(
          res,
          200,
          await activity(requireNetwork(url.searchParams.get("network"))),
        );
      if (req.method === "POST" && path === "/api/rehearsals") {
        const input = (await jsonBody(req)) as RehearsalInput;
        validateInput(input);
        const key = req.headers["idempotency-key"];
        if (typeof key !== "string")
          throw new HttpError(
            400,
            "IDEMPOTENCY_REQUIRED",
            "Review the request before running a rehearsal",
          );
        const old = options.ledger.lookup(key, input);
        if (old) return send(res, 200, old);
        const snapshot = input.snapshotRef
          ? snapshots.get(input.snapshotRef)
          : undefined;
        if (
          !snapshot ||
          snapshot.data.network !== input.network ||
          snapshot.data.observedAt !== input.snapshotObservedAt ||
          Date.now() - snapshot.time > 120000 ||
          snapshot.data.stale ||
          Date.now() - Date.parse(snapshot.data.observedAt) > 120000
        )
          throw new HttpError(
            422,
            "STALE_REVIEW",
            "Refresh market data and review the limits again",
          );
        const market = snapshot.data.markets.find(
          (m) => m.id === input.marketId,
        );
        if (
          !market ||
          !market.isOpen ||
          market.sizeDecimals !== input.sizeDecimals ||
          market.priceDecimals !== input.priceDecimals
        )
          throw new HttpError(
            422,
            "MARKET_CONFIG_MISMATCH",
            "Market configuration changed or is unsupported. Refresh and review again",
          );
        return send(res, 200, options.ledger.run(key, input));
      }
      if (req.method === "POST" && path === "/api/receipts/verify") {
        const body = await jsonBody(req);
        if (!body || !Object.hasOwn(body, "receipt"))
          throw new HttpError(400, "RECEIPT_REQUIRED", "Provide the receipt");
        return send(res, 200, verifyReceipt(body.receipt));
      }
      if (path.startsWith("/api/") || req.method !== "GET")
        throw new HttpError(404, "NOT_FOUND", "This route does not exist");
      const decoded = decodeURIComponent(path);
      const candidate = resolve(DIST, "." + decoded);
      if (candidate !== DIST && !candidate.startsWith(DIST + sep))
        throw new HttpError(404, "NOT_FOUND", "Not found");
      const target = extname(candidate)
        ? candidate
        : resolve(DIST, "index.html");
      try {
        const bytes = await readFile(target);
        const mime: Record<string, string> = {
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".svg": "image/svg+xml",
          ".png": "image/png",
          ".woff2": "font/woff2",
        };
        res.writeHead(200, {
          "content-type": mime[extname(target)] ?? "application/octet-stream",
          "x-content-type-options": "nosniff",
          "content-security-policy":
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'",
        });
        res.end(bytes);
      } catch {
        throw new HttpError(
          503,
          "UI_NOT_BUILT",
          "Build the frontend or use the Vite development server",
        );
      }
    } catch (e) {
      if (res.headersSent) {
        res.end();
        return;
      }
      if (e instanceof IdempotencyConflict)
        return send(res, 409, null, {
          code: "IDEMPOTENCY_CONFLICT",
          message: e.message,
        });
      if (e instanceof HttpError)
        return send(res, e.status, null, { code: e.code, message: e.message });
      const message = e instanceof Error ? e.message : "Unexpected error";
      const status = /Perpl public data|fetch failed|timeout|aborted/i.test(
        message,
      )
        ? 503
        : 400;
      send(res, status, null, {
        code: status === 503 ? "UPSTREAM_UNAVAILABLE" : "INVALID_REQUEST",
        message: message.slice(0, 300),
      });
    }
  });
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const dataDir = resolve(ROOT, ".data");
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const ledger = new RehearsalLedger(resolve(dataDir, "rehearsals.sqlite"));
  const port = Number(process.env.PORT ?? 4100);
  createApp({ ledger }).listen(port, "127.0.0.1", () =>
    console.log(`Read-only workbench http://127.0.0.1:${port}`),
  );
}
