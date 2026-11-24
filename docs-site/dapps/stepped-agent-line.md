# Stepped Agent Line

Backer-funded USDC credit lines for AI agents. Each line starts at a starter cap and steps up by a fixed amount after every qualifying on-time full repayment, up to a max cap. A missed due date, after a short grace, lets anyone mark a public default and freeze the line. Other apps can read a public per-agent credit history.

- Web page: https://lefgk.github.io/stepped-agent-line/
- Factory: `0x859e44268fa1e787105d6295e7350edb3299801b` ([Sourcify](https://repo.sourcify.dev/8453/0x859e44268fa1e787105d6295e7350edb3299801b/))
- Source: https://github.com/Lefgk/stepped-agent-line (`src/SteppedAgentVault.sol`, `src/SteppedAgentVaultFactory.sol`)
- Status in source: "PROTOTYPE - NOT AUDITED. USDC only. Agents cannot make arbitrary calls." The source also says: "no pooled lenders, no interest, no fee."

## How it works

1. The backer (vault owner) calls `createVault()` and funds it with `deposit(amount)`.
2. The backer opens a line with `openLine(agent, starterCap, stepSize, maxCap, term, grace, allowlistEnabled)`.
3. The agent calls `borrow(to, amount, memo)`. The first borrow of a cycle starts the clock: `dueDate = now + term`.
4. Anyone may `repay(agent, amount)`. When the debt reaches zero:
   - **On time** (at or before `dueDate`, not frozen): the cap steps up by `stepSize` (never above `maxCap`) and the on-time count goes up, but **only if** the cycle's peak debt reached at least 50% of the current cap and at least one `term` has passed since the last step. Otherwise nothing changes.
   - **Late**: no step, and the late count goes up. No automatic default.
5. If debt remains after `dueDate + grace`, anyone may call `markDefault(agent)`. The line freezes and a default is recorded. The backer can `clearDefault(agent)` only after full repayment; the cap and tier then reset to the starter.

## Agent actions

| Call | What it does |
|---|---|
| `borrow(to, amount, memo)` | Borrow USDC up to `currentCap`. Checks: line active, not frozen, before `dueDate` (if set), recipient allowed (if enabled), vault has the USDC, not paused. |
| `repay(agent, amount)` | Anyone repays. Works while paused, after revoke and after a freeze. |
| `markDefault(agent)` | Anyone, after `dueDate + grace`, if debt remains. |
| `renounceAgent()` | Agent gives up borrowing rights. Debt remains. |

## Owner and guardian powers

- Backer (owner): deposit/withdraw unused USDC (works while paused), open or update lines, set recipients, set a guardian, pause/unpause, clear a default after full repayment, transfer ownership (two-step).
- Guardian: `pause()` and `revokeAgent()` only.
- `revokeAgent` deactivates the line and wipes its allowlist. Debt, cap progress and public history remain.

## Limits in code

| Item | Value | Constant |
|---|---|---|
| Term | 1 day to 365 days | `MIN_TERM`, `MAX_TERM` |
| Grace after due date | up to 14 days | `MAX_GRACE` |
| Minimum usage for a step | `5000` bps (50%) of the cap | `MIN_USAGE_BPS` |

## Fees

None. The source says "no interest, no fee".

## Read it

`getLine(agent)`, `getHistory(agent)`, `creditHistory(agent)` (public on-time count, defaults, tier and cap), `availableCredit(agent)`, `amountDue(agent)`, `liquidity()`. MCP: `read_stepped_agent_line`, `build_stepped_line`.

## Risks specific to this dapp

- The backer bears all credit risk. A default is a public flag and a freeze, not a recovery.
- Credit history is stored per vault. An agent's record in one backer's vault says nothing about other vaults.
