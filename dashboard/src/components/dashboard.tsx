"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
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
type Verdict = { judge: string; scores: Record<string, number>; issues: string[]; strengths: string[] };
type DesignBrief = { judges: string[]; agreement: { allJudges: number | null; withoutAnthropic: number | null }; sites: Record<string, { anonId: string; verdicts: Verdict[] }> };
type Brief = { id: string; title: string; prompt: string; requiredPages: string[]; requiredFacts: string[] };
type Panel = { raters: number; roles: Record<string, number>; sites: { anonId: string; raters: number; means: Record<string, number | null>; preferred: number }[] };
const data = raw as unknown as {
  collectedAt: string; briefs: Record<string, Brief>; runs: Run[]; design: Record<string, DesignBrief>;
  rubric: { criteria: { key: string; label: string }[] };
};

const CATEGORIES = [
  { key: "performance", label: "Performance" },
  { key: "accessibility", label: "Accessibility" },
  { key: "best-practices", label: "Best practices" },
  { key: "seo", label: "SEO" },
] as const;
const BUILDERS: Record<string, { name: string; color: string }> = {
  radialpulse: { name: "Radial Pulse", color: "#ff5e3a" },
  replit: { name: "Replit", color: "#16b39e" },
  lovable: { name: "Lovable", color: "#e84393" },
  v0: { name: "v0", color: "#7c6cf0" },
  bolt: { name: "Bolt", color: "#f5a700" },
};
const builder = (tool: string) => BUILDERS[tool] ?? { name: tool, color: "#8a93b8" };
const JUDGE_VENDORS: Record<string, string> = { anthropic: "Claude", openai: "GPT", google: "Gemini", xai: "Grok" };
const judgeName = (id: string) => `${JUDGE_VENDORS[id.split("/")[0]] ?? id.split("/")[0]} ${id.split("/")[1]?.replace(/^(claude|gpt|gemini)-/, "").replace("-preview", "") ?? ""}`;
const avg = (values: (number | null | undefined)[]) => {
  const n = values.filter((v): v is number => typeof v === "number");
  return n.length ? n.reduce((a, b) => a + b, 0) / n.length : null;
};
const one = (value: number | null | undefined) => (value === null || value === undefined ? "—" : value.toFixed(1));

function heat(score: number | null) {
  if (score === null) return { background: "#eef0f7", color: "var(--wb-muted)" };
  const t = Math.max(0, Math.min(1, (score - 2.5) / 2.5));
  return { background: `color-mix(in oklab, #ffd23f ${Math.round(14 + t * 76)}%, #ffffff)`, color: "var(--wb-ink)" };
}

function lhTone(score: number | null) {
  if (score === null) return "text-[var(--wb-muted)]";
  if (score >= 90) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

function Lane({ name, color, value, max, label, delay }: { name: string; color: string; value: number | null; max: number; label: string; delay: number }) {
  const pct = value === null ? 0 : Math.max(2, (value / max) * 100);
  return (
    <div className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-3 sm:grid-cols-[8.5rem_1fr_4rem]">
      <span className="truncate text-sm text-white/80">{name}</span>
      <div className="relative h-9 overflow-hidden rounded-r-md bg-white/[0.06]">
        <div className="wb-lane-bar absolute inset-y-0 left-0 rounded-r-md" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}40, ${color})`, animationDelay: `${delay}ms` }} />
      </div>
      <span className="wb-num wb-lane-value text-right text-2xl font-semibold text-white" style={{ animationDelay: `${delay + 900}ms` }}>
        {value === null ? "—" : label}
      </span>
    </div>
  );
}

export function Dashboard() {
  const briefIds = Object.keys(data.briefs);
  const [briefId, setBriefId] = useState(briefIds[0]);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [panel, setPanel] = useState<Panel | null>(null);
  const brief = data.briefs[briefId];
  const runs = useMemo(() => data.runs.filter((r) => r.brief === briefId).sort((a, b) => builder(a.tool).name.localeCompare(builder(b.tool).name)), [briefId]);
  const design = data.design[briefId];
  const criteria = data.rubric.criteria;

  useEffect(() => {
    fetch(`/api/ratings?brief=${encodeURIComponent(briefId)}`).then((r) => (r.ok ? r.json() : null)).then(setPanel).catch(() => setPanel(null));
  }, [briefId]);

  const judges = design?.judges ?? [];
  const spread = (judge: string) => {
    const values = Object.values(design?.sites ?? {}).flatMap((s) => Object.values(s.verdicts.find((v) => v.judge === judge)?.scores ?? {}));
    return values.length ? Math.max(...values) - Math.min(...values) : 0;
  };
  const counted = judges.filter((j) => spread(j) > 0);
  const designScore = (tool: string, key?: string) => avg((design?.sites[tool]?.verdicts ?? []).filter((v) => counted.includes(v.judge)).flatMap((v) => (key ? [v.scores[key]] : Object.values(v.scores))));
  const techScore = (run: Run) => avg(CATEGORIES.map((c) => run.lighthouse.mobile.scores[c.key]));
  const anonToTool = Object.fromEntries(Object.entries(design?.sites ?? {}).map(([tool, s]) => [s.anonId, tool]));
  const chartData = CATEGORIES.map((c) => ({ category: c.label, ...Object.fromEntries(runs.map((r) => [r.tool, r.lighthouse[device].scores[c.key] ?? 0])) }));

  return (
    <div className="min-h-screen">
      <section className="wb-hero relative overflow-hidden text-white">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pt-5 sm:px-6">
          <a href="/" className="wb-display flex items-center gap-2 text-lg font-bold tracking-tight">
            <svg aria-hidden viewBox="0 0 24 24" className="size-6"><rect x="2" y="4" width="20" height="3" rx="1.5" fill="#ffd23f" /><rect x="2" y="10.5" width="14" height="3" rx="1.5" fill="#ff5e3a" /><rect x="2" y="17" width="17" height="3" rx="1.5" fill="#16b39e" /></svg>
            webgen-bench
          </a>
          <div className="flex items-center gap-1 text-sm">
            <a href="#technical" className="hidden rounded-md px-3 py-1.5 text-white/75 hover:text-white sm:block">Technical</a>
            <a href="#design" className="hidden rounded-md px-3 py-1.5 text-white/75 hover:text-white sm:block">Design</a>
            <a href="https://github.com/dhanushshenoyh/webgen-bench/blob/main/METHODOLOGY.md" className="hidden rounded-md px-3 py-1.5 text-white/75 hover:text-white sm:block">Method</a>
            <a href="/rate" className="ml-2 rounded-full bg-[var(--wb-signal)] px-4 py-1.5 font-semibold text-[var(--wb-ink)] transition-transform hover:-translate-y-0.5">Rate the sites</a>
          </div>
        </nav>

        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:pb-24 lg:pt-20">
          <div className="grid gap-6">
            <h1 className="wb-display text-[clamp(2.4rem,5.4vw,4.4rem)] font-extrabold leading-[0.98] tracking-[-0.035em] text-balance">
              One brief. Every builder. The same tests.
            </h1>
            <p className="max-w-[34rem] text-lg leading-relaxed text-white/75">
              AI website builders get an identical clinic brief. We score what they ship with Google Lighthouse, WCAG 2.2, the W3C validator, three blind AI design judges and a human panel.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {briefIds.length > 1 && (
                <select aria-label="Brief" value={briefId} onChange={(e) => setBriefId(e.target.value)} className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm text-white">
                  {briefIds.map((id) => <option key={id} value={id} className="text-black">{data.briefs[id].title}</option>)}
                </select>
              )}
              <details className="text-sm">
                <summary className="cursor-pointer list-none rounded-full border border-white/25 px-4 py-2 text-white/85 hover:bg-white/10">Read the brief</summary>
                <p className="mt-3 max-w-xl rounded-xl bg-white/10 p-4 leading-relaxed text-white/80">{brief.prompt}</p>
              </details>
            </div>
          </div>

          <div className="relative rounded-2xl border border-white/15 bg-white/[0.04] p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] backdrop-blur-sm sm:p-7">
            <div className="wb-sweep pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent" aria-hidden />
            <div className="mb-5 flex items-baseline justify-between gap-3">
              <h2 className="wb-display text-lg font-semibold">{brief.title}</h2>
              <span className="shrink-0 text-xs text-white/60">{runs.length} builders</span>
            </div>
            <div className="grid gap-6">
              <div className="grid gap-2.5">
                <p className="text-sm text-white/60">Technical quality: Lighthouse mobile average, out of 100</p>
                {runs.map((run, i) => <Lane key={run.tool} name={builder(run.tool).name} color={builder(run.tool).color} value={techScore(run)} max={100} label={String(Math.round(techScore(run) ?? 0))} delay={i * 180} />)}
              </div>
              {design && (
                <div className="grid gap-2.5">
                  <p className="text-sm text-white/60">Design quality: blind AI judges, out of 5</p>
                  {runs.map((run, i) => <Lane key={run.tool} name={builder(run.tool).name} color={builder(run.tool).color} value={designScore(run.tool)} max={5} label={one(designScore(run.tool))} delay={500 + i * 180} />)}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto grid max-w-6xl gap-20 px-4 py-16 sm:px-6">
        {design && (
          <section className="grid gap-6">
            <div className="grid gap-2">
              <h2 className="wb-display text-3xl font-bold tracking-tight">The contenders</h2>
              <p className="max-w-2xl text-[var(--wb-muted)]">What each builder shipped from the same brief, captured at 1440 px. Hover to see further down the page.</p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {runs.map((run) => {
                const site = design.sites[run.tool];
                const b = builder(run.tool);
                return (
                  <figure key={run.tool} className="group overflow-hidden rounded-2xl border border-[var(--wb-line)] bg-[var(--wb-card)] shadow-[0_24px_60px_-38px_rgba(18,21,61,0.55)]">
                    <div className="flex items-center gap-1.5 border-b border-[var(--wb-line)] bg-[#eef0f7] px-4 py-2.5">
                      <span className="size-2.5 rounded-full bg-[#ff5f57]" /><span className="size-2.5 rounded-full bg-[#febc2e]" /><span className="size-2.5 rounded-full bg-[#28c840]" />
                      <span className="ml-3 truncate text-xs text-[var(--wb-muted)]">{b.name}, generated {run.generated ?? "date unknown"}</span>
                    </div>
                    {site && (
                      <div className="relative aspect-[16/10] overflow-hidden bg-[var(--wb-paper)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/panel/${briefId}/${site.anonId}-index-1440-0.jpg`} alt={`Home page built by ${b.name}`} className="absolute inset-x-0 top-0 w-full" />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/panel/${briefId}/${site.anonId}-index-1440-1.jpg`} alt="" aria-hidden className="absolute inset-x-0 top-0 w-full opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                      </div>
                    )}
                    <figcaption className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                      <span className="wb-display flex items-center gap-2 text-lg font-semibold"><span className="size-3 rounded-full" style={{ background: b.color }} />{b.name}</span>
                      <span className="flex gap-5 text-sm text-[var(--wb-muted)]">
                        <span><span className="wb-num text-xl font-semibold text-[var(--wb-ink)]">{Math.round(techScore(run) ?? 0)}</span> technical</span>
                        <span><span className="wb-num text-xl font-semibold text-[var(--wb-ink)]">{one(designScore(run.tool))}</span> design</span>
                      </span>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </section>
        )}

        <section id="technical" className="grid scroll-mt-8 gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="grid gap-2">
              <h2 className="wb-display text-3xl font-bold tracking-tight">Technical quality</h2>
              <p className="max-w-2xl text-[var(--wb-muted)]">Google Lighthouse {runs[0]?.lighthouse.mobile.version}, median of {runs[0]?.lighthouse.mobile.runs} runs per page. 90 and above is good; below 50 is poor.</p>
            </div>
            <div role="radiogroup" aria-label="Device" className="inline-flex rounded-full border border-[var(--wb-line)] bg-white p-1 text-sm">
              {(["mobile", "desktop"] as const).map((d) => (
                <button key={d} role="radio" aria-checked={device === d} onClick={() => setDevice(d)} className={`rounded-full px-4 py-1.5 capitalize transition-colors ${device === d ? "bg-[var(--wb-ink)] text-white" : "text-[var(--wb-muted)] hover:text-[var(--wb-ink)]"}`}>{d}</button>
              ))}
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
            <div className="min-w-0 overflow-x-auto rounded-2xl border border-[var(--wb-line)] bg-white p-5">
              <div className="min-w-[520px]">
              <BarChart data={chartData} xDataKey="category" aspectRatio="16 / 9" barGap={0.3}>
                <Grid horizontal rowTickValues={[50, 90]} strokeDasharray="4 4" />
                {runs.map((run) => <Bar key={run.tool} dataKey={run.tool} fill={builder(run.tool).color} lineCap={6} />)}
                <BarXAxis />
                <ChartTooltip />
              </BarChart>
              </div>
            </div>
            <div className="grid content-start gap-3">
              {runs.map((run) => {
                const m = run.lighthouse[device].metrics;
                const b = builder(run.tool);
                return (
                  <div key={run.tool} className="grid gap-3 rounded-2xl border border-[var(--wb-line)] bg-white p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="wb-display flex items-center gap-2 font-semibold"><span className="size-2.5 rounded-full" style={{ background: b.color }} />{b.name}</span>
                      <span className="flex gap-3 text-sm">
                        {CATEGORIES.map((c) => <span key={c.key} title={c.label} className={`wb-num font-semibold ${lhTone(run.lighthouse[device].scores[c.key])}`}>{run.lighthouse[device].scores[c.key] ?? "—"}</span>)}
                      </span>
                    </div>
                    <dl className="grid grid-cols-3 gap-2 text-sm">
                      {[
                        { label: "Largest paint", value: `${(m.lcpMs / 1000).toFixed(1)} s`, ok: m.lcpMs <= 2500 },
                        { label: "Layout shift", value: m.cls.toFixed(2), ok: m.cls <= 0.1 },
                        { label: "Blocking time", value: `${Math.round(m.tbtMs)} ms`, ok: m.tbtMs <= 200 },
                      ].map((item) => (
                        <div key={item.label} className="rounded-xl bg-[var(--wb-paper)] px-3 py-2">
                          <dt className="text-xs text-[var(--wb-muted)]">{item.label}</dt>
                          <dd className={`wb-num text-base font-semibold ${item.ok ? "text-[var(--wb-ink)]" : "text-red-600"}`}>{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="text-xs text-[var(--wb-muted)]">
                      {run.axe.rules.length} WCAG 2.2 rule failures, {run.validator.errors} HTML errors, {run.content.missingFacts.length + run.content.missingPages.length === 0 ? "brief fully covered" : `missing ${[...run.content.missingPages, ...run.content.missingFacts].join(", ")}`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {design && (
          <section id="design" className="grid scroll-mt-8 gap-6">
            <div className="grid gap-2">
              <h2 className="wb-display text-3xl font-bold tracking-tight">Design quality</h2>
              <p className="max-w-2xl text-[var(--wb-muted)]">
                Each site is scored on its own, never side by side, from desktop and phone screenshots with builder names hidden. Scale 1 to 5. Judges that gave every site the same score are shown but not counted.
              </p>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-[var(--wb-line)] bg-white">
              <table className="w-full min-w-[520px] border-separate border-spacing-1 p-3 text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-[var(--wb-muted)]">Criterion</th>
                    {runs.map((run) => <th key={run.tool} className="px-3 py-2 text-left font-semibold"><span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: builder(run.tool).color }} />{builder(run.tool).name}</span></th>)}
                  </tr>
                </thead>
                <tbody>
                  {criteria.map((c) => (
                    <tr key={c.key}>
                      <td className="px-3 py-2">{c.label}</td>
                      {runs.map((run) => { const s = designScore(run.tool, c.key); return <td key={run.tool} className="wb-num rounded-lg px-3 py-2 text-base font-semibold" style={heat(s)}>{one(s)}</td>; })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {judges.map((judge) => (
                <div key={judge} className={`grid content-start gap-3 rounded-2xl border border-[var(--wb-line)] bg-white p-5 ${counted.includes(judge) ? "" : "opacity-70"}`}>
                  <div className="flex items-baseline justify-between"><h3 className="wb-display font-semibold">{judgeName(judge)}</h3>{!counted.includes(judge) && <span className="text-xs text-amber-700">not counted</span>}</div>
                  {runs.map((run) => {
                    const v = design.sites[run.tool]?.verdicts.find((x) => x.judge === judge);
                    const value = v ? avg(Object.values(v.scores)) : null;
                    return (
                      <div key={run.tool} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2 text-sm">
                        <span className="truncate text-[var(--wb-muted)]">{builder(run.tool).name}</span>
                        <span className="h-2 overflow-hidden rounded-full bg-[var(--wb-paper)]"><span className="block h-full rounded-full" style={{ width: `${((value ?? 0) / 5) * 100}%`, background: builder(run.tool).color }} /></span>
                        <span className="wb-num text-right font-semibold">{one(value)}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <details className="rounded-2xl border border-[var(--wb-line)] bg-white p-5 text-sm">
              <summary className="cursor-pointer font-semibold">What the judges criticised</summary>
              <div className="mt-4 grid gap-6 md:grid-cols-2">
                {runs.map((run) => (
                  <div key={run.tool} className="grid content-start gap-2">
                    <h4 className="flex items-center gap-2 font-semibold"><span className="size-2.5 rounded-full" style={{ background: builder(run.tool).color }} />{builder(run.tool).name}</h4>
                    <ul className="grid list-disc gap-1.5 pl-5 text-[var(--wb-muted)]">
                      {(design.sites[run.tool]?.verdicts ?? []).filter((v) => counted.includes(v.judge)).flatMap((v) => v.issues.map((issue, i) => <li key={`${v.judge}-${i}`}>{issue} <span className="text-xs">({judgeName(v.judge)})</span></li>))}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
            <p className="text-xs text-[var(--wb-muted)]">Agreement between judges (Krippendorff&apos;s alpha) is {one(design.agreement.allJudges)}; with only {runs.length} sites this is not yet meaningful. The same judge scoring the same site varies by about 0.2 between runs.</p>
          </section>
        )}

        <section className="relative overflow-hidden rounded-3xl bg-[var(--wb-signal)] px-6 py-12 text-[var(--wb-ink)] sm:px-12">
          <svg aria-hidden viewBox="0 0 400 200" className="pointer-events-none absolute -bottom-10 -left-16 hidden h-48 opacity-[0.12] md:block"><rect x="0" y="30" width="380" height="22" rx="11" fill="#12153d" /><rect x="0" y="90" width="260" height="22" rx="11" fill="#12153d" /><rect x="0" y="150" width="320" height="22" rx="11" fill="#12153d" /></svg>
          <div className="relative grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-center">
            <div className="grid gap-3">
              <h2 className="wb-display text-3xl font-extrabold tracking-tight sm:text-4xl">Your eye is the final judge.</h2>
              <p className="max-w-xl text-lg">Browse each site blind, in random order, and score it on the same rubric as the AI judges. About five minutes per site.</p>
            </div>
            <div className="grid gap-3 md:justify-items-end">
              <a href="/rate" className="w-fit rounded-full bg-[var(--wb-ink)] px-6 py-3 font-semibold text-white transition-transform hover:-translate-y-0.5">Rate the sites</a>
              <p className="text-sm">
                {panel === null ? "Panel results load here." : panel.raters === 0 ? "No ratings yet. Be the first." : `${panel.raters} rater${panel.raters === 1 ? "" : "s"} so far: ${panel.sites.map((s) => `${builder(anonToTool[s.anonId] ?? "").name} ${one(avg(Object.values(s.means)))}`).join(", ")}`}
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--wb-line)] bg-white">
        <div className="mx-auto grid max-w-6xl gap-3 px-4 py-10 text-sm text-[var(--wb-muted)] sm:px-6 md:grid-cols-[1fr_auto]">
          <div className="grid gap-1">
            <p className="wb-display font-semibold text-[var(--wb-ink)]">webgen-bench</p>
            <p>Lighthouse {runs[0]?.lighthouse.mobile.version}, axe-core {runs[0]?.axe.version}, {runs[0]?.validator.name}. Every site is served from the same local static server.</p>
            <p>Updated {new Date(data.collectedAt).toUTCString()}.</p>
          </div>
          <div className="flex gap-4 md:items-end">
            <a className="hover:text-[var(--wb-ink)]" href="https://github.com/dhanushshenoyh/webgen-bench/blob/main/METHODOLOGY.md">Methodology</a>
            <a className="hover:text-[var(--wb-ink)]" href="https://github.com/dhanushshenoyh/webgen-bench">Source</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
