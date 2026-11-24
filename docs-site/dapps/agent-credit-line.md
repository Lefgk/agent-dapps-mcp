# Agent Credit Line

Owner-funded USDC credit lines for AI agent addresses. Each line has a max borrow, a borrow expiry, a repay-by due date, an optional destination allowlist, and a public repayment / default record. Fully owner-collateralized: no pooled lenders and no interest. The owner may set an optional flat fee.

- Web page: https://lefgk.github.io/agent-credit-line/
- Factory: `0x83b84f63517a382b4cafb9d7989b222b7d6bfe71` ([Sourcify](https://repo.sourcify.dev/8453/0x83b84f63517a382b4cafb9d7989b222b7d6bfe71/))
- Source: https://github.com/Lefgk/agent-credit-line (`src/AgentCreditVault.sol`, `src/AgentCreditVaultFactory.sol`)
- Status in source: "PROTOTYPE - NOT AUDITED. USDC only. Agents cannot make arbitrary calls."

## How it works

1. The owner calls `createVault()` and funds the vault with `deposit(amount)` (needs a USDC approve first).
2. The owner opens a line with `openLine(agent, maxBorrow, expiry, dueDate, allowlistEnabled)`. `dueDate` must be at or after `expiry`. If `allowlistEnabled`, recipients are set with `setRecipient`.
3. The agent calls `borrow(to, amount, memo)`. If a fee is set, it is added to the agent's debt.
4. Anyone may `repay(agent, amount)`. Fees owed are paid first, then principal. Overpayments are capped to what is owed.
5. If debt remains after `dueDate`, anyone may call `markDefault(agent)`. This blocks new borrows until the owner clears it with `clearDefault(agent)`, which is only possible once the line is fully repaid.

Each agent has a public record (`getRecord`): borrow, repay and default counts, total borrowed and repaid, and last default time.

## Agent actions

| Call | What it does |
|---|---|
| `borrow(to, amount, memo)` | Borrow USDC. Checks: line active, not defaulted, before `expiry` and `dueDate`, recipient allowed (if enabled), new debt (principal + fees + amount + fee) ≤ `maxBorrow`, vault has the USDC, not paused. |
| `repay(agent, amount)` | Anyone repays. Works while paused, after revoke and after default. |
| `markDefault(agent)` | Anyone, after `dueDate`, if debt remains. |
| `renounceAgent()` | Agent gives up borrowing rights. Debt remains. |

## Owner and guardian powers

- Owner: deposit/withdraw unused USDC (withdraw works while paused), open or update lines, set recipients, set the fee, set a guardian, pause/unpause, clear defaults after full repayment, transfer ownership (two-step).
- Guardian: `pause()` and `revokeAgent()` only. The source says it can "never open lines or withdraw".
- `revokeAgent` deactivates the line and wipes its allowlist. Outstanding debt and the public record remain.

## Fees

| Item | Value | Source |
|---|---|---|
| Flat borrow fee | `feeBps`, set by each vault's owner, default `0` | `feeBps`, `setFeeBps` |
| Maximum fee | `1000` bps (10%) | `MAX_FEE_BPS` |

The fee is `amount × feeBps / 10000`, added to the agent's debt on each borrow, and repaid into the owner's vault. Changing the fee does not change existing debt. `quote(amount)` returns the fee and debt delta. Each vault has its own fee; there is no protocol-wide fee or fee recipient.

## Read it

`getLine(agent)`, `getRecord(agent)`, `availableCredit(agent)`, `amountDue(agent)`, `liquidity()`, `feeBps()`, `quote(amount)`. MCP: `read_agent_credit_line`, `build_credit_line`.

## Risks specific to this dapp

- The owner bears all credit risk. A default is only a public flag; there is no collateral from the agent and no automatic recovery.
- The owner can raise the fee (up to 10%) at any time for future borrows.
