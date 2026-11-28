import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";
import { chromePath } from "./browser.ts";
import { pageUrl } from "./serve.ts";

const require = createRequire(import.meta.url);
export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

export type AxeViolation = { id: string; impact: string | null; help: string; wcag: string[]; nodes: number; page: string; width: number };
export type Rendered = { page: string; text: string; html: string };
export type AxeResult = { axeVersion: string; widths: number[]; pages: string[]; violations: AxeViolation[]; passes: number; incomplete: number; rendered: Rendered[] };

/** Runs axe-core's WCAG 2.2 A/AA rules on every page at a desktop and a phone width. */
export async function runAxe(origin: string, pages: string[], widths = [1440, 390]): Promise<AxeResult> {
  const source = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");
  const browser = await chromium.launch({ executablePath: chromePath(), args: ["--no-sandbox"] });
  const violations: AxeViolation[] = [];
  const rendered: Rendered[] = [];
  let passes = 0, incomplete = 0, axeVersion = "";
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      for (const page of pages) {
        const tab = await context.newPage();
        await tab.goto(pageUrl(origin, page), { waitUntil: "load", timeout: 30_000 });
        await tab.waitForTimeout(500);
        if (width === widths[0]) {
          // Framework apps render their content with JavaScript; brief and HTML checks use what the visitor actually gets.
          rendered.push(await tab.evaluate((page) => ({ page, text: document.body.innerText, html: "<!DOCTYPE html>\n" + document.documentElement.outerHTML }), page));
        }
        await tab.addScriptTag({ content: source });
        const result: any = await tab.evaluate((tags) => (window as any).axe.run(document, { runOnly: { type: "tag", values: tags } }), WCAG_TAGS);
        axeVersion = result.testEngine?.version ?? axeVersion;
        passes += result.passes.length;
        incomplete += result.incomplete.length;
        for (const violation of result.violations) {
          violations.push({ id: violation.id, impact: violation.impact, help: violation.help, nodes: violation.nodes.length, page, width,
            wcag: violation.tags.filter((tag: string) => /^wcag\d{3,4}$/.test(tag)).map((tag: string) => tag.replace(/^wcag(\d)(\d)(\d+)$/, "$1.$2.$3")) });
        }
        await tab.close();
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  return { axeVersion, widths, pages, violations, passes, incomplete, rendered };
}
