# Calltab

Prepaid USDC tabs between a payer (or its agent key) and a service provider. The payer locks USDC and signs EIP-712 **cumulative** vouchers ("I owe you X in total so far"). The provider redeems only the unpaid difference. Closing uses a challenge window so the provider can submit a last voucher before the rest is refunded.

- Web page: https://lefgk.github.io/calltab/
- Contract (singleton): `0x289e7dcfa365f9cd74cf8f33b692279d2c8a0f6e` ([Sourcify](https://repo.sourcify.dev/8453/0x289e7dcfa365f9cd74cf8f33b692279d2c8a0f6e/))
- Source: https://github.com/Lefgk/calltab (`src/CallTab.sol`)
- Status in source: "Prototype, not audited. USDC-only. No protocol fee and no admin in v1."

## How it works

1. **Open**: the payer calls `openTab(provider, amount, periodCap, periodDuration, expiry, challengeWindow, agent, payerAgentId, providerAgentId)` after approving USDC.
   - `periodCap` limits how much can be redeemed per fixed window of `periodDuration`. Both must be `0` (no cap) or both non-zero.
   - `challengeWindow` must be between 1 hour and 7 days (`MIN_CHALLENGE_WINDOW`, `MAX_CHALLENGE_WINDOW`).
   - `agent` is an optional hot key allowed to sign vouchers. `address(0)` = payer only.
   - `expiry` is informational (UX); vouchers can still be redeemed until close is finalized.
   - The two ERC-8004 ids are metadata only.
2. **Use**: the payer or agent signs a voucher over `(tabId, cumulativeAmount, deadline)`. `hashVoucher` returns the digest to sign.
3. **Redeem**: the provider calls `redeem(tabId, cumulativeAmount, deadline, signature)`. It is paid `cumulativeAmount − alreadyClaimed`, never more than what is left. Lower or equal cumulative amounts revert (no replays). Exceeding the period cap reverts.
4. **Top up**: the payer calls `topUp(tabId, amount)`.
5. **Close**: the payer calls `initiateClose(tabId)`. The provider can still redeem during the challenge window. After it, anyone may `finalizeClose(tabId)` and the remainder goes back to the payer.

## Payer controls

- `pause(tabId)` blocks redeem, but only after one challenge window, so the provider can still cash vouchers it already holds. `unpause` lifts it.
- `setAgent(tabId, agent)` rotates the agent key. The old agent's vouchers stay valid for one challenge window. A second rotation must wait until that grace ends.

Signatures are checked with ECDSA recovery, so signers must be plain keys (EOAs).

## Fees

No protocol fee (stated in source).

## Read it

`getTab(tabId)`, `remaining(tabId)`, `tabsOfPayer(payer)`, `tabsOfProvider(provider)`, `hashVoucher(...)`, `domainSeparator()`. MCP: `read_calltab`, `build_calltab`.

## Risks specific to this dapp

- A leaked agent key can sign vouchers up to the full remaining balance (subject to any period cap). Keep tabs small, use `periodCap`, and rotate or pause quickly.
- A pause or close only takes effect after the challenge window, by design.
