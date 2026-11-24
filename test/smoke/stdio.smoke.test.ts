import { spawn } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const entry = path.join(root, "dist/mcp/stdio.js");

type Rpc = { id?: number; result?: Record<string, unknown>; error?: unknown };

describe("stdio smoke", () => {
  it("lists tools and answers tool calls over stdio JSON-RPC", async () => {
    const child = spawn(process.execPath, [entry], {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, BASE_RPC_URL: process.env.BASE_RPC_URL ?? "https://mainnet.base.org" },
    });
    let out = "";
    child.stdout.on("data", (c: Buffer) => {
      out += c.toString();
    });
    let err = "";
    child.stderr.on("data", (c: Buffer) => {
      err += c.toString();
    });
    const send = (msg: unknown) => {
      child.stdin.write(JSON.stringify(msg) + "\n");
    };
    const waitFor = async (id: number): Promise<Rpc | undefined> => {
      const started = Date.now();
      while (Date.now() - started < 20_000) {
        for (const line of out.split("\n").map((l) => l.trim()).filter(Boolean)) {
          try {
            const parsed = JSON.parse(line) as Rpc;
            if (parsed.id === id) return parsed;
          } catch {
            /* ignore partial */
          }
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      return undefined;
    };
    const callTool = async (id: number, name: string, args: unknown) => {
      send({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } });
      const res = await waitFor(id);
      const result = res?.result as { content?: { text: string }[]; isError?: boolean } | undefined;
      return { text: result?.content?.[0]?.text ?? "", isError: result?.isError === true };
    };

    try {
      send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "smoke", version: "0.0.0" },
        },
      });
      send({ jsonrpc: "2.0", method: "notifications/initialized" });
      send({ jsonrpc: "2.0", id: 2, method: "tools/list" });

      const list = await waitFor(2);
      const toolList = (list?.result?.tools ?? []) as {
        name: string;
        inputSchema: { properties?: Record<string, unknown>; additionalProperties?: unknown };
      }[];
      expect(toolList.length, err.slice(0, 400) || out.slice(0, 400)).toBeGreaterThan(10);
      const names = new Set(toolList.map((t) => t.name));
      for (const n of ["list_dapps", "build_aave_guard", "describe_tools", "find_dapp", "decode_tx", "estimate_gas", "preflight_build"]) {
        expect(names.has(n), n).toBe(true);
      }
      const credit = toolList.find((t) => t.name === "build_credit_line")!;
      expect(credit.inputSchema.additionalProperties).toBe(false);
      expect(credit.inputSchema.properties).toHaveProperty("chainId");

      const describe = await callTool(3, "describe_tools", {});
      expect(describe.isError).toBe(false);
      expect(JSON.parse(describe.text).tools.length).toBe(toolList.length);

      const wrongChain = await callTool(4, "list_dapps", { chainId: 1 });
      expect(wrongChain.isError).toBe(true);
      expect(wrongChain.text).toMatch(/chainId 8453/);

      const missing = await callTool(5, "build_credit_line", {
        from: "0x1111111111111111111111111111111111111111",
        vault: "0x3333333333333333333333333333333333333333",
        action: "borrow",
      });
      expect(missing.isError).toBe(true);
      expect(missing.text).toMatch(/to: is required for action "borrow"/);
    } finally {
      child.kill("SIGTERM");
    }
  }, 60_000);
});
