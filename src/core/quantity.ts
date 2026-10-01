const MAX = (1n << 128n) - 1n;
export function precision(decimals: number): void {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18)
    throw new Error("Unsupported decimal precision");
}
export function parseUnits(value: string, decimals: number): bigint {
  precision(decimals);
  if (
    typeof value !== "string" ||
    value.length > 80 ||
    !/^(0|[1-9]\d*)(\.\d+)?$/.test(value)
  )
    throw new Error(
      "Use a plain nonnegative decimal, without spaces or exponent notation",
    );
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals)
    throw new Error(`Maximum ${decimals} decimal places`);
  const result =
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
  if (result > MAX) throw new Error("Quantity exceeds supported integer range");
  return result;
}
export function integer(value: string): bigint {
  if (
    typeof value !== "string" ||
    !/^(0|[1-9]\d*)$/.test(value) ||
    value.length > 40
  )
    throw new Error("Invalid integer quantity");
  const result = BigInt(value);
  if (result > MAX) throw new Error("Integer overflow");
  return result;
}
export function formatUnits(value: bigint, decimals: number): string {
  precision(decimals);
  const sign = value < 0n ? "-" : "";
  const abs = value < 0n ? -value : value;
  const scale = 10n ** BigInt(decimals);
  const fraction = (abs % scale)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  return `${sign}${abs / scale}${fraction ? "." + fraction : ""}`;
}
