# Aave Guard Vault

An owner-owned vault that supplies ETH/WETH (and optionally USDC) to Aave V3 as collateral. An authorized agent may borrow USDC from Aave to allowlisted recipients, within a per-transaction and per-period cap, and only if the vault's health factor stays above an owner-set floor after the borrow.

- Web page: https://lefgk.github.io/aave-guard-vault/
- Factory: `0xf1e8810c932c0cafe90932eef83e718784b0d8ec` ([Sourcify](https://repo.sourcify.dev/8453/0xf1e8810c932c0cafe90932eef83e718784b0d8ec/))
- Source: https://github.com/Lefgk/aave-guard-vault (`src/AaveGuardVault.sol`, `src/AaveGuardVaultFactory.sol`)
- Status in source: "PROTOTYPE - NOT AUDITED".

## How it works

1. The owner calls `createVault()` on the factory. The new vault is wired to Base's Aave V3 Pool, WETH, USDC and Aave variable-debt USDC token.
2. The owner supplies collateral: `supplyETH()` (wraps ETH), `wrapAndSupplyETH()`, or `supply(asset, amount)` for WETH or USDC.
3. The owner grants an agent with `grantAgent(agent, expiry)`, sets a budget with `setBudget(agent, perTxCap, periodCap, period)`, and allowlists recipients with `setRecipient(agent, recipient, true)`.
4. The agent calls `borrow(to, amount, memo)`. The vault borrows USDC at Aave's variable rate and sends it to `to`. The whole call reverts if the post-borrow health factor is below the floor.
5. Anyone can `repay(amount)`; `repayFor(agent, amount)` attributes the repayment to a specific agent.

The vault is the single Aave user. Per-agent `outstanding` tracks principal borrowed minus principal repaid. Aave interest accrues on the shared position.

## Agent actions

| Call | What it does |
|---|---|
| `borrow(to, amount, memo)` | Borrow USDC to an allowlisted `to`. Checks: agent active, not expired, budget set, per-tx cap, period cap, recipient allowlist, not paused, health factor ≥ floor afterward. |
| `repay(amount)` | Repay vault USDC debt. Reduces the caller's outstanding first if the caller is an agent. Works while paused. |
| `repayFor(agent, amount)` | Repay and attribute to `agent`. |
| `renounceAgent()` | Agent gives up its own rights. |

## Owner and guardian powers

- Owner: supply and withdraw collateral (withdraw reverts if it would push the health factor below the floor while there is debt; works while paused), grant/revoke agents, set budgets and recipients, set the health-factor floor, set a guardian, pause/unpause, transfer ownership (two-step).
- Guardian: `pause()` and `revokeAgent()` only.

## Limits in code

| Item | Value | Source |
|---|---|---|
| Default health-factor floor | `1.5e18` (1.5) | `DEFAULT_HF_FLOOR` |
| Minimum floor the owner can set | `1.1e18` (1.1) | `MIN_HF_FLOOR` |
| Borrow rate mode | Variable (`2`) | `VARIABLE` |
| Collateral assets accepted by `supply` | WETH, USDC | `supply()` |

Budget values (per-tx cap, period cap, period length) are set per agent by the owner. There are no defaults.

## Fees

No fee in the contract. Aave's own borrow interest applies to the vault's debt.

## Read it

`accountData()`, `healthFactorFloor()`, `usdcDebt()`, `agents(agent)`, `getBudget(agent)`, `borrowableNow(agent)`, `isRecipientAllowed(agent, recipient)`. MCP: `read_aave_guard_vault`, `build_aave_guard`.

## Risks specific to this dapp

- Liquidation risk is the owner's. The source says so directly. A health-factor floor protects against agent borrows pushing the position too far, but market moves can still bring the position to liquidation.
- `borrowableNow` does not account for Aave's available borrows or the floor; a borrow inside the caps can still revert.
