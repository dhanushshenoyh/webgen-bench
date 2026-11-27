"use client";

import { useEffect, useMemo, useState } from "react";
import raw from "@/data/results.json";

type Criterion = { key: string; label: string; question: string; anchors: Record<string, string> };
const data = raw as unknown as {
  briefs: Record<string, { id: string; title: string; prompt: string }>;
  rubric: { criteria: Criterion[] };
  panel: Record<string, { anonId: string; pages: string[] }[]>;
};
const ROLES = [
  { value: "designer", label: "Designer" },
  { value: "developer", label: "Developer" },
  { value: "product", label: "Product or business" },
  { value: "clinic-staff", label: "Clinic staff" },
  { value: "patient", label: "Patient or member of the public" },
  { value: "other", label: "Other" },
];
const LETTERS = "ABCDEFGH";

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function RatePanel() {
  const briefIds = Object.keys(data.panel);
  const [briefId] = useState(briefIds[0]);
  const [order, setOrder] = useState<{ anonId: string; pages: string[] }[]>([]);
  const [step, setStep] = useState(-1);
  const [role, setRole] = useState("");
  const [initials, setInitials] = useState("");
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [preferred, setPreferred] = useState("");
  const [page, setPage] = useState("index.html");
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const criteria = data.rubric.criteria;
  const brief = data.briefs[briefId];

  useEffect(() => { setOrder(shuffle(data.panel[briefId] ?? [])); }, [briefId]);
  useEffect(() => { setPage("index.html"); }, [step]);

  const site = step >= 0 && step < order.length ? order[step] : null;
  const letter = (anonId: string) => LETTERS[order.findIndex((s) => s.anonId === anonId)] ?? "?";
  const complete = (anonId: string) => criteria.every((c) => scores[anonId]?.[c.key]);
  const allComplete = useMemo(() => order.length > 0 && order.every((s) => complete(s.anonId)), [order, scores]);

  async function submit() {
    setStatus("sending");
    setError("");
    const response = await fetch("/api/ratings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brief: briefId, rater: { role, initials: initials || undefined }, preferred: preferred || undefined,
        sites: order.map((s) => ({ anonId: s.anonId, scores: scores[s.anonId], comment: comments[s.anonId] || undefined })) }),
    }).catch(() => null);
    if (response?.ok) { setStatus("done"); return; }
    const body = await response?.json().catch(() => null);
    setError(body?.error ?? "Your ratings could not be saved. Check your connection and try again.");
    setStatus("error");
  }

  if (status === "done") {
    return (
      <main className="mx-auto grid max-w-2xl gap-4 px-4 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Thank you</h1>
        <p className="text-muted-foreground">Your ratings were saved. They are combined with other raters&apos; scores; individual submissions are not shown.</p>
        <a href="/" className="w-fit rounded-md border px-4 py-2 text-sm hover:bg-muted">See the results</a>
      </main>
    );
  }

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6">
      <header className="grid gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">webgen-bench · blind rating</p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">Rate {order.length} clinic websites</h1>
        <p className="max-w-3xl text-muted-foreground">
          Each website was built by a different AI tool from the same brief. The tools are hidden and the order is random. Browse each site, then score it on its own. It takes about 5 minutes per site.
        </p>
      </header>

      {step === -1 && (
        <section className="grid max-w-2xl gap-5 rounded-xl border bg-card p-6">
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">The brief every tool received</summary>
            <p className="mt-2 leading-relaxed text-muted-foreground">{brief?.prompt}</p>
          </details>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Which best describes you?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {ROLES.map((r) => (
                <label key={r.value} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${role === r.value ? "border-foreground" : ""}`}>
                  <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} />
                  {r.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="grid gap-1 text-sm" htmlFor="initials">
            <span className="font-medium">Initials (optional)</span>
            <input id="initials" value={initials} maxLength={8} onChange={(e) => setInitials(e.target.value)} className="w-32 rounded-md border bg-background px-3 py-1.5" />
          </label>
          <button disabled={!role || order.length === 0} onClick={() => setStep(0)} className="w-fit rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:opacity-40">Start rating</button>
        </section>
      )}

      {site && (
        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="grid min-w-0 content-start gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-semibold">Website {letter(site.anonId)} <span className="text-sm font-normal text-muted-foreground">({step + 1} of {order.length})</span></h2>
              <div className="flex flex-wrap gap-2">
                <div role="radiogroup" aria-label="Device" className="inline-flex rounded-md border p-0.5 text-sm">
                  {(["desktop", "phone"] as const).map((d) => (
                    <button key={d} role="radio" aria-checked={device === d} onClick={() => setDevice(d)} className={`rounded px-3 py-1 capitalize ${device === d ? "bg-foreground text-background" : "text-muted-foreground"}`}>{d}</button>
                  ))}
                </div>
                <select aria-label="Page" value={page} onChange={(e) => setPage(e.target.value)} className="rounded-md border bg-background px-2 py-1 text-sm">
                  {site.pages.map((p) => <option key={p} value={p}>{p.replace(".html", "")}</option>)}
                </select>
                <a href={`/sites/${site.anonId}/${page}`} target="_blank" rel="noopener" className="rounded-md border px-3 py-1 text-sm hover:bg-muted">Open full screen</a>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border bg-muted/40">
              <iframe key={`${site.anonId}-${page}`} title={`Website ${letter(site.anonId)}`} src={`/sites/${site.anonId}/${page}`}
                className="mx-auto block h-[70vh] w-full bg-white" style={{ maxWidth: device === "phone" ? 390 : "100%" }} />
            </div>
          </div>
          <form className="grid content-start gap-4" onSubmit={(e) => { e.preventDefault(); step < order.length - 1 ? setStep(step + 1) : setStep(order.length); }}>
            {criteria.map((c) => (
              <fieldset key={c.key} className="grid gap-1.5">
                <legend className="text-sm font-medium">{c.label}</legend>
                <p className="text-xs text-muted-foreground">{c.question}</p>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label key={n} title={c.anchors[String(n)] ?? ""} className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border text-sm tabular-nums ${scores[site.anonId]?.[c.key] === n ? "border-foreground bg-foreground text-background" : "hover:bg-muted"}`}>
                      <input type="radio" className="sr-only" name={`${site.anonId}-${c.key}`} value={n} checked={scores[site.anonId]?.[c.key] === n}
                        onChange={() => setScores((prev) => ({ ...prev, [site.anonId]: { ...prev[site.anonId], [c.key]: n } }))} />
                      {n}
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">1: {c.anchors["1"]} · 5: {c.anchors["5"]}</p>
              </fieldset>
            ))}
            <label className="grid gap-1 text-sm" htmlFor={`comment-${site.anonId}`}>
              <span className="font-medium">Anything else? (optional)</span>
              <textarea id={`comment-${site.anonId}`} rows={3} maxLength={600} value={comments[site.anonId] ?? ""} onChange={(e) => setComments((prev) => ({ ...prev, [site.anonId]: e.target.value }))} className="rounded-md border bg-background px-3 py-2" />
            </label>
            <div className="flex gap-2">
              {step > 0 && <button type="button" onClick={() => setStep(step - 1)} className="rounded-md border px-4 py-2 text-sm">Back</button>}
              <button type="submit" disabled={!complete(site.anonId)} className="rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:opacity-40">{step < order.length - 1 ? "Next website" : "Finish"}</button>
            </div>
          </form>
        </section>
      )}

      {step === order.length && order.length > 0 && (
        <section className="grid max-w-2xl gap-5 rounded-xl border bg-card p-6">
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">If you ran this clinic, which website would you choose?</legend>
            {order.map((s) => (
              <label key={s.anonId} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${preferred === s.anonId ? "border-foreground" : ""}`}>
                <input type="radio" name="preferred" checked={preferred === s.anonId} onChange={() => setPreferred(s.anonId)} />
                Website {letter(s.anonId)}
              </label>
            ))}
          </fieldset>
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setStep(order.length - 1)} className="rounded-md border px-4 py-2 text-sm">Back</button>
            <button disabled={!allComplete || !preferred || status === "sending"} onClick={submit} className="rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:opacity-40">
              {status === "sending" ? "Saving…" : "Submit ratings"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
