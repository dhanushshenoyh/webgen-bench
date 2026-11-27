import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { runAxe } from "./axe.ts";
import { checkBrief, sitePages, type Brief } from "./brief.ts";
import { runLighthouse } from "./lighthouse.ts";
import { serveSite } from "./serve.ts";
import { runValidator } from "./validator.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { brief: { type: "string" }, tool: { type: "string" }, site: { type: "string" }, runs: { type: "string", default: "5" }, generated: { type: "string" }, notes: { type: "string" } },
});

async function hashDir(dir: string): Promise<string> {
  const hash = createHash("sha256");
  for (const file of (await readdir(dir, { recursive: true })).sort()) {
    const content = await readFile(join(dir, file)).catch(() => null);
    if (content) hash.update(file).update(content);
  }
  return hash.digest("hex").slice(0, 16);
}

async function run() {
  if (!values.brief || !values.tool || !values.site) throw new Error("Usage: pnpm bench run --brief <id> --tool <name> --site <dir> [--runs 5] [--generated YYYY-MM-DD] [--notes text]");
  const brief = JSON.parse(await readFile(`briefs/${values.brief}.json`, "utf8")) as Brief;
  const dir = resolve(values.site);
  const pages = await sitePages(dir);
  const runs = Number(values.runs);
  const server = await serveSite(dir);
  console.log(`${values.tool}: ${pages.length} pages, ${runs} Lighthouse runs per page and form factor`);
  try {
    const lighthouse = [];
    for (const page of pages) {
      for (const formFactor of ["mobile", "desktop"] as const) {
        lighthouse.push({ page, ...(await runLighthouse(`${server.origin}/${page}`, formFactor, runs)) });
        console.log(`  lighthouse ${page} ${formFactor} done`);
      }
    }
    const axe = await runAxe(server.origin, pages);
    console.log(`  axe: ${axe.violations.length} violations`);
    const validator = await runValidator(dir, pages);
    console.log(`  validator: ${validator.errors} errors`);
    const content = await checkBrief(dir, brief);
    const result = {
      schema: 1, brief: brief.id, briefVersion: brief.version, tool: values.tool, generated: values.generated ?? null, notes: values.notes ?? null,
      evaluatedAt: new Date().toISOString(), siteHash: await hashDir(dir), pages, lighthouse, axe, validator, content,
      environment: { node: process.version, platform: process.platform },
    };
    await mkdir(`results/${brief.id}`, { recursive: true });
    await writeFile(`results/${brief.id}/${values.tool}.json`, JSON.stringify(result, null, 2));
    console.log(`  wrote results/${brief.id}/${values.tool}.json`);
  } finally {
    await server.close();
  }
}

if (positionals[0] === "run") run().catch((error) => { console.error(error); process.exit(1); });
else console.log("Commands: run");
