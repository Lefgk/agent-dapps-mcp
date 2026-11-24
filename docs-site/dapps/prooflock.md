# Prooflock

Permissionless USDC escrow for a single agent job. The client funds a job naming a provider, a deadline, an optional arbiter and an optional provider bond. The provider submits a deliverable hash and URI. Funds then release on client accept, auto-release after a review window if the client is silent, refund on a missed deadline, or an arbiter decision (a split is allowed).

- Web page: https://lefgk.github.io/prooflock/
- Contract (singleton): `0x139f45a0998a3378990f46a83f4f4de4af52975b` ([Sourcify](https://repo.sourcify.dev/8453/0x139f45a0998a3378990f46a83f4f4de4af52975b/))
- Source: https://github.com/Lefgk/prooflock (`src/Prooflock.sol`)

## How it works

1. **Create**: the client calls `createJob(p)` after approving USDC. `p` contains `provider`, `arbiter` (optional), `amount`, `deadline`, `reviewWindow`, `bondRequired` (optional), two optional ERC-8004 ids and a `metadataURI`. The USDC is pulled at once.
2. **Bond** (if required): the provider calls `postBond(id)` before the deadline.
3. **Deliver**: the provider calls `deliver(id, deliverableHash, deliverableURI)` before the deadline. The review deadline is set to now + `reviewWindow`.
4. **Settle**, one of:
   - `accept(id)`: client releases the escrow to the provider.
   - `autoRelease(id)`: anyone, after the review window, if there is no dispute.
   - `refund(id)`: anyone, after the deadline, if nothing was delivered. A posted bond goes back to the provider.
   - `dispute(id)`: client, during the review window, only if an arbiter was named. Then the arbiter calls `resolve(id, providerPayout, slashBond)`, choosing any split and whether the bond goes to the client.
   - `resolveStaleDispute(id)`: anyone, if the arbiter has not resolved within 30 days after the review deadline. The escrow splits 50/50 (odd unit to the client) and the bond goes back to the provider.

## Limits in code

| Item | Value | Constant |
|---|---|---|
| Deadline at least | 1 hour from creation | `MIN_DEADLINE_LEAD` |
| Deadline at most | 180 days from creation | `MAX_JOB_DURATION` |
| Review window | 1 hour to 30 days | `MIN_REVIEW_WINDOW`, `MAX_REVIEW_WINDOW` |
| Stale-dispute timeout | 30 days after review deadline | `DISPUTE_TIMEOUT` |

The client, provider and arbiter must all be different addresses.

## Fees

| Item | Value | Source |
|---|---|---|
| Protocol fee | `feeBps`, set by the contract owner. Source comment: "default 0". | `feeBps`, `setFeeBps` |
| Maximum fee | `500` bps (5%) | `MAX_FEE_BPS` |
| Current fee | `0` bps | `feeBps()` read on-chain 2026-11-24 |
| Fee recipient | `0x65314045df96Fc6443739346E24F5bb02b0fECFa` | `feeRecipient()` read on-chain 2026-11-24 |

The fee is taken only from the provider's payout at settlement: `fee = providerPayout × feeBps / 10000`. The fee rate is **snapshotted onto each job at creation**, so a later change does not affect existing jobs.

## Owner powers

The contract has an owner (`Ownable2Step`). Read on-chain on 2026-11-24: `owner()` = `0x65314045df96Fc6443739346E24F5bb02b0fECFa`. The owner can only `setFeeBps` (up to 5%), `setFeeRecipient`, and transfer ownership. There is no owner function to move escrowed funds or change a job.

## Read it

`jobs(id)`, `jobsOf(user)`, `nextJobId()`, `feeBps()`, `feeRecipient()`, `totalLocked()`. MCP: `read_prooflock`, `build_prooflock`.

## Risks specific to this dapp

- With no arbiter, the client cannot dispute: silence after delivery means auto-release to the provider.
- The arbiter fully controls the split in a dispute.
- `metadataURI` and `deliverableURI` are free text. The contract does not check them.
