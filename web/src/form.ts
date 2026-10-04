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
