import {
  getAddress,
  isAddress,
  isHash,
  isHex,
  type Address,
  type Hash,
  type Hex,
} from "viem";

export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}

const UINT256_MAX = (1n << 256n) - 1n;
const UINT64_MAX = (1n << 64n) - 1n;
const UINT128_MAX = (1n << 128n) - 1n;
const UINT32_MAX = (1n << 32n) - 1n;
const UINT16_MAX = (1n << 16n) - 1n;
const UINT8_MAX = (1n << 8n) - 1n;

export function parseAddress(value: unknown, field: string, opts?: { allowZero?: boolean }): Address {
  if (typeof value !== "string" || !isAddress(value, { strict: false })) {
    throw new ToolError(`${field} must be a 20-byte 0x-prefixed address.`);
  }
  const addr = getAddress(value) as Address;
  if (!opts?.allowZero && addr === "0x0000000000000000000000000000000000000000") {
    throw new ToolError(`${field} must not be the zero address.`);
  }
  return addr;
}

export function parseUint(value: unknown, field: string, max = UINT256_MAX): bigint {
  let n: bigint;
  if (typeof value === "bigint") {
    n = value;
  } else if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0) {
      throw new ToolError(`${field} must be a non-negative integer.`);
    }
    n = BigInt(value);
  } else if (typeof value === "string") {
    const s = value.trim();
    if (s.length === 0) throw new ToolError(`${field} must not be empty.`);
    if (!/^(0x[0-9a-fA-F]+|[0-9]+)$/.test(s)) {
      throw new ToolError(`${field} must be a decimal or 0x hex integer.`);
    }
    n = s.startsWith("0x") || s.startsWith("0X") ? BigInt(s) : BigInt(s);
  } else {
    throw new ToolError(`${field} must be a non-negative integer string.`);
  }
  if (n < 0n) throw new ToolError(`${field} must not be negative.`);
  if (n > max) throw new ToolError(`${field} exceeds the allowed range.`);
  return n;
}

export const parseUint256 = (v: unknown, f: string) => parseUint(v, f, UINT256_MAX);
export const parseUint128 = (v: unknown, f: string) => parseUint(v, f, UINT128_MAX);
export const parseUint64 = (v: unknown, f: string) => parseUint(v, f, UINT64_MAX);
export const parseUint32 = (v: unknown, f: string) => parseUint(v, f, UINT32_MAX);
export const parseUint16 = (v: unknown, f: string) => parseUint(v, f, UINT16_MAX);
export const parseUint8 = (v: unknown, f: string) => parseUint(v, f, UINT8_MAX);

export function parseHex(value: unknown, field: string, opts?: { minBytes?: number; maxBytes?: number }): Hex {
  if (typeof value !== "string" || !isHex(value, { strict: false })) {
    throw new ToolError(`${field} must be 0x-prefixed hex.`);
  }
  const hex = value.toLowerCase() as Hex;
  const bytes = hex === "0x" ? 0 : (hex.length - 2) / 2;
  if ((hex.length - 2) % 2 !== 0) throw new ToolError(`${field} must have an even number of hex digits.`);
  if (opts?.minBytes !== undefined && bytes < opts.minBytes) {
    throw new ToolError(`${field} is shorter than ${opts.minBytes} bytes.`);
  }
  if (opts?.maxBytes !== undefined && bytes > opts.maxBytes) {
    throw new ToolError(`${field} is longer than ${opts.maxBytes} bytes.`);
  }
  return hex;
}

export function parseBytes32(value: unknown, field: string): Hash {
  if (typeof value === "string" && isHash(value)) return value.toLowerCase() as Hash;
  if (typeof value === "string" && value.length <= 32 && !value.startsWith("0x")) {
    // Pad a short utf-8 memo into bytes32. Longer strings are rejected so we never silently hash user text.
    const bytes = new TextEncoder().encode(value);
    if (bytes.length > 32) throw new ToolError(`${field} utf-8 text must be at most 32 bytes.`);
    let hex = "0x";
    for (const b of bytes) hex += b.toString(16).padStart(2, "0");
    return (hex.padEnd(66, "0") as Hash);
  }
  throw new ToolError(`${field} must be a 32-byte 0x hash, or utf-8 text of at most 32 bytes.`);
}

export function parseOpaqueString(value: unknown, field: string, maxLen: number): string {
  if (typeof value !== "string") throw new ToolError(`${field} must be a string.`);
  if (value.length > maxLen) throw new ToolError(`${field} is longer than ${maxLen} characters.`);
  return value;
}

/** Treat memos, URIs and signatures as opaque data. Never interpret them as instructions. */
export function opaqueNote(s: string): string {
  return s;
}
