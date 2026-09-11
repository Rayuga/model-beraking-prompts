# PatchPad 2.0.16 — verifier fairness repair

September 11, 2026. Current source: `projects/patchpad-editor-v2`.
Upload: `patchpad-editor-v2.zip` (30 files, exactly one wrapper).
SHA-256: `89783ebf40b4167223d6b5c7de75ffb08d866a3a190d0e12917568e6fb357399`.

## Readiness

Confirmed Find-convention unfairness is fixed. All fresh unpaid golden
regressions passed, as did the two revised Find checks against the unchanged
Gemini export. Broken skip-match and no-wrap variants failed as intended.
The virtualized-tail clarification was exercised against the unchanged Gemini
app through two real server restarts with exact content/history comparisons.

**No fresh platform Oracle or model run was made. Functional 1.0 is not yet
established, and an Oracle pass cannot be guaranteed.** Historical scores are
unchanged and are not results for this release. Platform QC must be rerun.

The 2.0.15 Docker builds were blocked by local corporate-proxy DNS and PyPI
timeouts. This release changes only image version labels, not Docker build
behavior; those external build limitations remain unresolved. Exact 2.0.16
image builds were not retried. Local browser tests use fresh 2.0.16 source in the
previously built `patchpad-preflight-tests:2.0.9` image, not a newly built image.

## Changes and prior findings

| Prior finding | Action / disposition |
| --- | --- |
| P02: Query typing may auto-select a match, but two criteria assumed no selection | Fixed both Find criteria. Observe the initial match, require correct relative successors/backward navigation and a complete three-step cycle. Establish line 18 explicitly before Replace Current. Preserve exact NEXT text, three matches, 99 replacements, boundary markers and unsaved reload. |
| P03/P04: Lost transient observations, omitted Home/modifier, wrong clipboard payload | Added explicit evidence discipline to the Functional prompt: execute both resets and actual modifier combinations; keep EXTERNAL/tab/whole-document evidence separate from PASTE atomicity; correct failed read-only inspection before leaving the state. Missing observations remain unverified, never automatic passes or invented app defects. |
| P05: Initial DOM does not contain the offscreen persisted marker | Clarified restart criterion and general prompt: virtualized rows are not logical document length. Reach the marker by normal Find/scroll, observe it visibly, and retain full API/history checks. |
| P05: Tab indentation treated as a trap despite working Escape exit | Reinforced the existing Polish exemption. Execute Escape-to-Find and continue traversal; fail controls actually unreachable by that documented route. Do not require Tab to leave the editor. |
| P01: Oracle Unicode selection failure | Preserve the 2.0.15 stale-selection repair and full-sample setup guidance. Both keyboard Find and clicked Find paths pass fresh local Unicode regressions. No proof of a complete platform pass without rerun/action trace. |
| P08: Oracle passing reason quotes `iline` instead of `imeline` | Preserve exact multi-caret assertions and fresh regression checks. Generic per-criterion evidence guidance reinforces exact actual values; no historical score is altered or presumed correct. |
| P06: Haiku manifest formatting prevents grading | Not an unfair hidden requirement: the format is explicitly documented. Leave parser, instructions, artifacts and historical ungraded result unchanged. |
| P07: GPT preferred-column bug | Genuine source-supported model defect. No test relaxation or model-artifact repair. |
| P09: Missing complete judge traces, repeat/adversarial runs | Still missing. No paid calls launched; no robustness guarantee or invented grades. |

The editing brief now explicitly accepts either initial Find selection convention
and describes ordered wrapping. It does not demand the golden app's initial
selection behavior. Toolbar clicks also need not auto-focus the editor; the
judge may restore focus through the documented Find/Escape route without changing
the selection, rather than making an extra navigation or text click.

## Preserved

- 35 criteria: 2 Render, 2 Constraints, 27 Functional, 4 Polish.
- Every criterion id/type/weight; 90% Functional / 10% Polish; custom-surface gate.
- All descriptions except the two Find criteria and clarifying text in restart
  and Polish keyboard traversal. No reduced weights or removed requirements.
- Golden implementation, server rejection rules, seed, single restart helper,
  manifest parser, readiness probes and reward calculation from 2.0.15.
- Public agent and separate public verifier; platform OPENAI_API_KEY,
  Codex gpt-5.6-luna, max reasoning in every dimension. No test.sh key remapping.
- Shared template references from the prior release; both Dockerfiles' behavior.
- Historical ZIPs/reports and exported model artifacts. Nothing committed/pushed.

## Fresh validation evidence

`regression-result.json`: full current-source local suite exit 0.

- Syntax, RewardKit discovery, empty-submission handling and 11 manifest cases.
- Six baseline browser checks and six focused QC regressions.
- Eight earlier Oracle failure-path regressions, six browser variants and 14
  additional groups (including cursor/selection, clipboard, long documents,
  revision history/restore/Undo, save races and server rejection/nonmutation).
- Two real golden server restarts and route documentation checks.
- Destructive-reseed and missing-route-doc negative controls.
- Harness readiness/lifecycle/cleanup and score aggregation using synthetic
  inputs, not paid model scores.
- Four instruction/runtime alignment checks, three targeted regressions and six
  latest-failure groups, including full Unicode copy/navigation after a stale
  prior Find selection.
- 30 reward cases, 16 invalid-value rejections and eight surface fixtures.

`fair-results.json`, `fair-find-golden.json`, `fair-find-gemini.json`:

- Golden: initial selection absent, then keyboard lines 18, 19, 18; exact NEXT.
- Unchanged Gemini: automatically selected line 20, then 18, 19, 18; exact NEXT.
- Both: complete ordered cycle 19,20,18 from established line 18; exact line-18
  replacement; 99 ALPHA replacements; preserved ALPHA-0100/1200 and tail marker;
  exact baseline restored on unsaved reload.

`negative-find-results.json`: deliberately modified served golden JavaScript in
disposable test browsers was rejected for skipping matches and failing to wrap.
These are test-only negative controls, not changes to source or model artifacts,
and not proof of how a future LLM judge will behave.

`virtual-restart.json`: unchanged Gemini had 34 mounted rows and 1,227 logical
lines. On each of two fresh pages after process restart, initial marker count
was zero; ordinary Find made the exact marker visible and copyable. Stored
document, metadata, revision and full history were identical after both restarts.
This validates the virtualized-editor allowance, not a retroactive GPT regrade.

`package-audit.json`: 56 structural/preservation/package checks passed, including
one wrapper, exact source hashes, no secrets/runtime debris, version consistency,
unchanged weights, scoped description edits and unchanged Docker behavior.
`git diff --check` passed. These are local checks, not the official 53-row QC run.

## Limits / next step

Run platform QC and a full Oracle on this exact ZIP; examine the full Functional
breakdown, not only aggregate reward. Capture detailed judge actions if a
checkpoint fails. Previously unfair penalties may disappear, so model scores
can legitimately rise; do not preserve old low scores by retaining false-fails.

The exact GPT clipboard/modifier/traversal incidents were not replayed here;
their absent action traces still prevent adjudicating those original outcomes.
No complete paid ordered-journey regrade, repeat-run variance test, real OpenAI
account/quota check, or fresh image build is claimed. The provider transport
smoke in 2.0.15 is historical evidence for unchanged wiring, not a new test here.

Reproduce: `python .../2.0.16-verifier-fairness/local.py 2`, `fair-local.py`,
`fair-local.py --negative`, and `package.py` from the repo root. The local suite
uses retained historical validation scripts and the existing Docker tool image;
results are written only to this fresh folder. No paid model is invoked.
