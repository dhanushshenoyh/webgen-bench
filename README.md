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

Design quality is scored blind by AI judges from three vendors against `rubric/design-v1.json` (`pnpm bench design`), and by people on the dashboard's `/rate` page.

## Run a benchmark

Requirements: Node 22.19+, pnpm, Java 17+ (for the HTML checker) and a Chromium build (`CHROME_PATH`, or Playwright's cache).

```sh
pnpm install
# 1. Put the builder's static output in sites/<brief>--<tool>/
# 2. Score it
pnpm bench run --brief demo-clinic-a --tool replit --site sites/demo-clinic-a--replit --generated 2026-11-24
```

Results are written to `results/<brief>/<tool>.json`.

### Adding a builder's output (Lovable, v0, Bolt, ...)

1. Copy the prompt from `briefs/<id>.json` exactly and paste it into the builder. Do not add instructions or follow-up prompts.
2. Download the project as a ZIP into `inbox/<builder>.zip` (for example `inbox/lovable.zip`). Note the date and plan.
3. If the project is a framework app (React, Vite, Next), build it to static files (`npm install && npm run build`) and copy the build output (`dist/` or `out/`) to `sites/<brief>--<builder>/`. A plain HTML project is copied as is.
4. Run `pnpm bench run ...` and `pnpm bench design --brief <id> --judges <models>` for the new builder, then `pnpm --dir dashboard collect` and redeploy.

### Adding a builder's output (manual details)

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
