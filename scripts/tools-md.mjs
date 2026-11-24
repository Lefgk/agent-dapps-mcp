// Writes docs/TOOLS.md from the built tool schemas. Run with `npm run docs:tools`.
import { writeFileSync } from "node:fs";
import { toolsMarkdown } from "../dist/tools/docs.js";

writeFileSync(new URL("../docs/TOOLS.md", import.meta.url), toolsMarkdown());
