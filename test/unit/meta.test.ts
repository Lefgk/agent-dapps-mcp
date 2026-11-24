import { encodeFunctionData, getAddress, maxUint256, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { DAPPS, USDC } from "../../src/addresses.js";
import { erc20Abi } from "../../src/generated/abis.js";
import { SCOPE } from "../../src/format.js";
import { createMcpServer } from "../../src/mcp/createServer.js";
import { EXAMPLES } from "../../src/tools/catalog.js";
import { instanceAbi } from "../../src/tools/common.js";
import { runTool, tools } from "../../src/tools/index.js";
import type { Rpc } from "../../src/rpc.js";
import { mockRpc } from "./mockRpc.js";

const EOA = getAddress("0x1111111111111111111111111111111111111111") as Address;
const OTHER = getAddress("0x2222222222222222222222222222222222222222") as Address;
const VAULT = getAddress("0x3333333333333333333333333333333333333333") as Address;
const CREDIT_FACTORY = DAPPS["agent-credit-line"].address;

async function call(name: string, args: unknown, rpc: Rpc = {} as Rpc) {
  const r = await runTool(name, args, rpc);
  return { isError: r.isError === true, text: r.content[0]!.text, json: () => JSON.parse(r.content[0]!.text) };
}

/** A credit-line vault VAULT owned by EOA, registered on the official factory. */
function creditVaultRpc(extra: Record<string, unknown> = {}, opts: Parameters<typeof mockRpc>[1] = {}) {
  return mockRpc(
    {
      [`${VAULT}.owner`]: EOA,
      [`${CREDIT_FACTORY}.vaultsOf`]: [VAULT],
      "*.vaultsOf": [],
      "*.desksOf": [],
      ...extra,
    },
    opts,
  );
}

describe("describe_tools", () => {
  it("lists every tool with a short description, required fields and an example", async () => {
    const r = await call("describe_tools", {});
    expect(r.isError).toBe(false);
    const body = r.json();
    expect(body.chainId).toBe(8453);
    expect(body.tools.map((t: { name: string }) => t.name).sort()).toEqual(tools.map((t) => t.name).sort());
    for (const t of body.tools) {
      expect(t.description.length, t.name).toBeGreaterThan(10);
      expect(t.description).not.toContain(SCOPE);
      expect(t.example, `${t.name} has no example`).toBeDefined();
    }
    const credit = body.tools.find((t: { name: string }) => t.name === "build_credit_line");
    expect(credit.required).toEqual(expect.arrayContaining(["from", "vault", "action"]));
    expect(credit.actions.borrow).toEqual(["to", "amount"]);
  });

  it("every catalog example passes its tool's schema", () => {
    for (const tool of tools) {
      const examples = EXAMPLES[tool.name];
      expect(examples?.length, `${tool.name} needs an example`).toBeGreaterThan(0);
      for (const e of examples!) {
        const parsed = tool.inputSchema.safeParse(e.args);
        expect(parsed.success, `${tool.name} example ${JSON.stringify(e.args)}: ${parsed.error?.message}`).toBe(true);
      }
    }
    for (const name of Object.keys(EXAMPLES)) expect(tools.some((t) => t.name === name), name).toBe(true);
  });

  it("returns full detail for one tool", async () => {
    const body = (await call("describe_tools", { tool: "build_calltab" })).json();
    expect(body.kind).toBe("build");
    expect(body.properties.amount.description).toMatch(/base units/);
    expect(body.properties.from.pattern).toBeDefined();
    expect(body.actions.redeem.required).toEqual(["tabId", "cumulativeAmount", "deadline", "signature"]);
    expect(body.examples[0].tool).toBe("build_calltab");
  });

  it("suggests close names for an unknown tool", async () => {
    const r = await call("describe_tools", { tool: "build_calltabs" });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/Did you mean: .*build_calltab/);
  });

  it("registers all tools on the MCP server", () => {
    expect(() => createMcpServer({ rpc: {} as Rpc })).not.toThrow();
  });
});

describe("find_dapp", () => {
  it("finds a dapp by exact id or title", async () => {
    const body = (await call("find_dapp", { query: "Agent Credit Line" })).json();
    expect(body.match).toBe("name");
    expect(body.dapps).toHaveLength(1);
    expect(body.dapps[0].tools).toEqual({ read: "read_agent_credit_line", build: "build_credit_line" });
  });

  it("finds dapps by keyword", async () => {
    const body = (await call("find_dapp", { query: "escrow" })).json();
    expect(body.match).toBe("keyword");
    expect(body.dapps.map((d: { id: string }) => d.id)).toContain("prooflock");
  });

  it("identifies singleton, factory and USDC addresses without RPC", async () => {
    expect((await call("find_dapp", { query: DAPPS.calltab.address.toLowerCase() })).json().match).toBe("singleton");
    expect((await call("find_dapp", { query: CREDIT_FACTORY })).json().match).toBe("factory");
    expect((await call("find_dapp", { query: USDC })).json().match).toBe("usdc");
  });

  it("identifies an official factory instance on-chain", async () => {
    const body = (await call("find_dapp", { query: VAULT }, creditVaultRpc())).json();
    expect(body.match).toBe("instance");
    expect(body.owner).toBe(EOA);
    expect(body.dapps[0].id).toBe("agent-credit-line");
  });

  it("reports an unknown address as no match", async () => {
    const rpc = mockRpc({ [`${OTHER}.owner`]: EOA, "*.vaultsOf": [], "*.desksOf": [] });
    const body = (await call("find_dapp", { query: OTHER }, rpc)).json();
    expect(body.match).toBeNull();
    expect(body.dapps).toEqual([]);
  });

  it("returns known ids when nothing matches", async () => {
    const body = (await call("find_dapp", { query: "uniswap" })).json();
    expect(body.match).toBeNull();
    expect(body.note).toMatch(/calltab/);
  });
});

describe("decode_tx", () => {
  const approveData = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [DAPPS.calltab.address, 1_000_000n] });

  it("explains a USDC approve to an official spender", async () => {
    const body = (await call("decode_tx", { to: USDC, data: approveData, value: "0", chainId: 8453 })).json();
    expect(body.official).toBe(true);
    expect(body.function).toBe("approve");
    expect(body.signature).toBe("approve(address,uint256)");
    expect(body.args).toEqual({ spender: DAPPS.calltab.address, amount: "1000000" });
    expect(body.contract.spenderDapp).toBe("calltab");
    expect(body.builtByThisServer).toBe(true);
    expect(body.summary).toMatch(/1 USDC/);
    expect(body.warnings).toEqual([]);
  });

  it("rejects another chain", async () => {
    const r = await call("decode_tx", { to: USDC, data: approveData, chainId: 1 });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/chainId: .*Base \(chainId 8453\)/);
  });

  it("flags an unofficial approve spender, unlimited approvals and non-zero value", async () => {
    const data = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [OTHER, maxUint256] });
    const rpc = mockRpc({ [`${OTHER}.owner`]: EOA, "*.vaultsOf": [], "*.desksOf": [] });
    const body = (await call("decode_tx", { to: USDC, data, value: "5" }, rpc)).json();
    expect(body.warnings.join(" ")).toMatch(/not an official/);
    expect(body.warnings.join(" ")).toMatch(/Unlimited approval/);
    expect(body.warnings.join(" ")).toMatch(/value is 5 wei/);
  });

  it("marks an unknown target as not official", async () => {
    const rpc = mockRpc({}, { code: { [OTHER]: "0x" } });
    const body = (await call("decode_tx", { to: OTHER, data: approveData }, rpc)).json();
    expect(body.official).toBe(false);
    expect(body.warnings.join(" ")).toMatch(/Do not sign/);
  });

  it("decodes a vault call with named arguments", async () => {
    const data = encodeFunctionData({
      abi: instanceAbi["agent-credit-line"],
      functionName: "borrow",
      args: [OTHER, 2_000_000n, `0x${"00".repeat(32)}`],
    });
    const body = (await call("decode_tx", { to: VAULT, data, from: EOA }, creditVaultRpc())).json();
    expect(body.contract).toMatchObject({ kind: "instance", dapp: "agent-credit-line", owner: EOA, factory: CREDIT_FACTORY });
    expect(body.function).toBe("borrow");
    expect(body.args.to).toBe(OTHER);
    expect(body.args.amount).toBe("2000000");
  });

  it("round-trips a build_* result", async () => {
    const rpc = mockRpc({ [`${USDC}.approve`]: true });
    const tx = (await call("build_usdc_approve", { from: EOA, spender: DAPPS.prooflock.address, amount: "250000" }, rpc)).json();
    const body = (await call("decode_tx", { to: tx.to, data: tx.data, value: tx.value, chainId: tx.chainId, from: tx.from }, rpc)).json();
    expect(body.args.spender).toBe(DAPPS.prooflock.address);
    expect(body.contract.spenderDapp).toBe("prooflock");
  });

  it("rejects calldata without a selector", async () => {
    const r = await call("decode_tx", { to: USDC, data: "0x12" });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/selector/);
  });
});

describe("estimate_gas", () => {
  const data = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [DAPPS.calltab.address, 1n] });

  it("returns gas, a buffered limit and fees", async () => {
    const rpc = mockRpc({ "*.getL1FeeUpperBound": 1_000n }, { gas: 46_000n, gasPrice: 5_000_000n });
    const body = (await call("estimate_gas", { from: EOA, to: USDC, data, chainId: "8453" }, rpc)).json();
    expect(body.gas).toBe("46000");
    expect(body.suggestedGasLimit).toBe("55200");
    expect(body.l2FeeWei).toBe((46_000n * 5_000_000n).toString());
    expect(body.l1DataFeeUpperBoundWei).toBe("1000");
    expect(body.note).toMatch(/Nothing was signed or sent/);
  });

  it("refuses unknown targets and non-zero value", async () => {
    const rpc = mockRpc({}, { code: { [OTHER]: "0x" } });
    expect((await call("estimate_gas", { from: EOA, to: OTHER, data }, rpc)).text).toMatch(/refusing/);
    expect((await call("estimate_gas", { from: EOA, to: USDC, data, value: "1" }, mockRpc({}))).text).toMatch(/value = 0/);
  });

  it("surfaces a would-revert reason", async () => {
    const rpc = mockRpc({}, { estimateFail: "The call would revert: NotAgent." });
    const r = await call("estimate_gas", { from: EOA, to: USDC, data }, rpc);
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/NotAgent/);
  });
});

describe("preflight_build", () => {
  it("suggests the exact approve when the allowance is short", async () => {
    const rpc = mockRpc({ [`${USDC}.balanceOf`]: 5_000_000n, [`${USDC}.allowance`]: 0n });
    const body = (
      await call("preflight_build", { tool: "build_calltab", args: { from: EOA, action: "topUp", tabId: "1", amount: "1000000" } }, rpc)
    ).json();
    expect(body.ready).toBe(false);
    expect(body.usdc).toMatchObject({ required: "1000000", allowance: "0" });
    expect(body.nextSteps[0].tool).toBe("build_usdc_approve");
    expect(body.nextSteps[0].arguments).toEqual({ from: EOA, spender: DAPPS.calltab.address, amount: "1000000" });
    // The suggestion is itself a valid call.
    const approve = tools.find((t) => t.name === "build_usdc_approve")!;
    expect(approve.inputSchema.safeParse(body.nextSteps[0].arguments).success).toBe(true);
  });

  it("passes dapp for vault spenders", async () => {
    const rpc = creditVaultRpc({ [`${USDC}.balanceOf`]: 5_000_000n, [`${USDC}.allowance`]: 0n });
    const body = (
      await call("preflight_build", { tool: "build_credit_line", args: { from: EOA, vault: VAULT, action: "repay", amount: "1000000" } }, rpc)
    ).json();
    expect(body.nextSteps[0].arguments).toMatchObject({ spender: VAULT, dapp: "agent-credit-line" });
  });

  it("reports a balance shortfall", async () => {
    const rpc = mockRpc({ [`${USDC}.balanceOf`]: 10n, [`${USDC}.allowance`]: 0n });
    const body = (
      await call("preflight_build", { tool: "build_calltab", args: { from: EOA, action: "topUp", tabId: "1", amount: "1000000" } }, rpc)
    ).json();
    expect(body.ready).toBe(false);
    expect(body.nextSteps[0].why).toMatch(/999990/);
  });

  it("returns tx, decoded summary and gas when ready", async () => {
    const rpc = mockRpc({ [`${USDC}.approve`]: true, "*.getL1FeeUpperBound": 1n });
    const body = (
      await call("preflight_build", { tool: "build_usdc_approve", args: { from: EOA, spender: DAPPS.agentbond.address, amount: "1" } }, rpc)
    ).json();
    expect(body.ready).toBe(true);
    expect(body.tx.chainId).toBe(8453);
    expect(body.decoded.function).toBe("approve");
    expect(body.gas.gas).toBe("50000");
  });

  it("reports invalid arguments as not ready with a pointer to describe_tools", async () => {
    const body = (await call("preflight_build", { tool: "build_calltab", args: { from: EOA, action: "topUp" } })).json();
    expect(body.ready).toBe(false);
    expect(body.reason).toMatch(/tabId: is required for action "topUp"/);
    expect(body.nextSteps[0].arguments).toEqual({ tool: "build_calltab" });
  });

  it("reports a would-revert simulation as not ready", async () => {
    const rpc = mockRpc({ [`${USDC}.approve`]: new Error("The call would revert: Pausable: paused.") });
    const body = (
      await call("preflight_build", { tool: "build_usdc_approve", args: { from: EOA, spender: DAPPS.calltab.address, amount: "1" } }, rpc)
    ).json();
    expect(body.ready).toBe(false);
    expect(body.reason).toMatch(/would revert/);
  });

  it("only wraps build_* tools", async () => {
    const r = await call("preflight_build", { tool: "read_usdc", args: { account: EOA } });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/build_\* tool/);
  });
});
