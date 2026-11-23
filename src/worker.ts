import { createMcpHandler } from "@modelcontextprotocol/server";
import { CONTACT, DEFAULT_RPC_URL, SERVER_NAME, VERSION } from "./addresses.js";
import { createMcpServer } from "./mcp/createServer.js";

export type Env = {
  BASE_RPC_URL?: string;
};

const LANDING = `<!doctype html>
<html lang="en">
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Agent Dapps MCP</title>
<body>
<h1>Agent Dapps MCP</h1>
<p>MCP server for ten agent dapps on Base. It reads on-chain state and returns unsigned transactions only. It never holds keys and never broadcasts.</p>
<p>Connect an MCP client to <code>/mcp</code> over Streamable HTTP. Local stdio: <code>npx agent-dapps-mcp</code>.</p>
<p>Contact: <a href="mailto:${CONTACT}">${CONTACT}</a></p>
</body>
</html>`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors() });
    }
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      const body = url.pathname === "/health"
        ? JSON.stringify({ ok: true, name: SERVER_NAME, version: VERSION, chainId: 8453 })
        : LANDING;
      const type = url.pathname === "/health" ? "application/json" : "text/html; charset=utf-8";
      return new Response(body, { status: 200, headers: { "content-type": type, ...cors() } });
    }
    const handler = createMcpHandler(() =>
      createMcpServer({ rpcUrl: env.BASE_RPC_URL || DEFAULT_RPC_URL }),
    );
    const response = await handler.fetch(request);
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(cors())) headers.set(k, v);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};

function cors(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type, mcp-session-id, mcp-protocol-version, accept",
  };
}
