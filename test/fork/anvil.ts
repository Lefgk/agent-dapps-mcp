import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { createTestClient, http, publicActions, walletActions } from "viem";
import { base } from "viem/chains";

export type Fork = {
  port: number;
  url: string;
  proc: ChildProcess;
  client: ReturnType<typeof makeClient>;
};

function makeClient(url: string) {
  return createTestClient({
    chain: base,
    mode: "anvil",
    transport: http(url, { timeout: 60_000 }),
  })
    .extend(publicActions)
    .extend(walletActions);
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const addr = s.address();
      if (!addr || typeof addr === "string") {
        s.close();
        reject(new Error("no port"));
        return;
      }
      const port = addr.port;
      s.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

export async function startFork(): Promise<Fork> {
  const port = await freePort();
  const rpc = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
  const anvil = path.join(process.env.HOME ?? "", ".foundry/bin/anvil");
  const proc = spawn(
    anvil,
    ["--fork-url", rpc, "--port", String(port), "--host", "127.0.0.1", "--silent"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  const url = `http://127.0.0.1:${port}`;
  const started = Date.now();
  let stderr = "";
  proc.stderr?.on("data", (c: Buffer) => {
    stderr += c.toString();
  });
  while (Date.now() - started < 60_000) {
    if (proc.exitCode !== null) {
      throw new Error(`anvil exited ${proc.exitCode}: ${stderr.slice(0, 400)}`);
    }
    try {
      const client = makeClient(url);
      await client.getBlockNumber();
      return { port, url, proc, client };
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  proc.kill("SIGKILL");
  throw new Error(`anvil did not start: ${stderr.slice(0, 400)}`);
}

export async function stopFork(fork: Fork): Promise<void> {
  fork.proc.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 300));
  if (fork.proc.exitCode === null) fork.proc.kill("SIGKILL");
}

export async function mine(fork: Fork): Promise<void> {
  await fork.client.request({ method: "evm_mine", params: [] } as never);
}
