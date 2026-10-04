import { timeLabel } from "./form";
import type { Market, Markets, Liquidity, Level } from "./types";
function Book({
  title,
  levels,
  symbol,
}: {
  title: string;
  levels: Level[];
  symbol: string;
}) {
  return (
    <table className={`order-book ${title === "Bids" ? "bids" : "asks"}`}>
      <caption>
        {title} <span>(USD)</span>
      </caption>
      <thead>
        <tr>
          <th>Price</th>
          <th>Size ({symbol})</th>
        </tr>
      </thead>
      <tbody>
        {levels.slice(0, 5).map((level, index) => (
          <tr key={index}>
            <td>{level.price}</td>
            <td>{level.quantity}</td>
          </tr>
        ))}
        {!levels.length && (
          <tr>
            <td colSpan={2}>No quoted levels</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
export function MarketPanel({
  context,
  market,
  liquidity,
  error,
  liquidityError,
  loading,
  locked,
  refreshLocked,
  onMarket,
  onRefresh,
}: {
  context: Markets | null;
  market: Market | undefined;
  liquidity: Liquidity | null;
  error: string;
  liquidityError: string;
  loading: boolean;
  locked: boolean;
  refreshLocked?: boolean;
  onMarket: (id: number) => void;
  onRefresh: () => void;
}) {
  return (
    <section className="panel" aria-labelledby="liquidity-heading">
      <div className="section-heading">
        <h2 id="liquidity-heading">Live liquidity</h2>
        <button
          className="text-button"
          onClick={onRefresh}
          disabled={loading || refreshLocked}
        >
          Refresh reads
        </button>
      </div>
      {error ? (
        <div role="alert" className="notice error">
          {error}
        </div>
      ) : !context ? (
        <div className="empty-state" role="status">
          Reading public markets…
        </div>
      ) : (
        <>
          <div className="market-heading">
            <label className="market-select">
              Market
              <select
                aria-label="Market"
                disabled={locked}
                value={market?.id ?? ""}
                onChange={(e) => onMarket(Number(e.target.value))}
              >
                {context.markets.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="source-status">
              <span
                className={`status-dot ${context.stale ? "amber" : "green"}`}
              />
              {context.stale ? "Stale snapshot" : "Public read"}
              <small>{timeLabel(context.observedAt)}</small>
            </div>
          </div>
          <p className="muted source-line">
            Public Perpl snapshot · Chain {context.chainId}
          </p>
          {context.stale && (
            <p className="notice warning">
              This snapshot is stale. Refresh before using it.
            </p>
          )}
          {!market ? (
            <p className="empty-state">
              No markets are available for this network.
            </p>
          ) : liquidityError ? (
            <p className="notice warning" role="alert">
              {liquidityError}
            </p>
          ) : !liquidity ? (
            <p className="empty-state" role="status">
              Reading order book…
            </p>
          ) : (
            <>
              <div className="order-books">
                <Book
                  title="Bids"
                  levels={liquidity.bids}
                  symbol={market.symbol}
                />
                <Book
                  title="Asks"
                  levels={liquidity.asks}
                  symbol={market.symbol}
                />
              </div>
              <p className="caption">
                {liquidity.stale
                  ? "Stale order book. Refresh reads."
                  : "Actual public quotes. No position quantity or execution outcome is assumed."}
              </p>
            </>
          )}
          <a
            className="source-link"
            href={context.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            View public source ↗
          </a>
        </>
      )}
    </section>
  );
}
