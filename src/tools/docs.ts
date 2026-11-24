import { z } from "zod";
import { ACTION_RULES, EXAMPLES, EXAMPLE_NOTE, WORKFLOW } from "./catalog.js";
import { tools } from "./index.js";
import { shortDescription, toolKind } from "./meta.js";

type Prop = { type?: string; description?: string; enum?: unknown[]; pattern?: string; items?: unknown; anyOf?: Prop[] };

function typeOf(p: Prop): string {
  if (p.enum) return p.enum.map((v) => JSON.stringify(v)).join(" | ");
  if (p.anyOf) return p.anyOf.map(typeOf).join(" | ");
  if (p.type === "array") return "array";
  return p.type ?? "any";
}

function cell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/** Markdown reference for every tool. docs/TOOLS.md is generated from this (`npm run docs:tools`). */
export function toolsMarkdown(): string {
  const out: string[] = [];
  out.push("# Tool reference");
  out.push("");
  out.push("Generated from the tool schemas by `npm run docs:tools`. Do not edit by hand. The same data is available at runtime from the `describe_tools` tool.");
  out.push("");
  out.push(`All tools are Base (chainId 8453) only. Every tool also accepts an optional \`chainId\`, which must be \`8453\` or \`"8453"\`. Unknown fields are rejected. ${EXAMPLE_NOTE}`);
  out.push("");
  out.push("## Recommended flow");
  out.push("");
  for (const step of WORKFLOW) out.push(step);
  out.push("");
  for (const kind of ["help", "read", "build"] as const) {
    out.push(`## ${kind === "help" ? "Help tools" : kind === "read" ? "Read tools" : "Build tools (unsigned transactions)"}`);
    out.push("");
    for (const tool of tools.filter((t) => toolKind(t.name) === kind)) {
      const schema = z.toJSONSchema(tool.inputSchema, { io: "input", unrepresentable: "any" }) as {
        properties?: Record<string, Prop>;
        required?: string[];
      };
      const required = new Set(schema.required ?? []);
      out.push(`### \`${tool.name}\``);
      out.push("");
      out.push(shortDescription(tool));
      out.push("");
      out.push("| Field | Type | Required | Description |");
      out.push("|---|---|---|---|");
      for (const [name, p] of Object.entries(schema.properties ?? {})) {
        if (name === "chainId") continue;
        out.push(`| \`${name}\` | ${cell(typeOf(p))} | ${required.has(name) ? "yes" : ""} | ${cell(p.description ?? "")} |`);
      }
      out.push("");
      const rules = ACTION_RULES[tool.name];
      if (rules) {
        out.push("| Action | Required fields | Optional fields |");
        out.push("|---|---|---|");
        for (const [action, r] of Object.entries(rules)) {
          out.push(`| \`${action}\` | ${r.required.map((x) => `\`${x}\``).join(", ") || "none"} | ${(r.optional ?? []).map((x) => `\`${x}\``).join(", ")} |`);
        }
        out.push("");
      }
      for (const e of EXAMPLES[tool.name] ?? []) {
        out.push(e.note ? `Example (${e.note.replace(/\.$/, "")}):` : "Example:");
        out.push("");
        out.push("```json");
        out.push(JSON.stringify({ name: tool.name, arguments: e.args }, null, 2));
        out.push("```");
        out.push("");
      }
    }
  }
  return `${out.join("\n").trimEnd()}\n`;
}
