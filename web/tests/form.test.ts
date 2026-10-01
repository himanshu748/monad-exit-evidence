import { describe, expect, it } from "vitest";
import { resolveLimits, formatUnits } from "../src/form";
const market = { sizeDecimals: 5, priceDecimals: 2 };
const values = {
  positionQuantity: "0.04",
  closeQuantity: "0.02",
  priceLimit: "60000",
};
describe("exact hypothetical limits", () => {
  it("resolves human decimal strings without floating point", () =>
    expect(resolveLimits(values, market)).toEqual({
      errors: {},
      position: "4000",
      close: "2000",
      price: "6000000",
    }));
  it.each(["1e-2", "-0.02", "0.000001", "NaN", "1,000", "00.02", ""])(
    "rejects invalid close input %s",
    (closeQuantity) =>
      expect(
        resolveLimits({ ...values, closeQuantity }, market).errors
          .closeQuantity,
      ).toBeTruthy(),
  );
  it("rejects increasing or empty allowances", () => {
    expect(
      resolveLimits({ ...values, closeQuantity: "0.05" }, market).errors
        .closeQuantity,
    ).toBeTruthy();
    expect(
      resolveLimits({ ...values, closeQuantity: "0" }, market).errors
        .closeQuantity,
    ).toBeTruthy();
  });
  it("rejects out-of-range 128-bit quantities and unsupported precision", () => {
    expect(
      resolveLimits(
        {
          ...values,
          positionQuantity: "340282366920938463463374607431768211456",
        },
        market,
      ).errors.positionQuantity,
    ).toBeTruthy();
    expect(
      resolveLimits(values, { sizeDecimals: 19, priceDecimals: 2 }).errors
        .positionQuantity,
    ).toBeTruthy();
  });
  it("formats arbitrarily large base-unit values exactly", () =>
    expect(formatUnits("900719925474099312345", 5)).toBe(
      "9007199254740993.12345",
    ));
});
