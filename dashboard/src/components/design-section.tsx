"use client";

import { useEffect, useState } from "react";
import raw from "@/data/results.json";

type Verdict = { judge: string; scores: Record<string, number>; issues: string[]; strengths: string[] };
type DesignBrief = { judges: string[]; agreement: { allJudges: number | null; withoutAnthropic: number | null }; note: string; sites: Record<string, { anonId: string; verdicts: Verdict[] }> };
type Panel = { raters: number; roles: Record<string, number>; sites: { anonId: string; raters: number; means: Record<string, number | null>; preferred: number }[] };
const data = raw as unknown as { design: Record<string, DesignBrief>; rubric: { criteria: { key: string; label: string }[] } };

const JUDGE_NAMES: Record<string, string> = { anthropic: "Claude", openai: "GPT", google: "Gemini", xai: "Grok" };
const judgeName = (id: string) => `${JUDGE_NAMES[id.split("/")[0]] ?? id.split("/")[0]} ${id.split("/")[1]?.replace(/^(claude|gpt|gemini)-/, "") ?? ""}`;
const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const fmt = (value: number | null | undefined) => (value === null || value === undefined ? "—" : value.toFixed(1));

export function DesignSection({ briefId, toolName, colors }: { briefId: string; toolName: (tool: string) => string; colors: Record<string, string> }) {
  const design = data.design[briefId];
  const criteria = data.rubric.criteria;
  const [panel, setPanel] = useState<Panel | null>(null);
  const [panelError, setPanelError] = useState(false);

  useEffect(() => {
    fetch(`/api/ratings?brief=${encodeURIComponent(briefId)}`).then((r) => (r.ok ? r.json() : Promise.reject())).then(setPanel).catch(() => setPanelError(true));
  }, [briefId]);

  if (!design) return null;
  const tools = Object.keys(design.sites).sort();
  const spread = (judge: string) => {
    const values = tools.flatMap((tool) => Object.values(design.sites[tool].verdicts.find((v) => v.judge === judge)?.scores ?? {}));
    return values.length ? Math.max(...values) - Math.min(...values) : 0;
  };
  const discriminating = design.judges.filter((judge) => spread(judge) > 0);
  const anonToTool = Object.fromEntries(tools.map((tool) => [design.sites[tool].anonId, tool]));

  return (
    <section className="grid gap-6">
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Design quality</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Each site is scored on its own (never side by side) from desktop and phone screenshots against a 10-point rubric, scale 1 to 5, with builder names hidden. {design.note.split(". ").slice(-1)[0]}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Criterion</th>
              {tools.map((tool) => <th key={tool} className="px-4 py-3 font-medium"><span className="inline-flex items-center gap-2"><span aria-hidden className="size-2 rounded-full" style={{ background: colors[tool] }} />{toolName(tool)}</span></th>)}
            </tr>
          </thead>
          <tbody>
            {criteria.map((criterion) => (
              <tr key={criterion.key} className="border-t">
                <td className="px-4 py-2.5">{criterion.label}</td>
                {tools.map((tool) => {
                  const value = mean(design.sites[tool].verdicts.filter((v) => discriminating.includes(v.judge)).map((v) => v.scores[criterion.key]));
                  return <td key={tool} className="px-4 py-2.5 font-mono tabular-nums">{fmt(value)}</td>;
                })}
              </tr>
            ))}
            <tr className="border-t font-semibold">
              <td className="px-4 py-3">Average</td>
              {tools.map((tool) => <td key={tool} className="px-4 py-3 font-mono tabular-nums">{fmt(mean(design.sites[tool].verdicts.filter((v) => discriminating.includes(v.judge)).flatMap((v) => Object.values(v.scores))))}</td>)}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {design.judges.map((judge) => (
          <div key={judge} className="grid content-start gap-2 rounded-xl border bg-card p-4 text-sm">
            <h3 className="font-medium">{judgeName(judge)}</h3>
            {tools.map((tool) => {
              const verdict = design.sites[tool].verdicts.find((v) => v.judge === judge);
              return <p key={tool} className="flex justify-between"><span className="text-muted-foreground">{toolName(tool)}</span><span className="font-mono tabular-nums">{fmt(verdict ? mean(Object.values(verdict.scores)) : null)}</span></p>;
            })}
            {!discriminating.includes(judge) && <p className="text-xs text-amber-700 dark:text-amber-300">Gave every site the same score on every criterion, so it is excluded from the table above.</p>}
          </div>
        ))}
      </div>

      <details className="rounded-xl border bg-card p-4 text-sm">
        <summary className="cursor-pointer font-medium">What the judges criticised</summary>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {tools.map((tool) => (
            <div key={tool} className="grid gap-2">
              <h4 className="font-medium">{toolName(tool)}</h4>
              <ul className="grid list-disc gap-1 pl-5 text-muted-foreground">
                {design.sites[tool].verdicts.filter((v) => discriminating.includes(v.judge)).flatMap((v) => v.issues.map((issue, i) => <li key={`${v.judge}-${i}`}>{issue} <span className="text-xs">({judgeName(v.judge)})</span></li>))}
              </ul>
            </div>
          ))}
        </div>
      </details>

      <p className="text-xs text-muted-foreground">
        Agreement between judges (Krippendorff&apos;s alpha): {fmt(design.agreement.allJudges)}. With only {tools.length} sites this number is not yet meaningful; it becomes informative as more builders and briefs are added.
      </p>

      <div className="grid gap-3 rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">Human panel (blind)</h3>
          <a href="/rate" className="rounded-md bg-foreground px-3 py-1.5 text-sm text-background">Rate these websites</a>
        </div>
        {panelError && <p className="text-sm text-muted-foreground">Panel results could not be loaded.</p>}
        {panel && panel.raters === 0 && <p className="text-sm text-muted-foreground">No ratings yet. Raters see the sites without builder names, in random order, and score each one on the same rubric.</p>}
        {panel && panel.raters > 0 && (
          <div className="grid gap-2 text-sm">
            <p className="text-muted-foreground">{panel.raters} rater{panel.raters === 1 ? "" : "s"}: {Object.entries(panel.roles).filter(([, n]) => n > 0).map(([role, n]) => `${n} ${role.replace("-", " ")}`).join(", ")}.</p>
            {panel.sites.map((site) => (
              <p key={site.anonId} className="flex flex-wrap justify-between gap-2">
                <span>{toolName(anonToTool[site.anonId] ?? site.anonId)}</span>
                <span className="font-mono tabular-nums">average {fmt(mean(Object.values(site.means).filter((v): v is number => v !== null)))} · chosen by {site.preferred}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
