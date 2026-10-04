import { useEffect, useState } from "react";
import { api as defaultApi } from "./api";
import type { Activity, Api, Network } from "./types";

const NETWORKS = [
  { network: "mainnet", name: "Monad mainnet", chainId: 143 },
  { network: "testnet", name: "Monad testnet", chainId: 10143 },
] as const;
const SOURCE = "https://github.com/himanshu748/monad-exit-evidence";
type ReadState = { loading: boolean; activity?: Activity; error?: string };
const initialReads: Record<Network, ReadState> = {
  mainnet: { loading: true },
  testnet: { loading: true },
};

export function activityAvailability(
  activity: Activity,
  network: Network,
  now: number,
) {
  const expected = NETWORKS.find((item) => item.network === network)!;
  if (activity.chainId !== expected.chainId || activity.source !== "ENVIO")
    return {
      label: "Unavailable",
      detail: "The source did not match this network.",
    };
  if (activity.status !== "live")
    return {
      label: "Unavailable",
      detail: activity.error || "Fresh indexed activity is unavailable.",
    };
  const age = now - Date.parse(activity.receivedAt);
  if (!Number.isFinite(age) || age > 120_000 || age < -15_000)
    return {
      label: "Stale",
      detail:
        "The source read has aged out or has an invalid timestamp. Refresh to check again.",
    };
  if (!Number.isSafeInteger(activity.watermark) || activity.watermark! < 0)
    return {
      label: "Unavailable",
      detail: "Indexed coverage could not be checked.",
    };
  if (activity.engine === "HYPERSYNC") {
    const headAge = now - Date.parse(activity.providerHeadObservedAt ?? "");
    if (!Number.isFinite(headAge) || headAge > 300_000 || headAge < -15_000)
      return {
        label: "Stale",
        detail:
          "The provider head has aged out or has an invalid timestamp. Refresh to check again.",
      };
    if (
      !Number.isSafeInteger(activity.providerHead) ||
      activity.providerHead !== activity.watermark ||
      !Number.isSafeInteger(activity.windowStartBlock) ||
      activity.windowStartBlock! < 0 ||
      activity.windowStartBlock! > activity.watermark!
    )
      return {
        label: "Unavailable",
        detail: "Provider coverage could not be checked.",
      };
  }
  return {
    label: "Available",
    detail:
      "Envio returned fresh indexed activity. Quote and receipt sources are checked separately in the workbench.",
  };
}

export default function LandingPage({
  api = defaultApi,
}: {
  api?: Pick<Api, "activity">;
}) {
  const [reads, setReads] = useState(initialReads);
  const [refresh, setRefresh] = useState(0);
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setReads(initialReads);
    setClock(Date.now());
    for (const { network } of NETWORKS) {
      api
        .activity(network, controller.signal)
        .then((activity) => {
          if (active) {
            setClock(Date.now());
            setReads((old) => ({
              ...old,
              [network]: { loading: false, activity },
            }));
          }
        })
        .catch((error: unknown) => {
          if (active)
            setReads((old) => ({
              ...old,
              [network]: {
                loading: false,
                error:
                  error instanceof Error
                    ? error.message
                    : "The public read failed. Refresh to try again.",
              },
            }));
        });
    }
    return () => {
      active = false;
      controller.abort();
    };
  }, [api, refresh]);
  const loading = Object.values(reads).some((read) => read.loading);
  return (
    <div className="landing-shell">
      <a className="skip-link" href="#overview">
        Skip to overview
      </a>
      <header className="landing-header">
        <a
          className="landing-wordmark"
          href="#overview"
          aria-label="Exit evidence overview"
        >
          EXIT / EVIDENCE
        </a>
        <nav aria-label="Overview navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#workbench">
            Open workbench <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>
      <main className="landing-main" id="overview" tabIndex={-1}>
        <section className="landing-hero" aria-labelledby="overview-heading">
          <div className="landing-intro">
            <p className="landing-eyebrow">
              PUBLIC MARKETS. TRACEABLE EVIDENCE.
            </p>
            <h1 id="overview-heading">
              A quote is
              <br />
              not a fill.
            </h1>
            <p className="landing-lede">
              Follow the evidence on Monad. Inspect Perpl market quotes, Envio
              exchange records and independent chain receipts in one read-only
              workbench.
            </p>
            <div className="landing-actions">
              <a className="landing-button primary" href="#workbench">
                Open live workbench <span aria-hidden="true">→</span>
              </a>
              <a className="landing-source" href={SOURCE}>
                View source on GitHub <span aria-hidden="true">↗</span>
              </a>
            </div>
            <p className="landing-small-note">
              No wallet connection. No orders submitted.
            </p>
          </div>
          <section
            className="landing-source-map"
            aria-labelledby="source-map-heading"
          >
            <p className="landing-eyebrow">THE EVIDENCE PATH</p>
            <h2 id="source-map-heading">
              Three sources.
              <br />
              Each with a purpose.
            </h2>
            <ol>
              <li>
                <span className="landing-step-number" aria-hidden="true">
                  01
                </span>
                <div>
                  <h3>Public quotes</h3>
                  <p>Perpl API · current book depth</p>
                </div>
              </li>
              <li>
                <span className="landing-step-number" aria-hidden="true">
                  02
                </span>
                <div>
                  <h3>Exchange records</h3>
                  <p>Envio · indexed public events</p>
                </div>
              </li>
              <li>
                <span className="landing-step-number" aria-hidden="true">
                  03
                </span>
                <div>
                  <h3>Independent receipt</h3>
                  <p>Monad RPC · canonical block comparison</p>
                </div>
              </li>
            </ol>
            <p className="landing-map-note">
              Keep the quote, the event and the source comparison in view.
            </p>
          </section>
        </section>

        <section
          className="landing-availability"
          aria-labelledby="availability-heading"
        >
          <div className="landing-section-heading">
            <div>
              <p className="landing-eyebrow">SOURCE AVAILABILITY</p>
              <h2 id="availability-heading">Indexed activity, by network</h2>
            </div>
            <button
              className="secondary"
              onClick={() => setRefresh((value) => value + 1)}
              disabled={loading}
            >
              {loading ? "Checking sources…" : "Refresh activity"}
            </button>
          </div>
          <div className="landing-network-grid">
            {NETWORKS.map(({ network, name, chainId }) => {
              const read = reads[network];
              const availability = read.loading
                ? {
                    label: "Checking source…",
                    detail: "Reading real Envio activity for this network.",
                  }
                : read.error
                  ? { label: "Read failed", detail: read.error }
                  : activityAvailability(read.activity!, network, clock);
              const timestamp = read.activity?.receivedAt;
              const hasTimestamp =
                timestamp && Number.isFinite(Date.parse(timestamp));
              const available = availability.label === "Available";
              return (
                <section
                  className="landing-network-card"
                  key={network}
                  aria-labelledby={`${network}-heading`}
                >
                  <div className="landing-network-top">
                    <h3 id={`${network}-heading`}>{name}</h3>
                    <span className="landing-chain">Chain {chainId}</span>
                  </div>
                  <div
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    className={`landing-read-status ${available ? "is-available" : "is-pending"}`}
                  >
                    <span className="status-dot" aria-hidden="true" />
                    Indexed activity: {availability.label}
                  </div>
                  <p className="landing-network-detail">
                    {availability.detail}
                  </p>
                  <dl className="landing-source-details">
                    <div>
                      <dt>Source</dt>
                      <dd>
                        {read.activity?.engine === "HYPERSYNC"
                          ? "Envio HyperSync"
                          : read.activity?.engine === "HYPERINDEX"
                            ? "Envio HyperIndex"
                            : "Envio"}
                      </dd>
                    </div>
                    <div>
                      <dt>Source read</dt>
                      <dd>
                        {hasTimestamp ? (
                          <time dateTime={timestamp}>
                            {new Date(timestamp)
                              .toISOString()
                              .replace("T", " ")
                              .replace(/\.000Z$/, "Z")
                              .replace(/Z$/, " UTC")}
                          </time>
                        ) : (
                          "Not available yet"
                        )}
                      </dd>
                    </div>
                    {available &&
                      Number.isSafeInteger(read.activity?.windowStartBlock) &&
                      read.activity!.windowStartBlock! >= 0 &&
                      read.activity!.windowStartBlock! <=
                        read.activity!.watermark! && (
                        <div>
                          <dt>Coverage starts</dt>
                          <dd className="mono">
                            Block {read.activity!.windowStartBlock}
                          </dd>
                        </div>
                      )}
                    {available && (
                      <div>
                        <dt>
                          {read.activity?.engine === "HYPERSYNC"
                            ? "Scanned through"
                            : "Indexed through"}
                        </dt>
                        <dd className="mono">
                          Block {read.activity!.watermark}
                        </dd>
                      </div>
                    )}
                  </dl>
                </section>
              );
            })}
          </div>
          <p className="landing-small-note">
            These reads check Envio activity only. Availability can differ
            between sources and networks. Refresh manually for another check.
          </p>
        </section>

        <section
          className="landing-walkthrough"
          id="how-it-works"
          aria-labelledby="how-heading"
        >
          <div className="landing-section-heading">
            <div>
              <p className="landing-eyebrow">FROM QUOTE TO RECORD</p>
              <h2 id="how-heading">Inspect. Compare. Keep the evidence.</h2>
            </div>
            <p className="landing-section-intro">
              For builders who want to see what the data actually says.
            </p>
          </div>
          <ol className="landing-step-grid">
            <li>
              <span className="landing-step-number" aria-hidden="true">
                01 / MARKET
              </span>
              <h3>Read the public book</h3>
              <p>
                Select a network and market. Enter your own quantity to
                calculate depth against the current Perpl quotes.
              </p>
              <p className="landing-step-limit">
                An estimate describes visible liquidity. It cannot guarantee a
                fill.
              </p>
            </li>
            <li>
              <span className="landing-step-number" aria-hidden="true">
                02 / EVENT
              </span>
              <h3>Choose a real transaction</h3>
              <p>
                Open an Envio indexed event or paste a Monad transaction hash.
                Inspect the exchange log and its decoded parameters.
              </p>
              <p className="landing-step-limit">
                An order request records a request. Fill events have their own
                meaning.
              </p>
            </li>
            <li>
              <span className="landing-step-number" aria-hidden="true">
                03 / RECEIPT
              </span>
              <h3>Compare the sources</h3>
              <p>
                Read the independent Monad receipt, check its canonical block
                and compare the event with Envio. Export the observation as
                JSON.
              </p>
              <p className="landing-step-limit">
                A match is a point-in-time comparison, with provenance and
                limitations attached.
              </p>
            </li>
          </ol>
        </section>

        <section
          className="landing-boundary"
          aria-labelledby="boundary-heading"
        >
          <div>
            <p className="landing-eyebrow">A CLEARER RECORD</p>
            <h2 id="boundary-heading">Know what the evidence supports.</h2>
          </div>
          <div>
            <p>
              Public exchange events describe their participants. They do not
              establish your wallet ownership or execution by this app.
              Canonical block checks are point-in-time observations, not
              finality guarantees.
            </p>
            <p>
              The exported digest detects changed observation bytes. It does not
              authenticate an owner. Missing or stale sources stay visible in
              the workbench.
            </p>
            <a className="landing-text-link" href="#evidence">
              Inspect transaction evidence <span aria-hidden="true">→</span>
            </a>
          </div>
        </section>
        <section className="landing-final" aria-labelledby="start-heading">
          <div>
            <p className="landing-eyebrow">START WITH A PUBLIC READ</p>
            <h2 id="start-heading">
              Open the record.
              <br />
              Follow the sources.
            </h2>
          </div>
          <a className="landing-button primary" href="#workbench">
            Open live workbench <span aria-hidden="true">→</span>
          </a>
        </section>
      </main>
      <footer className="landing-footer">
        <p>
          EXIT / EVIDENCE <span>Built for public reads on Monad.</span>
        </p>
        <a href={SOURCE}>
          Source &amp; documentation <span aria-hidden="true">↗</span>
        </a>
      </footer>
    </div>
  );
}
