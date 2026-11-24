# Contract addresses

All contracts are on **Base mainnet, chain id 8453**. Always check an address against this page, the dapp's own `llms.txt`, and Sourcify before sending funds.

## Official dapp contracts

These are the official factory and singleton addresses. Sources: `discovery/<dapp>/llms.txt` and `discovery/<dapp>/.well-known/ai-catalog.json` (each says "Official Base factory contract" or "Official Base singleton contract"), and `src/addresses.ts`. All ten are verified on Sourcify as an exact match.

| Dapp | Kind | Address | Verified source |
|---|---|---|---|
| Aave Guard Vault | Factory (`AaveGuardVaultFactory`) | `0xf1e8810c932c0cafe90932eef83e718784b0d8ec` | [Sourcify](https://repo.sourcify.dev/8453/0xf1e8810c932c0cafe90932eef83e718784b0d8ec/) |
| Agent Credit Line | Factory (`AgentCreditVaultFactory`) | `0x83b84f63517a382b4cafb9d7989b222b7d6bfe71` | [Sourcify](https://repo.sourcify.dev/8453/0x83b84f63517a382b4cafb9d7989b222b7d6bfe71/) |
| Agent Revoke | Singleton (`PanicRevoke`) | `0x2de740fe7f3d5eeed57223c91b24bde83e4e8df0` | [Sourcify](https://repo.sourcify.dev/8453/0x2de740fe7f3d5eeed57223c91b24bde83e4e8df0/) |
| Agentbond | Singleton (`AgentBond`) | `0x7ef3b4c827190d6c8a66bc60a99ae7da4a49c417` | [Sourcify](https://repo.sourcify.dev/8453/0x7ef3b4c827190d6c8a66bc60a99ae7da4a49c417/) |
| Calltab | Singleton (`CallTab`) | `0x289e7dcfa365f9cd74cf8f33b692279d2c8a0f6e` | [Sourcify](https://repo.sourcify.dev/8453/0x289e7dcfa365f9cd74cf8f33b692279d2c8a0f6e/) |
| Circuit Vault | Factory (`CircuitVaultFactory`) | `0xd95fe751c8536f22334c1c8ddb56bbf7cbb150c0` | [Sourcify](https://repo.sourcify.dev/8453/0xd95fe751c8536f22334c1c8ddb56bbf7cbb150c0/) |
| Limitdesk | Factory (`LimitDeskFactory`) | `0xd1e6959ee4c1b077934a0d6bfcdbf3ffb527b8ab` | [Sourcify](https://repo.sourcify.dev/8453/0xd1e6959ee4c1b077934a0d6bfcdbf3ffb527b8ab/) |
| Prooflock | Singleton (`Prooflock`) | `0x139f45a0998a3378990f46a83f4f4de4af52975b` | [Sourcify](https://repo.sourcify.dev/8453/0x139f45a0998a3378990f46a83f4f4de4af52975b/) |
| Slipguard | Factory (`SlipGuardVaultFactory`) | `0x51e0ae4e704be5377fcec1d555d30baad065f161` | [Sourcify](https://repo.sourcify.dev/8453/0x51e0ae4e704be5377fcec1d555d30baad065f161/) |
| Stepped Agent Line | Factory (`SteppedAgentVaultFactory`) | `0x859e44268fa1e787105d6295e7350edb3299801b` | [Sourcify](https://repo.sourcify.dev/8453/0x859e44268fa1e787105d6295e7350edb3299801b/) |

Basescan: `https://basescan.org/address/<address>` (linked from each `llms.txt`).

## Your own vaults and desks (instances)

Factory dapps do not have one shared vault. Each owner gets their own instance from `createVault()` / `createDesk()`. To find yours, call on the factory:

- `vaultsOf(owner)` for Aave Guard Vault, Agent Credit Line, Circuit Vault, Slipguard, Stepped Agent Line
- `desksOf(owner)` for Limitdesk

An address is an official instance only if it appears in the official factory's list for its `owner()`. The MCP checks exactly this before building any vault or desk transaction (`assertFactoryInstance` in `src/tools/common.ts`).

This repo does not publish any example instance addresses. Addresses such as `0x1111…` in the tests are placeholders, not real contracts.

## External contracts the dapps are wired to

Read on-chain on 2026-11-24 with `eth_call` (the factories expose them as `immutable` getters), or taken from constants in the verified source. USDC, WETH and the Aave Pool also appear in `src/addresses.ts`.

| What | Address | Where it comes from |
|---|---|---|
| USDC (Circle) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `src/addresses.ts`; `usdc()` on every factory and singleton that uses USDC |
| WETH | `0x4200000000000000000000000000000000000006` | `src/addresses.ts`; `weth()` on Aave Guard Vault, Limitdesk and Slipguard factories |
| Aave V3 Pool | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` | `src/addresses.ts`; `pool()` on Aave Guard Vault and Circuit Vault factories |
| Aave variable-debt USDC | `0x59dca05b6c26dbd64b5381374aAaC5CD05644C28` | `variableDebtUsdc()` on the Aave Guard Vault factory |
| Aave aUSDC | `0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB` | `aToken()` on the Circuit Vault factory |
| Chainlink ETH/USD | `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70` | `ethUsdFeed()` on the Limitdesk factory |
| Chainlink USDC/USD | `0x7e860098F58bBFC8648a4311b374B1D669a2bc6B` | `usdcUsdFeed()` on the Limitdesk factory |
| Chainlink Base sequencer uptime feed | `0xBCF85224fc0756B9Fa45aA7892530B47e10b6433` | `BASE_SEQUENCER_FEED` constant in Limitdesk and Slipguard |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | `PERMIT2` constant in PanicRevoke and Slipguard |
| Coinbase Spend Permission Manager | `0xf85210B21cC50302F477BA56686d2019dC9b67Ad` | `SPEND_PERMISSION_MANAGER` constant in PanicRevoke |
| ERC-8004 identity registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | `identityRegistry()` on Agentbond |

Slipguard price feeds are not fixed: each vault owner sets them per token with `setFeed`.

## Admin addresses

| Contract | Role | Address | Source |
|---|---|---|---|
| Prooflock | `owner()` and `feeRecipient()` | `0x65314045df96Fc6443739346E24F5bb02b0fECFa` | Read on-chain 2026-11-24 |

The other singletons (Agent Revoke, Agentbond, Calltab) have no owner or admin in their source. Factory instances are owned by whoever created them.
