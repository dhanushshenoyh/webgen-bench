"use client";

import { CountUp } from "@/components/viz";

type Verdict = { judge: string; scores: Record<string, number> };
type Run = { brief: string; tool: string; lighthouse: { mobile: { scores: Record<string, number | null> } } };
type DesignBrief = { judges: string[]; sites: Record<string, { verdicts: Verdict[] }> };

const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

/** Builder-level results across held-out briefs: every run counts, with the spread shown. */
export function Overall({ briefs, runs, design, builderKey, label }: {
  briefs: { id: string; title: string; heldOut?: boolean }[];
  runs: Run[];
  design: Record<string, DesignBrief>;
  builderKey: (tool: string) => string;
  label: (key: string) => { name: string; color: string };
}) {
  const held = briefs.filter((b) => b.heldOut);
  if (!held.length) return null;
  const rows = new Map<string, { tech: number[]; design: { brief: string; value: number }[] }>();
  for (const brief of held) {
    const d = design[brief.id];
    const spread = (judge: string) => {
      const values = Object.values(d?.sites ?? {}).flatMap((s) => Object.values(s.verdicts.find((v) => v.judge === judge)?.scores ?? {}));
      return values.length ? Math.max(...values) - Math.min(...values) : 0;
    };
    const counted = (d?.judges ?? []).filter((j) => spread(j) > 0);
    for (const run of runs.filter((r) => r.brief === brief.id)) {
      const key = builderKey(run.tool);
      const row = rows.get(key) ?? { tech: [], design: [] };
      const t = mean(Object.values(run.lighthouse.mobile.scores).filter((x): x is number => typeof x === "number"));
      if (t !== null) row.tech.push(t);
      const dv = mean((d?.sites[run.tool]?.verdicts ?? []).filter((v) => counted.includes(v.judge)).flatMap((v) => Object.values(v.scores)));
      if (dv !== null) row.design.push({ brief: brief.id, value: dv });
      rows.set(key, row);
    }
  }
  const builders = [...rows.entries()].sort((a, b) => (mean(b[1].design.map((x) => x.value)) ?? 0) - (mean(a[1].design.map((x) => x.value)) ?? 0));
  const x = (v: number) => `${((v - 1) / 4) * 100}%`;

  return (
    <section className="grid gap-6">
      <div className="grid gap-2">
        <h2 className="wb-display text-3xl font-bold tracking-tight">Held-out results</h2>
        <p className="max-w-2xl text-[var(--wb-muted)]">
          {held.length} clinic briefs that no builder was tuned on, each generated more than once per builder. Every run counts; the bars show the range between the lowest and highest run.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {builders.map(([key, row]) => {
          const b = label(key);
          const values = row.design.map((d) => d.value);
          const lo = values.length ? Math.min(...values) : null;
          const hi = values.length ? Math.max(...values) : null;
          return (
            <article key={key} className="grid gap-4 rounded-2xl border border-[var(--wb-line)] bg-white p-6 transition-shadow duration-300 hover:shadow-[0_24px_50px_-34px_rgba(18,21,61,0.5)]">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="wb-display flex items-center gap-2 text-xl font-semibold"><span className="size-3 rounded-full" style={{ background: b.color }} />{b.name}</h3>
                <span className="text-sm text-[var(--wb-muted)]">{values.length} runs</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-0.5">
                  <span className="text-xs text-[var(--wb-muted)]">Design, out of 5</span>
                  <CountUp value={mean(values)} decimals={2} className="wb-num text-4xl font-bold" />
                  <span className="text-xs text-[var(--wb-muted)]">range {lo?.toFixed(1) ?? "—"} to {hi?.toFixed(1) ?? "—"}</span>
                </div>
                <div className="grid gap-0.5">
                  <span className="text-xs text-[var(--wb-muted)]">Technical, Lighthouse mobile</span>
                  <CountUp value={mean(row.tech)} className="wb-num text-4xl font-bold" />
                  <span className="text-xs text-[var(--wb-muted)]">range {row.tech.length ? Math.round(Math.min(...row.tech)) : "—"} to {row.tech.length ? Math.round(Math.max(...row.tech)) : "—"}</span>
                </div>
              </div>
              <div className="grid gap-2">
                {held.map((brief) => {
                  const pts = row.design.filter((d) => d.brief === brief.id).map((d) => d.value);
                  return (
                    <div key={brief.id} className="grid grid-cols-[7.5rem_1fr] items-center gap-3 text-xs">
                      <span className="truncate text-[var(--wb-muted)]">{brief.title.split(" (")[0]}</span>
                      <div className="relative h-6">
                        <div className="absolute inset-x-0 top-1/2 h-px bg-[var(--wb-line)]" />
                        {pts.length > 1 && <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full opacity-30" style={{ left: x(Math.min(...pts)), width: `calc(${x(Math.max(...pts))} - ${x(Math.min(...pts))})`, background: b.color }} />}
                        {pts.map((p, i) => <span key={i} title={`${p.toFixed(2)}`} className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow transition-transform hover:scale-150" style={{ left: x(p), background: b.color }} />)}
                      </div>
                    </div>
                  );
                })}
                <div className="grid grid-cols-[7.5rem_1fr] gap-3 text-[10px] text-[var(--wb-muted)]">
                  <span />
                  <div className="relative h-3">{[1, 2, 3, 4, 5].map((t) => <span key={t} className="wb-num absolute -translate-x-1/2" style={{ left: x(t) }}>{t}</span>)}</div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
