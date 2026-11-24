import { isAddress } from "viem";
import { z } from "zod";

/**
 * Zod field helpers. The MCP SDK validates arguments against these schemas before a handler runs,
 * so the messages here are what an agent sees for malformed input. Handlers still re-check
 * ranges, zero addresses and contract identity with src/validate.ts.
 */

type Iss = { input?: unknown };

function stringError(what: string) {
  return (iss: Iss) =>
    iss.input === undefined
      ? "is required"
      : typeof iss.input === "number"
        ? `must be a string, not a JSON number. Pass ${what} as a string, e.g. "1000000"`
        : `must be a string (${what})`;
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function address(description: string) {
  return z
    .string({ error: stringError("a 0x address") })
    .regex(ADDRESS_RE, { error: "must be a 20-byte 0x-prefixed address (0x + 40 hex characters)" })
    .refine((v) => {
      const body = v.slice(2);
      const mixed = body !== body.toLowerCase() && body !== body.toUpperCase();
      return !mixed || isAddress(v, { strict: true });
    }, { error: "has an invalid EIP-55 checksum; re-copy the address or pass it all-lowercase" })
    .describe(description);
}

export function uint(description: string) {
  return z
    .string({ error: stringError("an integer") })
    .regex(/^(0x[0-9a-fA-F]+|[0-9]+)$/, {
      error: 'must be a non-negative integer string in base units (decimal or 0x hex), e.g. "1000000" = 1 USDC',
    })
    .describe(description);
}

export function hex(description: string) {
  return z
    .string({ error: stringError("0x hex") })
    .regex(/^0x([0-9a-fA-F]{2})*$/, { error: "must be 0x-prefixed hex with an even number of digits" })
    .describe(description);
}

/** Strict 32-byte hex (keys, order ids, hashes). */
export function bytes32(description: string) {
  return z
    .string({ error: stringError("a 0x 32-byte hex value") })
    .regex(/^0x[0-9a-fA-F]{64}$/, { error: "must be a 32-byte 0x hex value (0x + 64 hex characters)" })
    .describe(description);
}

/** bytes32 that also accepts short utf-8 text (memos, reason tags). */
export function memo(description: string) {
  return z
    .string({ error: stringError("text or 0x hex") })
    .max(66, { error: "must be a 0x 32-byte hex value or utf-8 text of at most 32 bytes" })
    .describe(description);
}

export function text(description: string, max = 2048) {
  return z
    .string({ error: stringError("text") })
    .max(max, { error: `must be at most ${max} characters` })
    .describe(description);
}

export function action<const T extends readonly [string, ...string[]]>(values: T, description = "Which call to build") {
  return z
    .enum(values, {
      error: (iss: Iss) =>
        iss.input === undefined ? `is required; one of: ${values.join(", ")}` : `must be one of: ${values.join(", ")}`,
    })
    .describe(description);
}

export const chainId = z
  .literal([8453, "8453"], { error: "is not supported; this server only works on Base (chainId 8453)" })
  .describe("Optional. Must be 8453 (Base) if given; any other chain is rejected.");

export const from = address(
  "EOA that would send the transaction. Used only for simulation. This server does not sign or broadcast.",
);
