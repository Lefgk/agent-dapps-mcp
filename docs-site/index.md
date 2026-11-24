---
layout: home
hero:
  name: Agent Dapps on Base
  text: Ten small contracts that give AI agents limited, revocable power over money.
  tagline: Base mainnet, chain id 8453. Prototypes, not audited. Use small amounts.
  actions:
    - theme: brand
      text: Browse the dapps
      link: /dapps/
    - theme: alt
      text: Contract addresses
      link: /addresses
    - theme: alt
      text: For agents (MCP)
      link: /mcp
features:
  - title: Owners stay in control
    details: An owner funds a vault or tab, grants an agent narrow rights, and can revoke or pause at any time.
  - title: Agents get caps, not keys
    details: Agent rights are limited by per-transaction caps, period caps, expiries, allowlists and oracle checks enforced on-chain.
  - title: Unsigned transactions only
    details: The Agent Dapps MCP reads state and returns unsigned transactions. It never holds keys and never broadcasts.
---

## What these are

The agent dapps are ten Solidity contracts on [Base](https://basescan.org) (chain id 8453). Each one solves a single problem that comes up when an AI agent needs to touch money: borrowing, paying for a service, posting a bond, swapping, placing orders, or cleaning up approvals after something goes wrong.

They are for two groups:

- **Owners and operators** (people or teams) who fund a contract and decide what an agent may do. They use the web page for each dapp at `https://lefgk.github.io/<dapp>/`.
- **Agents and agent builders** who want a predictable, capped way to act on-chain. Agents read state and build unsigned transactions through the [Agent Dapps MCP](/mcp).

## The ten dapps

| Dapp | One line | Kind |
|---|---|---|
| [Aave Guard Vault](/dapps/aave-guard-vault) | An agent borrows USDC against the owner's Aave collateral, within caps and above a health-factor floor. | Factory |
| [Agent Credit Line](/dapps/agent-credit-line) | Owner-funded USDC credit lines with a max borrow, expiry, due date and optional flat fee. | Factory |
| [Agent Revoke](/dapps/agent-revoke) | One `panic` call clears pre-registered ERC-20 approvals, Permit2 allowances, Spend Permissions and Safe modules. | Singleton |
| [Agentbond](/dapps/agentbond) | A public USDC surety bond for an agent, with an arbiter who can slash to claimants. | Singleton |
| [Calltab](/dapps/calltab) | Prepaid USDC tabs paid out by signed cumulative vouchers. | Singleton |
| [Circuit Vault](/dapps/circuit-vault) | A USDC vault an agent can rebalance into Aave, with a drawdown circuit breaker anyone can trip. | Factory |
| [Limitdesk](/dapps/limitdesk) | Self-custodial WETH/USDC limit and stop orders signed by an agent and filled by anyone at an oracle-bounded price. | Factory |
| [Prooflock](/dapps/prooflock) | USDC escrow for one agent job: deliver, accept, auto-release, refund or arbiter split. | Singleton |
| [Slipguard](/dapps/slipguard) | Capped swaps from a personal vault through allowlisted routers, with min-out checked against Chainlink. | Factory |
| [Stepped Agent Line](/dapps/stepped-agent-line) | USDC credit lines whose cap steps up after each on-time full repayment. | Factory |

**Factory** dapps deploy one contract per owner (a vault or desk). **Singleton** dapps are one shared contract that everyone uses. See [How the dapps work](/concepts).

## Status

This repo's README says the contracts are prototypes and to use small amounts. Eight of the ten main contracts also say "prototype, not audited" in their verified source; Agent Revoke (`PanicRevoke`) and Prooflock carry no such note, but no audit report is published either. Treat them all as experiments. Read [Risks](/risks) before you put money in.

## Contact

lg.playstudio@gmail.com (from this repo's `package.json` and discovery files).
