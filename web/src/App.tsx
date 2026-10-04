import { useEffect, useRef, useState } from "react";
import { api as defaultApi } from "./api";
import { MarketPanel } from "./MarketPanel";
import { ActivityPanel } from "./ActivityPanel";
import type {
  Activity,
  Api,
  Liquidity,
  Markets,
  Network,
  Observation,
} from "./types";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Public read unavailable.";
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
  const [network, setNetwork] = useState<Network>("mainnet");
  const [context, setContext] = useState<Markets | null>(null),
    [marketId, setMarketId] = useState(0);
  const [book, setBook] = useState<Liquidity | null>(null),
    [activity, setActivity] = useState<Activity | null>(null);
  const [marketError, setMarketError] = useState(""),
    [bookError, setBookError] = useState(""),
    [activityError, setActivityError] = useState("");
  const [loading, setLoading] = useState(false),
    [refresh, setRefresh] = useState(0),
    [clock, setClock] = useState(Date.now());
  const [quantity, setQuantity] = useState(""),
    [side, setSide] = useState<"long" | "short">("long"),
    [depth, setDepth] = useState<Liquidity | null>(null),
    [depthError, setDepthError] = useState(""),
    [estimating, setEstimating] = useState(false);
  const [hash, setHash] = useState(""),
    [logIndex, setLogIndex] = useState(""),
    [observation, setObservation] = useState<Observation | null>(null),
    [observationError, setObservationError] = useState(""),
    [verifying, setVerifying] = useState(false);
  const generation = useRef(0),
    depthGeneration = useRef(0);
  const market = context?.markets.find((m) => m.id === marketId);
  const expired = (timestamp: string) =>
    !Number.isFinite(Date.parse(timestamp)) ||
    clock - Date.parse(timestamp) > 120000 ||
    Date.parse(timestamp) > clock + 15000;
  const visibleContext = context
    ? { ...context, stale: context.stale || expired(context.observedAt) }
    : null;
  const visibleBook = book
    ? { ...book, stale: book.stale || expired(book.observedAt) }
    : null;
  const visibleActivity: Activity | null =
    activity?.status === "live" && expired(activity.receivedAt)
      ? {
          ...activity,
          status: "unavailable",
          watermark: null,
          events: [],
          error:
            "Indexed activity has aged out. Refresh reads to check the pipeline.",
        }
      : activity;
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setContext(null);
    setMarketError("");
    api
      .markets(network)
      .then((result) => {
        if (active) {
          setContext(result);
          setMarketId((old) =>
            result.markets.some((m) => m.id === old)
              ? old
              : (result.markets[0]?.id ?? 0),
          );
        }
      })
      .catch((error) => {
        if (active) setMarketError(errorMessage(error));
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
        if (active) setActivityError(errorMessage(error));
      });
    return () => {
      active = false;
    };
  }, [api, network, refresh]);
  useEffect(() => {
    let active = true;
    setBook(null);
    setBookError("");
    if (market)
      api
        .book(network, market.id)
        .then((result) => {
          if (active) setBook(result);
        })
        .catch((error) => {
          if (active) setBookError(errorMessage(error));
        });
    return () => {
      active = false;
    };
  }, [api, network, market, refresh]);
  function clearDepth() {
    depthGeneration.current++;
    setDepth(null);
    setDepthError("");
    setEstimating(false);
  }
  function clearObservation() {
    generation.current++;
    setObservation(null);
    setObservationError("");
    setVerifying(false);
  }
  function changeNetwork(next: Network) {
    clearDepth();
    clearObservation();
    setNetwork(next);
    setMarketId(0);
    setContext(null);
    setBook(null);
    setActivity(null);
    setQuantity("");
    setHash("");
    setLogIndex("");
  }
  async function estimate() {
    if (!market || visibleContext?.stale) return;
    const version = ++depthGeneration.current;
    setEstimating(true);
    setDepth(null);
    setDepthError("");
    try {
      const result = await api.liquidity({
        network,
        marketId,
        quantity,
        direction: side,
      });
      if (version === depthGeneration.current) setDepth(result);
    } catch (error) {
      if (version === depthGeneration.current)
        setDepthError(errorMessage(error));
    } finally {
      if (version === depthGeneration.current) setEstimating(false);
    }
  }
  async function inspect(transactionHash = hash, index = logIndex) {
    const version = ++generation.current;
    setHash(transactionHash);
    setLogIndex(index);
    setVerifying(true);
    setObservation(null);
    setObservationError("");
    try {
      const result = await api.observe(network, transactionHash, index);
      if (version === generation.current) setObservation(result);
    } catch (error) {
      if (version === generation.current)
        setObservationError(errorMessage(error));
    } finally {
      if (version === generation.current) setVerifying(false);
    }
  }
  function exportObservation() {
    if (!observation) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(observation, null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `exit-evidence-${observation.observation.transactionHash}-${observation.observation.logIndex}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
            <p>Inspect real market data and public exchange transactions.</p>
          </div>
          <label className="network-control">
            <span className="sr-only">Network</span>
            <select
              value={network}
              onChange={(e) => changeNetwork(e.target.value as Network)}
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
              liquidity={visibleBook}
              error={marketError}
              liquidityError={bookError}
              loading={loading}
              locked={false}
              onMarket={(id) => {
                clearDepth();
                setMarketId(id);
                setBook(null);
                setQuantity("");
              }}
              onRefresh={() => {
                clearDepth();
                clearObservation();
                setRefresh((n) => n + 1);
              }}
            />
            <section className="panel" aria-labelledby="depth-heading">
              <h2 id="depth-heading">Book depth analysis</h2>
              <p className="muted compact">
                Calculate against current public quotes.
              </p>
              <div className="form-grid">
                <label className="field">
                  Requested quantity
                  <input
                    inputMode="decimal"
                    value={quantity}
                    onChange={(e) => {
                      clearDepth();
                      setQuantity(e.target.value);
                    }}
                  />
                </label>
                <label className="field">
                  Book side
                  <select
                    value={side}
                    onChange={(e) => {
                      clearDepth();
                      setSide(e.target.value as "long" | "short");
                    }}
                  >
                    <option value="long">Sell into bids</option>
                    <option value="short">Buy from asks</option>
                  </select>
                </label>
              </div>
              <button
                className="primary full"
                disabled={
                  !market || !!visibleContext?.stale || !quantity || estimating
                }
                onClick={() => void estimate()}
              >
                {estimating ? "Reading depth…" : "Calculate depth"}
              </button>
              {depthError && (
                <p className="notice error" role="alert">
                  {depthError}
                </p>
              )}
              {depth?.estimate && (
                <div className="review-summary">
                  <p>
                    {depth.stale || expired(depth.observedAt)
                      ? "Stale depth — refresh before relying on it"
                      : "Current book estimate"}
                  </p>
                  <dl>
                    <div>
                      <dt>Available quantity</dt>
                      <dd>
                        {depth.estimate.availableQuantity} {market?.symbol}
                      </dd>
                    </div>
                    <div>
                      <dt>Estimated quantity</dt>
                      <dd>
                        {depth.estimate.estimatedFilledQuantity}{" "}
                        {market?.symbol}
                      </dd>
                    </div>
                    <div>
                      <dt>Average price</dt>
                      <dd>
                        {depth.estimate.estimatedAveragePrice ?? "Not quoted"}
                      </dd>
                    </div>
                  </dl>
                  <p className="caption">{depth.estimate.meaning}</p>
                </div>
              )}
              <p className="caption footnote">
                No position or holdings are assumed. This analysis does not
                submit an order or guarantee a fill.
              </p>
            </section>
          </div>
          <section
            className="panel outcome-panel"
            id="evidence"
            aria-labelledby="observation-heading"
          >
            <h2 id="observation-heading">Transaction evidence</h2>
            <p className="muted compact">
              Decode a real public Perpl Exchange event.
            </p>
            <label className="field">
              Transaction hash
              <input
                className="mono"
                value={hash}
                placeholder="Paste a Monad transaction hash"
                onChange={(e) => {
                  clearObservation();
                  setHash(e.target.value);
                }}
              />
            </label>
            <label className="field">
              Log index (optional)
              <input
                inputMode="numeric"
                value={logIndex}
                onChange={(e) => {
                  clearObservation();
                  setLogIndex(e.target.value);
                }}
              />
            </label>
            <button
              className="primary full run-button"
              disabled={
                !/^0x[0-9a-f]{64}$/i.test(hash) ||
                verifying ||
                (logIndex !== "" && !/^(0|[1-9][0-9]*)$/.test(logIndex))
              }
              onClick={() => void inspect()}
            >
              {verifying ? "Reading transaction…" : "Read transaction"}
            </button>
            {observationError && (
              <p className="notice error" role="alert">
                {observationError}
              </p>
            )}
            {!observation && !verifying && !observationError && (
              <div className="outcome-empty">
                <h3>Select a real transaction</h3>
                <p>
                  Choose an indexed event below or paste a transaction hash. No
                  example transaction or execution outcome is prefilled.
                </p>
              </div>
            )}
            {observation && (
              <>
                <div
                  className={`notice ${observation.outcome === "SOURCE_MISMATCH" ? "error" : "success"}`}
                  role="status"
                >
                  <strong>
                    {observation.outcome === "INDEX_AND_CHAIN_MATCH"
                      ? "Envio and chain values match"
                      : observation.outcome === "SOURCE_MISMATCH"
                        ? "Indexed values differ from chain"
                        : "Public chain event decoded"}
                  </strong>
                  <p>Envio comparison: {observation.envio.status}</p>
                </div>
                <table className="comparison">
                  <tbody>
                    {[
                      ["Event", observation.observation.kind],
                      ["Block", String(observation.observation.blockNumber)],
                      ["Log index", String(observation.observation.logIndex)],
                      [
                        "Market ID",
                        observation.observation.marketId ?? "Not in this event",
                      ],
                      [
                        "Account ID",
                        observation.observation.accountId ??
                          "Not in this event",
                      ],
                      [
                        "Quantity (lot units)",
                        observation.observation.quantity ?? "Not in this event",
                      ],
                      ["Observed at", observation.observation.observedAt],
                    ].map(([label, value]) => (
                      <tr key={label}>
                        <td>{label}</td>
                        <td>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ul className="checks">
                  {observation.checks.map((check) => (
                    <li key={check.name}>
                      <div>
                        {check.name}
                        <small style={{ overflowWrap: "anywhere" }}>
                          {check.observed}
                        </small>
                      </div>
                      <strong className={check.result.toLowerCase()}>
                        {check.result}
                      </strong>
                    </li>
                  ))}
                </ul>
                <button className="secondary full" onClick={exportObservation}>
                  Export observation JSON
                </button>
                <details className="receipt-inspector">
                  <summary>Inspect decoded event</summary>
                  <pre
                    style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                  >
                    {JSON.stringify(observation.observation.decoded, null, 2)}
                  </pre>
                </details>
                {observation.limitations.map((text) => (
                  <p className="caption integrity-note" key={text}>
                    {text}
                  </p>
                ))}
              </>
            )}
          </section>
          <ActivityPanel
            activity={visibleActivity}
            error={activityError}
            network={network}
            onInspect={(event) => {
              void inspect(event.transactionHash, String(event.logIndex));
              document
                .getElementById("evidence")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          />
        </div>
        <footer className="page-footer">
          Public events describe their participants. No wallet ownership,
          position, approval or execution by this app is inferred.
        </footer>
      </main>
    </div>
  );
}
