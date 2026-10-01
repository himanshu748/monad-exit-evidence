import type { FormValues, Market, Resolved, Review } from "./types";
export function PermissionPanel({
  values,
  market,
  review,
  errors,
  disabled,
  locked,
  onChange,
  onReview,
}: {
  values: FormValues;
  market: Market | undefined;
  review: Review | null;
  errors: Resolved["errors"];
  disabled: boolean;
  locked: boolean;
  onChange: (key: keyof FormValues, value: string) => void;
  onReview: () => void;
}) {
  const priceTitle =
    values.direction === "long" ? "Minimum price" : "Maximum price";
  return (
    <section className="panel" aria-labelledby="limits-heading">
      <div className="section-heading">
        <h2 id="limits-heading">Hypothetical limits</h2>
        <span className="caption">Close-only</span>
      </div>
      <p className="muted compact">Hypothetical position</p>
      <div className="form-grid">
        {(
          [
            {
              key: "positionQuantity",
              title: "Existing position",
              unit: market?.symbol ?? "units",
            },
            {
              key: "closeQuantity",
              title: "Close quantity",
              unit: market?.symbol ?? "units",
            },
            { key: "priceLimit", title: priceTitle, unit: "USD" },
          ] as const
        ).map((field) => (
          <div className="field" key={field.key}>
            <label htmlFor={field.key}>{field.title}</label>
            <div
              className={`input-with-unit ${errors[field.key] ? "invalid" : ""}`}
            >
              <input
                id={field.key}
                disabled={locked}
                inputMode="decimal"
                value={values[field.key]}
                onChange={(e) => onChange(field.key, e.target.value)}
                aria-invalid={!!errors[field.key]}
                aria-describedby={
                  errors[field.key] ? `${field.key}-error` : undefined
                }
              />
              <span>{field.unit}</span>
            </div>
            {errors[field.key] && (
              <p id={`${field.key}-error`} className="field-error" role="alert">
                {errors[field.key]}
              </p>
            )}
          </div>
        ))}
        <div className="field">
          <label htmlFor="direction">Position side</label>
          <select
            id="direction"
            disabled={locked}
            value={values.direction}
            onChange={(e) => onChange("direction", e.target.value)}
          >
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </div>
      </div>
      {review && (
        <div className="review-summary" aria-label="Immutable reviewed limits">
          <p>
            Reviewed integer limits <span>(immutable)</span>
          </p>
          <dl>
            <div>
              <dt>Position units</dt>
              <dd>{review.resolved.position}</dd>
            </div>
            <div>
              <dt>Close units</dt>
              <dd data-testid="review-close">{review.resolved.close}</dd>
            </div>
            <div>
              <dt>Price units</dt>
              <dd>{review.resolved.price}</dd>
            </div>
          </dl>
          <p className="caption">
            {review.input.network} · market {review.input.marketId} ·{" "}
            {review.input.direction} · {review.input.sizeDecimals}/
            {review.input.priceDecimals} decimals
          </p>
        </div>
      )}
      <button className="primary full" disabled={disabled} onClick={onReview}>
        Review limits
      </button>
      <p className="caption footnote">
        No holdings are connected. No signature or trade is requested.
      </p>
    </section>
  );
}
