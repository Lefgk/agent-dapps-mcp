import { spawn } from "node:child_process";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const entry = path.join(root, "dist/mcp/stdio.js");

describe("stdio smoke", () => {
  it("lists tools over stdio JSON-RPC", async () => {
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

    const started = Date.now();
    let list: { result?: { tools?: { name: string }[] } } | undefined;
    while (Date.now() - started < 20_000) {
      const lines = out.split("\n").map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as { id?: number; result?: { tools?: { name: string }[] } };
          if (parsed.id === 2) list = parsed;
        } catch {
          /* ignore partial */
        }
      }
      if (list?.result?.tools) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    child.kill("SIGTERM");
    expect(list?.result?.tools?.length, err.slice(0, 400) || out.slice(0, 400)).toBeGreaterThan(10);
    const names = new Set((list?.result?.tools ?? []).map((t) => t.name));
    expect(names.has("list_dapps")).toBe(true);
    expect(names.has("build_aave_guard")).toBe(true);
  }, 30_000);
});
