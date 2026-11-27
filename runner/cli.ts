import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { runAxe } from "./axe.ts";
import { checkBrief, sitePages, type Brief } from "./brief.ts";
import { runLighthouse } from "./lighthouse.ts";
import { serveSite } from "./serve.ts";
import { runValidator } from "./validator.ts";
import { captureSite } from "./capture.ts";
import { judgeSite, krippendorffAlpha, type Rubric, type Verdict } from "./judge.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { judges: { type: "string" }, rubric: { type: "string", default: "design-v1" }, brief: { type: "string" }, tool: { type: "string" }, site: { type: "string" }, runs: { type: "string", default: "5" }, generated: { type: "string" }, notes: { type: "string" } },
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

const DEFAULT_JUDGES = ["anthropic/claude-opus-5.5", "openai/gpt-5.5", "google/gemini-3.1-pro-preview"];

/** Scores every stored site for a brief with several judge models on the design rubric, blind and absolute. */
async function design() {
  if (!values.brief) throw new Error("Usage: pnpm bench design --brief <id> [--judges a,b,c] [--rubric design-v1]");
  const brief = JSON.parse(await readFile(`briefs/${values.brief}.json`, "utf8")) as Brief;
  const rubric = JSON.parse(await readFile(`rubric/${values.rubric}.json`, "utf8")) as Rubric;
  const judges = values.judges?.split(",").map((judge) => judge.trim()).filter(Boolean) ?? DEFAULT_JUDGES;
  const tools = (await readdir("sites")).filter((name) => name.startsWith(`${brief.id}--`)).map((name) => name.slice(brief.id.length + 2)).sort();
  type SiteDesign = { anonId: string; siteHash: string; shots: string[]; verdicts: Verdict[]; errors: string[] };
  const previous = JSON.parse(await readFile(`results/${brief.id}/design.json`, "utf8").catch(() => "{}")) as { rubric?: string; sites?: Record<string, SiteDesign>; judges?: string[] };
  const sites: Record<string, SiteDesign> = {};
  for (const tool of tools) {
    const dir = resolve(`sites/${brief.id}--${tool}`);
    const anonId = createHash("sha256").update(`${brief.id}:${tool}:${await hashDir(dir)}`).digest("hex").slice(0, 8);
    const server = await serveSite(dir);
    const shots = await captureSite(server.origin, await sitePages(dir));
    await server.close();
    const shotDir = `dashboard/public/panel/${brief.id}`;
    await mkdir(shotDir, { recursive: true });
    const shotNames: string[] = [];
    for (const shot of shots) {
      const name = `${anonId}-${shot.page.replace(/\.html$/, "")}-${shot.width}-${shot.index}.jpg`;
      await writeFile(`${shotDir}/${name}`, shot.jpeg);
      shotNames.push(name);
    }
    console.log(`${tool}: ${shots.length} screenshots, judging with ${judges.length} models`);
    const settled = await Promise.allSettled(judges.map((judge) => judgeSite(judge, rubric, brief.prompt, shots)));
    const siteHash = await hashDir(dir);
    const kept = previous.rubric === rubric.id && previous.sites?.[tool]?.siteHash === siteHash ? previous.sites[tool].verdicts.filter((v) => !judges.includes(v.judge)) : [];
    sites[tool] = { anonId, siteHash, shots: shotNames, verdicts: kept, errors: [] };
    settled.forEach((result, index) => {
      if (result.status === "fulfilled") sites[tool].verdicts.push(result.value);
      else sites[tool].errors.push(`${judges[index]}: ${String(result.reason?.message ?? result.reason).slice(0, 300)}`);
    });
    for (const verdict of sites[tool].verdicts) console.log(`  ${verdict.judge}: mean ${(Object.values(verdict.scores).reduce((a, b) => a + b, 0) / rubric.criteria.length).toFixed(2)}`);
    for (const error of sites[tool].errors) console.log(`  failed ${error}`);
  }
  const allJudges = [...new Set([...(previous.judges ?? []), ...judges])].filter((judge) => tools.some((tool) => sites[tool].verdicts.some((v) => v.judge === judge)));
  const alpha = (filter: (judge: string) => boolean) => {
    const items: (number | null)[][] = [];
    for (const tool of tools) for (const criterion of rubric.criteria)
      items.push(allJudges.filter(filter).map((judge) => sites[tool].verdicts.find((v) => v.judge === judge)?.scores[criterion.key] ?? null));
    return krippendorffAlpha(items);
  };
  const result = {
    schema: 1, brief: brief.id, rubric: rubric.id, judges: allJudges, evaluatedAt: new Date().toISOString(), sites,
    agreement: { allJudges: alpha(() => true), withoutAnthropic: alpha((judge) => !judge.startsWith("anthropic/")) },
    note: "Each site is scored on its own (absolute), from screenshots, with tool names hidden. Radial Pulse generates with an Anthropic model, so scores are also reported without the Anthropic judge.",
  };
  await mkdir(`results/${brief.id}`, { recursive: true });
  await writeFile(`results/${brief.id}/design.json`, JSON.stringify(result, null, 2));
  console.log(`agreement (Krippendorff alpha): all ${result.agreement.allJudges?.toFixed(2)}, without Anthropic ${result.agreement.withoutAnthropic?.toFixed(2)}`);
}

const commands: Record<string, () => Promise<void>> = { run, design };
const command = commands[positionals[0] ?? ""];
if (command) command().catch((error) => { console.error(error); process.exit(1); });
else console.log("Commands: run, design");
