import type { Activity, Network } from "./types";
export function ActivityPanel({
  activity,
  error,
  network,
  onInspect,
}: {
  activity: Activity | null;
  error: string;
  network: Network;
  onInspect: (event: Activity["events"][number]) => void;
}) {
  return (
    <section
      className="panel activity-panel"
      id="activity"
      aria-labelledby="activity-heading"
    >
      <div className="section-heading">
        <h2 id="activity-heading">Indexed activity</h2>
        <span className="caption">Envio · {network}</span>
      </div>
      {error ? (
        <p className="empty-state">{error}</p>
      ) : !activity ? (
        <p className="empty-state" role="status">
          Checking indexer availability…
        </p>
      ) : activity.status !== "live" ? (
        <div className="empty-state">
          <p>{activity.error || "Envio pipeline unavailable."}</p>
          <p className="caption">No indexed activity has been inferred.</p>
        </div>
      ) : (
        <>
          <p className="caption">
            Latest 50 events shown; transaction inspection also queries the full
            current index window. Observed chain watermark:{" "}
            {activity.watermark ?? "not reported"}
          </p>
          {activity.windowStartBlock !== undefined && (
            <p className="caption">
              Recent index window starts at block {activity.windowStartBlock}.
              Earlier activity is outside this window.
            </p>
          )}
          {activity.events.length ? (
            <div className="activity-table-wrap">
              <table className="activity-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Block</th>
                    <th>Market</th>
                    <th>Transaction</th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.events.map((event) => (
                    <tr key={event.id}>
                      <td>{event.kind}</td>
                      <td>{event.blockNumber}</td>
                      <td>{event.marketId ?? "—"}</td>
                      <td className="mono">
                        {event.transactionHash.slice(0, 12)}…
                        {event.transactionHash.slice(-6)}
                      </td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => onInspect(event)}
                          aria-label={`Inspect ${event.id}`}
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-state">
              No events returned by the live indexer.
            </p>
          )}
        </>
      )}
      <div className="integration-gates">
        <span>
          Nansen context <strong>Access required</strong>
        </span>
      </div>
    </section>
  );
}
