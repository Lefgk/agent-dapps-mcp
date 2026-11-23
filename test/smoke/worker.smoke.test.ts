import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

function pickPort(): number {
  return 18000 + Math.floor(Math.random() * 1000);
}

describe("wrangler dev smoke", () => {
  let proc: ChildProcess | undefined;
  let baseUrl = "";

  beforeAll(async () => {
    const port = pickPort();
    baseUrl = `http://127.0.0.1:${port}`;
    const wrangler = path.join(root, "node_modules/.bin/wrangler");
    proc = spawn(wrangler, ["dev", "--port", String(port), "--ip", "127.0.0.1", "--local"], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });
    let logs = "";
    proc.stdout?.on("data", (c: Buffer) => {
      logs += c.toString();
    });
    proc.stderr?.on("data", (c: Buffer) => {
      logs += c.toString();
    });
    const started = Date.now();
    while (Date.now() - started < 60_000) {
      try {
        const res = await fetch(`${baseUrl}/health`);
        if (res.ok) return;
      } catch {
        /* not up yet */
      }
      if (proc.exitCode !== null) {
        throw new Error(`wrangler exited ${proc.exitCode}: ${logs.slice(0, 800)}`);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    throw new Error(`wrangler dev did not start: ${logs.slice(0, 800)}`);
  }, 70_000);

  afterAll(() => {
    proc?.kill("SIGTERM");
  });

  it("serves health and answers tools/list on /mcp", async () => {
    const health = await fetch(`${baseUrl}/health`);
    expect(health.ok).toBe(true);
    const body = (await health.json()) as { ok: boolean; name: string };
    expect(body.ok).toBe(true);
    expect(body.name).toBe("agent-dapps-mcp");

    const init = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2025-03-26",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "smoke", version: "0.0.0" },
        },
      }),
    });
    expect(init.status, await init.text().then((t) => t.slice(0, 300))).toBeLessThan(500);

    const list = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2025-03-26",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    });
    const text = await list.text();
    expect(list.status, text.slice(0, 400)).toBeLessThan(500);
    expect(text).toMatch(/list_dapps/);
  }, 30_000);
});
