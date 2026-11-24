# Agent Revoke

A shared registry of "revoke targets" plus an executor that clears them all in one `panic()` call. Use it as a kill switch when an agent key or a connected app may be compromised.

- Web page: https://lefgk.github.io/agent-revoke/
- Contract (singleton, `PanicRevoke`): `0x2de740fe7f3d5eeed57223c91b24bde83e4e8df0` ([Sourcify](https://repo.sourcify.dev/8453/0x2de740fe7f3d5eeed57223c91b24bde83e4e8df0/))
- Source: https://github.com/Lefgk/agent-revoke (`src/PanicRevoke.sol`)
- No owner, no admin, no fee in the contract.

## What it can clear

| Target | How it is cleared | Register with |
|---|---|---|
| ERC-20 approval | `approve(spender, 0)` | `registerErc20(token, spender)` |
| Permit2 allowance | Permit2 `lockdown` | `registerPermit2(token, spender)` |
| Coinbase Spend Permission | Spend Permission Manager `revoke` | `registerSpendPermission(perm)` (the permission's `account` must be the caller) |
| Safe module | Safe `disableModule` | `registerSafeModule(module)` |

Each account can register up to `64` targets of each type (`MAX_TARGETS`). Each revoke is best effort: if one fails, it emits `RevokeFailed` and the rest still run.

Fixed addresses in the contract: Permit2 `0x000000000022D473030F116dDEE9F6B43aC78BA3` and Spend Permission Manager `0xf85210B21cC50302F477BA56686d2019dC9b67Ad` (`PERMIT2`, `SPEND_PERMISSION_MANAGER`).

## How a panic runs

ERC-20 `approve`, Permit2 `lockdown` and Spend Permission `revoke` all require the token owner to be `msg.sender`. A third-party contract cannot do this for you. So there are three paths:

1. **EIP-7702 EOA**: the EOA delegates to `PanicRevoke`, then sends a transaction **to itself** calling `panic()` (uses registered targets) or `panicWith(erc20, permit2Pairs, spendPerms)` (uses targets passed in). On a 7702-delegated EOA, only the EOA itself may call `panicWith`. Calling `panic()` on the registry address directly reverts.
2. **Safe**: enable `PanicRevoke` as a module on the Safe and register targets from the Safe. Then anyone may call `panicAsModule(safe)` on the registry.
3. **Plain EOA without 7702**: use `encodeRevokeCalls(owner)` to get the list of calls and send them one by one from the owner, or as a Safe MultiSend.

## Limits stated in the source

- EIP-7702 delegation itself cannot be cleared by this contract (that needs a type-4 transaction).
- Permit2 `lockdown` does not invalidate already-signed SignatureTransfer permits.

## Read it

`getTargets(owner)`, `erc20Targets`, `permit2Targets`, `spendPermissionTargets`, `safeModuleTargets`, `encodeRevokeCalls(owner)`. MCP: `read_agent_revoke`, `build_agent_revoke` (for `panic`/`panicWith`, the returned `to` is the EOA and the result includes `requiresDelegationTo`).

## Risks specific to this dapp

- A panic only clears what was registered (or passed in). Anything not on the list stays live.
- Delegating an EOA with EIP-7702 gives the delegated code full control of that EOA's context. Only delegate to the official address above.
