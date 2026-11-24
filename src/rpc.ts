import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  decodeErrorResult,
  fallback,
  http,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { base } from "viem/chains";
import { errorsAbi } from "./generated/abis.js";
import { CHAIN_ID, DEFAULT_RPC_URL } from "./addresses.js";
import { ToolError } from "./validate.js";

export type CallResult =
  | { ok: true; data: Hex | undefined }
  | { ok: false; reason: string };

export type Rpc = {
  url: string;
  call: (args: {
    to: Address;
    data: Hex;
    from?: Address;
    value?: bigint;
    stateOverride?: { address: Address; code: Hex }[];
  }) => Promise<CallResult>;
  getCode: (address: Address) => Promise<Hex | undefined>;
  /** eth_estimateGas. Never sends anything. */
  estimateGas?: (args: {
    to: Address;
    data: Hex;
    from: Address;
    value?: bigint;
    stateOverride?: { address: Address; code: Hex }[];
  }) => Promise<{ ok: true; gas: bigint } | { ok: false; reason: string }>;
  /** eth_gasPrice in wei. */
  getGasPrice?: () => Promise<bigint>;
};

export function createRpc(url = DEFAULT_RPC_URL): Rpc {
  const client = createPublicClient({
    chain: base,
    transport: fallback([http(url, { timeout: 30_000 }), http(DEFAULT_RPC_URL, { timeout: 30_000 })]),
  });
  return {
    url,
    async getCode(address) {
      const code = await client.getCode({ address });
      return code;
    },
    async estimateGas({ to, data, from, value, stateOverride }) {
      try {
        const gas = await client.estimateGas({
          to,
          data,
          account: from,
          value: value ?? 0n,
          stateOverride: stateOverride?.map((s) => ({ address: s.address, code: s.code })),
        });
        return { ok: true, gas };
      } catch (err) {
        return { ok: false, reason: formatRevert(err) };
      }
    },
    async getGasPrice() {
      return client.getGasPrice();
    },
    async call({ to, data, from, value, stateOverride }) {
      try {
        const result = await client.call({
          to,
          data,
          account: from,
          value: value ?? 0n,
          stateOverride: stateOverride?.map((s) => ({ address: s.address, code: s.code })),
        });
        return { ok: true, data: result.data };
      } catch (err) {
        return { ok: false, reason: formatRevert(err) };
      }
    },
  };
}

export function formatRevert(err: unknown): string {
  if (err instanceof ContractFunctionRevertedError) {
    const name = err.data?.errorName;
    const args = err.data?.args;
    if (name) {
      const pretty = args && args.length ? `${name}(${args.map((a) => String(a)).join(", ")})` : name;
      return `The call would revert: ${pretty}.`;
    }
    if (err.reason) return `The call would revert: ${err.reason}.`;
  }
  if (err instanceof BaseError) {
    const decoded = tryDecode(err);
    if (decoded) return decoded;
    const short = err.shortMessage || err.message;
    return `The call would revert: ${stripInternal(short)}.`;
  }
  if (err instanceof Error) return `The call would revert: ${stripInternal(err.message)}.`;
  return "The call would revert for an unknown reason.";
}

function tryDecode(err: BaseError): string | undefined {
  const hex = findRevertData(err);
  if (!hex) return undefined;
  try {
    const decoded = decodeErrorResult({ abi: errorsAbi as Abi, data: hex });
    const pretty =
      decoded.args && decoded.args.length
        ? `${decoded.errorName}(${decoded.args.map((a) => String(a)).join(", ")})`
        : decoded.errorName;
    return `The call would revert: ${pretty}.`;
  } catch {
    return undefined;
  }
}

function findRevertData(err: BaseError): Hex | undefined {
  const walk: unknown[] = [err];
  const seen = new Set<unknown>();
  while (walk.length) {
    const cur = walk.pop();
    if (!cur || typeof cur !== "object" || seen.has(cur)) continue;
    seen.add(cur);
    const rec = cur as Record<string, unknown>;
    if (typeof rec.data === "string" && rec.data.startsWith("0x") && rec.data.length >= 10) {
      return rec.data as Hex;
    }
    if (rec.cause) walk.push(rec.cause);
    if (rec.walk && typeof rec.walk === "function") {
      try {
        rec.walk((e: unknown) => walk.push(e));
      } catch {
        /* ignore */
      }
    }
  }
  return undefined;
}

function stripInternal(message: string): string {
  return message.replace(/\s+/g, " ").slice(0, 500);
}

export function assertBase(): void {
  if (base.id !== CHAIN_ID) throw new ToolError("Internal error: unexpected chain configuration.");
}

export { errorsAbi };
