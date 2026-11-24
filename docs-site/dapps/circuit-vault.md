# Circuit Vault

A personal USDC vault. An authorized agent may move money only between cash and owner-whitelisted strategies, within per-strategy allocation caps. A high-water-mark drawdown breaker lets **anyone** call `trip()` once losses reach the owner's limit; that blocks the agent and can unwind everything to USDC.

- Web page: https://lefgk.github.io/circuit-vault/
- Factory: `0xd95fe751c8536f22334c1c8ddb56bbf7cbb150c0` ([Sourcify](https://repo.sourcify.dev/8453/0xd95fe751c8536f22334c1c8ddb56bbf7cbb150c0/))
- Source: https://github.com/Lefgk/circuit-vault (`src/CircuitVault.sol`, `src/CircuitVaultFactory.sol`, `src/AaveV3UsdcAdapter.sol`)
- Status in source: "PROTOTYPE - NOT AUDITED. v1 ships one Aave V3 USDC supply adapter. Not a public ERC-4626 fund. USDC only."

## How it works

1. The owner calls `createVault()` (default policy) or `createVaultWithPolicy(maxDrawdownBps, aaveCapBps)`. Each vault gets its own Aave V3 USDC adapter (`aaveStrategy()`), which supplies USDC to Aave and reports its aUSDC balance as value.
2. The owner deposits USDC with `deposit(amount)` and grants an agent with `grantAgent(agent, expiry)`.
3. The agent calls `rebalance(strategy, targetAssets)` to move one strategy toward a target USDC amount, using cash only.
4. The vault tracks a **high-water mark** (HWM). Deposits raise it; withdrawals scale it down pro rata; `checkpoint()` (anyone) raises it when value has grown.
5. If value falls to `maxDrawdownBps` below the HWM, anyone may call `trip()`. The vault is marked tripped, the agent is blocked, and if `autoExitOnTrip` is on (default on) every strategy is unwound to cash. The owner clears it with `resetTrip()`.

## Agent and public actions

| Call | Who | What it does |
|---|---|---|
| `rebalance(strategy, targetAssets)` | Agent | Move cash ↔ one allowed strategy. Reverts if paused, tripped, already past the drawdown limit, or if the strategy would exceed its cap. |
| `trip()` | Anyone | Fire the breaker when `canTrip()` is true. |
| `checkpoint()` | Anyone | Raise the HWM if value has grown. |

## Owner and guardian powers

- Owner: deposit/withdraw (from cash; works while paused or tripped), grant/revoke agents, add or update strategies (`setStrategy`), set max drawdown, toggle auto-exit, reset the breaker, pause/unpause, set a guardian, transfer ownership (two-step).
- Guardian: `pause()`, `revokeAgent()`, `exitStrategy(strategy)`, `exitAll()`.

## Limits in code

| Item | Value | Constant |
|---|---|---|
| Default max drawdown | `1000` bps (10%) | `DEFAULT_MAX_DRAWDOWN_BPS` |
| Default Aave allocation cap | `8000` bps (80%) | `DEFAULT_AAVE_CAP_BPS` |
| Smallest drawdown limit | `1` bp | `MIN_DRAWDOWN_BPS` |
| `autoExitOnTrip` at creation | `true` | constructor |

## Fees

No fee in the contract.

## Read it

`totalValue()`, `cash()`, `highWaterMark()`, `drawdownBps()`, `canTrip()`, `tripped()`, `strategies(s)`, `strategyAssets(s)`, `allocationBps(s)`, `agents(agent)`. MCP: `read_circuit_vault`, `build_circuit_vault`.

## Risks specific to this dapp

- The source warns that a strategy added by the owner is trusted: "a malicious adapter could pull funds". Only the built-in Aave adapter ships in v1.
- Aave can be at full utilization; then a strategy may not exit. The breaker still latches and other strategies still exit (best effort).
