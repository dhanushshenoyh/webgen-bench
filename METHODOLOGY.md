# Methodology

webgen-bench gives every website builder the same brief, keeps every output, and scores each one with the same published tools. Nothing is scored by a tool we wrote unless the table below says so.

## 1. Same input for every tool

A brief (`briefs/<id>.json`) holds the exact prompt, the required pages and the facts that must appear. Every tool receives the prompt verbatim. If a tool needs a manual step (Lovable, Bolt), the operator pastes the prompt unchanged and records the date and plan used. Outputs are stored as static files under `sites/<brief>--<tool>/`, and the run records a hash of the files so a score can always be traced to the exact output.

This answers the "different sections" objection: content is fixed by the brief, brief coverage is scored separately, and design is scored per site on an absolute rubric instead of section against section.

## 2. Objective standards (automated)

| Check | Tool and version | Standard it reports against | How it is run |
| --- | --- | --- | --- |
| Performance, Accessibility, Best Practices, SEO (0–100) | Google Lighthouse 13 | Lighthouse scoring (log-normal curves from HTTP Archive data) | Each page, mobile and desktop, 5 runs, median kept, runs never in parallel |
| Loading and stability (lab) | Lighthouse metrics | Core Web Vitals thresholds: LCP ≤ 2.5 s, CLS ≤ 0.1; TBT as the lab proxy for INP | From the same runs; labelled lab, not field data |
| Accessibility rules | axe-core 4.14 (Deque) | WCAG 2.0, 2.1, 2.2 at levels A and AA | Each page at 1440 px and 390 px |
| HTML conformance | W3C Nu HTML Checker (vnu.jar), offline | WHATWG HTML Living Standard | Each page |
| Brief coverage | webgen-bench (our script) | The brief's required pages and facts | Visible text of all pages |

Every site is served by the same local static server, so hosting differences do not affect scores. The home page is loaded at the site root (`/`), the address a visitor uses; client-side routers in framework apps show a not-found page at `/index.html`. Brief coverage and HTML conformance are checked on the rendered page after JavaScript runs, so framework apps are judged on what visitors see, not their empty HTML shell. Published framework apps are mirrored from their public URL with all JavaScript, CSS and images they reference; scripts the platform injects (for example Replit's `i.replit.com/script.js`) are kept, because visitors receive them too.

## 3. Design quality (rubric and people) — in progress

- **Absolute rubric per site:** each site is scored on its own against a fixed checklist, using screenshots at desktop, tablet and phone widths. The method follows ArtifactsBench (Tencent Hunyuan, 2025), which reported over 90% agreement with human experts.
- **Several judges:** three models from different vendors. A judge from the same vendor as a tool's own model is reported separately. Agreement between judges is reported as Krippendorff's alpha.
- **Blind human panel:** raters see sites without tool names, in random order, and score them with the 4-item VisAWI-S visual aesthetics scale plus a short task check. Pairwise preferences are combined with a Bradley–Terry model with confidence intervals, the method used by Arena.

## 4. Held-out briefs and repeated runs

Briefs marked `heldOut` were written after the generator under test was last tuned and are never used to tune it. Each builder generates each held-out brief at least twice; results report the average and the range across runs. The Demo Clinic A brief was used while tuning Radial Pulse, so it is labelled a tuning brief and kept out of the held-out averages.

## 5. What the numbers do not claim

- axe-core finds about 57% of accessibility issues by volume (Deque's own study), not full WCAG conformance. Manual review is still needed for a conformance claim.
- Lighthouse lab scores vary between runs; medians of 5 runs reduce but do not remove that. Small differences (a few points) are not meaningful.
- Security headers depend on hosting, not the generated files, so they are reported separately for hosted sites only.
- A result covers one brief and one generation per tool unless stated. Builders are not deterministic; repeated generations are needed to measure spread.

## Sources

- Lighthouse 13: https://developer.chrome.com/blog/lighthouse-13-0 · scoring: https://developer.chrome.com/docs/lighthouse/performance/performance-scoring · variability: https://github.com/GoogleChrome/lighthouse/blob/main/docs/variability.md
- Core Web Vitals: https://web.dev/articles/vitals
- axe-core: https://github.com/dequelabs/axe-core · coverage study: https://www.deque.com/automated-accessibility-coverage-report/
- Nu HTML Checker: https://validator.github.io/validator/
- ArtifactsBench: https://github.com/Tencent-Hunyuan/ArtifactsBenchmark (arXiv 2507.04952)
- Arena method: https://arena.ai/blog/webdev-arena
- VisAWI: https://aupsy.uni-wuppertal.de/en/instrumente/visawi/
- Closest precedent comparing builders with human raters: arXiv 2512.18080
