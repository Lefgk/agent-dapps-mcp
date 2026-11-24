# TODOs for Lef

Things the docs could not verify from this repo, the verified source, the discovery files, or a read-only on-chain call.

1. **Audit status**: no audit report is in this repo. Source comments cite internal reviews ("Audit 2026-11-23 H-01/M-01", "audit fix M-1/M-3", "Audit H-1"). Is there a report to link, and should Agent Revoke and Prooflock also be labelled "prototype, not audited" like the other eight?
2. **Prooflock owner / fee recipient**: on-chain both are `0x65314045df96Fc6443739346E24F5bb02b0fECFa`. Confirm this is the intended admin (EOA or multisig?) and whether a non-zero `feeBps` is planned.
3. **Deployment dates / blocks**: not in this repo. Add if you want them on the addresses page.
4. **Example instances**: no example vault or desk addresses are committed. Add any public demo instances you want listed (they would be marked as examples, not official).
5. **npm install path**: the README's stdio config uses `npx -y agent-dapps-mcp`, but `agent-dapps-mcp` is not on npm (404 on 2026-11-24, and the README says it is not published). The docs say "run from a clone". Decide whether to publish or change the README config.
6. **Docs hosting**: where should this site live (GitHub Pages path, custom domain)? `base` in `.vitepress/config.mts` must match. No workflow was added.
7. **agent-spend-controls and agent-undo-wallet**: not referenced anywhere in this repo, so they are omitted. Say if they belong in these docs.
8. **Slipguard routers and feeds**: no recommended router or per-token Chainlink feed list is committed. Owners must set feeds themselves; add a recommended list if you have one.
9. **Contact email**: docs use `lg.playstudio@gmail.com` from `package.json` and the discovery files. Confirm it is the public contact.
