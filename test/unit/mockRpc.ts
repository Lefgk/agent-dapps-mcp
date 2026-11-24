import {
  decodeFunctionData,
  encodeFunctionResult,
  getAddress,
  parseAbi,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { factoryAbi, instanceAbi, singletonAbi } from "../../src/tools/common.js";
import { erc20Abi } from "../../src/generated/abis.js";
import type { Rpc } from "../../src/rpc.js";

const extraAbi = parseAbi([
  "function owner() view returns (address)",
  "function getL1FeeUpperBound(uint256 unsignedTxSize) view returns (uint256)",
]);

const ABIS: Abi[] = [
  erc20Abi as Abi,
  extraAbi as Abi,
  ...Object.values(factoryAbi),
  ...Object.values(instanceAbi),
  ...Object.values(singletonAbi),
];

export type Handler = (args: readonly unknown[], ctx: { from?: Address; to: Address }) => unknown;

/**
 * ABI-aware mock: handlers are keyed by "<checksummed address>.<functionName>" or "*.<functionName>".
 * Missing handlers revert, so tests fail loudly instead of reading garbage.
 */
export function mockRpc(
  handlers: Record<string, Handler | unknown>,
  opts: { code?: Record<string, Hex>; gas?: bigint; gasPrice?: bigint; estimateFail?: string } = {},
): Rpc & { calls: string[] } {
  const calls: string[] = [];
  const decode = (data: Hex) => {
    for (const abi of ABIS) {
      try {
        return { abi, ...decodeFunctionData({ abi, data }) };
      } catch {
        /* next */
      }
    }
    return undefined;
  };
  return {
    url: "mock",
    calls,
    async getCode(address) {
      return opts.code?.[getAddress(address)] ?? "0x6080";
    },
    async call({ to, data, from }) {
      const d = decode(data);
      if (!d) return { ok: false, reason: "The call would revert: unknown selector." };
      const key = `${getAddress(to)}.${d.functionName}`;
      calls.push(key);
      const h = key in handlers ? handlers[key] : handlers[`*.${d.functionName}`];
      if (h === undefined) return { ok: false, reason: `The call would revert: no mock for ${key}.` };
      const value = typeof h === "function" ? (h as Handler)(d.args ?? [], { from, to }) : h;
      if (value instanceof Error) return { ok: false, reason: value.message };
      try {
        const out = encodeFunctionResult({ abi: d.abi, functionName: d.functionName, result: value as never });
        return { ok: true, data: out };
      } catch {
        return { ok: true, data: "0x" };
      }
    },
    async estimateGas() {
      if (opts.estimateFail) return { ok: false, reason: opts.estimateFail };
      return { ok: true, gas: opts.gas ?? 50_000n };
    },
    async getGasPrice() {
      return opts.gasPrice ?? 10_000_000n;
    },
  };
}
