# Agentbond

Public USDC surety bonds for agents. A bond is keyed to an ERC-8004 agent id (or a plain address). An operator posts coverage and names an arbiter. Anyone harmed by the agent can file an evidence-backed claim. The arbiter may slash up to the remaining bond to the claimant.

- Web page: https://lefgk.github.io/agentbond/
- Contract (singleton): `0x7ef3b4c827190d6c8a66bc60a99ae7da4a49c417` ([Sourcify](https://repo.sourcify.dev/8453/0x7ef3b4c827190d6c8a66bc60a99ae7da4a49c417/))
- Source: https://github.com/Lefgk/agentbond (`src/AgentBond.sol`)
- Status in source: "Prototype, not audited. USDC-only. No protocol fee and no admin in v1."

## How it works

1. **Post a bond**: `depositForAgent(agentId, arbiter, amount)` for a live ERC-8004 agent id, or `depositForAccount(account, arbiter, amount)` for a plain address. The first deposit names the arbiter. Anyone may top up.
2. **File a claim**: anyone except the arbiter and the bond's controller calls `fileClaim(key, amount, evidenceURI)`. The claimant escrows a claim deposit (see below). The evidence URI must be 1–512 characters (`MAX_URI_LENGTH`).
3. **Resolve**: the arbiter calls `resolveClaim(claimId, slashAmount, reasonHash)`.
   - `slashAmount = 0` rejects the claim; the claim deposit is added to the bond.
   - Otherwise the claimant gets `slashAmount` (capped at the requested amount and the remaining bond) plus their deposit back. The slash is recorded in a public history.
4. **Cancel or expire**: the claimant may `cancelClaim` (the deposit goes to the bond). Anyone may `expireClaim` after the claim timeout (the deposit is refunded).
5. **Withdraw**: the controller calls `requestWithdraw(key, amount)`, waits the cooldown, then `withdraw(key)`. Both are blocked while any claim is open.

**Controller** = the ERC-8004 owner of the agent id or its agent wallet (for agent bonds), or the account itself (for address bonds). Only the owner (not the agent wallet) can change the arbiter.

**Arbiter changes** are queued with `setArbiter(key, newArbiter)` and finalized with `applyArbiter(key)` after the withdraw cooldown, and only when no claims are open.

## Settings on the official contract

These are constructor values, fixed for this deployment (`immutable`). Read on-chain on 2026-11-24 with `eth_call`.

| Setting | Raw value | Meaning |
|---|---|---|
| `withdrawCooldown()` | `604800` | 7 days. Also the arbiter-change delay. |
| `claimTimeout()` | `1209600` | 14 days after a claim is filed, anyone may expire it. |
| `claimDeposit()` | `1000000` | 1 USDC escrowed per claim. |
| `identityRegistry()` | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | ERC-8004 identity registry used for agent-id bonds. |
| `usdc()` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | USDC on Base. |

## Fees

No protocol fee (stated in source). The claim deposit is not a fee: it is refunded on a slash or expiry, or added to the bond on a rejection or cancel.

## Read it

`coverageOf(key)`, `coverageOfAgent(agentId)`, `coverageOfAccount(account)`, `getBond(key)`, `getClaim(claimId)`, `claimIds(key)`, `slashHistory(key)`, `keyOfAgent`, `keyOfAccount`. MCP: `read_agentbond`, `build_agentbond`.

## Risks specific to this dapp

- The arbiter decides every claim. Choose one you trust; a bad arbiter can slash the full bond to any claimant.
- A bond only covers what is in it. Coverage drops as claims are paid.
