import { get, list, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import data from "@/data/results.json";

export const dynamic = "force-dynamic";

type Rating = { brief: string; rater: { role: string; initials?: string }; sites: { anonId: string; scores: Record<string, number>; comment?: string }[]; preferred?: string; submittedAt: string };

const ROLES = ["designer", "developer", "product", "clinic-staff", "patient", "other"];
const criteria = data.rubric.criteria.map((c) => c.key);
const panel = data.panel as Record<string, { anonId: string }[]>;

function validate(body: any): Rating | string {
  if (!body || typeof body !== "object") return "Invalid body.";
  const sites = panel[body.brief];
  if (!sites) return "Unknown brief.";
  if (!ROLES.includes(body.rater?.role)) return "Choose a role.";
  if (!Array.isArray(body.sites) || body.sites.length !== sites.length) return "Rate every site.";
  const ids = new Set(sites.map((s) => s.anonId));
  for (const site of body.sites) {
    if (!ids.has(site.anonId)) return "Unknown site.";
    for (const key of criteria) {
      const value = site.scores?.[key];
      if (!Number.isInteger(value) || value < 1 || value > 5) return "Score every question from 1 to 5.";
    }
  }
  if (body.preferred !== undefined && !ids.has(body.preferred)) return "Unknown preferred site.";
  return {
    brief: body.brief,
    rater: { role: body.rater.role, initials: typeof body.rater.initials === "string" ? body.rater.initials.slice(0, 8) : undefined },
    sites: body.sites.map((s: any) => ({ anonId: s.anonId, scores: Object.fromEntries(criteria.map((k) => [k, s.scores[k]])), comment: typeof s.comment === "string" ? s.comment.slice(0, 600) : undefined })),
    preferred: body.preferred,
    submittedAt: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  const result = validate(await request.json().catch(() => null));
  if (typeof result === "string") return Response.json({ error: result }, { status: 400 });
  await put(`ratings/${result.brief}/${Date.now()}-${randomUUID()}.json`, JSON.stringify(result), { access: "private", contentType: "application/json", addRandomSuffix: false });
  return Response.json({ ok: true });
}

/** Aggregates ratings per site (anonymous id) without returning individual submissions. */
export async function GET(request: Request) {
  const brief = new URL(request.url).searchParams.get("brief") ?? "";
  if (!panel[brief]) return Response.json({ error: "Unknown brief." }, { status: 400 });
  const ratings: Rating[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: `ratings/${brief}/`, cursor, limit: 1000 });
    for (const blob of page.blobs) {
      const file = await get(blob.pathname, { access: "private" });
      if (file?.stream) ratings.push(JSON.parse(await new Response(file.stream).text()));
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  const sites = panel[brief].map(({ anonId }) => {
    const rows = ratings.map((r) => r.sites.find((s) => s.anonId === anonId)).filter(Boolean) as Rating["sites"];
    const means = Object.fromEntries(criteria.map((k) => [k, rows.length ? rows.reduce((sum, r) => sum + r.scores[k], 0) / rows.length : null]));
    return { anonId, raters: rows.length, means, preferred: ratings.filter((r) => r.preferred === anonId).length };
  });
  return Response.json({ brief, raters: ratings.length, roles: Object.fromEntries(ROLES.map((role) => [role, ratings.filter((r) => r.rater.role === role).length])), sites });
}
