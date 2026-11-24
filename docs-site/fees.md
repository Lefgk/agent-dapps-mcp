# Fees

Only fees that exist in the verified contract source are listed. "On-chain" values were read with `eth_call` on 2026-11-24 and can change if the contract lets an owner change them.

| Dapp | Fee | Who sets it | Cap in code | Current value | Where it goes |
|---|---|---|---|---|---|
| Aave Guard Vault | None in the contract | — | — | — | — (Aave borrow interest applies) |
| Agent Credit Line | Flat fee on each borrow, added to the agent's debt (`feeBps`) | Each vault's owner | `1000` bps (10%), `MAX_FEE_BPS` | Per vault, starts at `0` | The owner's own vault, when repaid |
| Agent Revoke | None | — | — | — | — |
| Agentbond | None. Source: "No protocol fee" | — | — | — | — |
| Calltab | None. Source: "No protocol fee" | — | — | — | — |
| Circuit Vault | None in the contract | — | — | — | — |
| Limitdesk | None to the protocol. Owner-set filler discount (`fillDiscountBps`) | Each desk's owner | `1000` bps (10%), `MAX_FILL_DISCOUNT_BPS` | Per desk, starts at `100` (1%) | The filler, as a better price |
| Prooflock | Protocol fee on the provider's payout (`feeBps`) | Contract owner | `500` bps (5%), `MAX_FEE_BPS` | `0` (on-chain) | `feeRecipient()`, on-chain `0x65314045df96Fc6443739346E24F5bb02b0fECFa` |
| Slipguard | None in the contract | — | — | — | — (router fees may apply) |
| Stepped Agent Line | None. Source: "no interest, no fee" | — | — | — | — |

Notes:

- Prooflock snapshots `feeBps` onto each job when it is created, so later changes do not affect existing jobs.
- Agent Credit Line fee changes do not change existing debt; they apply to future borrows.
- The Agentbond claim deposit (`1000000` = 1 USDC on the official contract) is not a fee. It is refunded or added to the bond. See [Agentbond](/dapps/agentbond).
- Normal Base gas costs apply to every transaction.
- The MCP server charges nothing and is not involved in fees.
