import { ToolError } from "../validate.js";
import { errText, okText } from "../format.js";
import type { Rpc } from "../rpc.js";
import { buildTools } from "./builds.js";
import { readTools } from "./reads.js";
import type { ToolContent, ToolDef } from "./types.js";

export type { ToolDef, ToolContent } from "./types.js";

export const tools: ToolDef[] = [...readTools, ...buildTools];

const byName = new Map(tools.map((t) => [t.name, t]));

export function getTool(name: string): ToolDef {
  const tool = byName.get(name);
  if (!tool) throw new ToolError(`Unknown tool: ${name}`);
  return tool;
}

export async function runTool(name: string, rawArgs: unknown, rpc: Rpc): Promise<ToolContent> {
  try {
    const tool = getTool(name);
    const parsed = tool.inputSchema.parse(rawArgs ?? {});
    const result = await tool.handler(parsed as Record<string, unknown>, rpc);
    return okText(result);
  } catch (err) {
    const message =
      err instanceof ToolError
        ? err.message
        : err instanceof Error
          ? err.message
          : "The tool failed for an unknown reason.";
    return errText(message);
  }
}

export { readTools, buildTools };
