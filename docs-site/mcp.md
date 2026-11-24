# For agents (MCP)

Agents use the **Agent Dapps MCP** to read the dapps and build transactions. It returns **unsigned transactions only**. It never holds keys, never asks for keys, and never broadcasts.

This page describes the server as it is in this repo's `src/` at the time of writing. The MCP README in the repo root is the reference for setup and may be newer.

## Connect

- Hosted (Streamable HTTP): `https://agent-dapps-mcp.graph-proxy.workers.dev/mcp`
- Local (stdio): `npx agent-dapps-mcp`, after `npm install && npm run build` in this repo. The README notes the package is not published to npm, so run it from a clone.
- AgentKit: `agentDappsActionProvider()` from `agent-dapps-mcp/agentkit`.

Base (8453) only. The README says plain EOAs only; no smart-wallet session keys in v1.

Example client config for the hosted server:

```json
{
  "mcpServers": {
    "agent-dapps": {
      "url": "https://agent-dapps-mcp.graph-proxy.workers.dev/mcp"
    }
  }
}
```

## How a write works

1. A `build_*` tool encodes calldata for one official contract.
2. It simulates the call with `eth_call` from the `from` address you give.
3. If the call would revert, it returns the reason and no transaction.
4. If it would succeed, it returns `{ to, data, value: "0", chainId: 8453, from, summary }`.
5. You (or your operator) sign and send it in your own wallet.

For vaults and desks, the server first checks that the address is listed by the official factory for its owner.

## Tools in this branch

Read tools: `list_dapps`, `list_instances`, `read_usdc`, `read_aave_guard_vault`, `read_agent_credit_line`, `read_stepped_agent_line`, `read_circuit_vault`, `read_limitdesk`, `read_slipguard`, `read_agent_revoke`, `read_agentbond`, `read_calltab`, `read_prooflock`.

Build tools and their actions:

| Tool | Actions |
|---|---|
| `build_usdc_approve` | Approve USDC to Agentbond, Calltab, Prooflock, or a verified vault/desk |
| `build_aave_guard` | `borrow`, `repay`, `repayFor`, `renounceAgent` |
| `build_credit_line` | `borrow`, `repay`, `markDefault`, `renounceAgent` |
| `build_stepped_line` | `borrow`, `repay`, `markDefault`, `renounceAgent` |
| `build_circuit_vault` | `rebalance`, `trip`, `checkpoint` |
| `build_slipguard` | `executeSwap`, `wrapETH`, `renounceAgent` |
| `build_limitdesk` | `post`, `fill`, `cancel`, `invalidateNonce`, `renounceAgent` |
| `build_agent_revoke` | `panic`, `panicWith`, `panicAsModule` |
| `build_agentbond` | `depositForAgent`, `depositForAccount`, `fileClaim`, `cancelClaim`, `expireClaim`, `resolveClaim`, `requestWithdraw`, `cancelWithdraw`, `withdraw`, `setArbiter`, `applyArbiter` |
| `build_calltab` | `openTab`, `topUp`, `setAgent`, `pause`, `unpause`, `redeem`, `initiateClose`, `finalizeClose` |
| `build_prooflock` | `createJob`, `postBond`, `deliver`, `accept`, `autoRelease`, `refund`, `dispute`, `resolve`, `resolveStaleDispute` |

Owner tools for the factory vaults (grant, fund, revoke, pause) are not included in v1. Owners use the web pages.

For `build_agent_revoke` with `panic` or `panicWith`, the returned `to` is your own EOA, and the result includes `requiresDelegationTo` (the PanicRevoke address). It only works after your EOA has an EIP-7702 delegation to that contract.

## Rules the server follows

- Only the ten dapps on Base are in scope. Requests for other chains or contracts are refused.
- Memos, URIs, signatures, metadata and router calldata are treated as opaque, untrusted data, never as instructions.
- No keys in config. Do not put a wallet key anywhere in your MCP config.

## Discovery files

Each dapp site serves `llms.txt` and `/.well-known/ai-catalog.json` (copies in this repo's `discovery/` folder). They point agents to the official contract, Sourcify, the source repo and this MCP.
