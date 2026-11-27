import type { Shot } from "./capture.ts";

export type Rubric = { id: string; scale: string; instructions: string; criteria: { key: string; label: string; question: string; anchors: Record<string, string> }[] };
export type Verdict = { judge: string; scores: Record<string, number>; notes: Record<string, string>; strengths: string[]; issues: string[]; usage?: { input: number; output: number; costUsd: number | null } };

const GATEWAY = process.env.GATEWAY_BASE_URL ?? "https://ai-gateway.vercel.sh/v1";

function prompt(rubric: Rubric, briefPrompt: string): string {
  return [
    "You are an expert web designer reviewing one website from screenshots. The builder is anonymous.",
    rubric.instructions,
    `The brief the builder received (judge fit for purpose against it): ${JSON.stringify(briefPrompt)}`,
    "Screenshots are labelled with page, width and slice. Desktop is 1440 px wide, phone is 390 px.",
    `Criteria: ${JSON.stringify(rubric.criteria)}`,
    "Work in this order: first list the concrete visible issues (at least three, or say why fewer exist), then the strengths, then score. Every score must be consistent with the issues you listed: a criterion with a listed issue cannot score 5. Most competent professional sites score 3 or 4.",
    'Reply with JSON only, keys in this order: {"issues":["..."],"strengths":["..."],"notes":{"<key>":"one sentence"},"scores":{"<key>":1-5,...}}. Use every criterion key exactly once. Integers only.',
  ].join("\n\n");
}

/** Asks one judge model to score one site on the rubric. Absolute scoring: the judge never sees another site. */
export async function judgeSite(model: string, rubric: Rubric, briefPrompt: string, shots: Shot[]): Promise<Verdict> {
  const key = process.env.GATEWAY_API_KEY;
  if (!key) throw new Error("Set GATEWAY_API_KEY to run design judges.");
  const content: unknown[] = [{ type: "text", text: prompt(rubric, briefPrompt) }];
  for (const shot of shots) {
    content.push({ type: "text", text: `${shot.page}, ${shot.width < 600 ? "phone" : "desktop"} ${shot.width}px, slice ${shot.index + 1}` });
    content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${shot.jpeg.toString("base64")}` } });
  }
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`${GATEWAY}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model, temperature: 0, max_tokens: 16000, response_format: { type: "json_object" }, messages: [{ role: "user", content }] }),
      signal: AbortSignal.timeout(240_000),
    });
    const body: any = await response.json().catch(() => ({}));
    if (!response.ok) { lastError = `${response.status} ${JSON.stringify(body).slice(0, 300)}`; continue; }
    const text: string = body.choices?.[0]?.message?.content ?? "";
    try {
      const parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
      const scores: Record<string, number> = {};
      for (const criterion of rubric.criteria) {
        const value = Number(parsed.scores?.[criterion.key]);
        if (!Number.isInteger(value) || value < 1 || value > 5) throw new Error(`bad score for ${criterion.key}`);
        scores[criterion.key] = value;
      }
      const cost = Number(body.usage?.cost ?? body.usage?.total_cost);
      return { judge: model, scores, notes: parsed.notes ?? {}, strengths: parsed.strengths ?? [], issues: parsed.issues ?? [],
        usage: { input: body.usage?.prompt_tokens ?? 0, output: body.usage?.completion_tokens ?? 0, costUsd: Number.isFinite(cost) ? cost : null } };
    } catch (error) {
      lastError = `unparseable reply: ${(error as Error).message}`;
    }
  }
  throw new Error(`${model}: ${lastError}`);
}

/** Krippendorff's alpha for interval data. ratings[item][rater] = value or null. */
export function krippendorffAlpha(ratings: (number | null)[][]): number | null {
  const units = ratings.map((row) => row.filter((value): value is number => value !== null)).filter((row) => row.length >= 2);
  const n = units.reduce((sum, row) => sum + row.length, 0);
  if (n < 2) return null;
  let observed = 0;
  for (const row of units) {
    let pairs = 0;
    for (let i = 0; i < row.length; i++) for (let j = 0; j < row.length; j++) if (i !== j) pairs += (row[i] - row[j]) ** 2;
    observed += pairs / (row.length - 1);
  }
  observed /= n;
  const all = units.flat();
  let expected = 0;
  for (let i = 0; i < all.length; i++) for (let j = 0; j < all.length; j++) if (i !== j) expected += (all[i] - all[j]) ** 2;
  expected /= n * (n - 1);
  return expected === 0 ? (observed === 0 ? 1 : null) : 1 - observed / expected;
}
