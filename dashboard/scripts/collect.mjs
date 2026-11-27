// Copies benchmark results into the dashboard as one compact JSON file.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../../", import.meta.url).pathname;
const briefs = {};
for (const file of await readdir(join(root, "briefs"))) {
  if (!file.endsWith(".json")) continue;
  const brief = JSON.parse(await readFile(join(root, "briefs", file), "utf8"));
  briefs[brief.id] = { id: brief.id, title: brief.title, version: brief.version, prompt: brief.prompt, requiredPages: brief.requiredPages, requiredFacts: brief.requiredFacts };
}

const avg = (values) => {
  const numbers = values.filter((value) => typeof value === "number");
  return numbers.length ? Math.round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length) : null;
};

const runs = [];
for (const brief of await readdir(join(root, "results")).catch(() => [])) {
  for (const file of await readdir(join(root, "results", brief))) {
    if (!file.endsWith(".json")) continue;
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
await writeFile(new URL("../src/data/results.json", import.meta.url), JSON.stringify({ collectedAt: new Date().toISOString(), briefs, runs }, null, 2));
console.log(`collected ${runs.length} runs across ${Object.keys(briefs).length} briefs`);
