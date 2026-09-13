# PatchPad: server-response fairness correction

Prepared September 11, 2026. Task remains `patchpad-editor-v2`, version `1.0.0`.
Upload only `patchpad-editor-v2.zip` from this folder. Historical packages are unchanged.

## Corrections

The brief and all five browser gates now explicitly accept report data delivered
in the initial server-rendered HTML, embedded page data or the application's
ordinary same-origin responses. A separate JSON/read API is not required.
The manifest documents application routes and methods, including combined routes.

Nine Functional descriptions now use a shared fresh-server-read procedure.
It preserves exact content, metadata, revisions, full history, unchanged-save,
unsaved-discard, long-document, restore/Undo, rejection and two-restart assertions.
Independent observation pages avoid disturbing an unsaved draft. History previews
and decoded logical text are valid read evidence; browser storage alone is not.
No criterion was removed. All 39 criterion IDs, weights, types, scoring settings
and the final reward formula are unchanged. This avoids creating an ungraded
requirement while removing the implementation-specific read-endpoint assumption.

The previous feedback-scope correction is included: the Polish history/feedback
check no longer imposes an additional blanket colour-independent presentation
rule. Readable revision/timestamp information and understandable status/error
feedback are still required. The original required server-side save-validation
and conflict probes remain; this release does not remove write-safety tests.

No golden source, runner, lifecycle helper, task.toml or Dockerfile changed.
All five prompt revision markers were incremented, retaining runner hash logging.
Both task network settings remain public; native judge configuration is unchanged.

## Fresh unpaid validation

- 118 local standard checks passed (not the platform's full rubric review).
- Golden app and a disposable HTML-delivery variant each passed eight local
  browser/comparison groups: exact seed/metadata/history; unsaved discard;
  no-op saves; changed saves/history/preview/restore/Undo; stale-save rejection;
  seven malformed-write probes with exact nonmutation checks; two real process
  restarts with exact state/history preservation; and comparison negative controls.
- The HTML variant returned 404 for GET read-API routes. Browser evidence recorded
  only `/` for report/history reads. Its normal write route remained available.
  The variant existed only inside a disposable container; it is not packaged.
- Bash syntax passed for solve.sh, test.sh and app-lifecycle.sh. Node syntax passed
  for both browser/server sources in both variants.
- Current test.sh passed no-op zero handling, prompt-provenance hash validation,
  five-dimension CTRF generation and reward arithmetic with an explicitly injected
  diagnostic judge stub. The stub's reward is not an Oracle score.
- Archive checks enforce one wrapper, exactly the 32 task files, CRC integrity,
  byte-for-byte equality with source and unchanged IDs/weights/configuration.
  See package-audit.json for the ZIP SHA-256 and every source-file hash.

## Limits and remaining risks

These are focused local regressions, not an execution of all 39 natural-language
criteria by the paid judge. The negative controls test the state comparator,
not a complete adversarial-app scoring run. Seven invalid-write cases were run;
the entire verifier's conditional forged-request matrix was not rerun here.
The HTML fixture embeds structured data; a separate text-only server-rendered
implementation was not tested. The instructions permit that implementation too.

Containers used the cached patchpad-preflight-tests:2.0.9 image, with current
task source mounted read-only. Exact current Docker images were not rebuilt in
this correction (Dockerfiles are unchanged; recent exact builds were blocked by
the local proxy/registry environment). Diagnostic containers had network disabled
to prevent paid calls; packaged agent and verifier settings are both public.

Fresh platform QC and Oracle remain pending. No Oracle 1.0 or platform pass is
claimed. Reading complete histories through UI previews may take longer than a
single JSON response, so existing judge timeout limits remain a practical risk.
