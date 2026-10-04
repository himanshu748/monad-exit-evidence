import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "./server.ts";
const app = createApp({ publicMode: true, trustVercelProxy: process.env.VERCEL === "1" });
export default function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const route = url.searchParams.get("route") ?? "";
  url.searchParams.delete("route");
  const allowed = new Set(["health", "markets", "book", "liquidity", "activity", "observations", "nansen/status", "rehearsals", "receipts/verify"]);
  url.pathname = allowed.has(route) ? `/api/${route}` : "/api/not-found";
  req.url = url.pathname + url.search;
  app.emit("request", req, res);
}
