import { defineConfig } from "vitepress";

const dapps = [
  ["Aave Guard Vault", "aave-guard-vault"],
  ["Agent Credit Line", "agent-credit-line"],
  ["Agent Revoke", "agent-revoke"],
  ["Agentbond", "agentbond"],
  ["Calltab", "calltab"],
  ["Circuit Vault", "circuit-vault"],
  ["Limitdesk", "limitdesk"],
  ["Prooflock", "prooflock"],
  ["Slipguard", "slipguard"],
  ["Stepped Agent Line", "stepped-agent-line"],
];

export default defineConfig({
  title: "Agent Dapps on Base",
  description: "Docs for ten AI-agent contracts on Base (chain id 8453).",
  // README.md and TODOs.md are for maintainers, not site pages.
  srcExclude: ["README.md", "TODOs.md"],
  cleanUrls: true,
  lastUpdated: false,
  themeConfig: {
    nav: [
      { text: "Overview", link: "/" },
      { text: "Dapps", link: "/dapps/" },
      { text: "Addresses", link: "/addresses" },
      { text: "For agents (MCP)", link: "/mcp" },
    ],
    sidebar: [
      {
        text: "Start here",
        items: [
          { text: "Overview", link: "/" },
          { text: "How the dapps work", link: "/concepts" },
        ],
      },
      {
        text: "Dapps",
        items: [
          { text: "All dapps", link: "/dapps/" },
          ...dapps.map(([text, id]) => ({ text, link: `/dapps/${id}` })),
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Contract addresses", link: "/addresses" },
          { text: "Fees", link: "/fees" },
          { text: "Risks", link: "/risks" },
          { text: "For agents (MCP)", link: "/mcp" },
          { text: "FAQ", link: "/faq" },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/Lefgk/agent-dapps-mcp" }],
    search: { provider: "local" },
    footer: {
      message: "Prototype contracts, not audited. Use small amounts.",
    },
  },
});
