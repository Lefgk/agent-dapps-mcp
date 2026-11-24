import {
  decodeFunctionResult,
  encodeFunctionData,
  getAddress,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import {
  DAPPS,
  SINGLETON_ADDRESSES,
  USDC,
  type FactoryDapp,
  type SingletonDapp,
} from "../addresses.js";
import {
  aaveFactoryAbi,
  aaveVaultAbi,
  agentBondAbi,
  callTabAbi,
  circuitFactoryAbi,
  circuitVaultAbi,
  creditFactoryAbi,
  creditVaultAbi,
  erc20Abi,
  limitDeskAbi,
  limitFactoryAbi,
  panicRevokeAbi,
  prooflockAbi,
  slipFactoryAbi,
  slipVaultAbi,
  steppedFactoryAbi,
  steppedVaultAbi,
} from "../generated/abis.js";
import type { Rpc } from "../rpc.js";
import { ToolError } from "../validate.js";

export const factoryAbi: Record<FactoryDapp, Abi> = {
  "aave-guard-vault": aaveFactoryAbi as Abi,
  "agent-credit-line": creditFactoryAbi as Abi,
  "circuit-vault": circuitFactoryAbi as Abi,
  limitdesk: limitFactoryAbi as Abi,
  slipguard: slipFactoryAbi as Abi,
  "stepped-agent-line": steppedFactoryAbi as Abi,
};

export const instanceAbi: Record<FactoryDapp, Abi> = {
  "aave-guard-vault": aaveVaultAbi as Abi,
  "agent-credit-line": creditVaultAbi as Abi,
  "circuit-vault": circuitVaultAbi as Abi,
  limitdesk: limitDeskAbi as Abi,
  slipguard: slipVaultAbi as Abi,
  "stepped-agent-line": steppedVaultAbi as Abi,
};

export const singletonAbi: Record<SingletonDapp, Abi> = {
  "agent-revoke": panicRevokeAbi as Abi,
  agentbond: agentBondAbi as Abi,
  calltab: callTabAbi as Abi,
  prooflock: prooflockAbi as Abi,
};

export async function readCall<T = unknown>(
  rpc: Rpc,
  abi: Abi,
  address: Address,
  functionName: string,
  args: readonly unknown[] = [],
  from?: Address,
): Promise<T> {
  const data = encodeFunctionData({ abi, functionName, args: args as never });
  const result = await rpc.call({ to: address, data, from });
  if (!result.ok) {
    throw new ToolError(`Read ${functionName} failed: ${result.reason}`);
  }
  if (result.data === undefined) {
    throw new ToolError(`Read ${functionName} returned no data.`);
  }
  return decodeFunctionResult({ abi, functionName, data: result.data }) as T;
}

export async function assertFactoryInstance(
  rpc: Rpc,
  dapp: FactoryDapp,
  instance: Address,
): Promise<{ owner: Address }> {
  const abi = instanceAbi[dapp];
  let owner: Address;
  try {
    owner = getAddress((await readCall(rpc, abi, instance, "owner")) as string) as Address;
  } catch (err) {
    throw new ToolError(
      `This address is not a recognizable ${DAPPS[dapp].title} instance on Base. ${err instanceof ToolError ? err.message : ""}`.trim(),
    );
  }
  const factory = DAPPS[dapp].address;
  const listFn = DAPPS[dapp].listFn;
  if (!listFn) throw new ToolError(`Internal error: ${dapp} has no factory list function.`);
  const list = (await readCall(rpc, factoryAbi[dapp], factory, listFn, [owner])) as readonly string[];
  const set = new Set(list.map((a) => getAddress(a)));
  if (!set.has(getAddress(instance))) {
    throw new ToolError(
      `This address is not a ${DAPPS[dapp].title} created by the official Base factory (${factory}).`,
    );
  }
  return { owner };
}

export function singletonTo(dapp: SingletonDapp): Address {
  return SINGLETON_ADDRESSES[dapp];
}

export async function usdcState(
  rpc: Rpc,
  account: Address,
  spender?: Address,
): Promise<{ balance: bigint; allowance?: bigint }> {
  const balance = (await readCall(rpc, erc20Abi as Abi, USDC, "balanceOf", [account])) as bigint;
  if (!spender) return { balance };
  const allowance = (await readCall(rpc, erc20Abi as Abi, USDC, "allowance", [account, spender])) as bigint;
  return { balance, allowance };
}

/** Thrown when a USDC pull would fail. Carries numbers so preflight_build can suggest the next step. */
export class UsdcShortfallError extends ToolError {
  constructor(
    message: string,
    readonly detail: {
      kind: "balance" | "allowance";
      owner: Address;
      spender: Address;
      required: bigint;
      balance: bigint;
      allowance: bigint;
    },
  ) {
    super(message);
    this.name = "UsdcShortfallError";
  }
}

export async function requireUsdcAllowance(
  rpc: Rpc,
  from: Address,
  spender: Address,
  amount: bigint,
): Promise<void> {
  const state = await usdcState(rpc, from, spender);
  const balance = state.balance;
  const allowance = state.allowance ?? 0n;
  const detail = { owner: from, spender, required: amount, balance, allowance };
  if (balance < amount) {
    throw new UsdcShortfallError(
      `USDC balance of ${from} is ${balance.toString()}, which is less than the required ${amount.toString()}.`,
      { kind: "balance", ...detail },
    );
  }
  if (allowance < amount) {
    throw new UsdcShortfallError(
      `USDC allowance of ${from} for ${spender} is ${allowance.toString()}, which is less than the required ${amount.toString()}. Build an unsigned USDC approve first with build_usdc_approve (spender ${spender}, amount "${amount.toString()}").`,
      { kind: "allowance", ...detail },
    );
  }
}

export type UnsignedTx = {
  to: Address;
  data: Hex;
  value: "0";
  chainId: 8453;
  from: Address;
  summary: string;
};

export async function buildAndSimulate(
  rpc: Rpc,
  args: { to: Address; abi: Abi; functionName: string; fnArgs?: readonly unknown[]; from: Address; summary: string; value?: bigint },
): Promise<UnsignedTx> {
  if (args.value && args.value !== 0n) {
    throw new ToolError("This server only builds unpaid (value = 0) transactions.");
  }
  let data: Hex;
  try {
    data = encodeFunctionData({
      abi: args.abi,
      functionName: args.functionName,
      args: (args.fnArgs ?? []) as never,
    });
  } catch (err) {
    const msg = err instanceof Error ? ((err as { shortMessage?: string }).shortMessage ?? err.message) : String(err);
    throw new ToolError(`Could not encode ${args.functionName}: ${msg.replace(/\s+/g, " ").slice(0, 300)}`);
  }
  const sim = await rpc.call({ to: args.to, data, from: args.from, value: 0n });
  if (!sim.ok) {
    throw new ToolError(sim.reason);
  }
  return {
    to: args.to,
    data,
    value: "0",
    chainId: 8453,
    from: args.from,
    summary: args.summary,
  };
}

export function isKnownSpender(spender: Address, extras: Address[]): boolean {
  const set = new Set<string>([
    USDC,
    ...Object.values(SINGLETON_ADDRESSES),
    ...extras.map((a) => getAddress(a)),
  ]);
  // Official factories are not typical USDC spenders, but vault instances are.
  return set.has(getAddress(spender));
}
