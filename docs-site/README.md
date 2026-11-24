# Agent Dapps docs site

Public docs for the ten Base agent dapps, built with [VitePress](https://vitepress.dev). This folder is separate from the MCP package; nothing here changes the server or the Worker.

## Run locally

```bash
cd docs-site
npm install
npm run dev      # live preview
npm run build    # static build into .vitepress/dist
npm run preview  # serve the built site
```

## Sources

Everything on the site comes from one of:

- `../discovery/<dapp>/llms.txt` and `../discovery/<dapp>/.well-known/ai-catalog.json` (official addresses)
- `../src/addresses.ts` and `../src/tools/*.ts` (MCP behaviour, tool names)
- `../abis/*.abi.json` (function names)
- Verified Solidity on Sourcify for each official address (exact match), fetched 2026-11-24
- Read-only `eth_call` on Base mainnet on 2026-11-24 for values marked "read on-chain"

Open questions for Lef are in [TODOs.md](./TODOs.md).

## Not done here

No publish workflow. The site is not deployed anywhere. If it is published under a sub-path (for example GitHub Pages), set `base` in `.vitepress/config.mts`.
