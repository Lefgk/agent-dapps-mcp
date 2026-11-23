import { getAddress, type Address } from "viem";

export const CHAIN_ID = 8453;
export const DEFAULT_RPC_URL = "https://mainnet.base.org";
export const USDC = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913") as Address;
export const WETH = getAddress("0x4200000000000000000000000000000000000006") as Address;
export const AAVE_POOL = getAddress("0xA238Dd80C259a72e81d7e4664a9801593F98d1c5") as Address;

export const VERSION = "1.0.0";
export const SERVER_NAME = "agent-dapps-mcp";
export const CONTACT = "lg.playstudio@gmail.com";

export type FactoryDapp =
  | "aave-guard-vault"
  | "agent-credit-line"
  | "circuit-vault"
  | "limitdesk"
  | "slipguard"
  | "stepped-agent-line";

export type SingletonDapp = "agent-revoke" | "agentbond" | "calltab" | "prooflock";

export type DappId = FactoryDapp | SingletonDapp;

export const FACTORY_DAPPS: readonly FactoryDapp[] = [
  "aave-guard-vault",
  "agent-credit-line",
  "circuit-vault",
  "limitdesk",
  "slipguard",
  "stepped-agent-line",
] as const;

export const SINGLETON_DAPPS: readonly SingletonDapp[] = [
  "agent-revoke",
  "agentbond",
  "calltab",
  "prooflock",
] as const;

export const ALL_DAPPS: readonly DappId[] = [...FACTORY_DAPPS, ...SINGLETON_DAPPS];

export type DappInfo = {
  id: DappId;
  title: string;
  site: string;
  repo: string;
  /** Factory or singleton contract on Base. */
  address: Address;
  kind: "factory" | "singleton";
  listFn: "vaultsOf" | "desksOf" | null;
  sourcify: string;
  agentActions: string;
  summary: string;
};

function info(
  id: DappId,
  title: string,
  address: string,
  kind: "factory" | "singleton",
  listFn: DappInfo["listFn"],
  agentActions: string,
  summary: string,
): DappInfo {
  const addr = getAddress(address) as Address;
  return {
    id,
    title,
    site: `https://lefgk.github.io/${id}/`,
    repo: `https://github.com/Lefgk/${id}`,
    address: addr,
    kind,
    listFn,
    sourcify: `https://repo.sourcify.dev/8453/${addr}/`,
    agentActions,
    summary,
  };
}

export const DAPPS: Record<DappId, DappInfo> = {
  "aave-guard-vault": info(
    "aave-guard-vault",
    "Aave Guard Vault",
    "0xf1e8810c932c0cafe90932eef83e718784b0d8ec",
    "factory",
    "vaultsOf",
    "borrow, repay, repayFor, renounceAgent",
    "Owner-funded Aave V3 vault. An authorized agent may borrow USDC to allowlisted destinations within caps, if health factor stays above the floor.",
  ),
  "agent-credit-line": info(
    "agent-credit-line",
    "Agent Credit Line",
    "0x83b84f63517a382b4cafb9d7989b222b7d6bfe71",
    "factory",
    "vaultsOf",
    "borrow, repay, markDefault, renounceAgent",
    "Owner-funded USDC credit lines for agents, with a max borrow, expiry, due date, and optional destination allowlist.",
  ),
  "agent-revoke": info(
    "agent-revoke",
    "Agent Revoke",
    "0x2de740fe7f3d5eeed57223c91b24bde83e4e8df0",
    "singleton",
    null,
    "panic, panicWith, panicAsModule",
    "Clears pre-registered ERC-20 approvals, Permit2 allowances, Coinbase Spend Permissions and Safe modules in one panic call.",
  ),
  agentbond: info(
    "agentbond",
    "Agentbond",
    "0x7ef3b4c827190d6c8a66bc60a99ae7da4a49c417",
    "singleton",
    null,
    "deposit, file or resolve a claim, withdraw",
    "Public USDC surety bond keyed to an ERC-8004 agent id or a plain address, with an arbiter who can slash.",
  ),
  calltab: info(
    "calltab",
    "Calltab",
    "0x289e7dcfa365f9cd74cf8f33b692279d2c8a0f6e",
    "singleton",
    null,
    "openTab, topUp, redeem, close, setAgent, pause",
    "Prepaid USDC tabs. The payer signs EIP-712 cumulative vouchers; the provider redeems only the unpaid delta.",
  ),
  "circuit-vault": info(
    "circuit-vault",
    "Circuit Vault",
    "0xd95fe751c8536f22334c1c8ddb56bbf7cbb150c0",
    "factory",
    "vaultsOf",
    "rebalance, trip, checkpoint",
    "Personal USDC vault. An authorized agent may rebalance to a whitelisted Aave USDC strategy within caps; anyone may trip the drawdown breaker.",
  ),
  limitdesk: info(
    "limitdesk",
    "Limitdesk",
    "0xd1e6959ee4c1b077934a0d6bfcdbf3ffb527b8ab",
    "factory",
    "desksOf",
    "post, fill, cancel, invalidateNonce, renounceAgent",
    "Self-custodial limit and stop orders. An authorized agent signs EIP-712 orders; anyone can fill if the oracle condition still holds.",
  ),
  prooflock: info(
    "prooflock",
    "Prooflock",
    "0x139f45a0998a3378990f46a83f4f4de4af52975b",
    "singleton",
    null,
    "createJob, postBond, deliver, accept, autoRelease, refund, dispute, resolve",
    "Permissionless USDC escrow for one agent job, with a review window, deadline refund, and arbiter split.",
  ),
  slipguard: info(
    "slipguard",
    "Slipguard",
    "0x51e0ae4e704be5377fcec1d555d30baad065f161",
    "factory",
    "vaultsOf",
    "executeSwap, wrapETH, renounceAgent",
    "Capped, time-limited swaps from a personal vault, with token and router allowlists and max slippage vs Chainlink.",
  ),
  "stepped-agent-line": info(
    "stepped-agent-line",
    "Stepped Agent Line",
    "0x859e44268fa1e787105d6295e7350edb3299801b",
    "factory",
    "vaultsOf",
    "borrow, repay, markDefault, renounceAgent",
    "Backer-funded stepped USDC credit lines. The cap steps up after each on-time full repayment; a missed due date can be marked as a public default.",
  ),
};

export const SINGLETON_ADDRESSES: Record<SingletonDapp, Address> = {
  "agent-revoke": DAPPS["agent-revoke"].address,
  agentbond: DAPPS.agentbond.address,
  calltab: DAPPS.calltab.address,
  prooflock: DAPPS.prooflock.address,
};

export function isFactoryDapp(id: string): id is FactoryDapp {
  return (FACTORY_DAPPS as readonly string[]).includes(id);
}

export function isDappId(id: string): id is DappId {
  return (ALL_DAPPS as readonly string[]).includes(id);
}
