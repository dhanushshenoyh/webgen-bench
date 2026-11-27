import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Finds a Chromium build: CHROME_PATH, then Playwright's cache. */
export function chromePath(): string {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const cache = join(homedir(), ".cache", "ms-playwright");
  const builds = existsSync(cache) ? readdirSync(cache).filter((name) => /^chromium-\d+$/.test(name)).sort().reverse() : [];
  for (const build of builds) {
    for (const candidate of ["chrome-linux64/chrome", "chrome-linux/chrome", "chrome-mac/Chromium.app/Contents/MacOS/Chromium", "chrome-win/chrome.exe"]) {
      const path = join(cache, build, candidate);
      if (existsSync(path)) return path;
    }
  }
  throw new Error("No Chromium found. Set CHROME_PATH or run `npx playwright install chromium`.");
}
