# All dapps

| Dapp | Kind | Official contract on Base | Web page |
|---|---|---|---|
| [Aave Guard Vault](./aave-guard-vault) | Factory | `0xf1e8810c932c0cafe90932eef83e718784b0d8ec` | https://lefgk.github.io/aave-guard-vault/ |
| [Agent Credit Line](./agent-credit-line) | Factory | `0x83b84f63517a382b4cafb9d7989b222b7d6bfe71` | https://lefgk.github.io/agent-credit-line/ |
| [Agent Revoke](./agent-revoke) | Singleton | `0x2de740fe7f3d5eeed57223c91b24bde83e4e8df0` | https://lefgk.github.io/agent-revoke/ |
| [Agentbond](./agentbond) | Singleton | `0x7ef3b4c827190d6c8a66bc60a99ae7da4a49c417` | https://lefgk.github.io/agentbond/ |
| [Calltab](./calltab) | Singleton | `0x289e7dcfa365f9cd74cf8f33b692279d2c8a0f6e` | https://lefgk.github.io/calltab/ |
| [Circuit Vault](./circuit-vault) | Factory | `0xd95fe751c8536f22334c1c8ddb56bbf7cbb150c0` | https://lefgk.github.io/circuit-vault/ |
| [Limitdesk](./limitdesk) | Factory | `0xd1e6959ee4c1b077934a0d6bfcdbf3ffb527b8ab` | https://lefgk.github.io/limitdesk/ |
| [Prooflock](./prooflock) | Singleton | `0x139f45a0998a3378990f46a83f4f4de4af52975b` | https://lefgk.github.io/prooflock/ |
| [Slipguard](./slipguard) | Factory | `0x51e0ae4e704be5377fcec1d555d30baad065f161` | https://lefgk.github.io/slipguard/ |
| [Stepped Agent Line](./stepped-agent-line) | Factory | `0x859e44268fa1e787105d6295e7350edb3299801b` | https://lefgk.github.io/stepped-agent-line/ |

Addresses come from `discovery/<dapp>/llms.txt` and `src/addresses.ts` in this repo. Each is verified (exact match) on Sourcify. Source repos are at `https://github.com/Lefgk/<dapp>`.

Pick by job:

- **Let an agent borrow USDC**: [Agent Credit Line](./agent-credit-line) (fixed line), [Stepped Agent Line](./stepped-agent-line) (line that grows with on-time repayment), or [Aave Guard Vault](./aave-guard-vault) (borrow from Aave against your collateral).
- **Let an agent trade**: [Slipguard](./slipguard) (swaps through routers) or [Limitdesk](./limitdesk) (signed limit and stop orders).
- **Let an agent manage idle USDC**: [Circuit Vault](./circuit-vault).
- **Pay or get paid for agent work**: [Calltab](./calltab) (metered, voucher-based) or [Prooflock](./prooflock) (one job, escrowed).
- **Back an agent with collateral others can claim**: [Agentbond](./agentbond).
- **Kill switch for approvals**: [Agent Revoke](./agent-revoke).
