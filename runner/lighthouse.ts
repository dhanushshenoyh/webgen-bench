import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import * as chromeLauncher from "chrome-launcher";
import { chromePath } from "./browser.ts";

export type FormFactor = "mobile" | "desktop";
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"] as const;
const METRICS = {
  lcpMs: "largest-contentful-paint",
  fcpMs: "first-contentful-paint",
  cls: "cumulative-layout-shift",
  tbtMs: "total-blocking-time",
  speedIndexMs: "speed-index",
} as const;

export type LighthouseResult = {
  formFactor: FormFactor;
  runs: number;
  lighthouseVersion: string;
  scores: Record<(typeof CATEGORIES)[number], number | null>;
  metrics: Record<keyof typeof METRICS, number | null>;
  failedAudits: { id: string; title: string; category: string }[];
};

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
};

/** Runs Lighthouse `runs` times and keeps the median of each score and metric, as Google recommends for lab variance. */
export async function runLighthouse(url: string, formFactor: FormFactor, runs = 3): Promise<LighthouseResult> {
  const chrome = await chromeLauncher.launch({ chromePath: chromePath(), chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"] });
  const results: any[] = [];
  try {
    for (let index = 0; index < runs; index++) {
      const result = await lighthouse(url, { port: chrome.port, output: "json", logLevel: "error", onlyCategories: [...CATEGORIES] },
        formFactor === "desktop" ? desktopConfig : undefined);
      if (!result) throw new Error(`Lighthouse returned no result for ${url}`);
      results.push(result.lhr);
    }
  } finally {
    await chrome.kill();
  }
  const last = results[results.length - 1];
  const failedAudits: LighthouseResult["failedAudits"] = [];
  for (const category of CATEGORIES) {
    for (const ref of last.categories[category]?.auditRefs ?? []) {
      const audit = last.audits[ref.id];
      if (ref.weight > 0 && audit && audit.score !== null && audit.score < 0.9 && audit.scoreDisplayMode !== "informative") {
        failedAudits.push({ id: ref.id, title: audit.title, category });
      }
    }
  }
  return {
    formFactor,
    runs,
    lighthouseVersion: last.lighthouseVersion,
    scores: Object.fromEntries(CATEGORIES.map((category) => {
      const values = results.map((lhr) => lhr.categories[category]?.score).filter((score): score is number => typeof score === "number");
      const value = median(values);
      return [category, value === null ? null : Math.round(value * 100)];
    })) as LighthouseResult["scores"],
    metrics: Object.fromEntries(Object.entries(METRICS).map(([key, id]) => {
      const value = median(results.map((lhr) => lhr.audits[id]?.numericValue).filter((n): n is number => typeof n === "number"));
      return [key, value === null ? null : Math.round(value * 1000) / 1000];
    })) as LighthouseResult["metrics"],
    failedAudits,
  };
}
