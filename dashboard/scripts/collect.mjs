// Copies benchmark results into the dashboard as one compact JSON file.
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../../", import.meta.url).pathname;
const briefs = {};
for (const file of await readdir(join(root, "briefs"))) {
  if (!file.endsWith(".json")) continue;
  const brief = JSON.parse(await readFile(join(root, "briefs", file), "utf8"));
  briefs[brief.id] = { id: brief.id, title: brief.title, version: brief.version, prompt: brief.prompt, requiredPages: brief.requiredPages, requiredFacts: brief.requiredFacts, heldOut: Boolean(brief.heldOut) };
}

const avg = (values) => {
  const numbers = values.filter((value) => typeof value === "number");
  return numbers.length ? Math.round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length) : null;
};

const rubric = JSON.parse(await readFile(join(root, "rubric", "design-v1.json"), "utf8"));
const design = {};
const panel = {};
await rm(new URL("../public/sites/", import.meta.url), { recursive: true, force: true });
for (const brief of await readdir(join(root, "results")).catch(() => [])) {
  const file = join(root, "results", brief, "design.json");
  const result = JSON.parse(await readFile(file, "utf8").catch(() => "null"));
  if (!result) continue;
  design[brief] = { rubric: result.rubric, judges: result.judges, agreement: result.agreement, evaluatedAt: result.evaluatedAt, note: result.note,
    sites: Object.fromEntries(Object.entries(result.sites).map(([tool, site]) => [tool, { anonId: site.anonId, verdicts: site.verdicts.map((v) => ({ judge: v.judge, scores: v.scores, issues: v.issues, strengths: v.strengths })) }])) };
  // Blind panel: sites are served under an anonymous id, never the builder's name.
  panel[brief] = [];
  for (const [tool, site] of Object.entries(result.sites)) {
    await cp(join(root, "sites", `${brief}--${tool}`), new URL(`../public/sites/${site.anonId}/`, import.meta.url), { recursive: true });
    panel[brief].push({ anonId: site.anonId, pages: (await readdir(join(root, "sites", `${brief}--${tool}`))).filter((f) => f.endsWith(".html")).sort((a, b) => (a === "index.html" ? -1 : b === "index.html" ? 1 : a.localeCompare(b))) });
  }
}

const runs = [];
for (const brief of await readdir(join(root, "results")).catch(() => [])) {
  for (const file of await readdir(join(root, "results", brief))) {
    if (!file.endsWith(".json") || file === "design.json") continue;
    const result = JSON.parse(await readFile(join(root, "results", brief, file), "utf8"));
    const lighthouse = {};
    for (const formFactor of ["mobile", "desktop"]) {
      const rows = result.lighthouse.filter((row) => row.formFactor === formFactor);
      lighthouse[formFactor] = {
        scores: Object.fromEntries(["performance", "accessibility", "best-practices", "seo"].map((key) => [key, avg(rows.map((row) => row.scores[key]))])),
        metrics: {
          lcpMs: Math.max(...rows.map((row) => row.metrics.lcpMs ?? 0)),
          cls: Math.max(...rows.map((row) => row.metrics.cls ?? 0)),
          tbtMs: Math.max(...rows.map((row) => row.metrics.tbtMs ?? 0)),
        },
        pages: rows.map((row) => ({ page: row.page, scores: row.scores, metrics: row.metrics })),
        failedAudits: [...new Map(rows.flatMap((row) => row.failedAudits).map((audit) => [audit.id, audit])).values()],
        runs: rows[0]?.runs ?? 0,
        version: rows[0]?.lighthouseVersion ?? "",
      };
    }
    const byRule = new Map();
    for (const violation of result.axe.violations) {
      const entry = byRule.get(violation.id) ?? { id: violation.id, impact: violation.impact, help: violation.help, wcag: violation.wcag, nodes: 0, pages: new Set() };
      entry.nodes += violation.nodes;
      entry.pages.add(`${violation.page} @ ${violation.width}px`);
      byRule.set(violation.id, entry);
    }
    runs.push({
      brief: result.brief, tool: result.tool, generated: result.generated, notes: result.notes, evaluatedAt: result.evaluatedAt, siteHash: result.siteHash,
      pages: result.pages, lighthouse,
      axe: { version: result.axe.axeVersion, widths: result.axe.widths, rules: [...byRule.values()].map((rule) => ({ ...rule, pages: [...rule.pages] })) },
      validator: { name: result.validator.validator, errors: result.validator.errors, warnings: result.validator.warnings,
        top: [...new Map(result.validator.messages.filter((m) => m.type === "error").map((m) => [m.message, m])).values()].slice(0, 8).map((m) => ({ page: m.page, message: m.message })) },
      content: result.content,
    });
  }
}

await mkdir(new URL("../src/data/", import.meta.url), { recursive: true });
await writeFile(new URL("../src/data/results.json", import.meta.url), JSON.stringify({ collectedAt: new Date().toISOString(), briefs, runs, design, rubric: { id: rubric.id, criteria: rubric.criteria }, panel }, null, 2));
console.log(`collected ${runs.length} runs across ${Object.keys(briefs).length} briefs`);
