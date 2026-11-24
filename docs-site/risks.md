# Risks

Read this before you put money in any of the agent dapps.

## Prototype status

- This repo's README says: "The contracts are prototypes. Use small amounts."
- Eight of the ten main contracts say "prototype, not audited" in their verified source. Agent Revoke (`PanicRevoke`) and Prooflock have no such note, and no audit report is published for any of them.
- Some source comments reference fixes from internal reviews (for example "Audit 2026-11-23 H-01" in Limitdesk, "audit fix M-1" in Agentbond and Prooflock). These are notes in the code, not a published third-party audit.
- The verified sources contain no proxy or upgrade mechanism, so a bug cannot be patched in place. A fix means a new deployment.

## Owner and admin powers

| Dapp | Who has admin power | What they can do |
|---|---|---|
| Factory dapps (6) | The vault/desk owner (you) | Everything in your own vault: fund, withdraw, grant/revoke agents, set limits, pause. Nobody else, including the factory deployer, has power over your vault. |
| Prooflock | Contract owner (`0x65314045df96Fc6443739346E24F5bb02b0fECFa`, read on-chain 2026-11-24) | Set the protocol fee (max 5%, snapshotted per job) and fee recipient. Cannot move escrow. |
| Agentbond | No admin | Each bond's arbiter decides claims and can slash up to the full bond. |
| Calltab | No admin | Each tab's payer controls pause, agent key and close. |
| Agent Revoke | No admin | — |

## Agent permissions

- An agent can only call the narrow agent functions of each dapp. It cannot withdraw owner funds from any vault.
- In the borrowing dapps, an agent can send borrowed USDC to recipients. If the allowlist is off (Agent Credit Line, Stepped Agent Line with `allowlistEnabled = false`), it can send to **any** address. Aave Guard Vault always requires an allowlisted recipient.
- In Slipguard, the agent chooses the router calldata. Only allowlist routers you trust.
- In Calltab, the agent key can sign vouchers up to the remaining tab balance (subject to any period cap).
- A leaked agent key is the main risk. Use short expiries and low caps.

## Spending limits

Limits are set by the owner per agent and enforced on-chain. See each dapp page for the exact checks. There are no built-in default spending caps: the contracts enforce whatever values the owner sets, so a cap set too high is allowed. Calltab's period cap is optional (`0` = no cap).

## Revocation

- Owners (and guardians, where present) can revoke an agent at once with `revokeAgent`. Limitdesk revocation is owner-only.
- An agent can revoke itself with `renounceAgent()` in the dapps that have it.
- Revoking does **not** erase debt. Borrowed USDC must still be repaid.
- Calltab key rotation and pause only take effect after the tab's challenge window, by design.
- Agent Revoke only clears targets that were registered (or passed in). It cannot undo an EIP-7702 delegation, and Permit2 lockdown does not cancel already-signed SignatureTransfer permits.

## Market and oracle risk

- Aave Guard Vault positions can be liquidated by Aave if collateral value falls. That risk is the owner's.
- Circuit Vault exits depend on Aave liquidity; at full utilization a strategy may not exit right away.
- Slipguard and Limitdesk rely on Chainlink. Bad or stale prices make them revert; a mismatch between oracle and market can mean worse execution, bounded by the slippage or fill-discount settings.

## What the MCP will and will not do

The [Agent Dapps MCP](/mcp) in this repo:

- **Will** read on-chain state with `eth_call`, encode calldata for official contracts only, simulate it from your `from` address, and return an unsigned transaction or a clear revert reason.
- **Will** check that a vault or desk address was created by the official factory before building for it.
- **Will not** ask for, store or use private keys, seed phrases or API secrets. It has no key field.
- **Will not** sign or broadcast anything. You sign and send in your own wallet.
- **Will not** target other chains or contracts outside the ten dapps (and USDC approvals to them).
- **Will not** interpret memos, URIs, signatures or router calldata as instructions. They are passed through as opaque data.
- v1 has no owner tools (grant, fund, revoke, pause). Owners use the web pages.
- A successful simulation is not a guarantee. State can change between simulation and when you send.
