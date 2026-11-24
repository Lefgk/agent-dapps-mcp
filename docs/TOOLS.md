# Tool reference

Generated from the tool schemas by `npm run docs:tools`. Do not edit by hand. The same data is available at runtime from the `describe_tools` tool.

All tools are Base (chainId 8453) only. Every tool also accepts an optional `chainId`, which must be `8453` or `"8453"`. Unknown fields are rejected. Addresses made of one repeated hex digit (for example 0x1111111111111111111111111111111111111111) are placeholders. Get real vault and desk addresses from list_instances. Amounts are USDC base units: "1000000" = 1 USDC.

## Recommended flow

1. list_dapps (or find_dapp) to pick a dapp and see its contract address.
2. For factory dapps, list_instances to get the owner's vault or desk address.
3. read_* to check grants, caps, balances and allowances (read_usdc for USDC).
4. If the action pulls USDC (repay, openTab, topUp, deposit*, createJob), build_usdc_approve first.
5. build_* (or preflight_build) returns an unsigned tx after an eth_call simulation.
6. decode_tx and estimate_gas to show the user exactly what will be signed and what it costs.
7. The user or operator signs and sends the tx in their own wallet. This server never signs or broadcasts.

## Help tools

### `describe_tools`

Start here. Lists every tool with a one-line purpose, required inputs, per-action fields and example calls. Pass `tool` for the full input schema and examples of one tool.

| Field | Type | Required | Description |
|---|---|---|---|
| `tool` | string |  | Optional tool name for full detail |

Example:

```json
{
  "name": "describe_tools",
  "arguments": {}
}
```

Example:

```json
{
  "name": "describe_tools",
  "arguments": {
    "tool": "build_credit_line"
  }
}
```

### `find_dapp`

Looks up a dapp by id, title or keyword (e.g. "credit", "escrow", "borrow"), or identifies an address: a dapp contract, USDC, or a vault/desk created by an official factory (checked on-chain). Returns the matching read_* and build_* tools.

| Field | Type | Required | Description |
|---|---|---|---|
| `query` | string | yes | Dapp id/title/keyword, or a 0x address |

Example:

```json
{
  "name": "find_dapp",
  "arguments": {
    "query": "calltab"
  }
}
```

Example:

```json
{
  "name": "find_dapp",
  "arguments": {
    "query": "0x139F45a0998A3378990F46A83F4F4de4aF52975B"
  }
}
```

Example (An unknown address is checked against the six official factories):

```json
{
  "name": "find_dapp",
  "arguments": {
    "query": "0x3333333333333333333333333333333333333333"
  }
}
```

### `decode_tx`

Decodes an unsigned transaction {to, data, value, chainId} into the target contract, function and named arguments, and flags anything a signer should not trust (unknown contract, wrong chain, non-zero value, unofficial approve spender, calls this server does not build). Use it to show the user what they are about to sign.

| Field | Type | Required | Description |
|---|---|---|---|
| `to` | string | yes | Transaction target |
| `data` | string | yes | Calldata (0x...) |
| `value` | string |  | Optional value in wei (default 0) |
| `from` | string |  | Optional sender, for context |

Example (Paste the to/data/value/chainId returned by any build_* tool):

```json
{
  "name": "decode_tx",
  "arguments": {
    "to": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "data": "0x095ea7b3000000000000000000000000289e7dcfa365f9cd74cf8f33b692279d2c8a0f6e00000000000000000000000000000000000000000000000000000000000f4240",
    "value": "0",
    "chainId": 8453
  }
}
```

### `estimate_gas`

Estimates gas and fee for an unsigned transaction built by this server, with eth_estimateGas from `from`. Only official Agent Dapps targets and value = 0. Returns gas, a 20% buffered gas limit, the L2 fee and an L1 data fee upper bound. Never signs or sends.

| Field | Type | Required | Description |
|---|---|---|---|
| `from` | string | yes | Sender used for the estimate |
| `to` | string | yes | Transaction target |
| `data` | string | yes | Calldata (0x...) |
| `value` | string |  | Optional value in wei; must be 0 |

Example:

```json
{
  "name": "estimate_gas",
  "arguments": {
    "from": "0x1111111111111111111111111111111111111111",
    "to": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "data": "0x095ea7b3000000000000000000000000289e7dcfa365f9cd74cf8f33b692279d2c8a0f6e00000000000000000000000000000000000000000000000000000000000f4240",
    "value": "0",
    "chainId": 8453
  }
}
```

### `preflight_build`

Runs any build_* tool and, instead of failing, reports {ready, reason, nextSteps}. When ready it also returns the unsigned tx, its decoded form and a gas estimate. When a USDC allowance or balance is short it suggests the exact build_usdc_approve call. Never signs or sends.

| Field | Type | Required | Description |
|---|---|---|---|
| `tool` | string | yes | A build_* tool name |
| `args` | object | yes | Arguments for that tool |

Example (Never errors on a would-revert: returns ready=false with the reason and suggested next steps):

```json
{
  "name": "preflight_build",
  "arguments": {
    "tool": "build_calltab",
    "args": {
      "from": "0x1111111111111111111111111111111111111111",
      "action": "topUp",
      "tabId": "1",
      "amount": "1000000"
    }
  }
}
```

## Read tools

### `list_dapps`

Lists the 10 Agent Dapps on Base: factory or contract address, site, Sourcify page, and the agent-facing actions this server can build unsigned transactions for.

| Field | Type | Required | Description |
|---|---|---|---|

Example:

```json
{
  "name": "list_dapps",
  "arguments": {}
}
```

### `list_instances`

Lists vault or desk addresses created by the official Base factory for one of the six factory dapps, for a given owner.

| Field | Type | Required | Description |
|---|---|---|---|
| `dapp` | "aave-guard-vault" \| "agent-credit-line" \| "circuit-vault" \| "limitdesk" \| "slipguard" \| "stepped-agent-line" | yes | Factory dapp id (one of the six factory dapps from list_dapps) |
| `owner` | string | yes | Owner address whose vaults or desks to list |

Example:

```json
{
  "name": "list_instances",
  "arguments": {
    "dapp": "agent-credit-line",
    "owner": "0x1111111111111111111111111111111111111111"
  }
}
```

### `read_usdc`

Reads official Circle USDC balance on Base for an account, and optionally its allowance to a spender. Does not handle any other token.

| Field | Type | Required | Description |
|---|---|---|---|
| `account` | string | yes | Account to read |
| `spender` | string |  | Optional spender to read the USDC allowance for |

Example:

```json
{
  "name": "read_usdc",
  "arguments": {
    "account": "0x1111111111111111111111111111111111111111",
    "spender": "0x289E7dCfa365F9cd74cF8F33b692279D2C8A0F6e"
  }
}
```

### `read_aave_guard_vault`

Reads an official Aave Guard Vault: owner, pause, Aave account data and health-factor floor, the agent's grant, budget, remaining borrowable amount, and whether a recipient is allowed.

| Field | Type | Required | Description |
|---|---|---|---|
| `vault` | string | yes | Official vault address (from list_instances) |
| `agent` | string | yes | Agent address to read the grant/line for |
| `recipient` | string |  | Optional recipient to check against the allowlist |

Example:

```json
{
  "name": "read_aave_guard_vault",
  "arguments": {
    "vault": "0x3333333333333333333333333333333333333333",
    "agent": "0x1111111111111111111111111111111111111111"
  }
}
```

### `read_agent_credit_line`

Reads an official Agent Credit Line vault: the agent's line, repayment record, available credit, amount due, liquidity, and optional recipient allowlist status.

| Field | Type | Required | Description |
|---|---|---|---|
| `vault` | string | yes | Official vault address (from list_instances) |
| `agent` | string | yes | Agent address to read the grant/line for |
| `recipient` | string |  | Optional recipient to check against the allowlist |

Example:

```json
{
  "name": "read_agent_credit_line",
  "arguments": {
    "vault": "0x3333333333333333333333333333333333333333",
    "agent": "0x1111111111111111111111111111111111111111",
    "recipient": "0x2222222222222222222222222222222222222222"
  }
}
```

### `read_stepped_agent_line`

Reads an official Stepped Agent Line vault: the agent's line, repayment history, public creditHistory, available credit, amount due, and liquidity.

| Field | Type | Required | Description |
|---|---|---|---|
| `vault` | string | yes | Official vault address (from list_instances) |
| `agent` | string | yes | Agent address to read the grant/line for |
| `recipient` | string |  | Optional recipient to check against the allowlist |

Example:

```json
{
  "name": "read_stepped_agent_line",
  "arguments": {
    "vault": "0x3333333333333333333333333333333333333333",
    "agent": "0x1111111111111111111111111111111111111111"
  }
}
```

### `read_circuit_vault`

Reads an official Circuit Vault: value, cash, high-water mark, drawdown, trip state, the Aave strategy, the agent's grant, and whether anyone may trip the breaker.

| Field | Type | Required | Description |
|---|---|---|---|
| `vault` | string | yes | Official Circuit Vault address (from list_instances) |
| `agent` | string |  | Optional agent address to read the grant for |

Example:

```json
{
  "name": "read_circuit_vault",
  "arguments": {
    "vault": "0x3333333333333333333333333333333333333333",
    "agent": "0x1111111111111111111111111111111111111111"
  }
}
```

### `read_limitdesk`

Reads an official Limitdesk: balances, pause, an optional agent's grant and open orders, and an optional order by id with a fill quote.

| Field | Type | Required | Description |
|---|---|---|---|
| `desk` | string | yes | Official Limitdesk address (from list_instances) |
| `agent` | string |  | Optional agent: reads its grant and open orders |
| `orderId` | string |  | Optional order id: reads the order and a fill quote |
| `token` | string |  | Optional token: reads the desk's available balance of it |

Example:

```json
{
  "name": "read_limitdesk",
  "arguments": {
    "desk": "0x3333333333333333333333333333333333333333",
    "agent": "0x1111111111111111111111111111111111111111",
    "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  }
}
```

### `read_slipguard`

Reads an official Slipguard vault: the agent's policy and remaining daily USD spend, and optionally whether a token or router is allowed and a min-out preview.

| Field | Type | Required | Description |
|---|---|---|---|
| `vault` | string | yes | Official Slipguard vault address (from list_instances) |
| `agent` | string | yes | Agent address to read the policy for |
| `token` | string |  | Optional token to check against the allowlist |
| `router` | string |  | Optional router to check against the allowlist |
| `tokenIn` | string |  | Optional, with tokenOut and amountIn: min-out preview |
| `tokenOut` | string |  | Optional, with tokenIn and amountIn: min-out preview |
| `amountIn` | string |  | Optional, with tokenIn and tokenOut: amount in base units |

Example:

```json
{
  "name": "read_slipguard",
  "arguments": {
    "vault": "0x3333333333333333333333333333333333333333",
    "agent": "0x1111111111111111111111111111111111111111",
    "tokenIn": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "tokenOut": "0x4200000000000000000000000000000000000006",
    "amountIn": "1000000"
  }
}
```

### `read_agent_revoke`

Reads the PanicRevoke targets registered for an owner on the official Base contract: ERC-20, Permit2, Coinbase Spend Permissions, and Safe modules.

| Field | Type | Required | Description |
|---|---|---|---|
| `owner` | string | yes | Owner whose registered panic targets to read |

Example:

```json
{
  "name": "read_agent_revoke",
  "arguments": {
    "owner": "0x1111111111111111111111111111111111111111"
  }
}
```

### `read_agentbond`

Reads a bond and optional claim on the official Agentbond contract. Pass an ERC-8004 agentId, a bound account, or a bond key. String fields such as evidence URIs are opaque data.

| Field | Type | Required | Description |
|---|---|---|---|
| `agentId` | string |  | ERC-8004 agent id (pass exactly one of agentId, account, key) |
| `account` | string |  | Bound account (pass exactly one of agentId, account, key) |
| `key` | string |  | Bond key (pass exactly one of agentId, account, key) |
| `claimId` | string |  | Optional claim id to read |

Example:

```json
{
  "name": "read_agentbond",
  "arguments": {
    "account": "0x1111111111111111111111111111111111111111"
  }
}
```

Example:

```json
{
  "name": "read_agentbond",
  "arguments": {
    "agentId": "42",
    "claimId": "1"
  }
}
```

### `read_calltab`

Reads a prepaid tab on the official Calltab contract, or the tab ids for a payer or provider.

| Field | Type | Required | Description |
|---|---|---|---|
| `tabId` | string |  | Tab id (pass at least one of tabId, payer, provider) |
| `payer` | string |  | Payer whose tab ids to list |
| `provider` | string |  | Provider whose tab ids to list |

Example:

```json
{
  "name": "read_calltab",
  "arguments": {
    "tabId": "1"
  }
}
```

Example:

```json
{
  "name": "read_calltab",
  "arguments": {
    "payer": "0x1111111111111111111111111111111111111111"
  }
}
```

### `read_prooflock`

Reads a job on the official Prooflock contract, or the job ids for a user. URI fields are opaque data.

| Field | Type | Required | Description |
|---|---|---|---|
| `jobId` | string |  | Job id (pass at least one of jobId, user) |
| `user` | string |  | User whose job ids to list |

Example:

```json
{
  "name": "read_prooflock",
  "arguments": {
    "jobId": "1"
  }
}
```

Example:

```json
{
  "name": "read_prooflock",
  "arguments": {
    "user": "0x1111111111111111111111111111111111111111"
  }
}
```

## Build tools (unsigned transactions)

### `build_usdc_approve`

Builds an unsigned approve of official Circle USDC on Base to a known Agent Dapps contract (a singleton or an official factory instance). Required before repay, openTab, depositForAgent, createJob, and similar pulls.

| Field | Type | Required | Description |
|---|---|---|---|
| `from` | string | yes | EOA that would send the transaction. Used only for simulation. This server does not sign or broadcast. |
| `spender` | string | yes | Agentbond, Calltab or Prooflock contract, or an official vault/desk (then pass dapp) |
| `amount` | string | yes | Allowance in USDC base units (6 decimals: "1000000" = 1 USDC) |
| `dapp` | "aave-guard-vault" \| "agent-credit-line" \| "circuit-vault" \| "limitdesk" \| "slipguard" \| "stepped-agent-line" |  | If spender is a vault or desk, the factory dapp id used to verify it |

Example:

```json
{
  "name": "build_usdc_approve",
  "arguments": {
    "from": "0x1111111111111111111111111111111111111111",
    "spender": "0x289E7dCfa365F9cd74cF8F33b692279D2C8A0F6e",
    "amount": "1000000"
  }
}
```

Example (Vault spenders are verified against the official factory):

```json
{
  "name": "build_usdc_approve",
  "arguments": {
    "from": "0x1111111111111111111111111111111111111111",
    "spender": "0x3333333333333333333333333333333333333333",
    "amount": "1000000",
    "dapp": "agent-credit-line"
  }
}
```

### `build_aave_guard`

Builds an unsigned agent transaction for an official Aave Guard Vault: borrow, repay, repayFor, or renounceAgent.

| Field | Type | Required | Description |
|---|---|---|---|
| `from` | string | yes | EOA that would send the transaction. Used only for simulation. This server does not sign or broadcast. |
| `vault` | string | yes | Official Aave Guard Vault address (from list_instances) |
| `action` | "borrow" \| "repay" \| "repayFor" \| "renounceAgent" | yes | Which call to build |
| `to` | string |  | borrow: allowlisted recipient of the borrowed USDC |
| `amount` | string |  | borrow/repay/repayFor: amount in USDC base units (6 decimals: "1000000" = 1 USDC) |
| `agent` | string |  | repayFor: agent whose debt to repay |
| `memo` | string |  | borrow: optional memo, 0x bytes32 or utf-8 text of at most 32 bytes |

| Action | Required fields | Optional fields |
|---|---|---|
| `borrow` | `to`, `amount` | `memo` |
| `repay` | `amount` |  |
| `repayFor` | `agent`, `amount` |  |
| `renounceAgent` | none |  |

Example:

```json
{
  "name": "build_aave_guard",
  "arguments": {
    "from": "0x1111111111111111111111111111111111111111",
    "vault": "0x3333333333333333333333333333333333333333",
    "action": "borrow",
    "to": "0x2222222222222222222222222222222222222222",
    "amount": "1000000",
    "memo": "invoice-17"
  }
}
```

### `build_credit_line`

Builds an unsigned agent transaction for an official Agent Credit Line vault: borrow, repay, markDefault, or renounceAgent.

| Field | Type | Required | Description |
|---|---|---|---|
| `from` | string | yes | EOA that would send the transaction. Used only for simulation. This server does not sign or broadcast. |
| `vault` | string | yes | Official vault address (from list_instances) |
| `action` | "borrow" \| "repay" \| "markDefault" \| "renounceAgent" | yes | Which call to build |
| `to` | string |  | borrow: recipient of the borrowed USDC |
| `amount` | string |  | borrow/repay: amount in USDC base units (6 decimals: "1000000" = 1 USDC) |
| `agent` | string |  | repay: agent whose line to repay (defaults to from); markDefault: agent to mark |
| `memo` | string |  | borrow: optional memo, 0x bytes32 or utf-8 text of at most 32 bytes |

| Action | Required fields | Optional fields |
|---|---|---|
| `borrow` | `to`, `amount` | `memo` |
| `repay` | `amount` | `agent` |
| `markDefault` | `agent` |  |
| `renounceAgent` | none |  |

Example:

```json
{
  "name": "build_credit_line",
  "arguments": {
    "from": "0x1111111111111111111111111111111111111111",
    "vault": "0x3333333333333333333333333333333333333333",
    "action": "borrow",
    "to": "0x1111111111111111111111111111111111111111",
    "amount": "1000000",
    "memo": "invoice-17"
  }
}
```

Example (Needs a USDC allowance to the vault first (build_usdc_approve with dapp)):

```json
{
  "name": "build_credit_line",
  "arguments": {
    "from": "0x1111111111111111111111111111111111111111",
    "vault": "0x3333333333333333333333333333333333333333",
    "action": "repay",
    "amount": "1000000"
  }
}
```

### `build_stepped_line`

Builds an unsigned agent transaction for an official Stepped Agent Line vault: borrow, repay, markDefault, or renounceAgent.

| Field | Type | Required | Description |
|---|---|---|---|
| `from` | string | yes | EOA that would send the transaction. Used only for simulation. This server does not sign or broadcast. |
| `vault` | string | yes | Official vault address (from list_instances) |
| `action` | "borrow" \| "repay" \| "markDefault" \| "renounceAgent" | yes | Which call to build |
| `to` | string |  | borrow: recipient of the borrowed USDC |
| `amount` | string |  | borrow/repay: amount in USDC base units (6 decimals: "1000000" = 1 USDC) |
| `agent` | string |  | repay: agent whose line to repay (defaults to from); markDefault: agent to mark |
| `memo` | string |  | borrow: optional memo, 0x bytes32 or utf-8 text of at most 32 bytes |

| Action | Required fields | Optional fields |
|---|---|---|
| `borrow` | `to`, `amount` | `memo` |
| `repay` | `amount` | `agent` |
| `markDefault` | `agent` |  |
| `renounceAgent` | none |  |

Example:

```json
{
  "name": "build_stepped_line",
  "arguments": {
    "from": "0x1111111111111111111111111111111111111111",
    "vault": "0x3333333333333333333333333333333333333333",
    "action": "repay",
    "amount": "1000000"
  }
}
```

### `build_circuit_vault`

Builds an unsigned transaction for an official Circuit Vault: rebalance (agent), trip (anyone, if the drawdown breaker can fire), or checkpoint.

| Field | Type | Required | Description |
|---|---|---|---|
| `from` | string | yes | EOA that would send the transaction. Used only for simulation. This server does not sign or broadcast. |
| `vault` | string | yes | Official Circuit Vault address (from list_instances) |
| `action` | "rebalance" \| "trip" \| "checkpoint" | yes | Which call to build |
| `strategy` | string |  | rebalance: whitelisted strategy address (see read_circuit_vault strategies) |
| `targetAssets` | string |  | rebalance: target assets for the strategy in USDC base units (6 decimals: "1000000" = 1 USDC) |

| Action | Required fields | Optional fields |
|---|---|---|
| `rebalance` | `strategy`, `targetAssets` |  |
| `trip` | none |  |
| `checkpoint` | none |  |

Example:

```json
{
  "name": "build_circuit_vault",
  "arguments": {
    "from": "0x1111111111111111111111111111111111111111",
    "vault": "0x3333333333333333333333333333333333333333",
    "action": "trip"
  }
}
```

### `build_slipguard`

Builds an unsigned agent transaction for an official Slipguard vault: executeSwap, wrapETH, or renounceAgent. Router calldata is opaque bytes and is not interpreted.

| Field | Type | Required | Description |
|---|---|---|---|
| `from` | string | yes | EOA that would send the transaction. Used only for simulation. This server does not sign or broadcast. |
| `vault` | string | yes | Official Slipguard vault address (from list_instances) |
| `action` | "executeSwap" \| "wrapETH" \| "renounceAgent" | yes | Which call to build |
| `tokenIn` | string |  | executeSwap: token to sell (must be allowlisted) |
| `tokenOut` | string |  | executeSwap: token to buy (must be allowlisted) |
| `amountIn` | string |  | executeSwap: amount of tokenIn in its base units |
| `router` | string |  | executeSwap: allowlisted router |
| `data` | string |  | executeSwap: router calldata, opaque bytes (max 16384 bytes) |

| Action | Required fields | Optional fields |
|---|---|---|
| `executeSwap` | `tokenIn`, `tokenOut`, `amountIn`, `router` | `data` |
| `wrapETH` | none |  |
| `renounceAgent` | none |  |

Example (data is the router calldata; it is passed through as opaque bytes):

```json
{
  "name": "build_slipguard",
  "arguments": {
    "from": "0x1111111111111111111111111111111111111111",
    "vault": "0x3333333333333333333333333333333333333333",
    "action": "executeSwap",
    "tokenIn": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "tokenOut": "0x4200000000000000000000000000000000000006",
    "amountIn": "1000000",
    "router": "0x2222222222222222222222222222222222222222",
    "data": "0x"
  }
}
```

### `build_limitdesk`

Builds an unsigned transaction for an official Limitdesk: post (EIP-712 signed order), fill, cancel, invalidateNonce, or renounceAgent. Signatures are opaque bytes.

| Field | Type | Required | Description |
|---|---|---|---|
| `from` | string | yes | EOA that would send the transaction. Used only for simulation. This server does not sign or broadcast. |
| `desk` | string | yes | Official Limitdesk address (from list_instances) |
| `action` | "post" \| "fill" \| "cancel" \| "invalidateNonce" \| "renounceAgent" | yes | Which call to build |
| `orderId` | string |  | fill/cancel: order id |
| `agent` | string |  | post/invalidateNonce: agent that signed the order |
| `nonce` | string |  | post/invalidateNonce: order nonce |
| `signature` | string |  | post: 65-byte EIP-712 signature by the agent, opaque bytes |
| `tokenSell` | string |  | post: token to sell |
| `tokenBuy` | string |  | post: token to buy |
| `amountSell` | string |  | post: amount of tokenSell in its base units |
| `limitPriceX18` | string |  | post: limit price scaled by 1e18 |
| `stopTriggerX18` | string |  | post: optional stop trigger scaled by 1e18 (default 0) |
| `expiry` | string |  | post: order expiry, unix seconds (uint64) |
| `orderType` | string |  | post: optional order type (uint8, default 0) |
| `epoch` | string |  | post: optional agent epoch (uint32, default 0) |

| Action | Required fields | Optional fields |
|---|---|---|
| `post` | `agent`, `tokenSell`, `tokenBuy`, `amountSell`, `limitPriceX18`, `expiry`, `nonce`, `signature` | `stopTriggerX18`, `orderType`, `epoch` |
| `fill` | `orderId` |  |
| `cancel` | `orderId` |  |
| `invalidateNonce` | `agent`, `nonce` |  |
| `renounceAgent` | none |  |

Example:

```json
{
  "name": "build_limitdesk",
  "arguments": {
    "from": "0x1111111111111111111111111111111111111111",
    "desk": "0x3333333333333333333333333333333333333333",
    "action": "fill",
    "orderId": "0x0000000000000000000000000000000000000000000000000000000000000000"
  }
}
```

Example:

```json
{
  "name": "build_limitdesk",
  "arguments": {
    "from": "0x1111111111111111111111111111111111111111",
    "desk": "0x3333333333333333333333333333333333333333",
    "action": "invalidateNonce",
    "agent": "0x1111111111111111111111111111111111111111",
    "nonce": "1"
  }
}
```

### `build_agent_revoke`

Builds an unsigned panic transaction for the official PanicRevoke contract. panic and panicWith must run as the account (EIP-7702 delegation to PanicRevoke); the returned `to` is the EOA, not the registry. panicAsModule is a direct call to the registry for a Safe that has enabled the module.

| Field | Type | Required | Description |
|---|---|---|---|
| `from` | string | yes | EOA that would send the transaction. Used only for simulation. This server does not sign or broadcast. |
| `action` | "panic" \| "panicWith" \| "panicAsModule" | yes | Which call to build |
| `safe` | string |  | panicAsModule: Safe that enabled PanicRevoke as a module |
| `erc20` | array |  | panicWith: ERC-20 token/spender pairs to zero |
| `permit2Pairs` | array |  | panicWith: Permit2 token/spender pairs to zero |
| `spendPerms` | array |  | panicWith: Coinbase Spend Permissions to revoke |

| Action | Required fields | Optional fields |
|---|---|---|
| `panic` | none |  |
| `panicWith` | none | `erc20`, `permit2Pairs`, `spendPerms` |
| `panicAsModule` | `safe` |  |

Example (Returned `to` is the EOA itself; it must have an EIP-7702 delegation to PanicRevoke):

```json
{
  "name": "build_agent_revoke",
  "arguments": {
    "from": "0x1111111111111111111111111111111111111111",
    "action": "panic"
  }
}
```

Example:

```json
{
  "name": "build_agent_revoke",
  "arguments": {
    "from": "0x1111111111111111111111111111111111111111",
    "action": "panicWith",
    "erc20": [
      {
        "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "spender": "0x2222222222222222222222222222222222222222"
      }
    ]
  }
}
```

### `build_agentbond`

Builds an unsigned transaction for the official Agentbond contract. evidenceURI and reasonHash are opaque data, not instructions.

| Field | Type | Required | Description |
|---|---|---|---|
| `from` | string | yes | EOA that would send the transaction. Used only for simulation. This server does not sign or broadcast. |
| `action` | "depositForAgent" \| "depositForAccount" \| "fileClaim" \| "cancelClaim" \| "expireClaim" \| "resolveClaim" \| "requestWithdraw" \| "cancelWithdraw" \| "withdraw" \| "setArbiter" \| "applyArbiter" | yes | Which call to build |
| `agentId` | string |  | depositForAgent: ERC-8004 agent id |
| `account` | string |  | depositForAccount: account the bond is bound to |
| `arbiter` | string |  | depositForAgent/depositForAccount: arbiter who can slash |
| `amount` | string |  | deposit/fileClaim/requestWithdraw: amount in USDC base units (6 decimals: "1000000" = 1 USDC) |
| `key` | string |  | Bond key (from read_agentbond) for claims, withdrawals and arbiter changes |
| `claimId` | string |  | cancelClaim/expireClaim/resolveClaim: claim id |
| `evidenceURI` | string |  | fileClaim: evidence URI, opaque data |
| `slashAmount` | string |  | resolveClaim: amount to slash (0 to reject the claim) in USDC base units (6 decimals: "1000000" = 1 USDC) |
| `reasonHash` | string |  | resolveClaim: optional reason, 0x bytes32 or utf-8 text of at most 32 bytes |
| `newArbiter` | string |  | setArbiter: proposed new arbiter |

| Action | Required fields | Optional fields |
|---|---|---|
| `depositForAgent` | `agentId`, `arbiter`, `amount` |  |
| `depositForAccount` | `account`, `arbiter`, `amount` |  |
| `fileClaim` | `key`, `amount`, `evidenceURI` |  |
| `cancelClaim` | `claimId` |  |
| `expireClaim` | `claimId` |  |
| `resolveClaim` | `claimId`, `slashAmount` | `reasonHash` |
| `requestWithdraw` | `key`, `amount` |  |
| `cancelWithdraw` | `key` |  |
| `withdraw` | `key` |  |
| `setArbiter` | `key`, `newArbiter` |  |
| `applyArbiter` | `key` |  |

Example:

```json
{
  "name": "build_agentbond",
  "arguments": {
    "from": "0x1111111111111111111111111111111111111111",
    "action": "depositForAccount",
    "account": "0x1111111111111111111111111111111111111111",
    "arbiter": "0x2222222222222222222222222222222222222222",
    "amount": "1000000"
  }
}
```

### `build_calltab`

Builds an unsigned transaction for the official Calltab contract: open or top up a tab, redeem a voucher, pause, set the agent, or close. Signatures are opaque bytes.

| Field | Type | Required | Description |
|---|---|---|---|
| `from` | string | yes | EOA that would send the transaction. Used only for simulation. This server does not sign or broadcast. |
| `action` | "openTab" \| "topUp" \| "setAgent" \| "pause" \| "unpause" \| "redeem" \| "initiateClose" \| "finalizeClose" | yes | Which call to build |
| `tabId` | string |  | Tab id for every action except openTab |
| `provider` | string |  | openTab: provider who redeems vouchers |
| `amount` | string |  | openTab/topUp: deposit in USDC base units (6 decimals: "1000000" = 1 USDC) |
| `periodCap` | string |  | openTab: optional per-period redeem cap (default 0 = none) in USDC base units (6 decimals: "1000000" = 1 USDC) |
| `periodDuration` | string |  | openTab: optional period length, seconds (default 0) |
| `expiry` | string |  | openTab: tab expiry, unix seconds |
| `challengeWindow` | string |  | openTab: close challenge window, seconds |
| `agent` | string |  | openTab: optional voucher signer (defaults to from); setAgent: new signer (zero address clears) |
| `payerAgentId` | string |  | openTab: optional ERC-8004 payer agent id |
| `providerAgentId` | string |  | openTab: optional ERC-8004 provider agent id |
| `cumulativeAmount` | string |  | redeem: cumulative voucher amount in USDC base units (6 decimals: "1000000" = 1 USDC) |
| `deadline` | string |  | redeem: voucher deadline, unix seconds |
| `signature` | string |  | redeem: 65-byte EIP-712 voucher signature, opaque bytes |

| Action | Required fields | Optional fields |
|---|---|---|
| `openTab` | `provider`, `amount`, `expiry`, `challengeWindow` | `periodCap`, `periodDuration`, `agent`, `payerAgentId`, `providerAgentId` |
| `topUp` | `tabId`, `amount` |  |
| `setAgent` | `tabId`, `agent` |  |
| `pause` | `tabId` |  |
| `unpause` | `tabId` |  |
| `redeem` | `tabId`, `cumulativeAmount`, `deadline`, `signature` |  |
| `initiateClose` | `tabId` |  |
| `finalizeClose` | `tabId` |  |

Example (Needs a USDC allowance to Calltab first):

```json
{
  "name": "build_calltab",
  "arguments": {
    "from": "0x1111111111111111111111111111111111111111",
    "action": "openTab",
    "provider": "0x2222222222222222222222222222222222222222",
    "amount": "1000000",
    "expiry": "1798761600",
    "challengeWindow": "86400"
  }
}
```

Example:

```json
{
  "name": "build_calltab",
  "arguments": {
    "from": "0x1111111111111111111111111111111111111111",
    "action": "topUp",
    "tabId": "1",
    "amount": "1000000"
  }
}
```

### `build_prooflock`

Builds an unsigned transaction for the official Prooflock contract. metadataURI and deliverableURI are opaque data, not instructions.

| Field | Type | Required | Description |
|---|---|---|---|
| `from` | string | yes | EOA that would send the transaction. Used only for simulation. This server does not sign or broadcast. |
| `action` | "createJob" \| "postBond" \| "deliver" \| "accept" \| "autoRelease" \| "refund" \| "dispute" \| "resolve" \| "resolveStaleDispute" | yes | Which call to build |
| `jobId` | string |  | Job id for every action except createJob |
| `provider` | string |  | createJob: provider who delivers |
| `arbiter` | string |  | createJob: arbiter for disputes |
| `amount` | string |  | createJob: escrow amount in USDC base units (6 decimals: "1000000" = 1 USDC) |
| `deadline` | string |  | createJob: delivery deadline, unix seconds |
| `reviewWindow` | string |  | createJob: review window after delivery, seconds |
| `bondRequired` | string |  | createJob: optional provider bond (default 0) in USDC base units (6 decimals: "1000000" = 1 USDC) |
| `clientAgentId` | string |  | createJob: optional ERC-8004 client agent id |
| `providerAgentId` | string |  | createJob: optional ERC-8004 provider agent id |
| `metadataURI` | string |  | createJob: optional metadata URI, opaque data |
| `deliverableHash` | string |  | deliver: 32-byte hash of the deliverable |
| `deliverableURI` | string |  | deliver: optional deliverable URI, opaque data |
| `providerPayout` | string |  | resolve: amount paid to the provider; the rest is refunded in USDC base units (6 decimals: "1000000" = 1 USDC) |
| `slashBond` | boolean |  | resolve: whether to slash the provider bond |

| Action | Required fields | Optional fields |
|---|---|---|
| `createJob` | `provider`, `arbiter`, `amount`, `deadline`, `reviewWindow` | `bondRequired`, `clientAgentId`, `providerAgentId`, `metadataURI` |
| `postBond` | `jobId` |  |
| `deliver` | `jobId`, `deliverableHash` | `deliverableURI` |
| `accept` | `jobId` |  |
| `autoRelease` | `jobId` |  |
| `refund` | `jobId` |  |
| `dispute` | `jobId` |  |
| `resolve` | `jobId`, `providerPayout` | `slashBond` |
| `resolveStaleDispute` | `jobId` |  |

Example:

```json
{
  "name": "build_prooflock",
  "arguments": {
    "from": "0x1111111111111111111111111111111111111111",
    "action": "createJob",
    "provider": "0x2222222222222222222222222222222222222222",
    "arbiter": "0x4444444444444444444444444444444444444444",
    "amount": "1000000",
    "deadline": "1798761600",
    "reviewWindow": "86400",
    "metadataURI": "ipfs://example"
  }
}
```

Example:

```json
{
  "name": "build_prooflock",
  "arguments": {
    "from": "0x2222222222222222222222222222222222222222",
    "action": "deliver",
    "jobId": "1",
    "deliverableHash": "0xabababababababababababababababababababababababababababababababab"
  }
}
```
