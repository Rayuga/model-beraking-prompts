# Colderwater: final fairness-repair candidate

Input `4bc53a3f24e6fa46739f9f07d31b7fb8d8c763e796effa0a5200bbdf430b5867`. This supersedes the first fairness-fix candidate after independent review exposed an additional HTML-dispatch setup dependency in S03. Its original finding remains under `../coldwater-2026-09-30-fairness-fix/`.

Use [REPAIR_REPORT.md](REPAIR_REPORT.md) for completed repairs, measured evidence and remaining limits. The source is frozen by `scripts/qc_pipeline.py prepare`. The three default complete-review skeletons are unused: this pass uses three targeted independent reviews and fresh scripted browser measurements, and does not claim a new complete 53-row QC clearance.

Only the Functional prompt and four criterion descriptions changed. Public requirements, app source/bundle, weights, criterion count, canonical files and model settings remain unchanged. No ZIP, upload, provider run, commit or push was made.

The full golden run is `golden/run-golden-20260930-113007/`; the ten-case focused run is `golden/focused-20260930-113157/`. Executed driver copies and raw observations are retained there. Before the focused launch, its copied `fairness_probe.cjs` import and README were refreshed to the prepared final versions. The full golden used its own earlier saved copies; those two auxiliary files were not invoked by its executed path and remain preserved. All executed S03/S16/S24 modules match the final prepared code.

The driver author briefly considered one extra accepted-but-untrimmed-title variant after the nine-variant matrix was already built. That unexecuted source insertion was removed; the preserved variant manifest and actual run contain exactly nine variants plus the golden. That extra branch received source review only.
