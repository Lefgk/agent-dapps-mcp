import { encodeFunctionData, getAddress, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { DAPPS, USDC, ALL_DAPPS } from "../../src/addresses.js";
import { erc20Abi } from "../../src/generated/abis.js";
import { runTool, tools } from "../../src/tools/index.js";
import type { Rpc } from "../../src/rpc.js";

function hexPad(n: bigint, bytes = 32): Hex {
  return `0x${n.toString(16).padStart(bytes * 2, "0")}` as Hex;
}

function encodeAddress(addr: string): Hex {
  return `0x${"00".repeat(12)}${addr.slice(2).toLowerCase()}` as Hex;
}

describe("tool catalog", () => {
  it("registers unique tools covering all 10 dapps", () => {
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const id of ALL_DAPPS) {
      const hit = names.some((n) => n.includes(id.replaceAll("-", "_")) || tools.some((t) => t.description.includes(id) || t.name.includes(id.split("-")[0]!)));
      expect(hit, `missing coverage for ${id}`).toBe(true);
    }
    expect(names).toContain("list_dapps");
    expect(names).toContain("build_usdc_approve");
    expect(tools.every((t) => t.description.includes("never asks for, stores, or uses private keys"))).toBe(true);
  });

  it("list_dapps returns the 10 official Base addresses", async () => {
    const result = await runTool("list_dapps", {}, {} as Rpc);
    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0]!.text);
    expect(body.chainId).toBe(8453);
    expect(body.dapps).toHaveLength(10);
    expect(body.dapps.map((d: { id: string }) => d.id).sort()).toEqual([...ALL_DAPPS].sort());
    expect(body.dapps[0].address).toMatch(/^0x/);
  });
});

describe("validation on tools", () => {
  it("rejects a bad address without calling RPC", async () => {
    const result = await runTool("read_usdc", { account: "not-an-address" }, {} as Rpc);
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toMatch(/address/i);
  });
});

describe("build_usdc_approve", () => {
  it("simulates approve to Calltab and returns unsigned tx fields", async () => {
    const from = "0x1111111111111111111111111111111111111111";
    const spender = DAPPS.calltab.address;
    const expected = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [spender, 1_000_000n],
    });
    const rpc: Rpc = {
      url: "mock",
      async call({ to, data }) {
        expect(getAddress(to)).toBe(USDC);
        expect(data).toBe(expected);
        return { ok: true, data: hexPad(1n) };
      },
    };
    const result = await runTool(
      "build_usdc_approve",
      { from, spender, amount: "1000000" },
      rpc,
    );
    expect(result.isError).toBeUndefined();
    const tx = JSON.parse(result.content[0]!.text);
    expect(tx.chainId).toBe(8453);
    expect(tx.value).toBe("0");
    expect(tx.to).toBe(USDC);
    expect(tx.data).toBe(expected);
    expect(tx.from).toBe(getAddress(from));
    expect(tx.summary).toMatch(/Approve/);
  });

  it("rejects a would-be revert with a clear reason", async () => {
    const rpc: Rpc = {
      url: "mock",
      async call() {
        return { ok: false, reason: "The call would revert: Pausable: paused." };
      },
    };
    const result = await runTool(
      "build_usdc_approve",
      { from: "0x1111111111111111111111111111111111111111", spender: DAPPS.calltab.address, amount: "1" },
      rpc,
    );
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toMatch(/would revert/);
  });

  it("rejects an unknown spender", async () => {
    const result = await runTool(
      "build_usdc_approve",
      {
        from: "0x1111111111111111111111111111111111111111",
        spender: "0x2222222222222222222222222222222222222222",
        amount: "1",
      },
      {} as Rpc,
    );
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toMatch(/spender must be an official/);
  });
});

describe("assertFactoryInstance via list_instances", () => {
  it("encodes vaultsOf for the official factory", async () => {
    const owner = "0x1111111111111111111111111111111111111111";
    const vault = "0x3333333333333333333333333333333333333333";
    let seenTo: string | undefined;
    const rpc: Rpc = {
      url: "mock",
      async call({ to }) {
        seenTo = getAddress(to);
        // abi encode address[] of one vault
        const offset = hexPad(32n);
        const len = hexPad(1n);
        const item = encodeAddress(vault);
        return { ok: true, data: `0x${offset.slice(2)}${len.slice(2)}${item.slice(2)}` as Hex };
      },
    };
    const result = await runTool("list_instances", { dapp: "aave-guard-vault", owner }, rpc);
    expect(result.isError).toBeUndefined();
    expect(seenTo).toBe(DAPPS["aave-guard-vault"].address);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.instances[0]).toBe(getAddress(vault));
  });
});
