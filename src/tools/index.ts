import { z } from "zod";
import { ToolError } from "../validate.js";
import { errText, okText } from "../format.js";
import type { Rpc } from "../rpc.js";
import { buildTools } from "./builds.js";
import { ACTION_RULES } from "./catalog.js";
import * as f from "./fields.js";
import { createMetaTools, unknownToolMessage } from "./meta.js";
import { readTools } from "./reads.js";
import type { ToolContent, ToolDef } from "./types.js";

export type { ToolDef, ToolContent } from "./types.js";

const UNKNOWN_FIELD = "not a parameter of this tool (call describe_tools with this tool name).";

/**
 * Wrap a tool's object schema so every tool:
 * - rejects unknown fields (typos are never silently dropped),
 * - accepts an optional chainId that must be 8453,
 * - for build tools with actions, requires the fields the action needs and rejects fields it does not use.
 */
function harden(tool: ToolDef): ToolDef {
  const base = tool.inputSchema;
  if (!(base instanceof z.ZodObject)) return tool;
  const shape = { chainId: f.chainId.optional(), ...base.shape };
  let schema: z.ZodType = z.strictObject(shape, {
    error: (iss) =>
      iss.code === "unrecognized_keys"
        ? `Unknown field${iss.keys.length > 1 ? "s" : ""} ${iss.keys.map((k) => `"${k}"`).join(", ")}: ${UNKNOWN_FIELD} Allowed: ${Object.keys(shape).join(", ")}`
        : undefined,
  });
  const rules = ACTION_RULES[tool.name];
  if (rules) {
    const actionFields = new Set(Object.values(rules).flatMap((r) => [...r.required, ...(r.optional ?? [])]));
    schema = (schema as z.ZodObject).superRefine((val: Record<string, unknown>, ctx) => {
      const action = String(val.action);
      const rule = rules[action];
      if (!rule) return;
      const allowed = new Set([...rule.required, ...(rule.optional ?? [])]);
      const takes = [...rule.required.map((r) => `${r} (required)`), ...(rule.optional ?? [])].join(", ") || "no extra fields";
      for (const req of rule.required) {
        const v = val[req];
        if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
          ctx.addIssue({ code: "custom", path: [req], message: `is required for action "${action}"` });
        }
      }
      for (const [key, v] of Object.entries(val)) {
        if (v === undefined || !actionFields.has(key) || allowed.has(key)) continue;
        ctx.addIssue({ code: "custom", path: [key], message: `is not used by action "${action}". "${action}" takes: ${takes}` });
      }
    });
  }
  return { ...tool, inputSchema: schema };
}

const registryTools: ToolDef[] = [];
const byName = new Map<string, ToolDef>();

export function formatZodError(toolName: string, err: z.ZodError): string {
  const parts = err.issues.map((i) => (i.path.length ? `${i.path.map(String).join(".")}: ${i.message}` : i.message));
  return `Invalid arguments for ${toolName}: ${parts.join("; ")}`;
}

const metaTools = createMetaTools({
  list: () => registryTools,
  get: (name) => byName.get(name),
  formatZodError,
});

export const tools: ToolDef[] = [...metaTools, ...readTools, ...buildTools].map(harden);
for (const t of tools) {
  registryTools.push(t);
  byName.set(t.name, t);
}

export function getTool(name: string): ToolDef {
  const tool = byName.get(name);
  if (!tool) throw new ToolError(unknownToolMessage(name, tools));
  return tool;
}

export async function runTool(name: string, rawArgs: unknown, rpc: Rpc): Promise<ToolContent> {
  try {
    const tool = getTool(name);
    if (rawArgs !== undefined && rawArgs !== null && (typeof rawArgs !== "object" || Array.isArray(rawArgs))) {
      throw new ToolError(`Arguments for ${name} must be a JSON object.`);
    }
    const parsed = tool.inputSchema.safeParse(rawArgs ?? {});
    if (!parsed.success) throw new ToolError(formatZodError(name, parsed.error));
    const result = await tool.handler(parsed.data as Record<string, unknown>, rpc);
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

export { readTools, buildTools, metaTools };
