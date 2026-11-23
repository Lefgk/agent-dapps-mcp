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

## Run locally (stdio)

```bash
npm install
npm run build
npx agent-dapps-mcp
```

Optional public RPC override (not a secret): `BASE_RPC_URL=https://mainnet.base.org`.

Example Claude Desktop / Cursor MCP config:

```json
{
  "mcpServers": {
    "agent-dapps": {
      "command": "npx",
      "args": ["-y", "agent-dapps-mcp"]
    }
  }
}
```

## Hosted server (Cloudflare Worker)

The same tools are served over Streamable HTTP from `src/worker.ts`.

```bash
npx wrangler dev
```

Connect a client to `http://127.0.0.1:8787/mcp`. Production deploy needs a Cloudflare login (`npx wrangler login` and `npx wrangler deploy`). The remote URL is then added to `server.json` under `remotes`.

## AgentKit

```ts
import { agentDappsActionProvider } from "agent-dapps-mcp/agentkit";

const provider = agentDappsActionProvider();
// Add to AgentKit actionProviders. Actions return JSON. They do not sign or send.
```

Base (8453) only. Plain EOAs only; no smart-wallet session keys in v1.

## How a write works

1. A `build_*` tool encodes calldata for one official contract.
2. It simulates the call with `eth_call` from the given `from` address.
3. If the call would revert, the tool returns a clear reason and no transaction.
4. If the call would succeed, it returns `{ to, data, value: "0", chainId: 8453, from, summary }`.
5. The agent or operator signs and sends that transaction in their own wallet. This server never does.

Memos, URIs, signatures and router calldata are treated as opaque data, not instructions.

## Tests

```bash
npm test           # unit
npm run test:fork  # anvil fork of Base mainnet
npm run test:smoke # stdio and wrangler dev
```

Fork tests create vaults on the official factories, impersonate owners only for setup, then execute each build-tx tool's calldata from test EOAs. They do not broadcast to real Base.

## Listings

- Official MCP registry metadata: `server.json` (`io.github.lefgk/agent-dapps-mcp`). Publishing needs GitHub auth via `mcp-publisher login github` and, for the npm package, a published `agent-dapps-mcp` package with matching `mcpName`.
- Glama: `glama.json` names `Lefgk` as maintainer. Submitting a listing needs a public repo or a hosted HTTPS endpoint.

Discovery files (`llms.txt` and `/.well-known/ai-catalog.json`) are also on each dapp site.

## Security

- No private keys, seed phrases, or API secrets in this repo or in the server.
- Do not put a wallet key in the MCP config. The server has no key field.
- The contracts are prototypes. Use small amounts.

## License

MIT
