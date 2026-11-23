import { McpServer } from "@modelcontextprotocol/server";
import { SERVER_NAME, VERSION } from "../addresses.js";
import { createRpc, type Rpc } from "../rpc.js";
import { runTool, tools } from "../tools/index.js";

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
          readOnlyHint: tool.name.startsWith("read_") || tool.name === "list_dapps" || tool.name === "list_instances",
          destructiveHint: tool.name.startsWith("build_"),
          openWorldHint: true,
        },
      },
      async (args) => runTool(tool.name, args, rpc),
    );
  }
  return server;
}
