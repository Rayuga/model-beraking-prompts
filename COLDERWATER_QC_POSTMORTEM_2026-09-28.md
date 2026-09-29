# Colderwater QC postmortem

Prepared from the screenshots supplied in this conversation, the saved feedback ledger, final local audit, and current Colderwater source. This is an explanation of the failures, not a claim that they have been repaired. Colderwater files and its ZIP were not changed for this analysis.

## Main conclusion

The repeated failures were primarily an authoring and verification-process problem. We repaired individual reported examples without consistently removing their underlying causes. Some changes improved coverage but expanded the judge's work or introduced another ambiguity. Local validation demonstrated selected golden behaviors and harness mechanics; it did not demonstrate a complete, reliable evaluation of alternative correct implementations.

The final seven flags were not seven independent new bugs. The workload and whole-run-zero behavior contributed to three separate QC check failures. Other findings revisited privacy/CSS observation ambiguity and criterion bundling, alongside a missed Promise-timeout requirement.

## Nine feedback episodes available in the record

These are nine supplied feedback episodes, including one static-check episode, not nine independently verified platform run IDs. The historical ledger covers the first eight; the latest screenshot adds the ninth. They contain 37 flagged check occurrences in total. One flag can describe several defects, and several flags can describe the same defect. No exact upload hash is assigned to a screenshot unless a platform export establishes it.

| Episode | Flags | Main feedback | Why the next review could still fail |
| --- | ---: | --- | --- |
| 1 | 1 static | Ordinary words in the brief matched short private criterion IDs. | Making IDs distinctive fixed this mechanical collision, not semantic rubric quality. |
| 2 | 10 rubric | Unnatural instructions, grading vocabulary, missing feature coverage, bundled scores, weak gates and excessive credit for nonworking shells. | The task needed structural revision across instructions, gates and criteria. Fixing these examples did not establish complete coverage. |
| 3 | 3 rubric | Unrequested cancellation explanation and missing private-file protection checks. | Privacy probes were added, introducing difficult distinctions between protected files, public resources and browser fallback pages. |
| 4 | 2 rubric | Ambiguous five-second limits for later preview interactions; incomplete keyboard coverage. | More explicit interaction rules and broader keyboard tests increased the behaviors the verifier had to distinguish. |
| 5 | 8 rubric | Unrequired responsiveness/escape-key demands, timeout risk, remaining bundles, difficult browser probes, inconsistent timing/conflict evidence and metadata residue. | Removing unsupported requirements helped, but timing remained unmeasured and the browser protocols remained complicated. |
| 6 | 2 rubric | Public instructions revealed exact privacy test paths; restart depended on unrelated Duplicate/Delete features; Delete combined separate protections. | These specific dependencies were removed, but independence had not been checked consistently across all other outcomes. |
| 7 | 2 rubric | Timeout risk again, plus import/title/startup/language behaviors sharing binary scores. | Splitting scores preserved partial credit but did not establish that the judge could finish the work. More rows also increased reporting burden. |
| 8 | 2 rubric | Negative checks lacked working positive controls; privacy rules allowed conflicting classifications. | Positive controls and ordered privacy rules were added. Subsequent local coverage fixes added CSS-state, import-type, dirty-editor and keyboard observations. Some retained the same underlying observability and aggregation risks. |
| 9 | 7 rubric | Workload, whole-run-zero handling, Promise-timeout coverage, bundled polish, browser decidability, contradictory decisions and loss of graded reward. | The final review identified cross-file consequences of the remaining risks. It was not simply seven previously fixed defects returning unchanged. |

## Why two became seven

The count of two meant that review reported two failed check categories on that version. It did not freeze the other 51 verdicts for later versions. The candidate subsequently changed, and the next review could find both newly introduced problems and pre-existing problems missed earlier.

The last seven checks group as follows:

1. **Workload and error propagation: three flags.** The current Functional prompt contains 37 explicit action estimates totaling 715 actions, with 93 outcome rows and a 9,000-second judge budget. Required waits, tool latency, reasoning and final reporting share that budget. The custom `validate_suite` handler converts any row error or `EVALUATION_INCOMPLETE` reasoning into a zero for the entire evaluation. These facts underpin `timeouts_fit_the_work`, `verifier_entrypoint_is_safe_and_always_scores` and `reward_is_graded_not_binary_and_discriminates`.
2. **Coverage: one flag.** The brief includes runaway Promise callbacks within the execution budget. The timeout probes cover top-level loops and timers; Promise rejection reporting does not test interrupting a looping Promise callback.
3. **Independence: one flag.** The expanded Polish criterion checks labels, complete keyboard reachability and visible focus together. Expanding it closed a keyboard-coverage gap but left several independent usability qualities behind one binary result.
4. **Observation and decision consistency: two flags.** CSS checks require identifying the current authored execution context, which may not be observable in every valid implementation. Privacy checks require distinguishing intended public resources from working-file exposure without inspecting implementation contents. Their incomplete-observation branches still invalidate the entire evaluation. The timing complaint also identifies an approximately one-second distinction that is unsafe to judge through loosely timed browser interactions. These concerns support browser-decidability and self-consistency failures.

The screenshot shows Rubric Source failing before Oracle/model runs. The timeout finding is a source-level workload assessment, not evidence that a particular Oracle actually timed out in that run.

## What our local review got wrong

- **We overgeneralized from focused tests.** A golden flow passing demonstrates that implementation can satisfy those selected observations. It does not prove every alternative valid architecture can be judged or that an LLM-driven session can complete all scenarios.
- **We tested the handler's implementation rather than its grading consequence.** Tests confirmed that an incomplete result produced an ungraded zero. They did not establish that discarding other observed credit was fair. The platform still consumes the zero reward even if a diagnostic calls it ungraded.
- **We treated unresolved concerns too lightly.** The final local quality report contains 30 Pass, 22 Note and one Not exercised. Timeout fit was explicitly an open P1 risk. Browser observability and self-consistency were Notes with limitations. This was not an all-clear result, and should not have been presented with final-attempt confidence.
- **We increased complexity while chasing coverage.** Splitting outcomes, adding positive controls and covering more cases had legitimate purposes, but they also increased the prompt, state tracking and output burden. Shared setup reduced some repeated actions; it was not measured proof of sufficient time.
- **We fixed examples without a sufficiently strong regression review of related rules.** Independence resurfaced in different feature groups. Privacy changes and special incomplete-result rules had consequences across prompts, context and the shell.
- **We customized shared infrastructure.** Colderwater retains launch/restart/cleanup and report-validation changes in `test.sh`. The later lead message expressly requires that file to remain byte-identical to the template. This is an additional compliance issue, separate from claiming that it caused every historical flag.

## Is QC nondeterministic?

Review variability is possible, especially for prose naturalness, granularity and ambiguity. The available evidence does not establish a platform nondeterminism bug: the task changed between reviews, and there is no controlled pair of identical archive bytes and identical reviewer settings with contradictory outcomes. A later reviewer finding another defect is not by itself a false positive.

The defensible explanation is therefore incomplete earlier detection plus revision-induced problems and unresolved risks. Do not tell the admin that the platform randomly added failures, that the same unchanged ZIP produced all results, or that all local QC had passed.

## Changes to our process

1. Freeze shared template files and verify their hashes before packaging. Escalate template conflicts rather than patching the harness locally.
2. Design a smaller, executable evaluation before expanding the feature set. If the workload does not fit the frozen budget, simplify the task and keep instructions, criteria and golden implementation aligned.
3. Map public requirements to observable outcomes and test each negative claim against both a working positive control and a deliberately broken case.
4. Review every change across the full instruction, protocol, criterion and score path. A new coverage fix must not silently introduce bundling or an evaluator-dependent zero.
5. Treat unresolved P1 risks as release blockers. Separate source review, scripted browser tests, actual configured-judge timing, Oracle reward and hosted QC acceptance in status reports.

## Suggested admin message

We reviewed the Colderwater history. The repeated failures came mainly from fixing reported examples without fully resolving the underlying rubric complexity. Later fixes expanded coverage, but also added judge work and some new coupling/ambiguity. The final seven flags were partly related: the heavy workload plus our custom incomplete-result handler affected timeout, entrypoint safety and graded scoring. The other findings concerned an uncovered Promise-timeout case, bundled keyboard/label/focus checks, and CSS/privacy observations that were not reliable across valid implementations. Our local tests covered selected golden flows and harness mechanics, not a complete configured-judge evaluation. Timing was still an explicitly unresolved risk, so the readiness assessment was too optimistic. We do not have evidence that this was a QC nondeterminism bug. For the next task, we are keeping shared template files unchanged, reducing verifier complexity and treating unresolved timing or observability issues as blockers.

## Evidence

- [Earlier eight-episode ledger](COLDERWATER_QC_HISTORY_AND_LAST_TRY_REVIEW.md)
- [Final historical-witness review](deliverables/colderwater-playground-devtools/final-audit-2026-09-28/history.md)
- [Final local QC dispositions](deliverables/colderwater-playground-devtools/final-audit-2026-09-28/qc_final_findings.json)
- [Functional protocols](projects/colderwater-playground-devtools/tests/scored/functional/prompt.md)
- [Functional outcomes and timeout](projects/colderwater-playground-devtools/tests/scored/functional/judge.toml)
- [Bundled Polish outcome](projects/colderwater-playground-devtools/tests/scored/polish/judge.toml)
- [Whole-suite rejection handler](projects/colderwater-playground-devtools/tests/test.sh)
- Latest seven-failure screenshot supplied in the conversation; no separate platform export or reviewer configuration was supplied with it.
