import { formatUnits, scenarioNames } from "./form";
import type { Receipt, Review, Scenario, Verification } from "./types";
const statusLabels = {
  COMPLETED: "Rehearsal completed",
  REJECTED: "Request rejected",
  PARTIAL: "Partial outcome",
  UNKNOWN: "Outcome unknown",
};
export function OutcomePanel({
  scenario,
  review,
  receipt,
  pending,
  error,
  retry,
  verification,
  verificationError,
  verifying,
  json,
  onScenario,
  onRun,
  onVerify,
  onJson,
  onExport,
}: {
  scenario: Scenario;
  review: Review | null;
  receipt: Receipt | null;
  pending: boolean;
  error: string;
  retry: boolean;
  verification: Verification | null;
  verificationError: string;
  verifying: boolean;
  json: string;
  onScenario: (s: Scenario) => void;
  onRun: () => void;
  onVerify: () => void;
  onJson: (s: string) => void;
  onExport: () => void;
}) {
  const units = (s: string) =>
    `${formatUnits(s, review?.input.sizeDecimals ?? 0)} ${review?.symbol ?? "units"}`;
  return (
    <section
      className="panel outcome-panel"
      id="evidence"
      aria-labelledby="outcome-heading"
    >
      <h2 id="outcome-heading">Rehearsal outcome</h2>
      <p className="muted compact">Simulated approval and execution</p>
      <label className="field scenario-field">
        Rehearsal scenario
        <select
          value={scenario}
          onChange={(e) => onScenario(e.target.value as Scenario)}
          disabled={pending || retry || receipt?.execution.status === "UNKNOWN"}
        >
          {Object.entries(scenarioNames).map(([value, name]) => (
            <option key={value} value={value}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <button
        className="primary full run-button"
        onClick={onRun}
        disabled={!review || pending || !!receipt}
      >
        {pending
          ? "Running rehearsal…"
          : retry
            ? "Retry same request"
            : "Run rehearsal"}
      </button>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {retry && (
        <p className="notice warning">
          The response is unconfirmed. Retry reuses the same request ID; it does
          not create another execution.
        </p>
      )}
      {!receipt ? (
        <div className="outcome-empty">
          <div className="empty-mark" aria-hidden="true">
            ↳
          </div>
          <h3>Evidence starts with limits</h3>
          <p>
            Review a hypothetical close, then run a labeled rehearsal to compare
            its outcome.
          </p>
        </div>
      ) : (
        <>
          <div
            className={`outcome-banner ${receipt.execution.status === "COMPLETED" ? "success" : receipt.execution.status === "REJECTED" ? "error" : "warning"}`}
            role="status"
          >
            <span className="status-dot" />
            {statusLabels[receipt.execution.status]}
          </div>
          {receipt.scenario === "tampered" && (
            <p className="notice warning">
              Deliberately tampered replay. Verify the receipt before relying on
              these values.
            </p>
          )}
          <table className="comparison">
            <thead>
              <tr>
                <th>Item</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Approved close</td>
                <td>{units(receipt.authorization.authorizedCloseQuantity)}</td>
              </tr>
              <tr>
                <td>Observed fill</td>
                <td>{units(receipt.execution.filledQuantity)}</td>
              </tr>
              <tr data-testid="reserved-row">
                <td>Still reserved</td>
                <td>{units(receipt.execution.reservedQuantity)}</td>
              </tr>
            </tbody>
          </table>
          {receipt.execution.status === "PARTIAL" && (
            <p className="notice warning">
              A partial result is not completion.{" "}
              {receipt.execution.reservedQuantity !== "0"
                ? "Unresolved quantity stays reserved."
                : "This attempt ended; the unfilled remainder is not retried."}
            </p>
          )}
          {receipt.execution.status === "UNKNOWN" && (
            <p className="notice warning">
              The reservation remains held. An unknown outcome cannot safely be
              resubmitted as a new request.
            </p>
          )}
          <ul className="checks">
            {receipt.checks
              .filter((check) =>
                [
                  "Only position reduction",
                  "Exact approved quantity bound",
                  "Full target observed",
                ].includes(check.name),
              )
              .map((check, i) => (
                <li key={`${check.name}-${i}`}>
                  <span
                    className={`check-icon ${check.result.toLowerCase()}`}
                    aria-hidden="true"
                  >
                    {check.result === "PASS"
                      ? "✓"
                      : check.result === "FAIL"
                        ? "×"
                        : "?"}
                  </span>
                  <div>
                    {check.name}
                    <small>
                      {check.expected} → {check.observed}
                    </small>
                  </div>
                  <strong className={check.result.toLowerCase()}>
                    {check.result}
                  </strong>
                </li>
              ))}
          </ul>
          <details className="all-checks">
            <summary>All {receipt.checks.length} evidence checks</summary>
            <ul className="checks">
              {receipt.checks.map((check, i) => (
                <li key={i}>
                  <div>
                    {check.name}
                    <small>
                      Expected: {check.expected}
                      <br />
                      Observed: {check.observed}
                      <br />
                      Source: {check.source}
                    </small>
                  </div>
                  <strong className={check.result.toLowerCase()}>
                    {check.result}
                  </strong>
                </li>
              ))}
            </ul>
          </details>
          <details className="timeline">
            <summary>Execution observations</summary>
            <ol>
              {receipt.execution.timeline.map((item, index) => (
                <li key={index}>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </li>
              ))}
            </ol>
            <p className="caption">
              Provider writes: {receipt.execution.providerWrites} · Simulated
              submissions: {receipt.execution.simulatedSubmissions}
            </p>
          </details>
          <div className="button-row">
            <button className="secondary" onClick={onExport}>
              Export JSON
            </button>
            <button className="primary" onClick={onVerify} disabled={verifying}>
              {verifying ? "Verifying…" : "Verify receipt"}
            </button>
          </div>
          {verification && (
            <div
              role="status"
              className={`notice ${verification.valid ? "success" : "error"}`}
            >
              <strong>
                {verification.valid
                  ? "Receipt integrity verified"
                  : "Integrity check failed"}
              </strong>
              <p>{verification.meaning}</p>
            </div>
          )}
          {verificationError && (
            <p className="notice error" role="alert">
              {verificationError}
            </p>
          )}
          <details className="receipt-inspector">
            <summary>Inspect or verify receipt JSON</summary>
            <label htmlFor="receipt-json">Receipt JSON</label>
            <textarea
              id="receipt-json"
              value={json}
              onChange={(e) => onJson(e.target.value)}
              spellCheck={false}
            />
            <p className="caption">
              Edits here affect verification only. Export preserves the original
              returned receipt.
            </p>
          </details>
        </>
      )}
      <p className="caption integrity-note">
        Receipt integrity does not prove real-world execution.
      </p>
    </section>
  );
}
