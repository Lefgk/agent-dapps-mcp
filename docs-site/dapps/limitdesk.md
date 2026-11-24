# Limitdesk

A per-owner, self-custodial order book. The owner escrows WETH and USDC. An authorized agent signs EIP-712 limit or stop orders within caps. Anyone may fill an order if the Chainlink price condition and expiry still hold.

- Web page: https://lefgk.github.io/limitdesk/
- Factory: `0xd1e6959ee4c1b077934a0d6bfcdbf3ffb527b8ab` ([Sourcify](https://repo.sourcify.dev/8453/0xd1e6959ee4c1b077934a0d6bfcdbf3ffb527b8ab/))
- Source: https://github.com/Lefgk/limitdesk (`src/LimitDesk.sol`, `src/LimitDeskFactory.sol`)
- Status in source: "PROTOTYPE - NOT AUDITED. WETH and USDC only. No native ETH. No partial fills."

## How it works

1. The owner calls `createDesk()` on the factory, then `deposit(token, amount)` for WETH or USDC.
2. The owner grants an agent with `grantAgent(agent, expiry)` and sets a per-token sell cap with `setCap(agent, token, maxOpenSell)`.
3. The agent signs an `Order` off-chain: `agent, tokenSell, tokenBuy, amountSell, limitPriceX18, stopTriggerX18, expiry, nonce, orderType (Limit or Stop), epoch`.
4. Anyone with the signature calls `post(order, signature)`. This checks the signature, cap and escrow, and locks `amountSell`.
5. Anyone calls `fill(orderId)`. The filler pays `tokenBuy` and receives `tokenSell`. Full fill only.

## Fill price

- **Limit**: fills when the oracle price is at or better than the limit, at `max(limit, oracle × (1 − fillDiscountBps))`.
- **Stop**: fills once the oracle is at or below the trigger. With a limit, the oracle must stay at or above the limit and the same bounded price applies; without one, it fills at the oracle price.

Prices come from Chainlink ETH/USD and USDC/USD feeds. The desk refuses stale prices (ETH feed older than 2 hours, USDC feed older than 25 hours) and refuses to price while the Base sequencer is down or within 1 hour of restarting.

## Agent and public actions

| Call | Who | What it does |
|---|---|---|
| `post(order, signature)` | Anyone holding a valid agent signature | Register and lock the order. |
| `fill(orderId)` | Anyone | Fill at the bounded price if conditions hold. |
| `cancel(orderId)` | Owner or the order's agent | Cancel and unlock. |
| `invalidateNonce(agent, nonce)` | Owner or that agent | Burn a nonce so a signed order can never be posted. |
| `renounceAgent()` | Agent | Give up rights. |

## Owner powers

Deposit/withdraw unlocked escrow and fill proceeds (works while paused), grant/revoke agents, set caps, set `fillDiscountBps`, pause/unpause, transfer ownership (two-step). There is **no guardian**. `revokeAgent` cancels every open order of the agent and bumps its epoch so older signatures cannot be posted.

## Limits in code

| Item | Value | Constant |
|---|---|---|
| Max open orders per agent | `32` | `MAX_OPEN_PER_AGENT` |
| Cap window (open + filled sell volume per token) | 1 day | `CAP_WINDOW` |
| Default fill discount | `100` bps (1%) | `fillDiscountBps` initial value |
| Max fill discount | `1000` bps (10%) | `MAX_FILL_DISCOUNT_BPS` |
| ETH/USD staleness limit | 2 hours | `ETH_HEARTBEAT` |
| USDC/USD staleness limit | 25 hours | `STABLE_HEARTBEAT` |
| Sequencer grace | 1 hour | `SEQUENCER_GRACE` |

## Fees

No protocol fee. `fillDiscountBps` is not a fee to the protocol: it is the most a filler may gain versus the oracle price, paid by the desk owner as worse execution.

## Read it

`getOrder(id)`, `openOrders()`, `openOrdersOf(agent)`, `quoteFill(id)`, `oraclePriceX18(sell, buy)`, `available(token)`, `capOf`, `openSellOf`, `filledInWindowOf`, `nonceUsed`, `hashOrder(order)`. MCP: `read_limitdesk`, `build_limitdesk`.

## Risks specific to this dapp

- Fills happen at an oracle-derived price, not a market price. If Chainlink and the market differ, fillers profit at the owner's expense (bounded by the fill discount).
- Anyone can post a validly signed order. Use `invalidateNonce` or revoke to kill signatures you no longer want.
