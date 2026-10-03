import { parseUnits, formatUnits } from "../core/quantity.ts";
import { digest } from "../core/receipt.ts";
const ENDPOINT =
  "https://api.nansen.ai/api/v1/profiler/address/current-balance";
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
export type BalanceSnapshot = {
  wallet: string;
  chainId: 143;
  receivedAt: string;
  source: "NANSEN";
  sourceMode: "LIVE" | "FIXTURE";
  sourceUrl: string;
  digest: string;
  completeness: { page: 1; perPage: number; isLastPage: true; count: number };
  balances: { token: string; symbol: string; valueUsdMicros: string }[];
};
export type BudgetLimits = {
  wallet: string;
  chainId: number;
  targetToken: string;
  maxConcentrationBps: number;
  minLiquidBufferUsd: string;
  liquidTokens: string[];
};
export type AuthorizedNansenTransport = (
  url: string,
  body: {
    chain: "monad";
    address: string;
    hide_spam_token: true;
    pagination: { page: 1; per_page: 1000 };
  },
) => Promise<unknown>;
export function getNansenStatus() {
  return {
    status: "access-required",
    source: "NANSEN",
    message:
      "An authorized Nansen connection is required. No live Nansen data has been fetched; no automatic payment fallback.",
  };
}
export async function fetchNansenBalances(
  wallet: string,
  transport?: AuthorizedNansenTransport,
): Promise<BalanceSnapshot> {
  if (!ADDRESS.test(wallet)) throw new Error("Invalid wallet address");
  if (!transport)
    throw new Error(
      "Nansen requires a user-authorized transport; no credentials or payment fallback are available",
    );
  const raw = await transport(ENDPOINT, {
    chain: "monad",
    address: wallet.toLowerCase(),
    hide_spam_token: true,
    pagination: { page: 1, per_page: 1000 },
  });
  return normalizeNansenBalances(raw, wallet, Date.now(), "LIVE");
}
export function normalizeNansenBalances(
  value: unknown,
  wallet: string,
  now: number,
  sourceMode: "LIVE" | "FIXTURE",
): BalanceSnapshot {
  if (!ADDRESS.test(wallet) || !["LIVE", "FIXTURE"].includes(sourceMode))
    throw new Error("Invalid balance context");
  const p = value as {
    pagination?: { page?: number; per_page?: number; is_last_page?: boolean };
    data?: unknown[];
  };
  if (
    !p ||
    !p.pagination ||
    p.pagination.is_last_page !== true ||
    p.pagination.page !== 1 ||
    !Number.isInteger(p.pagination.per_page) ||
    (p.pagination.per_page ?? 0) < 1 ||
    (p.pagination.per_page ?? 0) > 1000 ||
    !Array.isArray(p.data) ||
    p.data.length > (p.pagination.per_page ?? 0)
  )
    throw new Error(
      "A complete unfiltered balance snapshot is required; incomplete pages cannot support policy",
    );
  const seen = new Set<string>();
  const balances = p.data.map((value) => {
    const b = value as {
      chain?: unknown;
      address?: unknown;
      token_address?: unknown;
      token_symbol?: unknown;
      value_usd?: unknown;
    };
    if (
      !b ||
      b.chain !== "monad" ||
      typeof b.address !== "string" ||
      b.address.toLowerCase() !== wallet.toLowerCase() ||
      typeof b.token_address !== "string" ||
      !ADDRESS.test(b.token_address)
    )
      throw new Error("Balance chain, account or token binding mismatch");
    const token = b.token_address.toLowerCase();
    if (seen.has(token)) throw new Error("Duplicate token balance");
    seen.add(token);
    if (
      typeof b.value_usd !== "number" ||
      !Number.isFinite(b.value_usd) ||
      b.value_usd < 0 ||
      b.value_usd > 1e9
    )
      throw new Error("Missing or unsupported USD valuation");
    return {
      token,
      symbol:
        typeof b.token_symbol === "string"
          ? b.token_symbol.slice(0, 24)
          : "Unknown",
      valueUsdMicros: parseUnits(b.value_usd.toFixed(6), 6).toString(),
    };
  });
  const body = {
    wallet: wallet.toLowerCase(),
    chainId: 143 as const,
    receivedAt: new Date(now).toISOString(),
    source: "NANSEN" as const,
    sourceMode,
    sourceUrl: ENDPOINT,
    balances,
    completeness: {
      page: 1 as const,
      perPage: p.pagination.per_page!,
      isLastPage: true as const,
      count: p.data.length,
    },
  };
  return { ...body, digest: digest(body) };
}
export function evaluateWalletBudget(
  snapshot: BalanceSnapshot,
  limits: BudgetLimits,
  now = Date.now(),
) {
  const base = {
    source: "NANSEN",
    sourceMode: snapshot.sourceMode,
    authorizesExecution: false as const,
    attribution: "Portfolio context from Nansen",
    limitations: [
      "USD valuations are provider estimates rounded to six decimals, not executable prices.",
      "This checks user-defined wallet budgets and excludes Perpl position exposure, debt and derivatives.",
      "WITHIN_LIMITS is not a trade recommendation, wallet authorization or a claim that portfolio risk is low.",
    ],
  };
  const unknown = (reason: string) => ({
    ...base,
    outcome: "UNKNOWN" as const,
    reason,
    targetConcentrationBps: null,
    liquidBufferUsd: null,
  });
  const { digest: expectedDigest, ...body } = snapshot;
  if (
    digest(body) !== expectedDigest ||
    limits.wallet.toLowerCase() !== snapshot.wallet ||
    limits.chainId !== 143 ||
    !Number.isFinite(Date.parse(snapshot.receivedAt)) ||
    now - Date.parse(snapshot.receivedAt) > 300000 ||
    Date.parse(snapshot.receivedAt) > now + 15000
  )
    return unknown(
      "Profile is stale, changed, or bound to another account/network",
    );
  if (
    !ADDRESS.test(limits.targetToken) ||
    !Number.isInteger(limits.maxConcentrationBps) ||
    limits.maxConcentrationBps < 0 ||
    limits.maxConcentrationBps > 10000 ||
    !Array.isArray(limits.liquidTokens) ||
    limits.liquidTokens.some((x) => !ADDRESS.test(x))
  )
    return unknown("Invalid user-defined limits");
  let minimum: bigint;
  try {
    minimum = parseUnits(limits.minLiquidBufferUsd, 6);
  } catch {
    return unknown("Invalid liquid buffer limit");
  }
  const total = snapshot.balances.reduce(
    (a, b) => a + BigInt(b.valueUsdMicros),
    0n,
  );
  if (total === 0n) return unknown("No valued balance evidence");
  const target = snapshot.balances.find(
    (b) => b.token === limits.targetToken.toLowerCase(),
  );
  const value = BigInt(target?.valueUsdMicros ?? "0");
  const concentration = Number((value * 10000n + total - 1n) / total);
  const liquidSet = new Set(limits.liquidTokens.map((t) => t.toLowerCase()));
  const liquid = snapshot.balances
    .filter((b) => liquidSet.has(b.token))
    .reduce((a, b) => a + BigInt(b.valueUsdMicros), 0n);
  const within =
    concentration <= limits.maxConcentrationBps && liquid >= minimum;
  return {
    ...base,
    outcome: within ? ("WITHIN_LIMITS" as const) : ("OUTSIDE_LIMITS" as const),
    reason: within
      ? "Observed balances meet the supplied budgets"
      : "A user-defined concentration or liquid-buffer budget is exceeded",
    targetConcentrationBps: concentration,
    liquidBufferUsd: formatUnits(liquid, 6),
    snapshotDigest: snapshot.digest,
  };
}
