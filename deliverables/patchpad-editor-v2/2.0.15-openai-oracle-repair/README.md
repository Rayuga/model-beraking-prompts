# PatchPad 2.0.15 — OpenAI template alignment and Find selection repair

September 11, 2026. Source: `projects/patchpad-editor-v2`.
Upload artifact: **patchpad-editor-v2.zip**, one wrapper, 30 files.

SHA-256: `0ef12112ccf079826eac519bbff03a5ce3d06848d6435ca656d0abebca8a9f84`.

## Status and limits

The revised source passes the unpaid current-source regression suite and 49
release/package invariants. It is packaged for platform review, but **fresh
Docker builds did not complete successfully**: the agent's apt operation cannot
resolve the configured corporate proxy, and the verifier's pip operation times
out at PyPI. See `build-results.json` and the two build logs. No dependencies were
removed, no TLS verification disabled, and no task network restriction added to
hide these local infrastructure failures. Retry both exact builds on working
network infrastructure before treating container compatibility as verified.

No paid Oracle/model was run. **Functional 1.0 is not established for 2.0.15.**
The former 2.0.14 Oracle's Functional 0.9759 / aggregate 0.9783 is historical only;
26/27 Functional criteria passed there, with Unicode navigation selection the
sole failure. Local tests do not replace the platform's complete judge journey.

## Changes

1. Golden Find query changes now clear an obsolete selection from the previous
   query. No-result navigation also clears stale selection. The Find focus hint
   distinguishes unselected matches (press Enter/Find Next) from an active match.
   This fixes an independently reproducible stale-selection/UI-state issue;
   without a full exported action trace, it cannot prove exactly why the prior
   judge copied only `é` instead of the full `A🙂éB` setup sample.
2. Functional prompt guidance now requires recording the actual Find field,
   navigation action, focus and full copied sample before Unicode movements.
   It grants no extra retries or alternative gestures and awards no unobserved
   checks. All 35 criterion definitions, assertion texts and weights are identical
   to 2.0.14. The 90/10 reward formula, simple gates, custom-surface prerequisite,
   restart helper, parser, readiness probe, instructions, seed and server behavior
   are unchanged.
3. Applied exactly the new verifier.env: platform-injected OPENAI_API_KEY, Codex,
   unprefixed gpt-5.6-luna, max reasoning. All four judge configs match. Removed
   the old verifier OpenRouter provider block and used the shared minimal Codex
   config plus its noninteractive RewardKit launcher patch. test.sh still has no
   provider-key setup, aliases or login commands.
4. Agent Dockerfile gains the template's git/procps/sqlite3/global dependencies
   and initialized /app repository. Kept the required CA/curl/coreutils bootstrap
   and task-specific Express 5.2.1 tree in both images. Versions are consistently
   2.0.15 in task, image labels, package/lock roots and dimension prompt markers.
5. Saved the original supplied paste and three cleaned reference files under
   `references/task-templates/patchpad-openai-2026-09-11/`. That folder's README
   identifies paste cleanup, the newest OpenAI override and retained task-specific
   differences. No reference files or authoring evidence are in the task ZIP.

## Fresh unpaid tests passed

The full suite used fresh current source in disposable containers based on the
previously built `patchpad-preflight-tests:2.0.9` tool image, with networking
disabled for local regressions. This is **not** an exact new-image build result.

- RewardKit discovery: 2 Render, 2 Constraints, 27 Functional, 4 Polish.
- Shell/JavaScript syntax and empty-submission zero handling.
- 11 manifest-parser fixtures: five accepted, six rejected; unrelated backup
  untouched.
- Six baseline browser checks and six focused QC regression groups.
- Eight prior Oracle failure paths: Unicode deletion/navigation, paste/cut atomic
  Undo, Find/Replace offsets/counts, Find focus/cycle, multi-caret typing/Undo,
  multi-caret Backspace/Delete, revision Preview/Restore/Undo.
- Six browser interaction variants and 14 additional regression groups, including
  exact cursor coordinates, long-document round trip, fresh-client save,
  in-flight-save dirty state and direct server rejection/nonmutation matrix.
- Two actual process replacements preserved the exact document and revision
  history; manifest route declarations matched observed requests.
- Negative controls rejected destructive startup reseeding and missing route docs.
- Harness lifecycle, readiness, cleanup and aggregation passed with explicitly
  synthetic scores (0.55 is a harness fixture, **not** an Oracle score).
- Four instruction/runtime alignment checks and three targeted restore/selection
  checks passed.
- 30 reward truth-table cases, 16 malformed-value rejections and eight custom-
  surface fixtures (four prohibited/four allowed).
- Six latest-failure regression groups. Both keyboard Find Enter/Escape and
  clicked Find Next select/copy the entire Unicode sample, then select exactly
  `A`, `🙂`, and `é` with the required arrow sequence. Re-ran these after adding
  an explicit previous short-query selection to prove that query replacement
  clears it, not merely that a fresh document works.
- Native OpenAI transport smoke with pinned Codex 0.151.0 and RewardKit 0.1.7:
  exact new Codex config and launcher patch; RewardKit-managed login; observed
  bearer header, model `gpt-5.6-luna`, reasoning `max`. The real built-in provider
  websocket was redirected to loopback inside a network-disabled container,
  using a temporary trusted certificate and synthetic key. The stub closes the
  connection without returning model output; its nonzero/timeout termination is
  intentional, not an Oracle run. Earlier failed smoke attempts exposed test-
  endpoint override and certificate issues, fixed only in the validation script.
- 49 package checks, including unchanged criteria/instructions, timeout nesting,
  public networking, no task credentials, ZIP CRC and every archive/source hash.
  `git diff --check` passed.

See individual JSON files and `regression-1.log` for the precise tested scope.
Some historical harness result labels say "new criteria"; these are fresh
executions of existing regression scripts, not new criteria in this release.

## Remaining risks / handover

- Fresh platform static/rubric QC, full Oracle and model runs are not performed.
  Judge provider/reasoning changed, so old platform scores cannot validate this
  package. OpenAI account access/quota and Harbor credential injection remain
  platform checks; local transport testing uses no real key.
- The known Gemini auto-select-first-Find convention mismatch remains in the
  unchanged criteria. This release targets golden stability and template format,
  not a new scoring policy. It must remain disclosed to the reviewer; do not
  label every model failure as genuine or this package universally fair.
- Missing detailed judge action traces prevent guaranteeing that a full ordered
  27-criterion Oracle journey will never mis-execute setup. Exact local paths pass;
  they do not prove every stochastic judge interaction or runtime duration.
- Existing 10,550-second dimension ceilings fit the 12,000-second wrapper and
  12,600-second verifier budget. Runtime with max reasoning is not measured.
- No historical ZIP/report, other project, shared context, or raw run was changed.
  Changes are not committed or pushed by this task.

Reproduce local suite from repo root with `python
deliverables/patchpad-editor-v2/2.0.15-openai-oracle-repair/local.py 2` (requires
the retained local image/container mount setup). Build both exact images with
`build.py`; rebuild/audit the deterministic archive with `package.py`.
`provider-smoke.py` requires Docker `--network none --add-host
api.openai.com:127.0.0.1`, current /tests mounted read-only and this folder at
/results; never run that synthetic-credential smoke with public networking.
