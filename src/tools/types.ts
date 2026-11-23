import type { z } from "zod";
import type { Rpc } from "../rpc.js";

export type ToolContent = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

export type ToolDef = {
  name: string;
  title: string;
  description: string;
  // Zod object schema. Empty object for tools with no arguments.
  inputSchema: z.ZodType;
  handler: (args: Record<string, unknown>, rpc: Rpc) => Promise<unknown>;
};
