# Independent harness cross-check

The immutable ZIP `a017932304e19209de817cdd13070c4e0ff5f8e5b8e2af72eac1078cf53357b1` had one confirmed RewardKit compatibility defect. It is fixed in source by changing only `row.get('reasoning')` to `row.get('reasoning', '')` at `tests/test.sh:311`. The patched shell is `983273d15c65a6e282e6d7fe8e31424ccc80b6d9701b1535d73431f5af5edabb`. The original ZIP and its prior evidence were left unchanged.

## Confirmed and fixed finding

**P1, CONFIRMED: a valid empty reasoning string invalidated the entire evaluation.** Installed `harbor-rewardkit==0.1.7` permits an empty string in the response schema (`rewardkit-0.1.7-source/judges.py:92`), defaults missing reasoning to `""` (`judges.py:264`), and omits that field from a serialized criterion when empty (`models.py:130`). The archived guard required the omitted field to exist as a string. Thus RewardKit could exit successfully with valid verdicts and the harness would write `graded=0`, `no_op=1`, zero reward, and `invalid_report: missing or malformed reasoning`.

This was reproduced through the actual installed RewardKit CLI, including discovery, Claude envelope parsing, normalization, aggregation and report serialization. Only the Claude child-process transport was replaced with a local JSON fixture. Docker networking was disabled and no provider was invoked. See [baseline actual CLI results](actual_rewardkit_results.json) and [the rejected valid report](actual-cli-cases/empty_reasoning/gates/reward-details.json).

The one-line fix accepts omitted or empty default reasoning. Explicit null/numeric reasoning remains invalid; an `EVALUATION_INCOMPLETE:` prefix and actual criterion errors still invalidate the run. Missing reasoning in an original provider response is not schema-valid, but RewardKit deliberately normalizes it to the same empty default; serialized reports cannot distinguish those two origins. The existing guard already accepted an explicitly empty string, so this aligns serialization compatibility without weakening its intended policy.

## Fresh verification

| Evidence | Result | Scope |
|---|---|---|
| [Actual RewardKit CLI after fix](actual_rewardkit_results.after.json) | 10/10 expected outcomes | Normal success, ordinary gate failure, reversed response order with mixed negative scores, empty/default reasoning, binary/Likert compatibility, incomplete marker, missing criterion, CLI failure, provider error envelope |
| [Guard regressions](guard_probe_results.json) | 43/43 | Original 40 scenarios, with missing-reasoning expectation corrected, plus empty/null/numeric reasoning |
| [Orchestration regressions](harness_regression_results.json) | 4/4 | Relative CWD and sanitized unprivileged launch/restart; golden snippet durability and single-use restart; gate-failure stop; missing app |
| [Review binding](review_binding.json) | 39/39 | Exact shell hashes, source diff, helpers, original ZIP, criterion counts/order, and evidence bindings |

The prior 40-case suite remains historical evidence for the original shell, and its missing-reasoning rejection is superseded by the actual installed serializer reproduction. These fixtures do not establish model judgement quality or paid full-suite latency.

## Contract findings

- RewardKit preserves explicit criterion IDs, names and TOML weights. Its parser iterates rubric order regardless of response-object order; the guard safely matches by name and rejects missing/duplicate identities. Current criteria have no negation or optional metadata that could change raw/value interpretation.
- RewardKit rounds normalized row values and dimension summaries to four places. Its detail score is assigned the same rounded dimension value as `reward.json`; the guard's exact summary/detail comparison is compatible. Actual mixed binary/Likert output and weighted aggregation passed.
- The guard accepts schema-valid binary and five-point Likert values plus RewardKit's common bool/numeric/integral-string representations. It intentionally rejects malformed strings, nonfinite values and out-of-range/fractional Likert values. Those are not valid responses under this rubric's generated schema.
- An agent process or Claude error envelope produces a nonzero RewardKit CLI result; a partial criterion response also fails parsing after bounded retries. Fresh actual CLI tests confirmed these paths cannot be treated as application grades. RewardKit's timeout path emits `error` per criterion with `raw=null`; the source and structured-error fixture confirm the guard checks that error before raw validation. A real 9,000-second provider timeout was not waited out.
- Functional restart is criterion **22**, immediately after `save_load`, leaving 13 later criteria. The prompt requires continuation after ordinary failures and a fresh page after a successful restart. MCP arguments expand the exported helper path through installed RewardKit's `os.path.expandvars`; transport-event evidence includes that expanded path.
- The original launch, restart and cleanup code is byte-identical after this compatibility fix. The four fresh orchestration cases passed. Prior resistant-parent/child cleanup evidence remains applicable through the exact unchanged lifecycle prefix; it was not relabelled as a fresh run.
- Canonical `score.py`, `restart_mcp.py` and `scoring.toml` still match the current template byte for byte. App UID/GID 65534, sanitized `env -i`, private verifier directories, parent-protected restart helper, single-use marker, process-group cleanup and preserved exit status remain intact.
- The audited ZIP contains 50 members, **35 functional / 47 total criteria**, functional weight sum **49.5**, no ZIP symlinks/path traversal, and no node_modules, database, nested archive, QC workbook or Python bytecode. Gate budget 1,500 plus scored 11,100 fits verifier 13,200; dimension timeout sums fit their suite budgets. Arithmetic nesting does not establish practical completion time.

No additional harness blocker was found in this bounded review. It read the requested QC skill and current staged contract; a fresh complete 53-check workbook review is the root review's separate responsibility. No paid/platform run was used, and the existing localhost:3420 preview and other containers were preserved. A replacement ZIP must be packaged separately from the original immutable artifact.
