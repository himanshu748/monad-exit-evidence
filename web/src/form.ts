import type { FormValues, Market, Resolved } from "./types";
function parse(value: string, decimals: number): bigint | null {
  if (
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 18 ||
    value.length > 80 ||
    !/^(0|[1-9]\d*)(?:\.\d+)?$/.test(value)
  )
    return null;
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals) return null;
  const parsed = BigInt(whole + fraction.padEnd(decimals, "0"));
  return parsed > 0n && parsed <= (1n << 128n) - 1n ? parsed : null;
}
export function resolveLimits(
  values: Pick<FormValues, "positionQuantity" | "closeQuantity" | "priceLimit">,
  market: Pick<Market, "sizeDecimals" | "priceDecimals">,
): Resolved {
  const errors: Resolved["errors"] = {};
  const position = parse(values.positionQuantity, market.sizeDecimals),
    close = parse(values.closeQuantity, market.sizeDecimals),
    price = parse(values.priceLimit, market.priceDecimals);
  if (position === null)
    errors.positionQuantity = `Use a plain positive decimal, with at most ${market.sizeDecimals} decimal places.`;
  if (close === null)
    errors.closeQuantity = `Use a plain positive decimal, with at most ${market.sizeDecimals} decimal places.`;
  if (price === null)
    errors.priceLimit = `Use a plain positive decimal, with at most ${market.priceDecimals} decimal places.`;
  if (position !== null && close !== null && close > position)
    errors.closeQuantity =
      "Close quantity cannot exceed the hypothetical existing position.";
  return {
    errors,
    ...(position !== null ? { position: position.toString() } : {}),
    ...(close !== null ? { close: close.toString() } : {}),
    ...(price !== null ? { price: price.toString() } : {}),
  };
}
export function formatUnits(value: string, decimals: number): string {
  if (
    !/^\d+$/.test(value) ||
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 18
  )
    return "Unavailable";
  if (decimals === 0) return value;
  const padded = value.padStart(decimals + 1, "0");
  return `${padded.slice(0, -decimals)}.${padded.slice(-decimals)}`;
}
export function timeLabel(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.valueOf())
    ? date.toLocaleTimeString("en-GB", { hour12: false, timeZone: "UTC" }) +
        " UTC"
    : "Unknown time";
}
export const scenarioNames = {
  valid: "Permitted close",
  unauthorized: "Unauthorized open",
  partial: "Partial fill",
  interrupted: "Interrupted delivery",
  duplicate: "Duplicate request",
  tampered: "Tampered receipt",
} as const;
