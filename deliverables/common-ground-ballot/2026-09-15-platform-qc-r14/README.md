# Common Ground Ballot r14 platform-QC repair

The supplied screenshot shows Upload checks passing, Static 45/45, and Rubric
50/53. Oracle and model runs were skipped because rubric QC failed. The visible
task is platform version v8; its abbreviated platform hash cannot be mapped
to a local ZIP checksum from the screenshot alone. All three reported issues
also exist in the r13 source, so this repair applies to the latest local task.

Use `common-ground-ballot.zip` from this dated r14 delivery folder. SHA256:
`dd8b99af573567fda1462b84299e780716711b07f91066bccf56fd7e43dc0318`.
Task version remains 1.0.0. There are 37 files and 38 task criteria across the
same five dimensions; the platform's 53 QC rules are a separate count.

## Fixes mapped to the supplied findings

| Platform finding | Repair and evidence |
| --- | --- |
| dimensions_cover_every_graded_requirement | Render and Constraints now use actual RewardKit all_pass aggregation. The independent same_origin_shell, health_endpoint and sqlite_persistence criteria are mandatory. Failing any one produces Constraints 0 and final reward 0, even when every other criterion passes. The 54 scoring regressions exercise every individual task criterion through the pinned aggregator and final scorer. |
| criteria_are_independent_and_noncontradictory | Removed public_page_loads, whose root-load observation was already in the shared gate. Split health from SQLite. Replaced theme_touch_and_motion_quality with theme_switch_preserves_workspace, comfortable_touch_targets and reduced_motion_preference. Each has its own evidence and verdict. The three old unrelated concerns retain their combined Polish weight through integer weights: the other three Polish criteria each weigh 3 and these new three each weigh 1. |
| cross_file_runtime_contract_is_consistent | Removed both redundant numeric maps and the intermediate reward aggregate from reward.toml. It now declares only composition roles and reward = []. The runner invokes score.py once; that scorer reads the sole numeric dimension weights directly from each judge.toml. No point coefficient is hardcoded again in test.sh or score.py. Changing a judge weight in a temporary test fixture changes the computed reward without editing the runner. |

The pinned RewardKit 0.1.7 implementation reads judge weights for dimension
aggregation and ignores the old reward-spec weight maps. Those misleading maps
were removed rather than being treated as authoritative. The real penalty gap
was the weighted-mean Constraints score remaining positive after one failed
requirement. The new all_pass aggregation closes that gap explicitly.

Numeric dimension weights remain Render 1, Constraints 1, Functional 0.6,
Polish 0.2 and Visual 0.2. Render and Constraints serve as mandatory gates.
When they pass, the final normalized weighted mean remains 60% Functional,
20% Polish and 20% Visual. The 22 Functional criteria and their 34 total weight
are byte-for-byte unchanged; Visual criteria and the golden solution are also
unchanged. The r13 native-dialog and vote/privacy checkpoint fixes remain.

All five prompts retain the identical shared authentication prerequisite.
Their independent-scoring paragraphs now explicitly distinguish mandatory
all_pass dimensions from the weighted_mean dimensions. Prompt revisions are
Render r4, Constraints r4, Functional r14, Polish r6 and Visual r4.

## Validation and remaining platform work

Validation uses files extracted from the exact frozen archive:

- 54 scoring regressions using the installed RewardKit aggregator, including
  every criterion's effect on final reward, each mandatory runtime failure,
  authoritative weight changes, malformed scores/weights, and the full
  RewardKit writer plus final scorer with explicit verdict fixtures.
- 45 full browser groups with two real restarts; seven focused session groups;
  13 groups through pinned Playwright MCP, including the previously failed
  session/privacy/approval observations and both restarts.
- Three independent Polish browser checks, including actual touch input and
  computed ordinary/reduced-motion durations. The golden control transitions
  drop from 0.16 seconds to 0.00001 seconds under reduced motion.
- A deliberately broken reduced-motion CSS variant fails only the motion
  criterion while its theme and touch checks pass.
- Five runtime checks, 15 runner harness cases, 129 standard checks,
  341 actual archive checks, and seven negative packaging regressions for
  the reported defects and their runtime dependencies.

The first new theme regression took its before-state while the roster was
still loading. Both the ordinary app and motion mutant exposed that test race.
Those attempts are retained. The driver now waits for the actual successful
roster response and visible member rows before measuring theme preservation;
the app and criteria were not changed to hide that invalid test setup.

The local standard and preflight checkers now recognize this explicit,
task-scoped platform-QC correction. Prior checker/standard source is retained
in this report directory. Historical ZIPs and other task packages are untouched.
New preflight regressions reject the zero-weight override, partial mandatory
aggregation, absent gate/scorer, duplicate root-load criterion, and old bundled
runtime/Polish criterion structure.

Runtime validation uses cached dependencies with the current frozen task files.
This does not establish a clean Docker build; the clean-build package proxy
blocker documented during the same-day r13 cross-check remains unresolved.
No new platform QC result or scored Oracle/GPT result is claimed. Run platform
QC on this ZIP first, then Oracle and GPT on the same checksum once QC passes.
Keep each result and the full action trace; the prior scores belong to earlier
grading configurations and cannot be relabeled as r14 results.
