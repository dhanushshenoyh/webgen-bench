import { chromium } from "playwright-core";
import { chromePath } from "./browser.ts";

export type Shot = { page: string; width: number; index: number; jpeg: Buffer };

/** Screenshots each page at desktop and phone widths as viewport-height slices (reduced motion, so content is at rest). */
export async function captureSite(origin: string, pages: string[], widths = [1440, 390], maxSlices = 4): Promise<Shot[]> {
  const browser = await chromium.launch({ executablePath: chromePath(), args: ["--no-sandbox"] });
  const shots: Shot[] = [];
  try {
    for (const width of widths) {
      const height = width < 600 ? 844 : 900;
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce", deviceScaleFactor: 1 });
      for (const page of pages) {
        const tab = await context.newPage();
        await tab.goto(`${origin}/${page}`, { waitUntil: "load", timeout: 30_000 });
        // Scroll through once so lazy-loaded images load, as they would for a visitor, then wait for them.
        await tab.evaluate(async () => {
          for (let y = 0; y < document.documentElement.scrollHeight; y += Math.round(window.innerHeight * 0.8)) {
            window.scrollTo(0, y);
            await new Promise((done) => setTimeout(done, 120));
          }
          window.scrollTo(0, 0);
          await Promise.all([...document.images].filter((img) => !img.complete).map((img) => new Promise((done) => { img.onload = img.onerror = done; setTimeout(done, 4000); })));
        });
        await tab.waitForTimeout(800);
        const total: number = await tab.evaluate(() => document.documentElement.scrollHeight);
        const slices = Math.min(maxSlices, Math.ceil(total / height));
        for (let index = 0; index < slices; index++) {
          const y = slices === 1 ? 0 : Math.round(((total - height) * index) / (slices - 1));
          const jpeg = await tab.screenshot({ type: "jpeg", quality: 70, fullPage: true, clip: { x: 0, y, width, height } });
          shots.push({ page, width, index, jpeg });
        }
        await tab.close();
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  return shots;
}
