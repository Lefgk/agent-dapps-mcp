# FAQ

## Which network are these on?

Base mainnet, chain id 8453. There are no other official deployments listed in this repo.

## Are the contracts audited?

No published audit. Eight of the ten main contracts say "prototype, not audited" in their verified source, and the repo README says to use small amounts. See [Risks](/risks).

## How do I know an address is official?

Compare it with [Contract addresses](/addresses), the dapp's `llms.txt` on its web page, and Sourcify. For a vault or desk, check it appears in the official factory's `vaultsOf(owner)` or `desksOf(owner)`.

## Does anyone else control my vault?

No. A factory vault or desk is owned by the address that created it. The factories have no admin functions. You may add a guardian yourself, who can only pause and revoke (and, in Circuit Vault, unwind strategies).

## Can an agent withdraw my funds?

No dapp gives an agent a withdraw function. In the credit dapps an agent can borrow and send USDC to recipients, within its line and (if enabled) the allowlist. In Slipguard swap output stays in the vault. In Calltab the provider redeems what the payer or agent signed for.

## How do I stop an agent right now?

Call `revokeAgent(agent)` (owner, or guardian where the dapp has one) or `pause()`. In Calltab, the payer can `pause`, `setAgent` or `initiateClose`, which take effect after the challenge window. For approvals across apps, use [Agent Revoke](/dapps/agent-revoke).

## Does revoking an agent cancel its debt?

No. Debt in Aave Guard Vault, Agent Credit Line and Stepped Agent Line remains and can still be repaid by anyone.

## Are there fees?

Only two dapps have a fee setting: Agent Credit Line (per-vault, owner-set, max 10%, paid to the vault owner) and Prooflock (protocol fee, max 5%, currently 0 on-chain). See [Fees](/fees).

## Is there interest?

None of the contracts charge interest themselves. Aave Guard Vault borrows from Aave, so Aave's variable borrow interest applies to the vault's debt.

## Does the MCP need my private key?

No. It has no key field and never signs or broadcasts. It returns unsigned transactions for you to sign in your own wallet. See [For agents (MCP)](/mcp).

## Can the MCP manage my vault as owner?

Not in v1. Owner actions (grant, fund, revoke, pause) are done on each dapp's web page.

## Which tokens are supported?

USDC for the credit dapps, Circuit Vault, Agentbond, Calltab and Prooflock. WETH and USDC for Limitdesk and as Aave Guard Vault collateral (plus ETH, wrapped). Any ERC-20 the owner allowlists and sets a Chainlink feed for in Slipguard.

## Who do I contact?

lg.playstudio@gmail.com
