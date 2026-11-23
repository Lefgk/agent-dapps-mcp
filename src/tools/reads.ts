import { getAddress, type Abi, type Address } from "viem";
import { z } from "zod";
import {
  ALL_DAPPS,
  DAPPS,
  USDC,
  type FactoryDapp,
  isFactoryDapp,
} from "../addresses.js";
import { READ_SCOPE } from "../format.js";
import { ToolError, parseAddress, parseUint256 } from "../validate.js";
import {
  assertFactoryInstance,
  factoryAbi,
  instanceAbi,
  readCall,
  singletonAbi,
  singletonTo,
  usdcState,
} from "./common.js";
import type { ToolDef } from "./types.js";

const dappEnum = z.enum(ALL_DAPPS as unknown as [string, ...string[]]);
const factoryEnum = z.enum([
  "aave-guard-vault",
  "agent-credit-line",
  "circuit-vault",
  "limitdesk",
  "slipguard",
  "stepped-agent-line",
]);

function desc(text: string): string {
  return `${text} ${READ_SCOPE}`;
}

export const listDapps: ToolDef = {
  name: "list_dapps",
  title: "List Agent Dapps",
  description: desc(
    "Lists the 10 Agent Dapps on Base: factory or contract address, site, Sourcify page, and the agent-facing actions this server can build unsigned transactions for.",
  ),
  inputSchema: z.object({}),
  async handler() {
    return {
      chainId: 8453,
      chain: "base",
      usdc: USDC,
      contact: "lg.playstudio@gmail.com",
      policy:
        "This server never holds keys and never broadcasts. It only reads state and returns unsigned transactions for plain EOAs.",
      dapps: ALL_DAPPS.map((id) => {
        const d = DAPPS[id];
        return {
          id: d.id,
          title: d.title,
          kind: d.kind,
          address: d.address,
          site: d.site,
          repo: d.repo,
          sourcify: d.sourcify,
          agentActions: d.agentActions,
          summary: d.summary,
        };
      }),
    };
  },
};

export const listInstances: ToolDef = {
  name: "list_instances",
  title: "List vaults or desks",
  description: desc(
    "Lists vault or desk addresses created by the official Base factory for one of the six factory dapps, for a given owner.",
  ),
  inputSchema: z.object({
    dapp: factoryEnum.describe("Factory dapp id"),
    owner: z.string().describe("Owner address"),
  }),
  async handler(args, rpc) {
    const dapp = args.dapp;
    if (typeof dapp !== "string" || !isFactoryDapp(dapp)) {
      throw new ToolError("dapp must be a factory dapp id from list_dapps.");
    }
    const owner = parseAddress(args.owner, "owner");
    const info = DAPPS[dapp];
    const listFn = info.listFn;
    if (!listFn) throw new ToolError("Internal error: missing list function.");
    const list = (await readCall(rpc, factoryAbi[dapp], info.address, listFn, [owner])) as readonly string[];
    return {
      dapp,
      factory: info.address,
      owner,
      instances: list.map((a) => getAddress(a)),
    };
  },
};

export const readUsdc: ToolDef = {
  name: "read_usdc",
  title: "Read USDC balance and allowance",
  description: desc(
    "Reads official Circle USDC balance on Base for an account, and optionally its allowance to a spender. Does not handle any other token.",
  ),
  inputSchema: z.object({
    account: z.string().describe("Account to read"),
    spender: z.string().optional().describe("Optional spender for allowance"),
  }),
  async handler(args, rpc) {
    const account = parseAddress(args.account, "account");
    const spender = args.spender ? parseAddress(args.spender, "spender") : undefined;
    const state = await usdcState(rpc, account, spender);
    return { token: USDC, account, spender: spender ?? null, ...state };
  },
};

async function readVaultBundle(
  rpc: Parameters<ToolDef["handler"]>[1],
  dapp: FactoryDapp,
  vault: Address,
  agent: Address,
  views: Array<{ name: string; args?: unknown[]; key: string }>,
) {
  const { owner } = await assertFactoryInstance(rpc, dapp, vault);
  const abi = instanceAbi[dapp];
  const out: Record<string, unknown> = { dapp, vault, owner, agent };
  const paused = await readCall(rpc, abi, vault, "paused").catch(() => undefined);
  if (paused !== undefined) out.paused = paused;
  for (const v of views) {
    out[v.key] = await readCall(rpc, abi, vault, v.name, v.args ?? []);
  }
  return out;
}

export const readAaveGuard: ToolDef = {
  name: "read_aave_guard_vault",
  title: "Read Aave Guard Vault",
  description: desc(
    "Reads an official Aave Guard Vault: owner, pause, Aave account data and health-factor floor, the agent's grant, budget, remaining borrowable amount, and whether a recipient is allowed.",
  ),
  inputSchema: z.object({
    vault: z.string(),
    agent: z.string(),
    recipient: z.string().optional(),
  }),
  async handler(args, rpc) {
    const vault = parseAddress(args.vault, "vault");
    const agent = parseAddress(args.agent, "agent");
    const recipient = args.recipient ? parseAddress(args.recipient, "recipient") : undefined;
    const result = await readVaultBundle(rpc, "aave-guard-vault", vault, agent, [
      { name: "accountData", key: "accountData" },
      { name: "healthFactorFloor", key: "healthFactorFloor" },
      { name: "usdcDebt", key: "usdcDebt" },
      { name: "guardian", key: "guardian" },
      { name: "agents", args: [agent], key: "agent" },
      { name: "getBudget", args: [agent], key: "budget" },
      { name: "borrowableNow", args: [agent], key: "borrowableNow" },
    ]);
    if (recipient) {
      result.recipient = recipient;
      result.recipientAllowed = await readCall(rpc, instanceAbi["aave-guard-vault"], vault, "isRecipientAllowed", [
        agent,
        recipient,
      ]);
    }
    return result;
  },
};

export const readCreditLine: ToolDef = {
  name: "read_agent_credit_line",
  title: "Read Agent Credit Line",
  description: desc(
    "Reads an official Agent Credit Line vault: the agent's line, repayment record, available credit, amount due, liquidity, and optional recipient allowlist status.",
  ),
  inputSchema: z.object({
    vault: z.string(),
    agent: z.string(),
    recipient: z.string().optional(),
  }),
  async handler(args, rpc) {
    const vault = parseAddress(args.vault, "vault");
    const agent = parseAddress(args.agent, "agent");
    const recipient = args.recipient ? parseAddress(args.recipient, "recipient") : undefined;
    const result = await readVaultBundle(rpc, "agent-credit-line", vault, agent, [
      { name: "getLine", args: [agent], key: "line" },
      { name: "getRecord", args: [agent], key: "record" },
      { name: "availableCredit", args: [agent], key: "availableCredit" },
      { name: "amountDue", args: [agent], key: "amountDue" },
      { name: "liquidity", key: "liquidity" },
      { name: "feeBps", key: "feeBps" },
    ]);
    if (recipient) {
      result.recipient = recipient;
      result.recipientAllowed = await readCall(rpc, instanceAbi["agent-credit-line"], vault, "isRecipientAllowed", [
        agent,
        recipient,
      ]);
    }
    return result;
  },
};

export const readStepped: ToolDef = {
  name: "read_stepped_agent_line",
  title: "Read Stepped Agent Line",
  description: desc(
    "Reads an official Stepped Agent Line vault: the agent's line, repayment history, public creditHistory, available credit, amount due, and liquidity.",
  ),
  inputSchema: z.object({
    vault: z.string(),
    agent: z.string(),
    recipient: z.string().optional(),
  }),
  async handler(args, rpc) {
    const vault = parseAddress(args.vault, "vault");
    const agent = parseAddress(args.agent, "agent");
    const recipient = args.recipient ? parseAddress(args.recipient, "recipient") : undefined;
    const result = await readVaultBundle(rpc, "stepped-agent-line", vault, agent, [
      { name: "getLine", args: [agent], key: "line" },
      { name: "getHistory", args: [agent], key: "history" },
      { name: "creditHistory", args: [agent], key: "creditHistory" },
      { name: "availableCredit", args: [agent], key: "availableCredit" },
      { name: "amountDue", args: [agent], key: "amountDue" },
      { name: "liquidity", key: "liquidity" },
    ]);
    if (recipient) {
      result.recipient = recipient;
      result.recipientAllowed = await readCall(rpc, instanceAbi["stepped-agent-line"], vault, "isRecipientAllowed", [
        agent,
        recipient,
      ]);
    }
    return result;
  },
};

export const readCircuit: ToolDef = {
  name: "read_circuit_vault",
  title: "Read Circuit Vault",
  description: desc(
    "Reads an official Circuit Vault: value, cash, high-water mark, drawdown, trip state, the Aave strategy, the agent's grant, and whether anyone may trip the breaker.",
  ),
  inputSchema: z.object({
    vault: z.string(),
    agent: z.string().optional(),
  }),
  async handler(args, rpc) {
    const vault = parseAddress(args.vault, "vault");
    const { owner } = await assertFactoryInstance(rpc, "circuit-vault", vault);
    const abi = instanceAbi["circuit-vault"];
    const strategyCount = (await readCall(rpc, abi, vault, "strategyCount")) as bigint;
    const strategies: Address[] = [];
    const count = Number(strategyCount);
    for (let i = 0; i < count && i < 16; i += 1) {
      strategies.push(getAddress((await readCall(rpc, abi, vault, "strategyAt", [BigInt(i)])) as string) as Address);
    }
    const out: Record<string, unknown> = {
      dapp: "circuit-vault",
      vault,
      owner,
      paused: await readCall(rpc, abi, vault, "paused"),
      totalValue: await readCall(rpc, abi, vault, "totalValue"),
      cash: await readCall(rpc, abi, vault, "cash"),
      highWaterMark: await readCall(rpc, abi, vault, "highWaterMark"),
      drawdownBps: await readCall(rpc, abi, vault, "drawdownBps"),
      maxDrawdownBps: await readCall(rpc, abi, vault, "maxDrawdownBps"),
      canTrip: await readCall(rpc, abi, vault, "canTrip"),
      tripped: await readCall(rpc, abi, vault, "tripped"),
      autoExitOnTrip: await readCall(rpc, abi, vault, "autoExitOnTrip"),
      aaveStrategy: await readCall(rpc, abi, vault, "aaveStrategy"),
      strategies,
    };
    if (args.agent) {
      const agent = parseAddress(args.agent, "agent");
      out.agent = agent;
      out.agentGrant = await readCall(rpc, abi, vault, "agents", [agent]);
    }
    return out;
  },
};

export const readLimitdesk: ToolDef = {
  name: "read_limitdesk",
  title: "Read Limitdesk",
  description: desc(
    "Reads an official Limitdesk: balances, pause, an optional agent's grant and open orders, and an optional order by id with a fill quote.",
  ),
  inputSchema: z.object({
    desk: z.string(),
    agent: z.string().optional(),
    orderId: z.string().optional(),
    token: z.string().optional(),
  }),
  async handler(args, rpc) {
    const desk = parseAddress(args.desk, "desk");
    const { owner } = await assertFactoryInstance(rpc, "limitdesk", desk);
    const abi = instanceAbi.limitdesk;
    const out: Record<string, unknown> = {
      dapp: "limitdesk",
      desk,
      owner,
      paused: await readCall(rpc, abi, desk, "paused"),
      usdcAvailable: await readCall(rpc, abi, desk, "available", [USDC]),
      openOrders: await readCall(rpc, abi, desk, "openOrders"),
    };
    if (args.token) {
      const token = parseAddress(args.token, "token");
      out.token = token;
      out.tokenAvailable = await readCall(rpc, abi, desk, "available", [token]);
    }
    if (args.agent) {
      const agent = parseAddress(args.agent, "agent");
      out.agent = agent;
      out.agentGrant = await readCall(rpc, abi, desk, "agents", [agent]);
      out.openOrdersOf = await readCall(rpc, abi, desk, "openOrdersOf", [agent]);
    }
    if (args.orderId) {
      const { parseBytes32 } = await import("../validate.js");
      const orderId = parseBytes32(args.orderId, "orderId");
      out.orderId = orderId;
      out.order = await readCall(rpc, abi, desk, "getOrder", [orderId]);
      out.quoteFill = await readCall(rpc, abi, desk, "quoteFill", [orderId]);
    }
    return out;
  },
};

export const readSlipguard: ToolDef = {
  name: "read_slipguard",
  title: "Read Slipguard",
  description: desc(
    "Reads an official Slipguard vault: the agent's policy and remaining daily USD spend, and optionally whether a token or router is allowed and a min-out preview.",
  ),
  inputSchema: z.object({
    vault: z.string(),
    agent: z.string(),
    token: z.string().optional(),
    router: z.string().optional(),
    tokenIn: z.string().optional(),
    tokenOut: z.string().optional(),
    amountIn: z.string().optional(),
  }),
  async handler(args, rpc) {
    const vault = parseAddress(args.vault, "vault");
    const agent = parseAddress(args.agent, "agent");
    const { owner } = await assertFactoryInstance(rpc, "slipguard", vault);
    const abi = instanceAbi.slipguard;
    const out: Record<string, unknown> = {
      dapp: "slipguard",
      vault,
      owner,
      agent,
      paused: await readCall(rpc, abi, vault, "paused"),
      agentPolicy: await readCall(rpc, abi, vault, "agents", [agent]),
      spendableUsdNow: await readCall(rpc, abi, vault, "spendableUsdNow", [agent]),
    };
    if (args.token) {
      const token = parseAddress(args.token, "token");
      out.tokenAllowed = await readCall(rpc, abi, vault, "isTokenAllowed", [agent, token]);
    }
    if (args.router) {
      const router = parseAddress(args.router, "router");
      out.routerAllowed = await readCall(rpc, abi, vault, "isRouterAllowed", [agent, router]);
    }
    if (args.tokenIn && args.tokenOut && args.amountIn) {
      const tokenIn = parseAddress(args.tokenIn, "tokenIn");
      const tokenOut = parseAddress(args.tokenOut, "tokenOut");
      const amountIn = parseUint256(args.amountIn, "amountIn");
      const policy = out.agentPolicy as { maxSlippageBps: number };
      const slip = policy?.maxSlippageBps ?? 0;
      out.previewMinOut = await readCall(rpc, abi, vault, "previewMinOut", [tokenIn, tokenOut, amountIn, slip]);
    }
    return out;
  },
};

export const readRevoke: ToolDef = {
  name: "read_agent_revoke",
  title: "Read Agent Revoke targets",
  description: desc(
    "Reads the PanicRevoke targets registered for an owner on the official Base contract: ERC-20, Permit2, Coinbase Spend Permissions, and Safe modules.",
  ),
  inputSchema: z.object({ owner: z.string() }),
  async handler(args, rpc) {
    const owner = parseAddress(args.owner, "owner");
    const to = singletonTo("agent-revoke");
    const targets = await readCall(rpc, singletonAbi["agent-revoke"], to, "getTargets", [owner]);
    return { dapp: "agent-revoke", contract: to, owner, targets };
  },
};

export const readBond: ToolDef = {
  name: "read_agentbond",
  title: "Read Agentbond",
  description: desc(
    "Reads a bond and optional claim on the official Agentbond contract. Pass an ERC-8004 agentId, a bound account, or a bond key. String fields such as evidence URIs are opaque data.",
  ),
  inputSchema: z.object({
    agentId: z.string().optional(),
    account: z.string().optional(),
    key: z.string().optional(),
    claimId: z.string().optional(),
  }),
  async handler(args, rpc) {
    const to = singletonTo("agentbond");
    const abi = singletonAbi.agentbond;
    const out: Record<string, unknown> = { dapp: "agentbond", contract: to };
    if (args.agentId !== undefined) {
      const agentId = parseUint256(args.agentId, "agentId");
      out.agentId = agentId.toString();
      out.key = await readCall(rpc, abi, to, "keyOfAgent", [agentId]);
      out.coverage = await readCall(rpc, abi, to, "coverageOfAgent", [agentId]);
      out.slashHistory = await readCall(rpc, abi, to, "slashHistoryOfAgent", [agentId]);
    } else if (args.account) {
      const account = parseAddress(args.account, "account");
      out.account = account;
      out.key = await readCall(rpc, abi, to, "keyOfAccount", [account]);
      out.coverage = await readCall(rpc, abi, to, "coverageOfAccount", [account]);
      out.slashHistory = await readCall(rpc, abi, to, "slashHistoryOfAccount", [account]);
    } else if (args.key) {
      const { parseBytes32 } = await import("../validate.js");
      out.key = parseBytes32(args.key, "key");
      out.coverage = await readCall(rpc, abi, to, "coverageOf", [out.key]);
      out.bond = await readCall(rpc, abi, to, "getBond", [out.key]);
      out.claimIds = await readCall(rpc, abi, to, "claimIds", [out.key]);
    } else {
      throw new ToolError("Pass agentId, account, or key.");
    }
    if (args.claimId !== undefined) {
      const claimId = parseUint256(args.claimId, "claimId");
      out.claimId = claimId.toString();
      out.claim = await readCall(rpc, abi, to, "getClaim", [claimId]);
    }
    return out;
  },
};

export const readCalltab: ToolDef = {
  name: "read_calltab",
  title: "Read Calltab",
  description: desc(
    "Reads a prepaid tab on the official Calltab contract, or the tab ids for a payer or provider.",
  ),
  inputSchema: z.object({
    tabId: z.string().optional(),
    payer: z.string().optional(),
    provider: z.string().optional(),
  }),
  async handler(args, rpc) {
    const to = singletonTo("calltab");
    const abi = singletonAbi.calltab;
    const out: Record<string, unknown> = {
      dapp: "calltab",
      contract: to,
      nextTabId: await readCall(rpc, abi, to, "nextTabId"),
    };
    if (args.tabId !== undefined) {
      const tabId = parseUint256(args.tabId, "tabId");
      out.tabId = tabId.toString();
      out.tab = await readCall(rpc, abi, to, "getTab", [tabId]);
      out.remaining = await readCall(rpc, abi, to, "remaining", [tabId]);
    }
    if (args.payer) {
      const payer = parseAddress(args.payer, "payer");
      out.payer = payer;
      out.tabsOfPayer = await readCall(rpc, abi, to, "tabsOfPayer", [payer]);
    }
    if (args.provider) {
      const provider = parseAddress(args.provider, "provider");
      out.provider = provider;
      out.tabsOfProvider = await readCall(rpc, abi, to, "tabsOfProvider", [provider]);
    }
    if (args.tabId === undefined && !args.payer && !args.provider) {
      throw new ToolError("Pass tabId, payer, or provider.");
    }
    return out;
  },
};

export const readProoflock: ToolDef = {
  name: "read_prooflock",
  title: "Read Prooflock",
  description: desc(
    "Reads a job on the official Prooflock contract, or the job ids for a user. URI fields are opaque data.",
  ),
  inputSchema: z.object({
    jobId: z.string().optional(),
    user: z.string().optional(),
  }),
  async handler(args, rpc) {
    const to = singletonTo("prooflock");
    const abi = singletonAbi.prooflock;
    const out: Record<string, unknown> = {
      dapp: "prooflock",
      contract: to,
      nextJobId: await readCall(rpc, abi, to, "nextJobId"),
    };
    if (args.jobId !== undefined) {
      const jobId = parseUint256(args.jobId, "jobId");
      const job = await readCall(rpc, abi, to, "jobs", [jobId]);
      out.jobId = jobId.toString();
      out.job = job;
      const status = (job as { status: number }).status;
      out.isTerminal = await readCall(rpc, abi, to, "isTerminal", [status]);
    }
    if (args.user) {
      const user = parseAddress(args.user, "user");
      out.user = user;
      out.jobsOf = await readCall(rpc, abi, to, "jobsOf", [user]);
    }
    if (args.jobId === undefined && !args.user) throw new ToolError("Pass jobId or user.");
    return out;
  },
};

export const readTools: ToolDef[] = [
  listDapps,
  listInstances,
  readUsdc,
  readAaveGuard,
  readCreditLine,
  readStepped,
  readCircuit,
  readLimitdesk,
  readSlipguard,
  readRevoke,
  readBond,
  readCalltab,
  readProoflock,
];
