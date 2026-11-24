# How the dapps work

This page covers the ideas shared by most of the ten contracts. Details per dapp are on each [dapp page](/dapps/).

## Factory vs singleton

- **Factory dapps** (Aave Guard Vault, Agent Credit Line, Circuit Vault, Limitdesk, Slipguard, Stepped Agent Line): you call `createVault()` (or `createDesk()` for Limitdesk) on the official factory. It deploys a new contract owned by you. The factory keeps a list per owner, readable with `vaultsOf(owner)` or `desksOf(owner)`. Your funds sit in your own contract, not in a shared pool.
- **Singleton dapps** (Agent Revoke, Agentbond, Calltab, Prooflock): one shared contract on Base. Each user's state (a tab, a bond, a job, a list of revoke targets) is a record inside it.

Official addresses are on [Contract addresses](/addresses).

## Roles

Most factory vaults use the same three roles.

| Role | Who | Typical powers |
|---|---|---|
| Owner | The address that called `createVault()` | Fund and withdraw, grant and revoke agents, set caps and allowlists, pause and unpause. Ownership moves with a two-step `transferOwnership` / `acceptOwnership` (OpenZeppelin `Ownable2Step`). |
| Guardian | Optional address the owner sets with `setGuardian` | Pause and revoke agents (and, in Circuit Vault, unwind strategies). Cannot withdraw funds, open lines or unpause. |
| Agent | An address the owner grants rights to | Only the narrow agent calls of that dapp, inside the owner's limits. Can give up its own rights with `renounceAgent()` where the dapp has it. |

Limitdesk has no guardian: only the owner can pause or revoke. Singleton dapps have their own roles (payer/provider, client/provider/arbiter, bond operator/arbiter); see each page.

## Limits on agents

Depending on the dapp, an agent is bounded by some mix of:

- **Expiry**: rights stop at a set Unix time.
- **Per-transaction cap** and **period cap** (a rolling window that resets after a set period).
- **Allowlists**: which recipients, tokens or routers the agent may use.
- **Oracle checks**: Slipguard and Limitdesk price against Chainlink feeds and refuse to act while the Base sequencer is down or within one hour of it restarting.
- **Safety floors**: Aave Guard Vault's health-factor floor and Circuit Vault's drawdown breaker.

## Revocation and epochs

Revoking an agent bumps an internal `epoch` counter for that agent. Caps, allowlists and (in Limitdesk) signed orders are keyed to the epoch, so a revoke wipes them at once. If the same address is granted again later, it starts with a clean slate. Outstanding debt in the credit-line dapps is **not** erased by a revoke; it stays on the public record.

## Pausing

Where a dapp has `pause()`, it blocks new agent actions. Owner withdrawals and repayments are still allowed while paused in the vaults that say so in their source (Aave Guard Vault, Agent Credit Line, Stepped Agent Line, Circuit Vault, Slipguard, Limitdesk), so funds do not get stuck.

## Units

- USDC on Base has 6 decimals. `1000000` = 1 USDC.
- Basis points (bps): `10000` = 100%, `100` = 1%.
- Slipguard USD caps use 8 decimals (`100000000` = $1), from the contract's `_usd8` helper.
- Limitdesk prices are `tokenBuy` units per `1e18` `tokenSell` units (`...X18` fields).

## Sources

All descriptions come from the verified Solidity on Sourcify (exact match) for each official address, the ABIs in this repo's `abis/` folder, and the discovery files in `discovery/`.
