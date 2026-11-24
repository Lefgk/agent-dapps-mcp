import { getAddress, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { DAPPS, USDC } from "../../src/addresses.js";
import { runTool } from "../../src/tools/index.js";
import type { Rpc } from "../../src/rpc.js";
import {
  ToolError,
  parseAddress,
  parseBytes32,
  parseChainId,
  parseUint,
  parseUint48,
} from "../../src/validate.js";
import { mockRpc } from "./mockRpc.js";

const EOA = "0x1111111111111111111111111111111111111111";
const VAULT = getAddress("0x3333333333333333333333333333333333333333") as Address;
const OWNER = getAddress("0x5555555555555555555555555555555555555555") as Address;

async function err(name: string, args: unknown, rpc: Rpc = {} as Rpc): Promise<string> {
  const r = await runTool(name, args, rpc);
  expect(r.isError, `${name} should fail: ${r.content[0]!.text}`).toBe(true);
  return r.content[0]!.text;
}

describe("validate.ts", () => {
  it("rejects a mixed-case address with a bad EIP-55 checksum", () => {
    const bad = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02914".replace("fCD6", "FcD6");
    expect(() => parseAddress(bad, "spender")).toThrow(/EIP-55 checksum/);
    // All-lowercase and correct checksums still work.
    expect(parseAddress(USDC.toLowerCase(), "spender")).toBe(USDC);
    expect(parseAddress(USDC, "spender")).toBe(USDC);
  });

  it("says a missing value is required", () => {
    expect(() => parseAddress(undefined, "to")).toThrow("to is required.");
    expect(() => parseUint("", "amount")).toThrow("amount is required.");
  });

  it("explains base units for decimal amounts", () => {
    expect(() => parseUint("1.5", "amount")).toThrow(/base units.*1500000/);
    expect(() => parseUint("1e6", "amount")).toThrow(/base units/);
    expect(() => parseUint(1.5, "amount")).toThrow(/non-negative integer/);
  });

  it("rejects unsafe JSON numbers instead of rounding them", () => {
    expect(() => parseUint(2 ** 60, "amount")).toThrow(/decimal string/);
    expect(parseUint(1_000_000, "amount")).toBe(1_000_000n);
  });

  it("enforces uint48 range", () => {
    expect(parseUint48((2n ** 48n - 1n).toString(), "period")).toBe(2n ** 48n - 1n);
    expect(() => parseUint48((2n ** 48n).toString(), "period")).toThrow(/allowed range/);
  });

  it("only pads text into bytes32 when allowed", () => {
    expect(parseBytes32("memo", "memo")).toMatch(/^0x6d656d6f0+$/);
    expect(() => parseBytes32("abc", "key", { allowText: false })).toThrow(/32-byte 0x hex/);
    expect(() => parseBytes32("0x1234", "memo")).toThrow(/exactly 32 bytes/);
  });

  it("accepts only Base as chainId", () => {
    expect(parseChainId(undefined)).toBe(8453);
    expect(parseChainId("0x2105")).toBe(8453);
    expect(() => parseChainId(1)).toThrow(ToolError);
    expect(() => parseChainId("84532")).toThrow(/only works on Base/);
  });
});

describe("tool schemas", () => {
  it("rejects unknown fields instead of dropping them", async () => {
    const text = await err("build_usdc_approve", { from: EOA, spender: DAPPS.calltab.address, ammount: "1" });
    expect(text).toMatch(/Unknown field "ammount": not a parameter of this tool.*Allowed: chainId, from, spender, amount, dapp/);
    expect(text).toMatch(/amount: is required/);
  });

  it("rejects a wrong chainId on any tool and accepts 8453", async () => {
    expect(await err("list_dapps", { chainId: 1 })).toMatch(/chainId: is not supported; this server only works on Base/);
    expect((await runTool("list_dapps", { chainId: 8453 }, {} as Rpc)).isError).toBeUndefined();
  });

  it("requires the fields an action needs", async () => {
    const text = await err("build_credit_line", { from: EOA, vault: VAULT, action: "borrow", amount: "1" });
    expect(text).toBe('Invalid arguments for build_credit_line: to: is required for action "borrow"');
  });

  it("rejects fields the action does not use", async () => {
    const text = await err("build_aave_guard", { from: EOA, vault: VAULT, action: "renounceAgent", amount: "1000000" });
    expect(text).toMatch(/amount: is not used by action "renounceAgent". "renounceAgent" takes: no extra fields/);
    const tab = await err("build_calltab", { from: EOA, action: "openTab", tabId: "1", provider: EOA, amount: "1", expiry: "1", challengeWindow: "1" });
    expect(tab).toMatch(/tabId: is not used by action "openTab"/);
  });

  it("lists valid actions for an unknown action", async () => {
    const text = await err("build_circuit_vault", { from: EOA, vault: VAULT, action: "withdraw" });
    expect(text).toMatch(/action: must be one of: rebalance, trip, checkpoint/);
  });

  it("explains JSON numbers and decimals for amounts", async () => {
    expect(await err("build_usdc_approve", { from: EOA, spender: DAPPS.calltab.address, amount: 1000000 })).toMatch(
      /amount: must be a string, not a JSON number/,
    );
    expect(await err("build_usdc_approve", { from: EOA, spender: DAPPS.calltab.address, amount: "1.5" })).toMatch(
      /amount: must be a non-negative integer string in base units/,
    );
    expect(await err("build_usdc_approve", { from: EOA, spender: DAPPS.calltab.address, amount: "-1" })).toMatch(/amount:/);
  });

  it("rejects bad addresses and checksums at the schema", async () => {
    expect(await err("read_usdc", { account: "0x1234" })).toMatch(/account: must be a 20-byte/);
    expect(await err("read_usdc", { account: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02914" })).toMatch(/EIP-55 checksum/);
    expect(await err("read_usdc", {})).toMatch(/account: is required/);
  });

  it("rejects text where a bond key or order id is required", async () => {
    expect(await err("build_agentbond", { from: EOA, action: "withdraw", key: "my-bond" })).toMatch(/key: must be a 32-byte 0x hex/);
    expect(await err("read_limitdesk", { desk: VAULT, orderId: "order-1" })).toMatch(/orderId: must be a 32-byte/);
  });

  it("rejects non-object arguments", async () => {
    expect(await err("list_dapps", "hello")).toMatch(/must be a JSON object/);
  });

  it("suggests close tool names for an unknown tool", async () => {
    expect(await err("read_calltabs", {})).toMatch(/Unknown tool: read_calltabs\. Did you mean: .*read_calltab/);
  });

  it("rejects ambiguous agentbond reads", async () => {
    expect(await err("read_agentbond", { agentId: "1", account: EOA })).toMatch(/exactly one of agentId, account, or key/);
  });

  it("rejects a partial slipguard min-out preview before any RPC", async () => {
    expect(await err("read_slipguard", { vault: VAULT, agent: EOA, tokenIn: USDC })).toMatch(/all three of tokenIn, tokenOut and amountIn/);
  });

  it("rejects out-of-range uint48 spend permission fields instead of losing precision", async () => {
    const perm = {
      account: EOA,
      spender: EOA,
      token: USDC,
      allowance: "1",
      period: (2n ** 53n + 1n).toString(),
      start: "0",
      end: "1",
      salt: "0",
    };
    expect(await err("build_agent_revoke", { from: EOA, action: "panicWith", spendPerms: [perm] })).toMatch(
      /spendPerms\[0\]\.period exceeds the allowed range/,
    );
    expect(
      await err("build_agent_revoke", { from: EOA, action: "panicWith", spendPerms: [{ ...perm, period: "1", allowance: (2n ** 160n).toString() }] }),
    ).toMatch(/spendPerms\[0\]\.allowance exceeds the allowed range/);
    expect(await err("build_agent_revoke", { from: EOA, action: "panicWith", erc20: [{ token: USDC, spender: EOA, extra: 1 }] })).toMatch(
      /erc20\.0/,
    );
  });

  it("rejects a Limitdesk epoch above uint32", async () => {
    const desk = DAPPS.limitdesk.address;
    const rpc = mockRpc({ [`${VAULT}.owner`]: OWNER, [`${desk}.desksOf`]: [VAULT] });
    const text = await err(
      "build_limitdesk",
      {
        from: EOA,
        desk: VAULT,
        action: "post",
        agent: EOA,
        tokenSell: USDC,
        tokenBuy: USDC,
        amountSell: "1",
        limitPriceX18: "1",
        expiry: "1",
        nonce: "1",
        signature: `0x${"11".repeat(65)}`,
        epoch: (2n ** 32n).toString(),
      },
      rpc,
    );
    expect(text).toMatch(/epoch exceeds the allowed range/);
  });
});
