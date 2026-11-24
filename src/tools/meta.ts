import {
  decodeFunctionData,
  formatEther,
  formatUnits,
  getAddress,
  parseAbi,
  toFunctionSelector,
  toFunctionSignature,
  type Abi,
  type AbiFunction,
  type Address,
  type Hex,
} from "viem";
import { z } from "zod";
import {
  ALL_DAPPS,
  DAPPS,
  FACTORY_DAPPS,
  USDC,
  isFactoryDapp,
  type DappId,
  type FactoryDapp,
} from "../addresses.js";
import { READ_SCOPE, SCOPE } from "../format.js";
import type { Rpc } from "../rpc.js";
import { erc20Abi } from "../generated/abis.js";
import {
  ToolError,
  parseAddress,
  parseChainId,
  parseHex,
  parseOpaqueString,
  parseUint256,
} from "../validate.js";
import { ACTION_RULES, DAPP_TOOLS, EXAMPLES, EXAMPLE_NOTE, WORKFLOW } from "./catalog.js";
import { UsdcShortfallError, factoryAbi, instanceAbi, readCall, singletonAbi, singletonTo } from "./common.js";
import * as f from "./fields.js";
import type { ToolDef } from "./types.js";

/** Access to the final tool registry without a circular import. */
export type Registry = {
  list: () => ToolDef[];
  get: (name: string) => ToolDef | undefined;
  formatZodError: (toolName: string, err: z.ZodError) => string;
};

function desc(text: string): string {
  return `${text} ${READ_SCOPE}`;
}

/** First sentence of a tool description, without the shared scope boilerplate. */
export function shortDescription(tool: ToolDef): string {
  const text = tool.description.split(SCOPE)[0]!.replace(/\s*Read-only\. Uses eth_call on Base\.\s*$/, "").trim();
  const builds = text.split(" Builds an unsigned transaction and returns")[0]!.trim();
  return builds;
}

export function toolKind(name: string): "build" | "read" | "help" {
  if (name.startsWith("build_")) return "build";
  if (name === "describe_tools" || name === "find_dapp" || name === "decode_tx" || name === "estimate_gas" || name === "preflight_build") {
    return "help";
  }
  return "read";
}

function dappOfBuildTool(name: string): DappId | undefined {
  return ALL_DAPPS.find((id) => DAPP_TOOLS[id].build === name);
}

// ---------------------------------------------------------------- target resolution

type Target =
  | { kind: "usdc"; address: Address; title: string; abi: Abi }
  | { kind: "singleton" | "factory"; dapp: DappId; address: Address; title: string; abi: Abi }
  | { kind: "instance"; dapp: FactoryDapp; address: Address; title: string; abi: Abi; owner: Address; factory: Address }
  | { kind: "eoa-delegated"; dapp: "agent-revoke"; address: Address; title: string; abi: Abi };

const ownerAbi = parseAbi(["function owner() view returns (address)"]);

/** Is this address a vault/desk created by one of the six official factories? */
export async function findOfficialInstance(
  rpc: Rpc,
  address: Address,
): Promise<{ dapp: FactoryDapp; owner: Address; factory: Address } | null> {
  const code = await rpc.getCode(address).catch(() => undefined);
  if (!code || code === "0x") return null;
  let owner: Address;
  try {
    owner = getAddress((await readCall(rpc, ownerAbi as Abi, address, "owner")) as string) as Address;
  } catch {
    return null;
  }
  for (const dapp of FACTORY_DAPPS) {
    const info = DAPPS[dapp];
    try {
      const list = (await readCall(rpc, factoryAbi[dapp], info.address, info.listFn!, [owner])) as readonly string[];
      if (list.some((a) => getAddress(a) === address)) return { dapp, owner, factory: info.address };
    } catch {
      /* try the next factory */
    }
  }
  return null;
}

function knownContract(address: Address): Target | null {
  if (address === USDC) return { kind: "usdc", address, title: "USDC (Circle, Base)", abi: erc20Abi as Abi };
  for (const id of ALL_DAPPS) {
    const d = DAPPS[id];
    if (d.address !== address) continue;
    if (d.kind === "singleton") {
      return { kind: "singleton", dapp: id, address, title: d.title, abi: singletonAbi[id as keyof typeof singletonAbi] };
    }
    return { kind: "factory", dapp: id, address, title: `${d.title} factory`, abi: factoryAbi[id as FactoryDapp] };
  }
  return null;
}

async function resolveTarget(rpc: Rpc, to: Address, from: Address | undefined, data: Hex, warnings: string[]): Promise<Target | null> {
  const known = knownContract(to);
  if (known) return known;
  const panicAbi = singletonAbi["agent-revoke"];
  const panicSelectors = new Set(
    (panicAbi as readonly { type: string; name?: string }[])
      .filter((i) => i.type === "function" && (i.name === "panic" || i.name === "panicWith"))
      .map((i) => toFunctionSelector(i as AbiFunction)),
  );
  if (panicSelectors.has(data.slice(0, 10).toLowerCase() as Hex)) {
    if (from && from !== to) {
      warnings.push("panic/panicWith must be sent by the account to itself (to == from). This tx has a different from.");
    }
    if (!from) warnings.push("Pass from to confirm the sender; panic/panicWith must be sent by the account to itself.");
    const code = await rpc.getCode(to).catch(() => undefined);
    const registry = singletonTo("agent-revoke");
    const delegation = `0xef0100${registry.slice(2).toLowerCase()}`;
    if (code && code !== "0x" && code.toLowerCase() !== delegation) {
      warnings.push(`${to} has code that is not an EIP-7702 delegation to PanicRevoke (${registry}). Do not sign.`);
    } else if (!code || code === "0x") {
      warnings.push(`${to} has no EIP-7702 delegation yet. It must delegate to PanicRevoke (${registry}) before this call works.`);
    }
    return { kind: "eoa-delegated", dapp: "agent-revoke", address: to, title: "Agent Revoke (as the account, EIP-7702)", abi: panicAbi };
  }
  const inst = await findOfficialInstance(rpc, to);
  if (!inst) return null;
  return {
    kind: "instance",
    dapp: inst.dapp,
    address: to,
    title: DAPPS[inst.dapp].title,
    abi: instanceAbi[inst.dapp],
    owner: inst.owner,
    factory: inst.factory,
  };
}

function builtFunctions(target: Target): Set<string> {
  if (target.kind === "usdc") return new Set(["approve"]);
  if (target.kind === "factory") return new Set();
  return new Set(Object.keys(ACTION_RULES[DAPP_TOOLS[target.dapp].build] ?? {}));
}

function plain(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  }
  return value;
}

export type Decoded = {
  official: boolean;
  chainId: 8453;
  to: Address;
  from: Address | null;
  value: string;
  contract: Record<string, unknown> | null;
  function: string | null;
  signature: string | null;
  selector: string | null;
  args: Record<string, unknown> | null;
  builtByThisServer: boolean;
  summary: string;
  warnings: string[];
};

export async function decodeTx(
  rpc: Rpc,
  input: { to: unknown; data: unknown; from?: unknown; value?: unknown; chainId?: unknown },
): Promise<Decoded> {
  parseChainId(input.chainId);
  const to = parseAddress(input.to, "to");
  const from = input.from !== undefined ? parseAddress(input.from, "from") : undefined;
  const data = parseHex(input.data, "data", { maxBytes: 64 * 1024 });
  const value = parseUint256(input.value ?? "0", "value");
  const warnings: string[] = [];
  if (value !== 0n) {
    warnings.push(`value is ${value.toString()} wei. This server only builds value = 0 transactions; do not sign a paid call based on it.`);
  }
  const base = { chainId: 8453 as const, to, from: from ?? null, value: value.toString() };
  if (data.length < 10) {
    throw new ToolError("data must include at least a 4-byte function selector.");
  }
  const target = await resolveTarget(rpc, to, from, data, warnings);
  if (!target) {
    return {
      official: false,
      ...base,
      contract: null,
      function: null,
      signature: null,
      selector: data.slice(0, 10),
      args: null,
      builtByThisServer: false,
      summary: `${to} is not an official Agent Dapps contract, vault or desk on Base, or USDC.`,
      warnings: [...warnings, "Unknown target contract. Do not sign this based on this server's tools."],
    };
  }
  const contract: Record<string, unknown> = { kind: target.kind, title: target.title, address: target.address };
  if (target.kind !== "usdc") contract.dapp = target.dapp;
  if (target.kind === "instance") {
    contract.owner = target.owner;
    contract.factory = target.factory;
  }
  let decoded: { functionName: string; args?: readonly unknown[] };
  try {
    decoded = decodeFunctionData({ abi: target.abi, data }) as typeof decoded;
  } catch {
    return {
      official: true,
      ...base,
      contract,
      function: null,
      signature: null,
      selector: data.slice(0, 10),
      args: null,
      builtByThisServer: false,
      summary: `Calldata does not match any function of ${target.title}.`,
      warnings: [...warnings, "Calldata does not decode against the official ABI. Do not sign."],
    };
  }
  const item = (target.abi as readonly AbiFunction[]).find(
    (i) => i.type === "function" && i.name === decoded.functionName && toFunctionSelector(i) === data.slice(0, 10),
  )!;
  const args: Record<string, unknown> = {};
  (decoded.args ?? []).forEach((v, i) => {
    args[item.inputs[i]?.name || `arg${i}`] = plain(v);
  });
  const built = builtFunctions(target).has(decoded.functionName);
  if (!built) {
    warnings.push(`${decoded.functionName} is not one of the calls this server builds (owner and factory calls are out of scope in v1).`);
  }
  const extra: string[] = [];
  if (target.kind === "usdc" && decoded.functionName === "approve") {
    const spender = getAddress(args.spender as string) as Address;
    const amount = BigInt(args.amount as string);
    extra.push(`${formatUnits(amount, 6)} USDC`);
    const spenderKnown = knownContract(spender);
    const isPullingSingleton =
      spenderKnown?.kind === "singleton" && spenderKnown.dapp !== "agent-revoke";
    if (isPullingSingleton) {
      contract.spenderDapp = spenderKnown.dapp;
    } else {
      const inst = await findOfficialInstance(rpc, spender);
      if (inst) contract.spenderDapp = inst.dapp;
      else warnings.push(`Approve spender ${spender} is not an official Agent Dapps contract, vault or desk. Do not sign.`);
    }
    if (amount === (1n << 256n) - 1n) warnings.push("Unlimited approval. Prefer the exact amount needed.");
  }
  const argText = Object.entries(args)
    .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(", ");
  return {
    official: true,
    ...base,
    contract,
    function: decoded.functionName,
    signature: toFunctionSignature(item),
    selector: data.slice(0, 10),
    args,
    builtByThisServer: built,
    summary: `${target.title} ${target.address}: ${decoded.functionName}(${argText})${extra.length ? ` [${extra.join("; ")}]` : ""}`,
    warnings,
  };
}

// ---------------------------------------------------------------- gas

const GAS_ORACLE = getAddress("0x420000000000000000000000000000000000000F") as Address;
const gasOracleAbi = parseAbi(["function getL1FeeUpperBound(uint256 unsignedTxSize) view returns (uint256)"]);

export async function estimateTx(
  rpc: Rpc,
  input: { to: unknown; data: unknown; from: unknown; value?: unknown; chainId?: unknown },
) {
  const decoded = await decodeTx(rpc, input);
  if (!decoded.official) {
    throw new ToolError(`${decoded.to} is not an official Agent Dapps contract on Base; refusing to estimate gas for it.`);
  }
  if (decoded.value !== "0") throw new ToolError("This server only estimates value = 0 transactions.");
  if (!rpc.estimateGas || !rpc.getGasPrice) throw new ToolError("This RPC client does not support gas estimation.");
  const from = parseAddress(input.from, "from");
  const data = parseHex(input.data, "data");
  let stateOverride: { address: Address; code: Hex }[] | undefined;
  if (decoded.contract?.kind === "eoa-delegated") {
    const registryCode = await rpc.getCode(singletonTo("agent-revoke"));
    if (registryCode && registryCode !== "0x") stateOverride = [{ address: decoded.to, code: registryCode }];
  }
  const est = await rpc.estimateGas({ to: decoded.to, data, from, value: 0n, stateOverride });
  if (!est.ok) throw new ToolError(est.reason);
  const gasPrice = await rpc.getGasPrice();
  const l2Fee = est.gas * gasPrice;
  let l1Upper: bigint | undefined;
  try {
    const size = BigInt((data.length - 2) / 2 + 100);
    l1Upper = (await readCall(rpc, gasOracleAbi as Abi, GAS_ORACLE, "getL1FeeUpperBound", [size])) as bigint;
  } catch {
    l1Upper = undefined;
  }
  return {
    chainId: 8453,
    to: decoded.to,
    from,
    summary: decoded.summary,
    gas: est.gas.toString(),
    suggestedGasLimit: ((est.gas * 12n) / 10n).toString(),
    gasPriceWei: gasPrice.toString(),
    l2FeeWei: l2Fee.toString(),
    l2FeeEth: formatEther(l2Fee),
    l1DataFeeUpperBoundWei: l1Upper?.toString() ?? null,
    totalFeeUpperBoundEth: l1Upper !== undefined ? formatEther(l2Fee + l1Upper) : null,
    usedStateOverride: Boolean(stateOverride),
    warnings: decoded.warnings,
    note: "Estimate only (eth_estimateGas at the latest block). Nothing was signed or sent. suggestedGasLimit adds a 20% buffer.",
  };
}

// ---------------------------------------------------------------- tools

export function createMetaTools(registry: Registry): ToolDef[] {
  const describeTools: ToolDef = {
    name: "describe_tools",
    title: "Describe tools (start here)",
    description: desc(
      "Start here. Lists every tool with a one-line purpose, required inputs, per-action fields and example calls. Pass `tool` for the full input schema and examples of one tool.",
    ),
    inputSchema: z.object({
      tool: z.string({ error: "must be a tool name string" }).max(64).optional().describe("Optional tool name for full detail"),
    }),
    async handler(args) {
      const all = registry.list();
      if (typeof args.tool === "string") {
        const tool = registry.get(args.tool);
        if (!tool) throw new ToolError(unknownToolMessage(args.tool, all));
        const schema = z.toJSONSchema(tool.inputSchema, { io: "input", unrepresentable: "any" }) as {
          properties?: Record<string, unknown>;
          required?: string[];
        };
        return {
          name: tool.name,
          title: tool.title,
          kind: toolKind(tool.name),
          description: shortDescription(tool),
          required: schema.required ?? [],
          properties: schema.properties ?? {},
          actions: ACTION_RULES[tool.name] ?? null,
          examples: (EXAMPLES[tool.name] ?? []).map((e) => ({ tool: tool.name, arguments: e.args, ...(e.note ? { note: e.note } : {}) })),
          exampleNote: EXAMPLE_NOTE,
        };
      }
      return {
        chainId: 8453,
        policy: "Reads state and returns unsigned transactions only. Never asks for keys, never signs, never broadcasts.",
        workflow: WORKFLOW,
        exampleNote: EXAMPLE_NOTE,
        tools: all.map((tool) => {
          const schema = z.toJSONSchema(tool.inputSchema, { io: "input", unrepresentable: "any" }) as { required?: string[] };
          const rules = ACTION_RULES[tool.name];
          const example = EXAMPLES[tool.name]?.[0];
          return {
            name: tool.name,
            kind: toolKind(tool.name),
            description: shortDescription(tool),
            required: schema.required ?? [],
            ...(rules
              ? { actions: Object.fromEntries(Object.entries(rules).map(([a, r]) => [a, r.required])) }
              : {}),
            ...(example ? { example: example.args } : {}),
          };
        }),
      };
    },
  };

  const findDapp: ToolDef = {
    name: "find_dapp",
    title: "Find a dapp by name or address",
    description: desc(
      "Looks up a dapp by id, title or keyword (e.g. \"credit\", \"escrow\", \"borrow\"), or identifies an address: a dapp contract, USDC, or a vault/desk created by an official factory (checked on-chain). Returns the matching read_* and build_* tools.",
    ),
    inputSchema: z.object({
      query: z
        .string({ error: "is required (a dapp name, keyword or 0x address)" })
        .min(2, { error: "must be at least 2 characters" })
        .max(100, { error: "must be at most 100 characters" })
        .describe("Dapp id/title/keyword, or a 0x address"),
    }),
    async handler(args, rpc) {
      const query = parseOpaqueString(args.query, "query", 100).trim();
      const describe = (id: DappId, extra: Record<string, unknown> = {}) => {
        const d = DAPPS[id];
        return {
          id,
          title: d.title,
          kind: d.kind,
          address: d.address,
          site: d.site,
          agentActions: d.agentActions,
          summary: d.summary,
          tools: DAPP_TOOLS[id],
          ...extra,
        };
      };
      if (/^0x/i.test(query)) {
        const address = parseAddress(query, "query");
        if (address === USDC) {
          return { query, match: "usdc", address, note: "Official Circle USDC on Base. Use read_usdc and build_usdc_approve.", dapps: [] };
        }
        const hit = ALL_DAPPS.find((id) => DAPPS[id].address === address);
        if (hit) {
          return {
            query,
            match: DAPPS[hit].kind === "factory" ? "factory" : "singleton",
            address,
            dapps: [describe(hit, DAPPS[hit].kind === "factory" ? { note: "This is the factory. Agents act on the vaults or desks it creates; use list_instances." } : {})],
          };
        }
        const inst = await findOfficialInstance(rpc, address);
        if (inst) {
          return {
            query,
            match: "instance",
            address,
            owner: inst.owner,
            factory: inst.factory,
            dapps: [describe(inst.dapp)],
          };
        }
        return {
          query,
          match: null,
          address,
          dapps: [],
          note: "Not an Agent Dapps contract, USDC, or a vault/desk from an official Base factory.",
        };
      }
      const q = query.toLowerCase();
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const nq = norm(q);
      const exact = ALL_DAPPS.filter((id) => norm(id) === nq || norm(DAPPS[id].title) === nq);
      const fuzzy = exact.length
        ? exact
        : ALL_DAPPS.filter((id) => {
            const d = DAPPS[id];
            return (
              norm(id).includes(nq) ||
              norm(d.title).includes(nq) ||
              d.summary.toLowerCase().includes(q) ||
              d.agentActions.toLowerCase().includes(q)
            );
          });
      return {
        query,
        match: fuzzy.length ? (exact.length ? "name" : "keyword") : null,
        dapps: fuzzy.map((id) => describe(id)),
        ...(fuzzy.length ? {} : { note: `No dapp matches. Known ids: ${ALL_DAPPS.join(", ")}.` }),
      };
    },
  };

  const decodeTool: ToolDef = {
    name: "decode_tx",
    title: "Decode / explain an unsigned tx",
    description: desc(
      "Decodes an unsigned transaction {to, data, value, chainId} into the target contract, function and named arguments, and flags anything a signer should not trust (unknown contract, wrong chain, non-zero value, unofficial approve spender, calls this server does not build). Use it to show the user what they are about to sign.",
    ),
    inputSchema: z.object({
      to: f.address("Transaction target"),
      data: f.hex("Calldata (0x...)"),
      value: f.uint("Optional value in wei (default 0)").optional(),
      from: f.address("Optional sender, for context").optional(),
      chainId: f.chainId.optional(),
    }),
    async handler(args, rpc) {
      return decodeTx(rpc, { ...args, to: args.to, data: args.data });
    },
  };

  const estimateTool: ToolDef = {
    name: "estimate_gas",
    title: "Estimate gas for an unsigned tx",
    description: desc(
      "Estimates gas and fee for an unsigned transaction built by this server, with eth_estimateGas from `from`. Only official Agent Dapps targets and value = 0. Returns gas, a 20% buffered gas limit, the L2 fee and an L1 data fee upper bound. Never signs or sends.",
    ),
    inputSchema: z.object({
      from: f.address("Sender used for the estimate"),
      to: f.address("Transaction target"),
      data: f.hex("Calldata (0x...)"),
      value: f.uint("Optional value in wei; must be 0").optional(),
      chainId: f.chainId.optional(),
    }),
    async handler(args, rpc) {
      return estimateTx(rpc, { ...args, to: args.to, data: args.data, from: args.from });
    },
  };

  const preflight: ToolDef = {
    name: "preflight_build",
    title: "Preflight a build (ready / not ready)",
    description: desc(
      "Runs any build_* tool and, instead of failing, reports {ready, reason, nextSteps}. When ready it also returns the unsigned tx, its decoded form and a gas estimate. When a USDC allowance or balance is short it suggests the exact build_usdc_approve call. Never signs or sends.",
    ),
    inputSchema: z.object({
      tool: z.string({ error: "is required (a build_* tool name)" }).max(64).describe("A build_* tool name"),
      args: z.record(z.string(), z.unknown(), { error: "must be an object of arguments for that tool" }).describe("Arguments for that tool"),
    }),
    async handler(args, rpc) {
      const name = String(args.tool);
      const tool = registry.get(name);
      if (!tool || toolKind(name) !== "build") {
        throw new ToolError(
          `tool must be a build_* tool. ${tool ? "" : unknownToolMessage(name, registry.list())}`.trim(),
        );
      }
      const parsed = tool.inputSchema.safeParse(args.args ?? {});
      if (!parsed.success) {
        return {
          ready: false,
          tool: name,
          reason: registry.formatZodError(name, parsed.error),
          nextSteps: [{ tool: "describe_tools", arguments: { tool: name }, why: "See the fields this tool and action need." }],
        };
      }
      const toolArgs = parsed.data as Record<string, unknown>;
      try {
        const tx = (await tool.handler(toolArgs, rpc)) as { to: Address; data: Hex; from: Address; value: string };
        const decoded = await decodeTx(rpc, { to: tx.to, data: tx.data, from: tx.from, value: tx.value });
        let gas: unknown = null;
        let gasError: string | null = null;
        if (rpc.estimateGas && rpc.getGasPrice) {
          try {
            const g = await estimateTx(rpc, { to: tx.to, data: tx.data, from: tx.from, value: tx.value });
            gas = { gas: g.gas, suggestedGasLimit: g.suggestedGasLimit, l2FeeEth: g.l2FeeEth, totalFeeUpperBoundEth: g.totalFeeUpperBoundEth };
          } catch (err) {
            gasError = err instanceof Error ? err.message : String(err);
          }
        }
        return {
          ready: true,
          tool: name,
          tx,
          decoded: { summary: decoded.summary, function: decoded.function, args: decoded.args, warnings: decoded.warnings },
          gas,
          ...(gasError ? { gasError } : {}),
          nextSteps: [{ why: "Show the user tx + decoded.summary, then sign and send it in their own wallet. This server never signs." }],
        };
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        const nextSteps: Record<string, unknown>[] = [];
        if (err instanceof UsdcShortfallError) {
          const d = err.detail;
          if (d.kind === "allowance") {
            const spenderKnown = knownContract(d.spender);
            const dapp = spenderKnown ? undefined : dappOfBuildTool(name);
            nextSteps.push({
              tool: "build_usdc_approve",
              arguments: {
                from: d.owner,
                spender: d.spender,
                amount: d.required.toString(),
                ...(dapp && isFactoryDapp(dapp) ? { dapp } : {}),
              },
              why: `Allowance is ${d.allowance.toString()}, ${d.required.toString()} is needed. Sign the approve, then call ${name} again.`,
            });
          } else {
            nextSteps.push({
              why: `Fund ${d.owner} with at least ${(d.required - d.balance).toString()} more USDC base units (${formatUnits(d.required - d.balance, 6)} USDC), then retry.`,
            });
          }
          return {
            ready: false,
            tool: name,
            reason,
            usdc: {
              owner: d.owner,
              spender: d.spender,
              required: d.required.toString(),
              balance: d.balance.toString(),
              allowance: d.allowance.toString(),
            },
            nextSteps,
          };
        }
        if (!(err instanceof ToolError)) throw err;
        const dapp = dappOfBuildTool(name);
        if (dapp) {
          nextSteps.push({ tool: DAPP_TOOLS[dapp].read, why: "Read the on-chain state (grant, caps, status) to see why the call would fail." });
        }
        return { ready: false, tool: name, reason, nextSteps };
      }
    },
  };

  return [describeTools, findDapp, decodeTool, estimateTool, preflight];
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = dp[j]!;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length]!;
}

export function unknownToolMessage(name: string, all: ToolDef[]): string {
  const generic = new Set(["read", "build", "list", "agent", "tool"]);
  const tokens = name.toLowerCase().split(/[_\-\s]+/).filter((t) => t.length >= 3 && !generic.has(t));
  const close = all
    .map((t) => ({ name: t.name, d: editDistance(name.toLowerCase(), t.name) }))
    .filter((c) => c.d <= 3 || tokens.some((t) => c.name.includes(t) || t.includes(c.name.split("_").pop() ?? "~")))
    .sort((x, y) => x.d - y.d)
    .slice(0, 3)
    .map((c) => c.name);
  return `Unknown tool: ${name}.${close.length ? ` Did you mean: ${close.join(", ")}?` : ""} Call describe_tools to list all tools.`;
}
