import { DAPPS, USDC, type DappId } from "../addresses.js";

/**
 * Per-action argument rules for build tools. Enforced by the tool schema (see tools/index.ts):
 * a missing required field, or a field the chosen action does not use, is rejected with a clear message.
 * Fields not mentioned in any action of a tool (from, vault, desk, chainId, action) are always allowed.
 */
export type ActionRule = { required: readonly string[]; optional?: readonly string[] };

const none: ActionRule = { required: [] };

const creditRules: Record<string, ActionRule> = {
  borrow: { required: ["to", "amount"], optional: ["memo"] },
  repay: { required: ["amount"], optional: ["agent"] },
  markDefault: { required: ["agent"] },
  renounceAgent: none,
};

export const ACTION_RULES: Record<string, Record<string, ActionRule>> = {
  build_aave_guard: {
    borrow: { required: ["to", "amount"], optional: ["memo"] },
    repay: { required: ["amount"] },
    repayFor: { required: ["agent", "amount"] },
    renounceAgent: none,
  },
  build_credit_line: creditRules,
  build_stepped_line: creditRules,
  build_circuit_vault: {
    rebalance: { required: ["strategy", "targetAssets"] },
    trip: none,
    checkpoint: none,
  },
  build_slipguard: {
    executeSwap: { required: ["tokenIn", "tokenOut", "amountIn", "router"], optional: ["data"] },
    wrapETH: none,
    renounceAgent: none,
  },
  build_limitdesk: {
    post: {
      required: ["agent", "tokenSell", "tokenBuy", "amountSell", "limitPriceX18", "expiry", "nonce", "signature"],
      optional: ["stopTriggerX18", "orderType", "epoch"],
    },
    fill: { required: ["orderId"] },
    cancel: { required: ["orderId"] },
    invalidateNonce: { required: ["agent", "nonce"] },
    renounceAgent: none,
  },
  build_agent_revoke: {
    panic: none,
    panicWith: { required: [], optional: ["erc20", "permit2Pairs", "spendPerms"] },
    panicAsModule: { required: ["safe"] },
  },
  build_agentbond: {
    depositForAgent: { required: ["agentId", "arbiter", "amount"] },
    depositForAccount: { required: ["account", "arbiter", "amount"] },
    fileClaim: { required: ["key", "amount", "evidenceURI"] },
    cancelClaim: { required: ["claimId"] },
    expireClaim: { required: ["claimId"] },
    resolveClaim: { required: ["claimId", "slashAmount"], optional: ["reasonHash"] },
    requestWithdraw: { required: ["key", "amount"] },
    cancelWithdraw: { required: ["key"] },
    withdraw: { required: ["key"] },
    setArbiter: { required: ["key", "newArbiter"] },
    applyArbiter: { required: ["key"] },
  },
  build_calltab: {
    openTab: {
      required: ["provider", "amount", "expiry", "challengeWindow"],
      optional: ["periodCap", "periodDuration", "agent", "payerAgentId", "providerAgentId"],
    },
    topUp: { required: ["tabId", "amount"] },
    setAgent: { required: ["tabId", "agent"] },
    pause: { required: ["tabId"] },
    unpause: { required: ["tabId"] },
    redeem: { required: ["tabId", "cumulativeAmount", "deadline", "signature"] },
    initiateClose: { required: ["tabId"] },
    finalizeClose: { required: ["tabId"] },
  },
  build_prooflock: {
    createJob: {
      required: ["provider", "arbiter", "amount", "deadline", "reviewWindow"],
      optional: ["bondRequired", "clientAgentId", "providerAgentId", "metadataURI"],
    },
    postBond: { required: ["jobId"] },
    deliver: { required: ["jobId", "deliverableHash"], optional: ["deliverableURI"] },
    accept: { required: ["jobId"] },
    autoRelease: { required: ["jobId"] },
    refund: { required: ["jobId"] },
    dispute: { required: ["jobId"] },
    resolve: { required: ["jobId", "providerPayout"], optional: ["slashBond"] },
    resolveStaleDispute: { required: ["jobId"] },
  },
};

/** Which read/build tools serve each dapp. */
export const DAPP_TOOLS: Record<DappId, { read: string; build: string }> = {
  "aave-guard-vault": { read: "read_aave_guard_vault", build: "build_aave_guard" },
  "agent-credit-line": { read: "read_agent_credit_line", build: "build_credit_line" },
  "agent-revoke": { read: "read_agent_revoke", build: "build_agent_revoke" },
  agentbond: { read: "read_agentbond", build: "build_agentbond" },
  calltab: { read: "read_calltab", build: "build_calltab" },
  "circuit-vault": { read: "read_circuit_vault", build: "build_circuit_vault" },
  limitdesk: { read: "read_limitdesk", build: "build_limitdesk" },
  prooflock: { read: "read_prooflock", build: "build_prooflock" },
  slipguard: { read: "read_slipguard", build: "build_slipguard" },
  "stepped-agent-line": { read: "read_stepped_agent_line", build: "build_stepped_line" },
};

/** Placeholder addresses used in examples. Replace them with real ones. */
export const PLACEHOLDER = {
  eoa: "0x1111111111111111111111111111111111111111",
  other: "0x2222222222222222222222222222222222222222",
  vault: "0x3333333333333333333333333333333333333333",
} as const;

export const EXAMPLE_NOTE =
  "Addresses made of one repeated hex digit (for example 0x1111111111111111111111111111111111111111) are placeholders. Get real vault and desk addresses from list_instances. Amounts are USDC base units: \"1000000\" = 1 USDC.";

const E = PLACEHOLDER;
const ZERO32 = `0x${"00".repeat(32)}`;

/** One or more example calls per tool. Every example must pass the tool's schema (tested). */
export const EXAMPLES: Record<string, { args: Record<string, unknown>; note?: string }[]> = {
  describe_tools: [{ args: {} }, { args: { tool: "build_credit_line" } }],
  find_dapp: [
    { args: { query: "calltab" } },
    { args: { query: DAPPS.prooflock.address } },
    { args: { query: E.vault }, note: "An unknown address is checked against the six official factories." },
  ],
  decode_tx: [
    {
      args: {
        to: USDC,
        data: "0x095ea7b3000000000000000000000000289e7dcfa365f9cd74cf8f33b692279d2c8a0f6e00000000000000000000000000000000000000000000000000000000000f4240",
        value: "0",
        chainId: 8453,
      },
      note: "Paste the to/data/value/chainId returned by any build_* tool.",
    },
  ],
  estimate_gas: [
    {
      args: {
        from: E.eoa,
        to: USDC,
        data: "0x095ea7b3000000000000000000000000289e7dcfa365f9cd74cf8f33b692279d2c8a0f6e00000000000000000000000000000000000000000000000000000000000f4240",
        value: "0",
        chainId: 8453,
      },
    },
  ],
  preflight_build: [
    {
      args: {
        tool: "build_calltab",
        args: { from: E.eoa, action: "topUp", tabId: "1", amount: "1000000" },
      },
      note: "Never errors on a would-revert: returns ready=false with the reason and suggested next steps.",
    },
  ],
  list_dapps: [{ args: {} }],
  list_instances: [{ args: { dapp: "agent-credit-line", owner: E.eoa } }],
  read_usdc: [{ args: { account: E.eoa, spender: DAPPS.calltab.address } }],
  read_aave_guard_vault: [{ args: { vault: E.vault, agent: E.eoa } }],
  read_agent_credit_line: [{ args: { vault: E.vault, agent: E.eoa, recipient: E.other } }],
  read_stepped_agent_line: [{ args: { vault: E.vault, agent: E.eoa } }],
  read_circuit_vault: [{ args: { vault: E.vault, agent: E.eoa } }],
  read_limitdesk: [{ args: { desk: E.vault, agent: E.eoa, token: USDC } }],
  read_slipguard: [
    { args: { vault: E.vault, agent: E.eoa, tokenIn: USDC, tokenOut: "0x4200000000000000000000000000000000000006", amountIn: "1000000" } },
  ],
  read_agent_revoke: [{ args: { owner: E.eoa } }],
  read_agentbond: [{ args: { account: E.eoa } }, { args: { agentId: "42", claimId: "1" } }],
  read_calltab: [{ args: { tabId: "1" } }, { args: { payer: E.eoa } }],
  read_prooflock: [{ args: { jobId: "1" } }, { args: { user: E.eoa } }],
  build_usdc_approve: [
    { args: { from: E.eoa, spender: DAPPS.calltab.address, amount: "1000000" } },
    { args: { from: E.eoa, spender: E.vault, amount: "1000000", dapp: "agent-credit-line" }, note: "Vault spenders are verified against the official factory." },
  ],
  build_aave_guard: [{ args: { from: E.eoa, vault: E.vault, action: "borrow", to: E.other, amount: "1000000", memo: "invoice-17" } }],
  build_credit_line: [
    { args: { from: E.eoa, vault: E.vault, action: "borrow", to: E.eoa, amount: "1000000", memo: "invoice-17" } },
    { args: { from: E.eoa, vault: E.vault, action: "repay", amount: "1000000" }, note: "Needs a USDC allowance to the vault first (build_usdc_approve with dapp)." },
  ],
  build_stepped_line: [{ args: { from: E.eoa, vault: E.vault, action: "repay", amount: "1000000" } }],
  build_circuit_vault: [{ args: { from: E.eoa, vault: E.vault, action: "trip" } }],
  build_slipguard: [
    {
      args: {
        from: E.eoa,
        vault: E.vault,
        action: "executeSwap",
        tokenIn: USDC,
        tokenOut: "0x4200000000000000000000000000000000000006",
        amountIn: "1000000",
        router: E.other,
        data: "0x",
      },
      note: "data is the router calldata; it is passed through as opaque bytes.",
    },
  ],
  build_limitdesk: [
    { args: { from: E.eoa, desk: E.vault, action: "fill", orderId: ZERO32 } },
    { args: { from: E.eoa, desk: E.vault, action: "invalidateNonce", agent: E.eoa, nonce: "1" } },
  ],
  build_agent_revoke: [
    { args: { from: E.eoa, action: "panic" }, note: "Returned `to` is the EOA itself; it must have an EIP-7702 delegation to PanicRevoke." },
    { args: { from: E.eoa, action: "panicWith", erc20: [{ token: USDC, spender: E.other }] } },
  ],
  build_agentbond: [{ args: { from: E.eoa, action: "depositForAccount", account: E.eoa, arbiter: E.other, amount: "1000000" } }],
  build_calltab: [
    {
      args: { from: E.eoa, action: "openTab", provider: E.other, amount: "1000000", expiry: "1798761600", challengeWindow: "86400" },
      note: "Needs a USDC allowance to Calltab first.",
    },
    { args: { from: E.eoa, action: "topUp", tabId: "1", amount: "1000000" } },
  ],
  build_prooflock: [
    {
      args: {
        from: E.eoa,
        action: "createJob",
        provider: E.other,
        arbiter: "0x4444444444444444444444444444444444444444",
        amount: "1000000",
        deadline: "1798761600",
        reviewWindow: "86400",
        metadataURI: "ipfs://example",
      },
    },
    { args: { from: E.other, action: "deliver", jobId: "1", deliverableHash: `0x${"ab".repeat(32)}` } },
  ],
};

export const WORKFLOW = [
  "1. list_dapps (or find_dapp) to pick a dapp and see its contract address.",
  "2. For factory dapps, list_instances to get the owner's vault or desk address.",
  "3. read_* to check grants, caps, balances and allowances (read_usdc for USDC).",
  "4. If the action pulls USDC (repay, openTab, topUp, deposit*, createJob), build_usdc_approve first.",
  "5. build_* (or preflight_build) returns an unsigned tx after an eth_call simulation.",
  "6. decode_tx and estimate_gas to show the user exactly what will be signed and what it costs.",
  "7. The user or operator signs and sends the tx in their own wallet. This server never signs or broadcasts.",
];
