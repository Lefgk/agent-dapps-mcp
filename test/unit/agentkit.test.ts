import { describe, expect, it } from "vitest";
import { agentDappsActionProvider } from "../../src/agentkit/provider.js";
import { tools } from "../../src/tools/index.js";

describe("AgentKit provider", () => {
  it("exposes the same tool names and only supports Base", () => {
    const provider = agentDappsActionProvider();
    expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "8453" })).toBe(true);
    expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "1" })).toBe(false);
    const actions = provider.getActions({} as never);
    expect(actions.map((a) => a.name).sort()).toEqual(tools.map((t) => t.name).sort());
  });
});
