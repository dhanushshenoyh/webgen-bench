# webgen-bench

Give several AI website builders the same brief, keep every output, and score each one with the same published tools. See [METHODOLOGY.md](METHODOLOGY.md) for what is measured, how, and what the numbers do not claim.

## What it measures today

| Area | Tool |
| --- | --- |
| Performance, Accessibility, Best Practices, SEO | Google Lighthouse 13 (mobile and desktop, median of 5 runs) |
| Loading and stability (lab) | Lighthouse metrics against Core Web Vitals thresholds |
| WCAG 2.0/2.1/2.2 A and AA rules | axe-core 4.14 at 1440 px and 390 px |
| HTML conformance | W3C Nu HTML Checker (offline) |
| Brief coverage | required pages and facts from the brief |

Design-quality scoring (rubric judges and a blind human panel) is described in the methodology and not built yet.

## Run a benchmark

Requirements: Node 22.19+, pnpm, Java 17+ (for the HTML checker) and a Chromium build (`CHROME_PATH`, or Playwright's cache).

```sh
pnpm install
# 1. Put the builder's static output in sites/<brief>--<tool>/
# 2. Score it
pnpm bench run --brief demo-clinic-a --tool replit --site sites/demo-clinic-a--replit --generated 2026-11-24
```

Results are written to `results/<brief>/<tool>.json`.

### Adding a builder's output

1. Copy the prompt from `briefs/<id>.json` exactly, and paste it into the builder (Replit, Lovable, v0, Bolt, ...). Do not add instructions.
2. Export or download the generated site as static files. Record the date and plan in `--generated` and `--notes`.
3. Run the command above with `--tool <builder>`.

## Dashboard

```sh
cd dashboard
pnpm install
pnpm dev     # collects results/ and starts the dashboard
pnpm build   # static export in dashboard/out/
```

Charts use [Bklit UI](https://bklit.com) (MIT) on Next.js and shadcn/ui.

## Layout

- `briefs/` the exact prompts and required content
- `sites/` stored outputs, one folder per brief and builder
- `runner/` the benchmark runner
- `results/` raw results
- `dashboard/` results website
