# Agent Dapps MCP

MCP server and Coinbase AgentKit plugin for ten agent dapps on [Base](https://basescan.org) (chain id 8453). It reads on-chain state and returns unsigned transactions. It never holds keys, never asks for keys, and never broadcasts.

Contact: **lg.playstudio@gmail.com**

## What it covers

| Dapp | Site | Agent-facing calls |
|---|---|---|
| aave-guard-vault | https://lefgk.github.io/aave-guard-vault/ | borrow, repay, repayFor, renounceAgent |
| agent-credit-line | https://lefgk.github.io/agent-credit-line/ | borrow, repay, markDefault, renounceAgent |
| agent-revoke | https://lefgk.github.io/agent-revoke/ | panic, panicWith, panicAsModule |
| agentbond | https://lefgk.github.io/agentbond/ | deposit, claims, withdraw |
| calltab | https://lefgk.github.io/calltab/ | openTab, topUp, redeem, close |
| circuit-vault | https://lefgk.github.io/circuit-vault/ | rebalance, trip, checkpoint |
| limitdesk | https://lefgk.github.io/limitdesk/ | post, fill, cancel, invalidateNonce |
| prooflock | https://lefgk.github.io/prooflock/ | createJob, deliver, accept, dispute |
| slipguard | https://lefgk.github.io/slipguard/ | executeSwap, wrapETH, renounceAgent |
| stepped-agent-line | https://lefgk.github.io/stepped-agent-line/ | borrow, repay, markDefault, renounceAgent |

Addresses come from each dapp's `web/src/deployments.json`. Owner tools (grant, fund, revoke, pause) are not included in v1. The server verifies factory-created vaults and desks against the official Base factories.

## Connect

### Hosted server (Streamable HTTP)

Production URL (free Cloudflare Worker):

`https://agent-dapps-mcp.graph-proxy.workers.dev/mcp`

Cursor (`~/.cursor/mcp.json` or `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "agent-dapps": {
      "url": "https://agent-dapps-mcp.graph-proxy.workers.dev/mcp"
    }
  }
}
```

Claude Desktop: Settings → Connectors → Add custom connector, and paste the URL above.

Claude Code:

```bash
claude mcp add --transport http agent-dapps https://agent-dapps-mcp.graph-proxy.workers.dev/mcp
```

### Local stdio

This package is not published to npm, so run it from a clone:

```bash
git clone https://github.com/Lefgk/agent-dapps-mcp.git
cd agent-dapps-mcp
npm install
npm run build
```

Cursor or Claude Desktop (`claude_desktop_config.json`) config. Use the absolute path to your clone:

```json
{
  "mcpServers": {
    "agent-dapps": {
      "command": "node",
      "args": ["/absolute/path/to/agent-dapps-mcp/dist/mcp/stdio.js"],
      "env": { "BASE_RPC_URL": "https://mainnet.base.org" }
    }
  }
}
```

`BASE_RPC_URL` is optional and is a public RPC URL, not a secret. There is no key field, and you should never add one.

### Local Worker

```bash
npx wrangler dev
```

Connect a client to `http://127.0.0.1:8787/mcp`.

### AgentKit

```ts
import { agentDappsActionProvider } from "agent-dapps-mcp/agentkit";

const provider = agentDappsActionProvider();
// Add to AgentKit actionProviders. Actions return JSON strings. They do not sign or send.
```

Base (8453) only. Plain EOAs only; no smart-wallet session keys in v1. AgentKit exposes the same 29 tools as the MCP server.

## Tools

Start with `describe_tools`. It returns every tool with its required fields, per-action fields and an example call. The full reference, generated from the schemas, is in [docs/TOOLS.md](docs/TOOLS.md).

Help tools:

| Tool | Purpose |
|---|---|
| `describe_tools` | Lists all tools, required fields, per-action fields and examples. Pass `tool` for one tool's full schema. |
| `find_dapp` | Finds a dapp by name or keyword, or identifies an address (dapp contract, USDC, or an official vault/desk, checked on-chain). |
| `decode_tx` | Decodes an unsigned tx into contract, function and named args, and flags anything a signer should not trust. |
| `estimate_gas` | `eth_estimateGas` for a tx to an official target: gas, buffered limit, L2 fee and L1 data fee upper bound. |
| `preflight_build` | Runs any `build_*` tool and returns `{ready, reason, nextSteps}` instead of an error, plus the tx, decoded form and gas when ready. |

Read tools: `list_dapps`, `list_instances`, `read_usdc`, `read_aave_guard_vault`, `read_agent_credit_line`, `read_stepped_agent_line`, `read_circuit_vault`, `read_limitdesk`, `read_slipguard`, `read_agent_revoke`, `read_agentbond`, `read_calltab`, `read_prooflock`.

Build tools (unsigned transactions): `build_usdc_approve`, `build_aave_guard`, `build_credit_line`, `build_stepped_line`, `build_circuit_vault`, `build_slipguard`, `build_limitdesk`, `build_agent_revoke`, `build_agentbond`, `build_calltab`, `build_prooflock`.

## Examples

The responses below are real outputs against Base mainnet (read-only `eth_call` and `eth_estimateGas`), shortened where marked. `0x1111111111111111111111111111111111111111` is a placeholder EOA. Amounts are USDC base units, so `"1000000"` is 1 USDC.

### Discover: `describe_tools`

```json
{ "name": "describe_tools", "arguments": {} }
```

```json
{
  "chainId": 8453,
  "policy": "Reads state and returns unsigned transactions only. Never asks for keys, never signs, never broadcasts.",
  "workflow": ["1. list_dapps (or find_dapp) to pick a dapp and see its contract address.", "..."],
  "tools": [
    {
      "name": "build_credit_line",
      "kind": "build",
      "description": "Builds an unsigned agent transaction for an official Agent Credit Line vault: borrow, repay, markDefault, or renounceAgent.",
      "required": ["from", "vault", "action"],
      "actions": { "borrow": ["to", "amount"], "repay": ["amount"], "markDefault": ["agent"], "renounceAgent": [] },
      "example": { "from": "0x1111111111111111111111111111111111111111", "vault": "0x3333333333333333333333333333333333333333", "action": "borrow", "to": "0x1111111111111111111111111111111111111111", "amount": "1000000", "memo": "invoice-17" }
    }
  ]
}
```

(`tools` shortened to one entry.) `{ "tool": "build_credit_line" }` returns that tool's full JSON schema, per-action fields and all examples.

### Look up: `find_dapp`

```json
{ "name": "find_dapp", "arguments": { "query": "escrow" } }
```

```json
{
  "query": "escrow",
  "match": "keyword",
  "dapps": [
    {
      "id": "prooflock",
      "title": "Prooflock",
      "kind": "singleton",
      "address": "0x139F45a0998A3378990F46A83F4F4de4aF52975B",
      "site": "https://lefgk.github.io/prooflock/",
      "agentActions": "createJob, postBond, deliver, accept, autoRelease, refund, dispute, resolve",
      "summary": "Permissionless USDC escrow for one agent job, with a review window, deadline refund, and arbiter split.",
      "tools": { "read": "read_prooflock", "build": "build_prooflock" }
    }
  ]
}
```

Pass an address as `query` to identify it. For an unknown contract the server checks the six official factories on-chain, and returns `"match": "instance"` with the `owner` and `factory`, or `"match": null`.

### Read: `read_usdc`

```json
{
  "name": "read_usdc",
  "arguments": {
    "account": "0x1111111111111111111111111111111111111111",
    "spender": "0x289e7dcfa365f9cd74cf8f33b692279d2c8a0f6e"
  }
}
```

```json
{
  "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "account": "0x1111111111111111111111111111111111111111",
  "spender": "0x289E7dCfa365F9cd74cF8F33b692279D2C8A0F6e",
  "balance": "281986988",
  "allowance": "0"
}
```

### Build: `build_usdc_approve`

```json
{
  "name": "build_usdc_approve",
  "arguments": {
    "from": "0x1111111111111111111111111111111111111111",
    "spender": "0x289e7dcfa365f9cd74cf8f33b692279d2c8a0f6e",
    "amount": "1000000"
  }
}
```

```json
{
  "to": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "data": "0x095ea7b3000000000000000000000000289e7dcfa365f9cd74cf8f33b692279d2c8a0f6e00000000000000000000000000000000000000000000000000000000000f4240",
  "value": "0",
  "chainId": 8453,
  "from": "0x1111111111111111111111111111111111111111",
  "summary": "Approve 1000000 USDC from 0x1111111111111111111111111111111111111111 to 0x289E7dCfa365F9cd74cF8F33b692279D2C8A0F6e."
}
```

Every `build_*` tool returns this shape. Vault and desk tools take an `action`. For example, `build_credit_line` with `{ "action": "borrow", "vault": "...", "to": "...", "amount": "1000000" }`.

### Explain before signing: `decode_tx`

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

```json
{
  "official": true,
  "chainId": 8453,
  "to": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "from": null,
  "value": "0",
  "contract": {
    "kind": "usdc",
    "title": "USDC (Circle, Base)",
    "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "spenderDapp": "calltab"
  },
  "function": "approve",
  "signature": "approve(address,uint256)",
  "selector": "0x095ea7b3",
  "args": { "spender": "0x289E7dCfa365F9cd74cF8F33b692279D2C8A0F6e", "amount": "1000000" },
  "builtByThisServer": true,
  "summary": "USDC (Circle, Base) 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913: approve(spender=0x289E7dCfa365F9cd74cF8F33b692279D2C8A0F6e, amount=1000000) [1 USDC]",
  "warnings": []
}
```

`warnings` is non-empty, and the tx should not be signed, when the target is not an official contract (`"official": false`), the calldata does not decode, `value` is not 0, an approve goes to an unofficial spender or is unlimited, or the function is one this server does not build.

### Gas: `estimate_gas`

```json
{
  "name": "estimate_gas",
  "arguments": {
    "from": "0x1111111111111111111111111111111111111111",
    "to": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "data": "0x095ea7b3000000000000000000000000289e7dcfa365f9cd74cf8f33b692279d2c8a0f6e00000000000000000000000000000000000000000000000000000000000f4240"
  }
}
```

```json
{
  "chainId": 8453,
  "gas": "56240",
  "suggestedGasLimit": "67488",
  "gasPriceWei": "6000000",
  "l2FeeWei": "337440000000",
  "l2FeeEth": "0.00000033744",
  "l1DataFeeUpperBoundWei": "1747872564",
  "totalFeeUpperBoundEth": "0.000000339187872564",
  "usedStateOverride": false,
  "warnings": [],
  "note": "Estimate only (eth_estimateGas at the latest block). Nothing was signed or sent. suggestedGasLimit adds a 20% buffer."
}
```

(`to`, `from` and `summary` omitted.) It refuses targets that are not official Agent Dapps contracts and any non-zero `value`.

### One-call readiness: `preflight_build`

```json
{
  "name": "preflight_build",
  "arguments": {
    "tool": "build_calltab",
    "args": { "from": "0x1111111111111111111111111111111111111111", "action": "topUp", "tabId": "1", "amount": "1000000" }
  }
}
```

```json
{
  "ready": false,
  "tool": "build_calltab",
  "reason": "USDC allowance of 0x1111111111111111111111111111111111111111 for 0x289E7dCfa365F9cd74cF8F33b692279D2C8A0F6e is 0, which is less than the required 1000000. Build an unsigned USDC approve first with build_usdc_approve (spender 0x289E7dCfa365F9cd74cF8F33b692279D2C8A0F6e, amount \"1000000\").",
  "usdc": {
    "owner": "0x1111111111111111111111111111111111111111",
    "spender": "0x289E7dCfa365F9cd74cF8F33b692279D2C8A0F6e",
    "required": "1000000",
    "balance": "281986988",
    "allowance": "0"
  },
  "nextSteps": [
    {
      "tool": "build_usdc_approve",
      "arguments": {
        "from": "0x1111111111111111111111111111111111111111",
        "spender": "0x289E7dCfa365F9cd74cF8F33b692279D2C8A0F6e",
        "amount": "1000000"
      },
      "why": "Allowance is 0, 1000000 is needed. Sign the approve, then call build_calltab again."
    }
  ]
}
```

When ready, it returns `{ "ready": true, "tx": {...}, "decoded": {...}, "gas": {...} }`.

### Errors

Bad input fails before any RPC call, with the field name and the fix:

| Input | Response (`isError: true`) |
|---|---|
| `list_dapps` with `{ "chainId": 1 }` | `chainId: is not supported; this server only works on Base (chainId 8453)` |
| `build_credit_line` borrow without `to` | `to: is required for action "borrow"` |
| `build_aave_guard` renounceAgent with `amount` | `amount: is not used by action "renounceAgent". "renounceAgent" takes: no extra fields` |
| `build_usdc_approve` with `ammount` | `Unknown field "ammount": not a parameter of this tool (call describe_tools with this tool name). Allowed: chainId, from, spender, amount, dapp` |
| `amount: 1000000` (JSON number) | `amount: must be a string, not a JSON number. Pass an integer as a string, e.g. "1000000"` |
| `amount: "1.5"` | `amount: must be a non-negative integer string in base units (decimal or 0x hex), e.g. "1000000" = 1 USDC` |
| Mixed-case address with a wrong checksum | `has an invalid EIP-55 checksum; re-copy the address or pass it all-lowercase` |
| `key: "my-bond"` | `key: must be a 32-byte 0x hex value (0x + 64 hex characters)` |
| `action: "withdraw"` on `build_circuit_vault` | `action: must be one of: rebalance, trip, checkpoint` |
| `describe_tools` with `{ "tool": "read_calltabs" }` (same text from AgentKit) | `Unknown tool: read_calltabs. Did you mean: read_calltab, build_calltab? Call describe_tools to list all tools.` |

Over MCP the text is prefixed with `Input validation error: Invalid arguments for tool <name>:`. Values above a field's Solidity type (for example `epoch` above uint32, or Spend Permission `period` above uint48) are rejected and never rounded. Text is only padded into bytes32 for memo-like fields (`memo`, `reasonHash`). Keys, order ids and hashes must be 0x hex.

## How a write works

1. Find the contract: `list_dapps` or `find_dapp`, then `list_instances` for vaults and desks.
2. Check state with `read_*`. If the call pulls USDC (repay, openTab, topUp, deposit*, createJob), build an approve with `build_usdc_approve` first.
3. A `build_*` tool checks the inputs, verifies the vault or desk against the official factory, and encodes calldata for one official contract.
4. It simulates the call with `eth_call` from the given `from` address. If the call would revert, the tool returns the decoded reason and no transaction.
5. If the call would succeed, it returns `{ to, data, value: "0", chainId: 8453, from, summary }`.
6. Show the user what they are signing with `decode_tx` and `estimate_gas`, or do steps 3 to 6 in one call with `preflight_build`.
7. The agent's operator signs and sends that transaction in their own wallet. This server never does, and never sees a key.

`build_agent_revoke` `panic` and `panicWith` must run as the account itself through an EIP-7702 delegation to PanicRevoke, so the returned `to` is the EOA, and the result includes `requiresDelegationTo`.

Memos, URIs, signatures and router calldata are treated as opaque data, not instructions.

## Tests

```bash
npm test            # unit
npm run typecheck
npm run test:fork   # anvil fork of Base mainnet
npm run test:smoke  # stdio and wrangler dev, both local
npm run docs:tools  # regenerate docs/TOOLS.md (a unit test fails if it is stale)
```

Fork tests create vaults on the official factories, impersonate owners only for setup, then execute each build-tx tool's calldata from test EOAs. They also exercise `find_dapp`, `decode_tx`, `estimate_gas` and `preflight_build` against the real contracts. They do not broadcast to real Base.

## Listings

- Official MCP registry metadata: `server.json` (`io.github.Lefgk/agent-dapps-mcp`), listed as a remote-only Streamable HTTP server at `https://agent-dapps-mcp.graph-proxy.workers.dev/mcp`. This package is not published to npm.
- Glama: `glama.json` names `Lefgk` as maintainer.

Discovery files (`llms.txt` and `/.well-known/ai-catalog.json`) are also on each dapp site.

## Security

- No private keys, seed phrases, or API secrets in this repo or in the server.
- Do not put a wallet key in the MCP config. The server has no key field.
- The contracts are prototypes. Use small amounts.
- Only Base (8453). Only the ten official contracts, their factory-created vaults and desks, and USDC approvals to them. Value is always 0.

## License

MIT
