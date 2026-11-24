# Slipguard

An owner-funded personal vault that gives an AI agent capped, time-limited swap rights. The agent may only call allowlisted routers with allowlisted tokens. Minimum output is enforced on-chain against a Chainlink mid price minus the agent's max slippage. Output stays in the vault. The agent cannot withdraw.

- Web page: https://lefgk.github.io/slipguard/
- Factory: `0x51e0ae4e704be5377fcec1d555d30baad065f161` ([Sourcify](https://repo.sourcify.dev/8453/0x51e0ae4e704be5377fcec1d555d30baad065f161/))
- Source: https://github.com/Lefgk/slipguard (`src/SlipGuardVault.sol`, `src/SlipGuardVaultFactory.sol`)
- Status in source: "PROTOTYPE - NOT AUDITED. ERC-20 swaps only (`executeSwap` never sends ETH)."

## How it works

1. The owner calls `createVault()` and deposits tokens with `deposit(token, amount)` (or sends ETH and calls `wrapETH()`).
2. The owner sets a Chainlink feed per token with `setFeed(token, aggregator, maxStale)`.
3. The owner grants an agent with `grantAgent(agent, expiry, maxSlippageBps, maxPerTxUsd, dailyCapUsd)`, then allowlists tokens (`setTokenAllowed`) and routers (`setRouterAllowed`) for that agent.
4. The agent calls `executeSwap(tokenIn, tokenOut, amountIn, router, data)`. The vault approves the router for exactly `amountIn`, calls it with `data`, clears the approval, then checks:
   - the vault received at least the oracle min-out of `tokenOut`,
   - no more than `amountIn` of `tokenIn` left the vault,
   - the vault's ETH balance did not drop.

USD caps are counted at the oracle price in 8 decimals. The daily cap window is fixed at 1 day (`PERIOD`).

## Agent and public actions

| Call | Who | What it does |
|---|---|---|
| `executeSwap(...)` | Agent | Capped, oracle-checked swap through an allowlisted router. |
| `wrapETH()` | Anyone | Wrap the vault's ETH to WETH. Funds stay in the vault. |
| `renounceAgent()` | Agent | Give up rights. |

## Owner and guardian powers

- Owner: deposit/withdraw ERC-20 and ETH (works while paused), unwrap WETH, set feeds, grant agents, update policy (`setPolicy`) without wiping allowlists, set token and router allowlists, toggle Permit2 mode, set a guardian, pause/unpause, transfer ownership (two-step).
- Guardian: `pause()` and `revokeAgent()` only.
- `setPermit2Enabled(true)` makes `executeSwap` also grant a one-shot Permit2 allowance to the router (needed for Uniswap Universal Router). Off by default.

## Limits in code

| Item | Value | Constant |
|---|---|---|
| Highest slippage an owner can grant | `2000` bps (20%) | `MAX_SLIPPAGE_BPS` |
| Spending window | 1 day | `PERIOD` |
| Sequencer grace | 1 hour | `SEQUENCER_GRACE` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | `PERMIT2` |
| Base sequencer uptime feed | `0xBCF85224fc0756B9Fa45aA7892530B47e10b6433` | `BASE_SEQUENCER_FEED` |

`maxPerTxUsd` must be non-zero and no more than `dailyCapUsd`.

## Fees

No fee in the contract. The router you call may charge its own fees.

## Read it

`agents(agent)`, `spendableUsdNow(agent)`, `isTokenAllowed`, `isRouterAllowed`, `feeds(token)`, `quoteUsd(token, amount)`, `previewMinOut(...)`, `permit2Enabled()`. MCP: `read_slipguard`, `build_slipguard`.

## Risks specific to this dapp

- Router calldata is opaque to the vault. Safety comes from the allowlists and the post-swap balance checks, so only allowlist routers you trust.
- Min-out is relative to Chainlink, not to the best market price. Within `maxSlippageBps` the agent can still trade badly.
- A wrong or stale feed set by the owner makes swaps revert (or, if wrong, mis-priced).
