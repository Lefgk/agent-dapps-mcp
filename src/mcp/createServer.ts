import { McpServer } from "@modelcontextprotocol/server";
import { SERVER_NAME, VERSION } from "../addresses.js";
import { createRpc, type Rpc } from "../rpc.js";
import { runTool, tools } from "../tools/index.js";
import { toolKind } from "../tools/meta.js";

export type ServerOptions = {
  rpcUrl?: string;
  rpc?: Rpc;
};

export function createMcpServer(options: ServerOptions = {}): McpServer {
  const rpc = options.rpc ?? createRpc(options.rpcUrl);
  const server = new McpServer({
    name: SERVER_NAME,
    version: VERSION,
    title: "Agent Dapps MCP",
  });
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: {
          // Nothing here changes chain state; build_* only return unsigned txs that a wallet may later send.
          readOnlyHint: toolKind(tool.name) !== "build",
          destructiveHint: toolKind(tool.name) === "build",
          openWorldHint: true,
        },
      },
      async (args) => runTool(tool.name, args, rpc),
    );
  }
  return server;
}
