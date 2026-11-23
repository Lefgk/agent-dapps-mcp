#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { DEFAULT_RPC_URL } from "../addresses.js";
import { createMcpServer } from "./createServer.js";

const rpcUrl = process.env.BASE_RPC_URL ?? DEFAULT_RPC_URL;

serveStdio(
  () => createMcpServer({ rpcUrl }),
  {
    onerror: (error) => {
      process.stderr.write(`${error.message}\n`);
    },
  },
);
