import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import { serveSite } from "./serve.ts";
import { chromePath } from "./browser.ts";
const dir = process.argv[2];
const server = await serveSite(dir);
const chrome = await chromeLauncher.launch({ chromePath: chromePath(), chromeFlags: ["--headless=new", "--no-sandbox"] });
const out = [];
for (let i = 0; i < 5; i++) {
  const r: any = await lighthouse(`${server.origin}/index.html`, { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["performance"] });
  out.push(r.lhr.audits["cumulative-layout-shift"].numericValue.toFixed(3));
}
console.log(out.join(" "));
await chrome.kill(); await server.close();
