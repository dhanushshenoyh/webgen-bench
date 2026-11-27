"use client";

import { useMemo, useState } from "react";
import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { RadarChart } from "@/components/charts/radar-chart";
import { RadarGrid } from "@/components/charts/radar-grid";
import { RadarAxis } from "@/components/charts/radar-axis";
import { RadarLabels } from "@/components/charts/radar-labels";
import { RadarArea } from "@/components/charts/radar-area";
import raw from "@/data/results.json";

type Rule = { id: string; impact: string | null; help: string; wcag: string[]; nodes: number; pages: string[] };
type Scores = Record<"performance" | "accessibility" | "best-practices" | "seo", number | null>;
type Lh = { scores: Scores; metrics: { lcpMs: number; cls: number; tbtMs: number }; runs: number; version: string };
type Run = {
  brief: string; tool: string; generated: string | null; notes: string | null; siteHash: string; pages: string[];
  lighthouse: Record<"mobile" | "desktop", Lh>;
  axe: { version: string; rules: Rule[] };
  validator: { name: string; errors: number; warnings: number; top: { page: string; message: string }[] };
  content: { missingPages: string[]; missingFacts: string[] };
};
type Brief = { id: string; title: string; prompt: string; requiredPages: string[]; requiredFacts: string[] };
const data = raw as unknown as { collectedAt: string; briefs: Record<string, Brief>; runs: Run[] };
type FormFactor = "mobile" | "desktop";

const CATEGORIES = [
  { key: "performance", label: "Performance" },
  { key: "accessibility", label: "Accessibility" },
  { key: "best-practices", label: "Best practices" },
  { key: "seo", label: "SEO" },
] as const;
const TOOL_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const TOOL_NAMES: Record<string, string> = { radialpulse: "Radial Pulse", replit: "Replit", lovable: "Lovable", v0: "v0", bolt: "Bolt" };
const toolName = (tool: string) => TOOL_NAMES[tool] ?? tool;

function band(score: number | null) {
  if (score === null) return { label: "n/a", cls: "text-muted-foreground" };
  if (score >= 90) return { label: "Good", cls: "text-emerald-600 dark:text-emerald-400" };
  if (score >= 50) return { label: "Needs work", cls: "text-amber-600 dark:text-amber-400" };
  return { label: "Poor", cls: "text-red-600 dark:text-red-400" };
}

function Pill({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-red-500/10 text-red-700 dark:text-red-300"}`}>
      {children}
    </span>
  );
}

function Section({ title, kicker, children }: { title: string; kicker?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4">
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold tracking-tight text-balance">{title}</h2>
        {kicker && <p className="max-w-3xl text-sm text-muted-foreground">{kicker}</p>}
      </div>
      {children}
    </section>
  );
}

export function Dashboard() {
  const briefIds = Object.keys(data.briefs);
  const [briefId, setBriefId] = useState(briefIds[0]);
  const [formFactor, setFormFactor] = useState<FormFactor>("mobile");
  const brief = data.briefs[briefId];
  const runs = useMemo(() => data.runs.filter((run) => run.brief === briefId).sort((a, b) => a.tool.localeCompare(b.tool)), [briefId]);

  const chartData = CATEGORIES.map((category) => ({
    category: category.label,
    ...Object.fromEntries(runs.map((run) => [run.tool, run.lighthouse[formFactor].scores[category.key] ?? 0])),
  }));
  const radarData = runs.map((run, index) => ({
    label: toolName(run.tool),
    color: TOOL_COLORS[index % TOOL_COLORS.length],
    values: Object.fromEntries(CATEGORIES.map((category) => [category.key, run.lighthouse[formFactor].scores[category.key] ?? 0])),
  }));

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-10 sm:px-6">
      <header className="grid gap-4">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">webgen-bench · same brief, same standards</p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">How AI website builders compare</h1>
        <p className="max-w-3xl text-muted-foreground">
          Each builder receives the identical brief. Every result is scored with published, widely used tools: Google Lighthouse, axe-core for WCAG 2.2 AA and the W3C HTML validator. Scores are medians of repeated runs.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted-foreground" htmlFor="brief">Brief</label>
          <select id="brief" value={briefId} onChange={(event) => setBriefId(event.target.value)} className="rounded-md border bg-background px-3 py-1.5 text-sm">
            {briefIds.map((id) => <option key={id} value={id}>{data.briefs[id].title}</option>)}
          </select>
          <div role="radiogroup" aria-label="Device" className="inline-flex rounded-md border p-0.5">
            {(["mobile", "desktop"] as const).map((value) => (
              <button key={value} role="radio" aria-checked={formFactor === value} onClick={() => setFormFactor(value)}
                className={`rounded px-3 py-1 text-sm capitalize transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${formFactor === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
                {value}
              </button>
            ))}
          </div>
        </div>
        <details className="max-w-3xl rounded-lg border bg-card p-4 text-sm">
          <summary className="cursor-pointer font-medium">Read the brief every builder received</summary>
          <p className="mt-3 leading-relaxed text-muted-foreground">{brief.prompt}</p>
          <p className="mt-3 text-muted-foreground">Required pages: {brief.requiredPages.join(", ")}. Required facts: {brief.requiredFacts.join(", ")}.</p>
        </details>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {runs.map((run, index) => {
          const scores = run.lighthouse[formFactor].scores;
          return (
            <article key={run.tool} className="grid gap-4 rounded-xl border bg-card p-5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="flex items-center gap-2 font-semibold">
                  <span aria-hidden className="size-2.5 rounded-full" style={{ background: TOOL_COLORS[index % TOOL_COLORS.length] }} />
                  {toolName(run.tool)}
                </h3>
                <span className="font-mono text-xs text-muted-foreground">{run.generated ?? "date unknown"}</span>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                {CATEGORIES.map((category) => {
                  const value = scores[category.key];
                  const b = band(value);
                  return (
                    <div key={category.key} className="grid gap-0.5">
                      <dt className="text-xs text-muted-foreground">{category.label}</dt>
                      <dd className="flex items-baseline gap-2"><span className="font-mono text-2xl font-semibold tabular-nums">{value ?? "—"}</span><span className={`text-xs ${b.cls}`}>{b.label}</span></dd>
                    </div>
                  );
                })}
              </dl>
              <div className="flex flex-wrap gap-2 border-t pt-3 text-xs">
                <Pill ok={run.axe.rules.length === 0}>{run.axe.rules.length} WCAG rule{run.axe.rules.length === 1 ? "" : "s"} failed</Pill>
                <Pill ok={run.validator.errors === 0}>{run.validator.errors} HTML error{run.validator.errors === 1 ? "" : "s"}</Pill>
                <Pill ok={run.content.missingFacts.length === 0 && run.content.missingPages.length === 0}>
                  {run.content.missingFacts.length + run.content.missingPages.length === 0 ? "Brief fully covered" : `${run.content.missingFacts.length + run.content.missingPages.length} brief items missing`}
                </Pill>
              </div>
            </article>
          );
        })}
      </div>

      <Section title="Lighthouse scores" kicker={`Average across pages, ${formFactor}. Google bands: 90–100 good, 50–89 needs improvement, 0–49 poor.`}>
        <div className="grid gap-6 rounded-xl border bg-card p-4 lg:grid-cols-[1.6fr_1fr]">
          <div className="min-w-0">
            <BarChart data={chartData} xDataKey="category" aspectRatio="16 / 9" barGap={0.25}>
              <Grid horizontal rowTickValues={[50, 90]} strokeDasharray="4 4" />
              {runs.map((run, index) => <Bar key={run.tool} dataKey={run.tool} fill={TOOL_COLORS[index % TOOL_COLORS.length]} lineCap={4} />)}
              <BarXAxis />
              <ChartTooltip />
            </BarChart>
          </div>
          <div className="flex min-w-0 items-center justify-center">
            <RadarChart data={radarData} metrics={CATEGORIES.map((c) => ({ key: c.key, label: c.label }))} size={320} levels={4} margin={56}>
              <RadarGrid />
              <RadarAxis />
              <RadarLabels />
              {radarData.map((_, index) => <RadarArea key={index} index={index} />)}
            </RadarChart>
          </div>
        </div>
      </Section>

      <Section title="Loading and stability (lab)" kicker="Worst page per builder. Thresholds from Core Web Vitals: LCP ≤ 2.5 s and CLS ≤ 0.1. Total Blocking Time is the lab stand-in for INP (≤ 200 ms good).">
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3 font-medium">Builder</th><th className="px-4 py-3 font-medium">Largest Contentful Paint</th><th className="px-4 py-3 font-medium">Cumulative Layout Shift</th><th className="px-4 py-3 font-medium">Total Blocking Time</th></tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const m = run.lighthouse[formFactor].metrics;
                return (
                  <tr key={run.tool} className="border-t">
                    <td className="px-4 py-3 font-medium">{toolName(run.tool)}</td>
                    <td className="px-4 py-3"><Pill ok={m.lcpMs <= 2500}>{(m.lcpMs / 1000).toFixed(2)} s</Pill></td>
                    <td className="px-4 py-3"><Pill ok={m.cls <= 0.1}>{m.cls.toFixed(3)}</Pill></td>
                    <td className="px-4 py-3"><Pill ok={m.tbtMs <= 200}>{Math.round(m.tbtMs)} ms</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Accessibility: WCAG 2.2 A and AA rules" kicker="axe-core rules that failed on any page at 1440 px or 390 px. Automated rules find roughly half of accessibility issues; zero failures is not a conformance claim.">
        <div className="grid gap-4 lg:grid-cols-2">
          {runs.map((run) => (
            <div key={run.tool} className="rounded-xl border bg-card p-4">
              <h3 className="mb-3 font-medium">{toolName(run.tool)}</h3>
              {run.axe.rules.length === 0 ? <p className="text-sm text-muted-foreground">No automated WCAG rule failures.</p> : (
                <ul className="grid gap-2 text-sm">
                  {run.axe.rules.map((rule) => (
                    <li key={rule.id} className="grid gap-0.5">
                      <span className="font-medium">{rule.help}</span>
                      <span className="text-xs text-muted-foreground">{rule.impact ?? "unrated"} · WCAG {rule.wcag.join(", ") || "best practice"} · {rule.nodes} element{rule.nodes === 1 ? "" : "s"} · {rule.pages.join(", ")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="HTML conformance and brief coverage" kicker="W3C Nu HTML Checker errors, and whether every required page and fact from the brief appears in the visible text.">
        <div className="grid gap-4 lg:grid-cols-2">
          {runs.map((run) => (
            <div key={run.tool} className="grid gap-3 rounded-xl border bg-card p-4 text-sm">
              <h3 className="font-medium">{toolName(run.tool)}</h3>
              <p><Pill ok={run.validator.errors === 0}>{run.validator.errors} errors</Pill> <span className="text-muted-foreground">{run.validator.warnings} warnings</span></p>
              {run.validator.top.length > 0 && <ul className="grid list-disc gap-1 pl-5 text-xs text-muted-foreground">{run.validator.top.map((m, i) => <li key={i}>{m.page}: {m.message}</li>)}</ul>}
              <p className="text-muted-foreground">
                {run.content.missingPages.length + run.content.missingFacts.length === 0 ? "All required pages and facts present." : `Missing: ${[...run.content.missingPages, ...run.content.missingFacts].join(", ")}`}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <footer className="grid gap-2 border-t pt-6 text-xs text-muted-foreground">
        <p>Tools: Lighthouse {runs[0]?.lighthouse.mobile.version}, {runs[0]?.lighthouse.mobile.runs} runs per page and device (median); axe-core {runs[0]?.axe.version}; {runs[0]?.validator.name}.</p>
        <p>Every site is served from the same local static server. Site hashes: {runs.map((run) => `${toolName(run.tool)} ${run.siteHash}`).join(" · ")}. Collected {new Date(data.collectedAt).toUTCString()}.</p>
        <p>Design-quality scores (rubric judges and a blind human panel) are not shown yet.</p>
      </footer>
    </main>
  );
}
