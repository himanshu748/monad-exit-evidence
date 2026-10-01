import { useEffect, useRef, useState } from "react";
import { api as defaultApi } from "./api";
import { resolveLimits } from "./form";
import { MarketPanel } from "./MarketPanel";
import { PermissionPanel } from "./PermissionPanel";
import { OutcomePanel } from "./OutcomePanel";
import { ActivityPanel } from "./ActivityPanel";
import type {
  Activity,
  Api,
  FormValues,
  Liquidity,
  Markets,
  Network,
  Receipt,
  Resolved,
  Review,
  Scenario,
  Verification,
} from "./types";
const storageKey = "exit-evidence.review.v1";
const defaults: FormValues = {
  positionQuantity: "0.04",
  closeQuantity: "0.02",
  priceLimit: "",
  direction: "long",
};
function loadReview(): { review: Review; attempted: boolean } | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey) || "null");
    if (
      value?.review?.input &&
      typeof value.review.key === "string" &&
      ["mainnet", "testnet"].includes(value.review.input.network)
    )
      return value;
  } catch {}
  return null;
}
function persist(review: Review | null, attempted = false) {
  try {
    if (review)
      sessionStorage.setItem(storageKey, JSON.stringify({ review, attempted }));
    else sessionStorage.removeItem(storageKey);
  } catch {}
}
function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The request could not be completed.";
}
function NavIcon({ type }: { type: "grid" | "file" | "list" }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {type === "grid" ? (
        <>
          <rect x="3" y="3" width="6" height="6" rx="1" />
          <rect x="15" y="3" width="6" height="6" rx="1" />
          <rect x="3" y="15" width="6" height="6" rx="1" />
          <rect x="15" y="15" width="6" height="6" rx="1" />
        </>
      ) : type === "file" ? (
        <>
          <path d="M7 3h7l4 4v14H7zM14 3v5h4M10 12h5M10 16h5" />
        </>
      ) : (
        <>
          <path d="M8 6h13M8 12h13M8 18h13" />
          <circle cx="3" cy="6" r=".5" />
          <circle cx="3" cy="12" r=".5" />
          <circle cx="3" cy="18" r=".5" />
        </>
      )}
    </svg>
  );
}
export default function App({ api = defaultApi }: { api?: Api }) {
  const initial = useRef(loadReview()).current;
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setClock(Date.now());
    const timer = window.setInterval(tick, 5000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  const [network, setNetwork] = useState<Network>(
    initial?.review.input.network ?? "mainnet",
  );
  const [context, setContext] = useState<Markets | null>(null),
    [marketId, setMarketId] = useState(initial?.review.input.marketId ?? 0),
    [marketError, setMarketError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [loading, setLoading] = useState(false);
  const [values, setValues] = useState<FormValues>(
    initial
      ? {
          positionQuantity: initial.review.input.positionQuantity,
          closeQuantity: initial.review.input.closeQuantity,
          priceLimit: initial.review.input.priceLimit,
          direction: initial.review.input.direction,
        }
      : defaults,
  );
  const [scenario, setScenario] = useState<Scenario>(
      initial?.review.input.scenario ?? "valid",
    ),
    [review, setReview] = useState<Review | null>(initial?.review ?? null),
    [errors, setErrors] = useState<Resolved["errors"]>({});
  const [liquidity, setLiquidity] = useState<Liquidity | null>(null),
    [liquidityError, setLiquidityError] = useState(""),
    [activity, setActivity] = useState<Activity | null>(null),
    [activityError, setActivityError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null),
    [pending, setPending] = useState(false),
    [runError, setRunError] = useState(""),
    [retry, setRetry] = useState(initial?.attempted ?? false);
  const [json, setJson] = useState(""),
    [verification, setVerification] = useState<Verification | null>(null),
    [verificationError, setVerificationError] = useState(""),
    [verifying, setVerifying] = useState(false);
  const busy = useRef(false),
    generation = useRef(0),
    verificationGeneration = useRef(0);
  const market = context?.markets.find((item) => item.id === marketId);
  const expired = (timestamp: string) =>
    !Number.isFinite(Date.parse(timestamp)) ||
    clock - Date.parse(timestamp) > 120000 ||
    Date.parse(timestamp) > clock + 15000;
  const visibleContext = context
    ? { ...context, stale: context.stale || expired(context.observedAt) }
    : null;
  const visibleLiquidity = liquidity
    ? { ...liquidity, stale: liquidity.stale || expired(liquidity.observedAt) }
    : null;
  const visibleActivity: Activity | null =
    activity && activity.status === "live" && expired(activity.receivedAt)
      ? {
          ...activity,
          status: "unavailable",
          watermark: null,
          events: [],
          error:
            "Indexed activity has aged out. Refresh reads to check the current pipeline.",
        }
      : activity;
  const unresolved = retry || receipt?.execution.status === "UNKNOWN";
  function invalidate() {
    generation.current++;
    verificationGeneration.current++;
    setVerifying(false);
    setReview(null);
    persist(null);
    setReceipt(null);
    setRunError("");
    setRetry(false);
    setVerification(null);
    setVerificationError("");
    setErrors({});
    setJson("");
  }
  useEffect(() => {
    let active = true;
    setLoading(true);
    setMarketError("");
    setContext(null);
    setLiquidity(null);
    api
      .markets(network)
      .then((result) => {
        if (!active) return;
        setContext(result);
        setMarketId((old) =>
          result.markets.some((item) => item.id === old)
            ? old
            : (result.markets[0]?.id ?? 0),
        );
        setValues((old) =>
          old.priceLimit
            ? old
            : { ...old, priceLimit: result.markets[0]?.bidPrice ?? "" },
        );
      })
      .catch((error) => {
        if (active) setMarketError(message(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, network, refresh]);
  useEffect(() => {
    let active = true;
    setActivity(null);
    setActivityError("");
    api
      .activity(network)
      .then((result) => {
        if (active) setActivity(result);
      })
      .catch((error) => {
        if (active) setActivityError(message(error));
      });
    return () => {
      active = false;
    };
  }, [api, network, refresh]);
  useEffect(() => {
    let active = true;
    setLiquidity(null);
    setLiquidityError("");
    if (!market || !/^\d+(?:\.\d+)?$/.test(values.closeQuantity)) return;
    api
      .liquidity({
        network,
        marketId: market.id,
        quantity: values.closeQuantity,
        direction: values.direction,
      })
      .then((result) => {
        if (active) setLiquidity(result);
      })
      .catch((error) => {
        if (active) setLiquidityError(message(error));
      });
    return () => {
      active = false;
    };
  }, [api, network, market, values.closeQuantity, values.direction, refresh]);
  function changeField(key: keyof FormValues, value: string) {
    if (unresolved) return;
    invalidate();
    setValues((old) => ({ ...old, [key]: value }));
  }
  function changeNetwork(next: Network) {
    if (unresolved) return;
    invalidate();
    setNetwork(next);
    setMarketId(0);
    setValues({ ...defaults });
    setContext(null);
    setActivity(null);
  }
  function changeMarket(id: number) {
    if (unresolved) return;
    invalidate();
    setMarketId(id);
    const next = context?.markets.find((item) => item.id === id);
    setValues((old) => ({
      ...old,
      priceLimit:
        (old.direction === "long" ? next?.bidPrice : next?.askPrice) ?? "",
    }));
  }
  function makeReview() {
    if (!market || !context || visibleContext?.stale || unresolved) return;
    const resolved = resolveLimits(values, market);
    setErrors(resolved.errors);
    if (Object.keys(resolved.errors).length) return;
    const input = {
      network,
      marketId: market.id,
      ...values,
      sizeDecimals: market.sizeDecimals,
      priceDecimals: market.priceDecimals,
      scenario,
      ...(context.snapshotRef
        ? {
            snapshotRef: context.snapshotRef,
            snapshotObservedAt: context.observedAt,
          }
        : {}),
    };
    if (review && JSON.stringify(review.input) === JSON.stringify(input))
      return;
    invalidate();
    const next = {
      input,
      key: crypto.randomUUID(),
      symbol: market.symbol,
      resolved,
    };
    setReview(next);
    persist(next);
  }
  async function run() {
    if (!review || busy.current || receipt) return;
    busy.current = true;
    setPending(true);
    setRunError("");
    persist(review, true);
    const version = generation.current;
    try {
      const result = await api.rehearse(review.input, review.key);
      if (version !== generation.current) return;
      verificationGeneration.current++;
      setVerification(null);
      setVerifying(false);
      setReceipt(result);
      setJson(JSON.stringify(result, null, 2));
      setRetry(false);
      persist(review, true);
    } catch (error) {
      if (version === generation.current) {
        setRunError(message(error));
        setRetry(true);
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function verify() {
    const version = ++verificationGeneration.current;
    setVerifying(true);
    setVerification(null);
    setVerificationError("");
    try {
      const parsed = JSON.parse(json);
      const result = await api.verify(parsed);
      if (version === verificationGeneration.current) setVerification(result);
    } catch (error) {
      if (version === verificationGeneration.current)
        setVerificationError(
          error instanceof SyntaxError
            ? "Receipt JSON is not valid JSON."
            : message(error),
        );
    } finally {
      if (version === verificationGeneration.current) setVerifying(false);
    }
  }
  function exportJson() {
    if (!receipt) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(receipt, null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `exit-evidence-${receipt.id}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#workbench">
        Skip to workbench
      </a>
      <aside className="rail">
        <a href="#workbench" className="wordmark">
          EXIT /<br />
          EVIDENCE
        </a>
        <nav aria-label="Workbench navigation">
          <a className="selected" href="#workbench">
            <NavIcon type="grid" />
            Workbench
          </a>
          <a href="#evidence">
            <NavIcon type="file" />
            Evidence
          </a>
          <a href="#activity">
            <NavIcon type="list" />
            Activity
          </a>
        </nav>
        <p className="rail-footnote">Read-only · No transactions</p>
      </aside>
      <main id="workbench">
        <header className="page-header">
          <div>
            <h1>Exit evidence</h1>
            <p>Review a reduction. Know what the evidence proves.</p>
          </div>
          <label className="network-control">
            <span className="sr-only">Network</span>
            <select
              value={network}
              onChange={(e) => changeNetwork(e.target.value as Network)}
              disabled={pending || unresolved}
            >
              <option value="mainnet">Monad mainnet</option>
              <option value="testnet">Monad testnet</option>
            </select>
          </label>
        </header>
        <div className="workspace-grid">
          <div className="left-column">
            <MarketPanel
              context={visibleContext}
              market={market}
              liquidity={visibleLiquidity}
              error={marketError}
              liquidityError={liquidityError}
              loading={loading}
              locked={pending || unresolved}
              refreshLocked={pending}
              onMarket={changeMarket}
              onRefresh={() => {
                if (!unresolved) invalidate();
                setRefresh((value) => value + 1);
              }}
            />
            <PermissionPanel
              values={values}
              market={market}
              review={review}
              errors={errors}
              disabled={
                !market ||
                !!visibleContext?.stale ||
                pending ||
                unresolved ||
                !market.isOpen
              }
              locked={pending || unresolved}
              onChange={changeField}
              onReview={makeReview}
            />
            {unresolved && (
              <div className="notice warning" role="alert">
                <p>
                  This rehearsal still has an unresolved response or outcome.
                  Refreshing reads keeps its recovery record. Starting a
                  separate rehearsal deliberately stops tracking that record in
                  this view; no real transaction exists.
                </p>
                <button
                  className="text-button"
                  disabled={pending}
                  onClick={() => invalidate()}
                >
                  Start a separate rehearsal
                </button>
              </div>
            )}
          </div>
          <OutcomePanel
            scenario={scenario}
            review={review}
            receipt={receipt}
            pending={pending}
            error={runError}
            retry={retry}
            verification={verification}
            verificationError={verificationError}
            verifying={verifying}
            json={json}
            onScenario={(next) => {
              if (unresolved) return;
              invalidate();
              setScenario(next);
            }}
            onRun={run}
            onVerify={verify}
            onJson={(value) => {
              verificationGeneration.current++;
              setVerifying(false);
              setJson(value);
              setVerification(null);
              setVerificationError("");
            }}
            onExport={exportJson}
          />
          <ActivityPanel
            activity={visibleActivity}
            error={activityError}
            network={network}
          />
        </div>
        <footer className="page-footer">
          Public observations and replay evidence are separate. This workbench
          cannot submit transactions.
        </footer>
      </main>
    </div>
  );
}
