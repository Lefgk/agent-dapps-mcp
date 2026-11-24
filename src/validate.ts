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

const UINT160_MAX = (1n << 160n) - 1n;
const UINT48_MAX = (1n << 48n) - 1n;

function isMissing(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim().length === 0);
}

/** Throw a clear "is required" error for missing values. */
export function requireValue(value: unknown, field: string): void {
  if (isMissing(value)) throw new ToolError(`${field} is required.`);
}

export function parseAddress(value: unknown, field: string, opts?: { allowZero?: boolean }): Address {
  requireValue(value, field);
  if (typeof value !== "string" || !isAddress(value, { strict: false })) {
    throw new ToolError(`${field} must be a 20-byte 0x-prefixed address (0x + 40 hex characters).`);
  }
  // Mixed-case input must carry a valid EIP-55 checksum. All-lowercase or all-uppercase is accepted.
  const body = value.slice(2);
  const mixed = body !== body.toLowerCase() && body !== body.toUpperCase();
  if (mixed && !isAddress(value, { strict: true })) {
    throw new ToolError(
      `${field} has an invalid EIP-55 checksum. Re-copy the address, or pass it all-lowercase if you are sure it is correct.`,
    );
  }
  const addr = getAddress(value) as Address;
  if (!opts?.allowZero && addr === "0x0000000000000000000000000000000000000000") {
    throw new ToolError(`${field} must not be the zero address.`);
  }
  return addr;
}

export function parseUint(value: unknown, field: string, max = UINT256_MAX): bigint {
  requireValue(value, field);
  let n: bigint;
  if (typeof value === "bigint") {
    n = value;
  } else if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0) {
      throw new ToolError(`${field} must be a non-negative integer.`);
    }
    if (!Number.isSafeInteger(value)) {
      throw new ToolError(`${field} is too large for a JSON number. Pass it as a decimal string.`);
    }
    n = BigInt(value);
  } else if (typeof value === "string") {
    const s = value.trim();
    if (/^-/.test(s)) throw new ToolError(`${field} must not be negative.`);
    if (/^[0-9]*\.[0-9]+$/.test(s) || /^[0-9]+(\.[0-9]*)?e[0-9]+$/i.test(s)) {
      throw new ToolError(
        `${field} must be an integer in base units, not a decimal. USDC has 6 decimals: 1.5 USDC = "1500000".`,
      );
    }
    if (!/^(0x[0-9a-fA-F]+|[0-9]+)$/.test(s)) {
      throw new ToolError(`${field} must be a decimal or 0x hex integer string, e.g. "1000000".`);
    }
    n = BigInt(s);
  } else {
    throw new ToolError(`${field} must be a non-negative integer string.`);
  }
  if (n < 0n) throw new ToolError(`${field} must not be negative.`);
  if (n > max) throw new ToolError(`${field} exceeds the allowed range (max ${max.toString()}).`);
  return n;
}

export const parseUint256 = (v: unknown, f: string) => parseUint(v, f, UINT256_MAX);
export const parseUint160 = (v: unknown, f: string) => parseUint(v, f, UINT160_MAX);
export const parseUint128 = (v: unknown, f: string) => parseUint(v, f, UINT128_MAX);
export const parseUint64 = (v: unknown, f: string) => parseUint(v, f, UINT64_MAX);
export const parseUint48 = (v: unknown, f: string) => parseUint(v, f, UINT48_MAX);
export const parseUint32 = (v: unknown, f: string) => parseUint(v, f, UINT32_MAX);
export const parseUint16 = (v: unknown, f: string) => parseUint(v, f, UINT16_MAX);
export const parseUint8 = (v: unknown, f: string) => parseUint(v, f, UINT8_MAX);

export function parseHex(value: unknown, field: string, opts?: { minBytes?: number; maxBytes?: number }): Hex {
  requireValue(value, field);
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

/**
 * Parse a bytes32. With `allowText` (memos, reason tags) short utf-8 text is right-padded into bytes32.
 * Without it (keys, order ids, hashes) only a 0x 32-byte hex value is accepted, so text is never
 * silently turned into a different key.
 */
export function parseBytes32(value: unknown, field: string, opts: { allowText?: boolean } = { allowText: true }): Hash {
  if (typeof value === "string" && isHash(value)) return value.toLowerCase() as Hash;
  if (!opts.allowText) {
    requireValue(value, field);
    throw new ToolError(`${field} must be a 32-byte 0x hex value (0x + 64 hex characters).`);
  }
  if (typeof value === "string" && value.startsWith("0x")) {
    throw new ToolError(`${field} must be exactly 32 bytes (0x + 64 hex characters), or plain utf-8 text of at most 32 bytes.`);
  }
  if (typeof value === "string" && value.length <= 32) {
    // Pad a short utf-8 memo into bytes32. Longer strings are rejected so we never silently hash user text.
    const bytes = new TextEncoder().encode(value);
    if (bytes.length > 32) throw new ToolError(`${field} utf-8 text must be at most 32 bytes.`);
    let hex = "0x";
    for (const b of bytes) hex += b.toString(16).padStart(2, "0");
    return (hex.padEnd(66, "0") as Hash);
  }
  throw new ToolError(`${field} must be a 32-byte 0x hash, or utf-8 text of at most 32 bytes.`);
}

export const CHAIN_ID_BASE = 8453;

/** Accept only Base (8453). Agents sometimes pass a chain id; anything else is rejected, never ignored. */
export function parseChainId(value: unknown, field = "chainId"): 8453 {
  if (value === undefined) return 8453;
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^(0x[0-9a-fA-F]+|[0-9]+)$/.test(value.trim())
        ? Number(BigInt(value.trim()))
        : NaN;
  if (n !== CHAIN_ID_BASE) {
    throw new ToolError(`${field} ${String(value)} is not supported. This server only works on Base (chainId 8453).`);
  }
  return 8453;
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
