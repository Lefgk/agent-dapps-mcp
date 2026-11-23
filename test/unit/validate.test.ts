import { describe, expect, it } from "vitest";
import { ToolError, parseAddress, parseBytes32, parseUint } from "../../src/validate.js";

describe("parseAddress", () => {
  it("checksums a valid address", () => {
    expect(parseAddress("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", "account")).toBe(
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    );
  });
  it("rejects the zero address", () => {
    expect(() => parseAddress("0x0000000000000000000000000000000000000000", "from")).toThrow(ToolError);
  });
  it("rejects a short value", () => {
    expect(() => parseAddress("0x1234", "from")).toThrow(/20-byte/);
  });
});

describe("parseUint", () => {
  it("accepts decimal and hex", () => {
    expect(parseUint("1000000", "amount")).toBe(1_000_000n);
    expect(parseUint("0xff", "amount")).toBe(255n);
  });
  it("rejects negatives and overflow", () => {
    expect(() => parseUint("-1", "amount")).toThrow();
    expect(() => parseUint((1n << 256n).toString(), "amount")).toThrow(/range/);
  });
});

describe("parseBytes32", () => {
  it("pads short utf-8 memos", () => {
    const hex = parseBytes32("hello", "memo");
    expect(hex.startsWith("0x68656c6c6f")).toBe(true);
    expect(hex.length).toBe(66);
  });
  it("rejects long utf-8", () => {
    expect(() => parseBytes32("n".repeat(33), "memo")).toThrow();
  });
});
