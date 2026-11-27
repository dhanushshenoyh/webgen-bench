import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export type Brief = { id: string; title: string; version: number; prompt: string; requiredPages: string[]; requiredFacts: string[]; forbidden: string[] };
export type BriefResult = { missingPages: string[]; missingFacts: string[]; forbiddenFound: string[]; pages: string[] };

export const visibleText = (html: string) =>
  html.replace(/<(script|style|template|noscript)\b[\s\S]*?<\/\1\s*>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, " ").toLowerCase();

export async function sitePages(dir: string): Promise<string[]> {
  return (await readdir(dir)).filter((file) => file.endsWith(".html")).sort((a, b) => (a === "index.html" ? -1 : b === "index.html" ? 1 : a.localeCompare(b)));
}

/** Checks the brief's required pages and facts in visible text, so every tool is held to the same content. */
export async function checkBrief(dir: string, brief: Brief): Promise<BriefResult> {
  const pages = await sitePages(dir);
  const text = (await Promise.all(pages.map((page) => readFile(join(dir, page), "utf8")))).map(visibleText).join(" ");
  return {
    pages,
    missingPages: brief.requiredPages.filter((page) => !pages.includes(page)),
    missingFacts: brief.requiredFacts.filter((fact) => !text.includes(fact.toLowerCase())),
    forbiddenFound: brief.forbidden.filter((term) => text.includes(term.toLowerCase())),
  };
}
