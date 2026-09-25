# Common Ground Ballot: functional r11

The latest GPT result reported 17/22 Functional criteria passed, for 0.7647. Its overall 0 came from a hidden login error and does not demonstrate sufficient difficulty in the ballot workflows. This revision deepens three existing Functional criteria with concrete state and privacy checks. It keeps 22 Functional criteria, their total weight 34, all other dimensions, the authentication gates, task version 1.0.0 and the final 60/20/20 formula unchanged.

| Existing criterion | Added required behavior | Captured GPT local result | Unchanged golden local result |
| --- | --- | --- | --- |
| Role and identity enforcement | Malformed membership values must not change status, revision or audit; the next opening snapshot must use the valid roster | Omitted, object and array values all return 200 and change state | All three refused with 400; state and downstream snapshot preserved |
| Identified turnout without choice link | Member protected responses expose only that Member's participation, including nested data | Other Members' IDs and submission times appear in participant lists and turnout data | Member data stays private while staff retain identified turnout |
| Vote retry idempotency | The same approval choice set in a different order returns the original receipt through publication and restart; a genuinely different set is refused | Reordered original request returns 409 instead of its original 200; exact-order replay works | Reordered and original requests both return the identical 201 receipt; mismatch is refused |

The corresponding requirements are explicit in `environment/instructions/privacy.md` and `ballots.md`. Approval set equivalence is a newly explicit contract rule, not a retrospective rescoring of the old run. The participation boundary and malformed-write invariants are now spelled out and exercised more thoroughly. No reference API names or selectors are required by the delivered judge. Local regression scripts may use source-specific adapters and remain outside the upload.

The Functional prompt is now `common-ground-ballot-functional-v1.0.0-r11`. Only the two instruction files, Functional prompt and Functional judge descriptions changed. The golden app already supports these behaviors and was not edited. The prompt also reinforces exact capture before replay, distinguishes missing evidence from an app defect, and prevents a non-2xx criterion from silently acquiring a universal 4xx-only rule.

## Validation

- 45 complete local golden browser groups pass, including UI-created controls, real request capture, two process restarts and all five authentication gates after mutations.
- Five runtime groups and 15 runner cases pass. The runner cases use an explicit local scoring test double and do not represent a provider verdict.
- All three focused groups pass on the unmodified golden app and fail on the captured GPT app using disposable databases. This is diagnostic evidence, not an official score.
- Three separately broken golden variants are detected: Member participation leakage, roster coercion, and order-sensitive approval receipts. Each fails only its intended focused group.
- 115 current standard checks pass. Agent instruction/asset hashes, installed dependencies, seed counts and absence of golden/test files were checked in the local agent image.
- Source-to-ZIP equality, the 36-file single wrapper, unchanged criterion IDs/weights, unchanged golden source, identical shared gates and verifier provenance hashes are checked mechanically.

No new GPT generation, paid Oracle or platform QC was run. A future model may implement the stronger requirements correctly. The historical 0.7647 and final 0 remain unchanged.

## Build and checker limitations

Clean builds of both unchanged Dockerfiles failed because Docker could not resolve its configured corporate package proxy. Explicit empty proxy build arguments did not resolve that environment issue. Local validation therefore used the installed pinned runtime dependencies, copied in the exact updated task files, and restored the current provider-neutral verifier configuration. These local images are labelled with `-local`; they are not evidence of successful clean image builds.

The repository's newer generic ZIP checker was also run against both the r10 baseline and this candidate. Its results are recorded in `generic-upload-check.json`. The old archive fails its portable file-metadata check; r11 writes Unix regular-file metadata and clears that issue. The r11 check then stops at `Independent judgments render` because it requires the literal phrase `Evaluate each criterion independently`; Ballot already expresses that rule under `Independent criterion scoring:`. The checker also hardcodes an aggregation layout that differs from Ballot's existing standard-approved layout. The Ballot standard checker, byte-level package checks and unchanged-gate comparisons are reported separately; no generic checker or platform pass is claimed. Resolve checker compatibility and rerun clean builds before treating this as a fully validated release.

`common-ground-ballot.zip` in the matching deliverables folder is the candidate package for the next validation cycle. Use a fresh Oracle and GPT generation on those exact bytes once the build/QC prerequisites are satisfied. Regrading the previous GPT artifact cannot measure how a new generation handles the clarified requirements.

## Reproduction

From the repository root:

```powershell
python reports/common-ground-ballot/2026-09-14-functional-r11/probe.py
python reports/common-ground-ballot/2026-09-14-functional-r11/validate.py build
python reports/common-ground-ballot/2026-09-14-functional-r11/validate.py checks
```

For the documented local dependency fallback:

```powershell
python reports/common-ground-ballot/2026-09-14-functional-r11/validate.py build checks --cached-dependencies
```

The cached verifier image lacked curl. The local fallback supplies the real curl binary and its isolated library bundle from the installed agent image; it does not replace health requests with a test double. The local runner also sets `NO_PROXY` for loopback. No global proxy settings or product files were changed for those workarounds. Packaging refuses to overwrite a frozen archive. Evidence remains under `reports/common-ground-ballot/2026-09-14-functional-r11/`.
