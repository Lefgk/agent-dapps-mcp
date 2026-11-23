import { ActionProvider, type Action, type Network, type WalletProvider } from "@coinbase/agentkit";
import { DEFAULT_RPC_URL } from "../addresses.js";
import { createRpc, type Rpc } from "../rpc.js";
import { runTool, tools } from "../tools/index.js";

/**
 * Coinbase AgentKit action provider with the same tools as the MCP server.
 * Actions return JSON strings. They never use the wallet to sign or broadcast.
 */
export class AgentDappsActionProvider extends ActionProvider<WalletProvider> {
  private readonly rpc: Rpc;

  constructor(rpcUrl = DEFAULT_RPC_URL) {
    super("agent-dapps-mcp", []);
    this.rpc = createRpc(rpcUrl);
  }

  supportsNetwork(network: Network): boolean {
    if (network.protocolFamily !== "evm") return false;
    return network.chainId === "8453" || network.networkId === "base-mainnet" || network.networkId === "base";
  }

  override getActions(_walletProvider: WalletProvider): Action[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      // AgentKit types this as zod 3; runtime only needs parse-compatible schemas.
      schema: tool.inputSchema as unknown as Action["schema"],
      invoke: async (args) => {
        const result = await runTool(tool.name, args, this.rpc);
        return result.content[0]?.text ?? "";
      },
    }));
  }
}

export function agentDappsActionProvider(rpcUrl = DEFAULT_RPC_URL): AgentDappsActionProvider {
  return new AgentDappsActionProvider(rpcUrl);
}
