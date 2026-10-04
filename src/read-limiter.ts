import { createHmac, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import type { IncomingMessage } from 'node:http';

function normalizedIp(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 64 || value.includes(',') || value.includes('%')) return undefined;
  const ip = value.trim();
  if (isIP(ip) === 4) return ip;
  if (isIP(ip) !== 6) return undefined;
  // Canonicalize IPv6 spelling and mapped IPv4 so alternate representations
  // cannot produce separate buckets for the same address.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped && isIP(mapped[1]) === 4) return mapped[1];
  try {
    const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
    const encoded = /^::ffff:([0-9a-f]+):([0-9a-f]+)$/.exec(canonical);
    if (encoded) {
      const value = parseInt(encoded[1], 16) * 65536 + parseInt(encoded[2], 16);
      return [24, 16, 8, 0].map(shift => (value >>> shift) & 255).join('.');
    }
    const [left, right] = canonical.split('::');
    const leading = left ? left.split(':') : [], trailing = right ? right.split(':') : [];
    const words = right === undefined ? leading : [...leading, ...Array(8 - leading.length - trailing.length).fill('0'), ...trailing];
    return words.slice(0, 4).map(word => parseInt(word, 16).toString(16)).join(':') + '::/64';
  } catch { return undefined; }
}

/** Trust platform-overwritten identity only in the explicit Vercel adapter.
 * Standalone/bridge listeners ignore all forwarded headers. Unknown or malformed
 * platform identity fails into a shared peer bucket instead of inventing a client.
 */
export function readClientIdentity(req: Pick<IncomingMessage, 'headers' | 'socket'>, trustVercelProxy = false): string {
  if (trustVercelProxy) {
    const ip = normalizedIp(req.headers['x-vercel-forwarded-for']);
    if (ip) return `ip:${ip}`;
  }
  return `ip:${normalizedIp(req.socket?.remoteAddress) ?? 'unknown'}`;
}

type Limits = { perClient: number; perClientActive: number; global: number; globalActive: number; maxClients: number; perClientObservationActive: number; globalObservationActive: number };
type Bucket = { windowAt: number; requests: number; active: number; observations: number };
type Admission = { allowed: true; release: () => void } | { allowed: false; retryAfter: number; reason: 'client-window' | 'client-concurrency' | 'global-window' | 'global-concurrency' | 'identity-capacity' | 'client-observation-concurrency' | 'global-observation-concurrency' };
const DEFAULTS: Limits = { perClient: 40, perClientActive: 4, global: 120, globalActive: 6, maxClients: 512, perClientObservationActive: 1, globalObservationActive: 2 };

/** Bounded, ephemeral IP buckets plus aggregate upstream protection per instance.
 * Denied requests never consume another admission or allocate a new identity.
 */
export function createReadLimiter(options: Partial<Limits> = {}, clock: () => number = Date.now) {
  const limits = { ...DEFAULTS, ...options };
  for (const value of Object.values(limits)) if (!Number.isSafeInteger(value) || value < 1) throw new Error('Invalid read limit');
  const secret = randomBytes(32), clients = new Map<string, Bucket>();
  let lastTime = clock(), windowAt = lastTime, lastSweep = lastTime, requests = 0, active = 0, observations = 0;
  const retry = (start: number, now: number) => Math.max(1, Math.ceil((start + 60_000 - now) / 1000));
  function admit(identity: string, kind: 'read' | 'observation' = 'read'): Admission {
    const now = Math.max(lastTime, clock()); lastTime = now;
    if (now - windowAt >= 60_000) { windowAt = now; requests = 0; }
    if (now - lastSweep >= 1000) {
      for (const [key, client] of clients) if (client.active === 0 && now - client.windowAt >= 60_000) clients.delete(key);
      lastSweep = now;
    }
    const key = createHmac('sha256', secret).update(identity).digest('hex');
    let client = clients.get(key);
    if (client && now - client.windowAt >= 60_000) { client.windowAt = now; client.requests = 0; }
    if (client && client.requests >= limits.perClient) return { allowed: false, retryAfter: retry(client.windowAt, now), reason: 'client-window' };
    if (client && client.active >= limits.perClientActive) return { allowed: false, retryAfter: 1, reason: 'client-concurrency' };
    if (kind === 'observation' && client && client.observations >= limits.perClientObservationActive) return { allowed: false, retryAfter: 5, reason: 'client-observation-concurrency' };
    if (kind === 'observation' && observations >= limits.globalObservationActive) return { allowed: false, retryAfter: 5, reason: 'global-observation-concurrency' };
    if (requests >= limits.global) return { allowed: false, retryAfter: retry(windowAt, now), reason: 'global-window' };
    if (active >= limits.globalActive) return { allowed: false, retryAfter: 1, reason: 'global-concurrency' };
    if (!client) {
      if (clients.size >= limits.maxClients) return { allowed: false, retryAfter: 1, reason: 'identity-capacity' };
      client = { windowAt: now, requests: 0, active: 0, observations: 0 };
      clients.set(key, client);
    }
    client.requests++; requests++; client.active++; active++;
    if (kind === 'observation') { client.observations++; observations++; }
    const admitted = client;
    let released = false;
    return { allowed: true, release() { if (!released) { released = true; admitted.active--; active--; if (kind === 'observation') { admitted.observations--; observations--; } } } };
  }
  // Aggregate counts only, for verification; never exposes IPs or hashed identities.
  return { admit, snapshot: () => ({ clients: clients.size, active, admissions: requests }) };
}
