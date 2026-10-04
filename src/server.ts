import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Network } from "./core/types.ts";
import { createReadLimiter, readClientIdentity } from "./read-limiter.ts";
import {
  getMarkets,
  getLiquidity,
  getOrderBook,
  requireNetwork,
  type MarketContext,
} from "./data/perpl.ts";
import { getEnvioActivity, getLocalEnvioSnapshot } from "./data/envio.ts";
import { getNansenStatus } from "./data/nansen.ts";
import { getTransactionObservation } from "./data/observations.ts";
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
  publicMode?: boolean;
  bridgeOnly?: boolean;
  trustVercelProxy?: boolean;
  markets?: (n: Network) => Promise<MarketContext>;
  liquidity?: typeof getLiquidity;
  activity?: typeof getEnvioActivity;
  observation?: typeof getTransactionObservation;
};
export function createApp(options: Dependencies = {}) {
  const markets = options.markets ?? getMarkets,
    liquidity = options.liquidity ?? getLiquidity,
    activity = options.activity ?? getEnvioActivity;
  const publicMode = options.publicMode ?? process.env.PUBLIC_DEMO === "1";
  const bridgeOnly = options.bridgeOnly ?? process.env.ENVIO_BRIDGE_ONLY === "1";
  const limiter = createReadLimiter();
  const trustVercelProxy = options.trustVercelProxy === true;
  return createServer(async (req, res) => {
    let release: (() => void) | undefined;
    res.setHeader("referrer-policy", "no-referrer");
    res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
    try {
      if ((req.url ?? "").length > 4096) throw new HttpError(414, "URI_TOO_LONG", "Request URL is too long");
      const url = new URL(req.url ?? "/", "http://localhost");
      const path = url.pathname;
      if (bridgeOnly && path !== "/api/indexer-snapshot") throw new HttpError(404, "NOT_FOUND", "This route does not exist");
      if (publicMode && path.startsWith("/api/")) {
        const admission = limiter.admit(readClientIdentity(req, trustVercelProxy), path === "/api/observations" ? "observation" : "read");
        if (!admission.allowed) {
          res.setHeader("retry-after", String(admission.retryAfter));
          throw new HttpError(429, "READ_LIMIT", admission.reason.startsWith("client-")
            ? "Public read limit reached for this client; retry shortly"
            : "Public read capacity reached; retry shortly");
        }
        release = admission.release;
      }
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
      if (path === "/api/rehearsals" || path === "/api/receipts/verify") throw new HttpError(410, "SIMULATION_REMOVED", "Use real public transaction observations. Simulated executions are no longer served.");
      if (path.startsWith("/api/") && req.method !== "GET") throw new HttpError(405, "READ_ONLY", "Only public read operations are available");
      if (req.method === "GET" && path === "/api/indexer-snapshot") {
        if (process.env.SERVE_ENVIO_SNAPSHOT !== "1" || process.env.VERCEL === "1") throw new HttpError(404, "NOT_FOUND", "This route does not exist");
        try { return send(res, 200, await getLocalEnvioSnapshot(requireNetwork(url.searchParams.get("network")), url.searchParams.get("transactionHash") ?? undefined, url.searchParams.has("logIndex") ? Number(url.searchParams.get("logIndex")) : undefined)); }
        catch { throw new HttpError(503, "INDEXER_UNAVAILABLE", "The genuine Envio indexer has no fresh validated snapshot"); }
      }
      if (req.method === "GET" && path === "/api/book") return send(res, 200, await getOrderBook(requireNetwork(url.searchParams.get("network")), Number(url.searchParams.get("marketId"))));
      if (req.method === "GET" && path === "/api/observations") {
        const index = url.searchParams.get("logIndex");
        if (index !== null && !/^(0|[1-9][0-9]*)$/.test(index)) throw new HttpError(400, "INVALID_LOG_INDEX", "Use an exact nonnegative integer log index");
        return send(res, 200, await (options.observation ?? getTransactionObservation)(requireNetwork(url.searchParams.get("network")), url.searchParams.get("transactionHash") ?? "", index === null ? undefined : Number(index)));
      }
      if (req.method === "GET" && path === "/api/health") {
        const [mainnet, testnet] = await Promise.all([
          activity("mainnet"),
          activity("testnet"),
        ]);
        return send(res, 200, {
          mode: "LIVE_READ_ONLY",
          simulationEnabled: false,
          tradingEnabled: false,
          integrations: {
            perpl: "public-read-configured",
            envio:
              mainnet.status === "live" || testnet.status === "live"
                ? "live"
                : "unavailable",
            cre: "omitted-user-choice",
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
      if (e instanceof HttpError)
        return send(res, e.status, null, { code: e.code, message: e.message });
      const message = e instanceof Error ? e.message : "Unexpected error";
      const status = /Perpl public data|Public Monad RPC unavailable|fetch failed|timeout|aborted/i.test(
        message,
      )
        ? 503
        : 400;
      send(res, status, null, {
        code: status === 503 ? "UPSTREAM_UNAVAILABLE" : "INVALID_REQUEST",
        message: publicMode ? (/^(Use a plain nonnegative decimal, without spaces or exponent notation|Maximum \d+ decimal places|Quantity exceeds supported integer range|Quantity must be positive)$/.test(message) ? message : status === 503 ? "Public provider unavailable; retry later" : "The requested public read is invalid or unsupported") : message.slice(0, 300),
      });
    } finally { release?.(); }
  });
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.PORT ?? 4100);
  createApp().listen(port, "127.0.0.1", () =>
    console.log(`Read-only workbench http://127.0.0.1:${port}`),
  );
}
