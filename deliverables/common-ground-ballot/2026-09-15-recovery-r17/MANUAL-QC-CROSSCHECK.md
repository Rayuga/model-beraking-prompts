# Common Ground r17: manual QC and difficulty cross-check

The frozen r17 ZIP remains unchanged. Its 39 files match both the current source
and the frozen validation directory. SHA256:
`51465c839d05a23574b787ff7e4d01aeb3118c82cb138d8b3be875ab5d73c3a2`.

The structural and behavioral checks pass against the canonical extracted
reference in `projects/bazaarbridge-marketplace-commerce/`. The original
BazaarBridge task ZIP from Jordan is not available locally, so this review does
not claim a byte-level comparison with that original attachment. Earlier
BazaarBridge copies with four dimensions and OpenRouter settings are obsolete
for this comparison.

| Manual QC item | Finding |
| --- | --- |
| task.toml uses reference keys | Pass: all 31 table/key paths match; no missing or extra keys. |
| Consistent timeouts | Pass: build 600s, agent 7200s, verifier 13200s. Judges 600/600/9000/900/900 total 12000s inside the serial 12600s wrapper. |
| Version v1.0.0 | Pass: literal TOML value is `"1.0.0"`, as in the canonical reference. The v prefix is the release label. |
| Identical verifier.env | Pass: the platform-injected OpenAI placeholder, Codex judge, gpt-5.6-luna and max match exactly. No literal credential is stored. |
| No API-key mentions in either Dockerfile or test.sh | Pass, including comments. Provider package names are dependencies, not API keys. |
| Verifier reasoning max | Pass: `model_reasoning_effort = "max"` in verifier configuration. |
| Gated 60/20/20 reward | Behavioral pass: zero when either gate is nonpositive; otherwise 60% Functional, 20% Polish, 20% Visual, then four-decimal rounding as in the reference. 32 numeric cases agree; seven malformed score cases are rejected. |
| Formula physically inside test.sh | Placement differs: test.sh calls `tests/score.py`. The helper reads weights from judge.toml, preserving the earlier single-source correction. It is not the literal inline reference block. |
| Five verifier folders | Pass: all five under `tests/`, which is the reference directory spelling. |
| judge.toml in every folder; no judge/model overrides | Pass: all five parse, with no prohibited scalar overrides. The required `[judge]` configuration table remains. |

The inline placement question was raised separately with the user. Pending an
answer, retain the validated helper structure and label this difference
explicitly; do not claim unconditional compliance with a reviewer demanding the
literal code block inside test.sh. Four-decimal rounding is not a deviation:
the canonical reference also rounds after applying the formula.

## Difficulty assessment

r17 has meaningful implementation complexity: fixed eligibility snapshots,
private selections versus identified turnout, irreversible lifecycle transitions,
optimistic concurrency, exact persisted success/refusal receipts, and recovery
of uncertain writes across reloads, sessions and tabs. Those rules interact and
cannot all be satisfied by a shallow collection of CRUD screens.

The six new criteria own 22/58 Functional weight: 20 for the five recovery
invariants and 2 for operation namespace. Each recovery criterion changes final
reward by approximately 0.0414. Their separation is justified by distinct
observable failures: losing work, changing a retry, overwriting another entry,
exposing another person's work, and resurrecting a resolved entry across tabs.

The previous 347 passing local groups include 58 golden boundary probes and 23
recovery groups. Actual pinned-MCP recovery checks passed, and five deliberately
broken recovery variants were caught. These facts support buildability and
verifier feasibility. Full scored judge execution remains the main uncertainty;
its multi-context, fault-injection and restart evidence sequence needs a fresh
Oracle run. Ordinary Polish feedback should use its independent sign-in or
validation witness, avoiding a second deduction for a recovery-only defect.

The old GPT artifact is not yet proven below 0.7. A diagnostic counterfactual
restoring evidence-only roster and recorded-participation deductions, retaining
the observed mobile overflow, applying the reproduced malformed-input failures,
and failing all six new criteria produces Functional 34.25/58 = 0.5905,
Polish 11/14 = 0.7857, Visual 1 and overall 0.7115. This is arithmetic under stated
assumptions, not a new judge score. Simply reweighting the old deductions gives
0.6868 but wrongly treats missing evidence as reliable product defects.

Recommendation: keep the scope and run fresh platform QC, Oracle/NOP, then GPT
on this exact ZIP. The task is complex enough for that trial; neither Oracle 1
nor a target GPT band can be guaranteed. Further expansion before those results
would increase judge workload without proving better calibration.

The executable audit and detailed evidence are in `audit.py` and
`manual-qc-audit.json` in this report directory. No source, rubric weights,
golden behavior or ZIP bytes were changed by this cross-check.
