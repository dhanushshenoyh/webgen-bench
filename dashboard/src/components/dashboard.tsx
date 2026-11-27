"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { RingChart } from "@/components/charts/ring-chart";
import { Ring } from "@/components/charts/ring";
import { RadarChart } from "@/components/charts/radar-chart";
import { RadarGrid } from "@/components/charts/radar-grid";
import { RadarAxis } from "@/components/charts/radar-axis";
import { RadarLabels } from "@/components/charts/radar-labels";
import { RadarArea } from "@/components/charts/radar-area";
import { ArcGauge, Bullet, CountUp, JudgeDots, Mark, ScrollProgress, Segmented, TiltCard } from "@/components/viz";
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
        {value === null ? "—" : <CountUp value={value} decimals={label.includes(".") ? 1 : 0} duration={1500} />}
      </span>
    </div>
  );
}

export function Dashboard() {
  const briefIds = Object.keys(data.briefs);
  const [briefId, setBriefId] = useState(briefIds[0]);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [panel, setPanel] = useState<Panel | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [hoverCell, setHoverCell] = useState<string | null>(null);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
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
      <ScrollProgress />
      <header className={`sticky top-0 z-40 text-white transition-[background-color,box-shadow] duration-300 ${scrolled ? "wb-nav-scrolled" : "bg-[var(--wb-ultra)]"}`}>
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <a href="/" className="wb-display flex items-center gap-2 text-lg font-bold tracking-tight">
            <svg aria-hidden viewBox="0 0 24 24" className="size-6"><rect x="2" y="4" width="20" height="3" rx="1.5" fill="#ffd23f" /><rect x="2" y="10.5" width="14" height="3" rx="1.5" fill="#ff5e3a" /><rect x="2" y="17" width="17" height="3" rx="1.5" fill="#16b39e" /></svg>
            webgen-bench
          </a>
          <div className="flex items-center gap-1 text-sm">
            <a href="#technical" className="hidden rounded-md px-3 py-1.5 text-white/75 hover:text-white sm:block">Technical</a>
            <a href="#design" className="hidden rounded-md px-3 py-1.5 text-white/75 hover:text-white sm:block">Design</a>
            <a href="https://github.com/dhanushshenoyh/webgen-bench/blob/main/METHODOLOGY.md" className="hidden rounded-md px-3 py-1.5 text-white/75 hover:text-white sm:block">Method</a>
            <a href="/rate" className="wb-press ml-2 rounded-full bg-[var(--wb-signal)] px-4 py-1.5 font-semibold text-[var(--wb-ink)]">Rate the sites</a>
          </div>
        </nav>
      </header>
      <section className="wb-hero relative overflow-hidden text-white">


        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:pb-24 lg:pt-16">
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
                  <TiltCard key={run.tool} className="rounded-2xl">
                  <figure className="group overflow-hidden rounded-2xl border border-[var(--wb-line)] bg-[var(--wb-card)] shadow-[0_24px_60px_-38px_rgba(18,21,61,0.55)]">
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
                        <span><CountUp value={techScore(run)} className="wb-num text-xl font-semibold text-[var(--wb-ink)]" /> technical</span>
                        <span><CountUp value={designScore(run.tool)} decimals={1} className="wb-num text-xl font-semibold text-[var(--wb-ink)]" /> design</span>
                      </span>
                    </figcaption>
                  </figure>
                  </TiltCard>
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
            <Segmented label="Device" value={device} onChange={setDevice} options={[{ value: "mobile", label: "Mobile" }, { value: "desktop", label: "Desktop" }]} />
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
            <div className="min-w-0 self-start overflow-x-auto rounded-2xl border border-[var(--wb-line)] bg-white p-5">
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
                const sc = run.lighthouse[device].scores;
                const ringData = CATEGORIES.map((c, i) => ({ label: c.label, value: sc[c.key] ?? 0, maxValue: 100, color: ["#ff5e3a", "#16b39e", "#7c6cf0", "#f5a700"][i] }));
                return (
                  <div key={`${run.tool}-${device}`} className="grid gap-4 rounded-2xl border border-[var(--wb-line)] bg-white p-5 transition-shadow duration-300 hover:shadow-[0_24px_50px_-34px_rgba(18,21,61,0.5)] sm:grid-cols-[150px_1fr]">
                    <div className="grid justify-items-center gap-2">
                      <div className="relative">
                        <RingChart data={ringData} size={156} strokeWidth={7} ringGap={3}>
                          {ringData.map((_, i) => <Ring key={i} index={i} />)}
                        </RingChart>
                        <div className="pointer-events-none absolute inset-0 grid place-content-center justify-items-center">
                          <CountUp value={avg(ringData.map((r) => r.value))} className="wb-num text-xl font-bold leading-none" />
                          <span className="text-[10px] text-[var(--wb-muted)]">average</span>
                        </div>
                      </div>
                      <span className="wb-display flex items-center gap-2 font-semibold"><span className="size-2.5 rounded-full" style={{ background: b.color }} />{b.name}</span>
                    </div>
                    <div className="grid content-start gap-3">
                      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        {CATEGORIES.map((c, i) => (
                          <li key={c.key} className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 text-[var(--wb-muted)]"><span className="size-2 rounded-full" style={{ background: ringData[i].color }} />{c.label}</span>
                            <span className={`wb-num font-semibold ${lhTone(sc[c.key])}`}>{sc[c.key] ?? "—"}</span>
                          </li>
                        ))}
                      </ul>
                      <Bullet label="Largest contentful paint" value={m.lcpMs / 1000} unit=" s" good={2.5} poor={4} max={6} format={(v) => v.toFixed(1)} />
                      <Bullet label="Cumulative layout shift" value={m.cls} unit="" good={0.1} poor={0.25} max={0.4} format={(v) => v.toFixed(2)} />
                      <Bullet label="Total blocking time" value={m.tbtMs} unit=" ms" good={200} poor={600} max={1000} format={(v) => String(Math.round(v))} />
                      <div className="flex flex-wrap gap-x-3 gap-y-1.5 border-t border-[var(--wb-line)] pt-3 text-xs">
                        <span className="flex items-center gap-1.5"><Mark ok={run.axe.rules.length === 0} />{run.axe.rules.length} WCAG failures</span>
                        <span className="flex items-center gap-1.5"><Mark ok={run.validator.errors === 0} />{run.validator.errors} HTML errors</span>
                        {brief.requiredFacts.map((fact) => <span key={fact} className="flex items-center gap-1.5"><Mark ok={!run.content.missingFacts.includes(fact)} />{fact}</span>)}
                      </div>
                    </div>
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
            <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
              <div className="grid place-items-center overflow-hidden rounded-2xl border border-[var(--wb-line)] bg-white p-4">
                <RadarChart data={runs.map((run) => ({ label: builder(run.tool).name, color: builder(run.tool).color, values: Object.fromEntries(criteria.map((c) => [c.key, ((designScore(run.tool, c.key) ?? 0) / 5) * 100])) }))}
                  metrics={criteria.map((c) => ({ key: c.key, label: c.label.replace(" and ", " & ") }))} size={440} levels={5} margin={92}>
                  <RadarGrid />
                  <RadarAxis />
                  <RadarLabels fontSize={11} />
                  {runs.map((run, i) => <RadarArea key={run.tool} index={i} color={builder(run.tool).color} showGlow />)}
                </RadarChart>
                <div className="flex gap-4 text-xs text-[var(--wb-muted)]">{runs.map((run) => <span key={run.tool} className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: builder(run.tool).color }} />{builder(run.tool).name}</span>)}</div>
              </div>
              <div className="grid content-start gap-4 sm:grid-cols-2">
                {runs.map((run) => {
                  const value = designScore(run.tool);
                  return (
                    <div key={run.tool} className="grid justify-items-center gap-1 rounded-2xl border border-[var(--wb-line)] bg-white p-5">
                      <ArcGauge value={value} max={5} color={builder(run.tool).color} label={`${builder(run.tool).name} design score`} />
                      <span className="wb-display flex items-center gap-2 font-semibold"><span className="size-2.5 rounded-full" style={{ background: builder(run.tool).color }} />{builder(run.tool).name}</span>
                    </div>
                  );
                })}
                <div className="grid gap-3 rounded-2xl border border-[var(--wb-line)] bg-white p-5 sm:col-span-2">
                  <h3 className="wb-display font-semibold">Where the judges land</h3>
                  <JudgeDots judges={judges.map((j) => `${judgeName(j)}${counted.includes(j) ? "" : " (not counted)"}`)} rows={runs.map((run) => ({ name: builder(run.tool).name, color: builder(run.tool).color, scores: judges.map((j) => { const v = design.sites[run.tool]?.verdicts.find((x) => x.judge === j); return v ? avg(Object.values(v.scores)) : null; }) }))} />
                </div>
              </div>
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
                      {runs.map((run) => {
                        const value = designScore(run.tool, c.key);
                        const id = `${run.tool}:${c.key}`;
                        return (
                          <td key={run.tool} tabIndex={0} onMouseEnter={() => setHoverCell(id)} onMouseLeave={() => setHoverCell(null)} onFocus={() => setHoverCell(id)} onBlur={() => setHoverCell(null)}
                            className="wb-cell wb-num relative cursor-default rounded-lg px-3 py-2 text-base font-semibold" style={heat(value)}>
                            {one(value)}
                            {hoverCell === id && (
                              <span role="tooltip" className="absolute left-1/2 top-full z-20 mt-2 grid w-48 -translate-x-1/2 gap-1 rounded-xl bg-[var(--wb-ink)] p-3 text-xs font-normal text-white shadow-xl">
                                {(design.sites[run.tool]?.verdicts ?? []).map((v) => <span key={v.judge} className="flex justify-between gap-2"><span className="text-white/70">{judgeName(v.judge)}</span><span className="wb-num font-semibold">{v.scores[c.key]}</span></span>)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
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

          <div className="relative grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-center">
            <div className="grid gap-3">
              <h2 className="wb-display text-3xl font-extrabold tracking-tight sm:text-4xl">Your eye is the final judge.</h2>
              <p className="max-w-xl text-lg">Browse each site blind, in random order, and score it on the same rubric as the AI judges. About five minutes per site.</p>
            </div>
            <div className="grid gap-3 md:justify-items-end">
              <a href="/rate" className="wb-press w-fit rounded-full bg-[var(--wb-ink)] px-6 py-3 font-semibold text-white">Rate the sites</a>
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
