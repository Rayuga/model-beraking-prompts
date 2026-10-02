# Reviewer A: colderwater-playground-devtools, strict quick review

- Snapshot: `.qc-cache/coldwater-strict-2026-10-02-r4/task` (input SHA256 `72adf65fb8ad53114a063b8314aaf68a381649434faded448b93d17621d5bceb`)
- Rules read: frozen workbook (`Quality Checks` + `Internal Quality Checks`), `SKILL.md`, `references/quality-checks.md`, `references/staged-task-contract.md`, `qc/REVIEW_POLICY.md`, frozen template.
- Task files read: `instruction.md`, six notes, `task.toml`, `app_context.md`, five `prompt.md`, five `judge.toml` (3 gate, 41 functional, 6 polish, 3 visual criteria), `solve.sh`, `server.js`, `src/custom-editor.js`, `src/app.tsx`, `src/runtime.ts`, `src/style.css`, `tests/test.sh`, both Dockerfiles.
- Evidence used: `raw-evidence-index.json` and the scripted results/tests it indexes (`qc/repairs/coldwater-2026-10-02-strict/results/*.json`, `tests/lib.cjs`, `tests/editor.cjs`). This is scripted golden evidence, not a judge run.
- Not read: any `per-row-review`, any earlier reviewer report, `STRICT_CANDIDATE.md`.
- What I ran: TOML parse of all seven TOML files, `bash -n` on both scripts, `node --check server.js`, CRLF count, `diff` against the frozen template. Nothing was built, no container was started, no judge was run.
- Known and accepted, not re-reported: no configured judge / Oracle / target-model run (rows 11, 22, 40, 42 measurements missing); Stop and supersession depend on the judge acting within about four seconds.

## Result: 49 Pass, 4 Fail (rows 18, 26, 32, 49)

All four Fails are `Not exercised` by a real judge. None is refuted by the scripted evidence; two are supported by it (the scripted tests needed inputs the judge rules forbid).

## Fails

### Row 32, criteria_are_outcome_based_and_browser_decidable (P1, not exercised)

- Anchor: `tests/app_context.md:24` ("Script may be used for exactly two things ... Every other graded action uses real keys and mouse input") and `tests/scored/functional/prompt.md:20`; criteria `tests/scored/functional/judge.toml:56` (`cw_mouse_selection`, triple click) and `:119` (`cw_same_line_carets`, three carets after three words on one line).
- Problem: the judge's browser server is started without coordinate tools (`judge.toml:12`, args `--headless --isolated ...` only). An element click lands on the element's centre and has a double-click flag but no triple click. A triple click, and a modifier-click at a chosen character on a line, can only be produced by driving the mouse at page coordinates through the Playwright code runner. The rules read as forbidding that, because it is "script" and not one of the two named uses.
- Supporting evidence: the scripted golden test did exactly this, `page.mouse.click(p.x + 2, p.y, { clickCount: 3 })` at `qc/repairs/coldwater-2026-10-02-strict/tests/editor.cjs:67`, and coordinate modifier-clicks at `:147`, `:169`.
- Counterexample: the golden itself. A judge that obeys line 24 cannot triple-click or place the second and third same-line carets, so it fails `cw_mouse_selection` (1.0) and `cw_same_line_carets` (2.0) on a conforming app. If the snapshot exposes no per-line references inside the editor, the three other multi-caret and drag criteria are affected too.
- Not verified: the exact tool list of `@playwright/mcp@0.0.79` (image not available here).
- Fix: add one sentence to `app_context.md`: driving the real mouse and keyboard at page coordinates through the browser tool's code runner (triple click, press-move-release drag, click with a modifier held) is real input, and reading element boxes to find the coordinates is allowed.

### Row 18, solution_covers_every_graded_dimension (P2, not exercised)

- Anchor: `tests/scored/functional/judge.toml:47` (`cw_grapheme_navigation_and_deletion`) against `solution/app/src/custom-editor.js:348` (text arrives only from `keydown` with a one-character `event.key`) and `:19` (the surface is a plain focusable `div`, with no input sink).
- Problem: an emoji and a combining accent have no key. Playwright sends such characters as inserted text, which a non-editable `div` ignores, so on the golden nothing appears. The only real-input route is a genuine clipboard paste, and nothing tells the judge how to get the fixture onto the clipboard.
- Supporting evidence: the scripted test entered this fixture with a synthetic `ClipboardEvent('paste')` (`tests/lib.cjs:39`, limitation 1 in `raw-evidence-index.json`), which the judge rules forbid ("do not dispatch synthetic events").
- Counterexample: the golden fails this criterion when the judge types `a😀béc` with key presses, reads back `abc`, retries twice and fails fast (`prompt.md:15`). A submission that uses the allowed hidden input for keyboard plumbing would accept the same typing, so the golden is the disadvantaged one.
- Fix: add to `app_context.md`: characters with no key may be typed into the Find field, selected, copied and pasted into the editor with the usual shortcuts. (Alternative: give the golden editor a hidden input sink, which changes the golden and needs re-testing.)

### Row 49, cross_file_runtime_contract_is_consistent (P2, not exercised)

- Anchor: `tests/gates/constraints/prompt.md:5` ("do not dispatch synthetic events or change the app's DOM or state from script") against `tests/gates/constraints/judge.toml:32` (`cw_shared_saved_record`: "clear this origin's browser storage as described in the application notes", which is a script) and `tests/app_context.md:23-24`.
- Problem: the functional prompt carries the exception ("except for the two uses named in the application notes", `scored/functional/prompt.md:20`); the constraints gate prompt does not. The same injected context grants what the prompt sentence forbids.
- Counterexample: a judge that follows the prompt sentence cannot perform the storage clearing, so it fails an `all_pass` gate and the golden's reward is zero. Probability is low because the app context is in the same prompt; the consequence is the whole reward.
- Fix: append "except the storage clearing named in the application notes" to that sentence in `gates/constraints/prompt.md:5`.

### Row 26, dimensions_cover_every_graded_requirement (P2)

Two public asks have no criterion that grades them.

1. `environment/instructions/ui.md:17`: "After Run, Save and Format, say in words what happened". `tests/scored/polish/judge.toml:32` grades a completed Run, a throwing Run and a Save. A successful Format is not checked. Broken app that passes: one that formats silently.
   Fix: add "a successful Format" as a fourth action in `cw_controls_feedback_and_labels`.
2. `environment/instructions/ui.md:9`: "Allow both Alt+Click and Ctrl/Cmd+Click". `tests/scored/functional/judge.toml:101` and `:119` accept "Alt+Click or Ctrl/Cmd+Click". Broken app that passes: one that supports Alt+Click only.
   Fix: in `cw_multi_caret_typing_atomic` require one caret added with Alt+Click and one with Ctrl/Cmd+Click.

## Nits (not Fails)

1. `functional/judge.toml:173` (`cw_js_semantic_coloring`) requires each of the five categories to differ from a plain variable name. `ui.md:13` lists five categories and never mentions plain identifiers. An app that colours every identifier one way, function names included, is arguably conforming and would fail. Add the words to `ui.md` or drop the clause.
2. `functional/judge.toml:362` (`cw_history_restore_retry`): for an app with no retry control the judge must replay "the same method, path and body". Whether the network tool exposes request bodies is unverified. The golden has a "Retry same restore" button, so it is unaffected.
3. `functional/judge.toml:317` (`cw_preview_isolation`): the localStorage leg has no known stored value as a control, and a preview on its own separate origin that writes its own storage successfully could be read as a failure. Say that only reading a value the playground page stored counts.
4. `functional/judge.toml:56`: "exactly the text between those two points" for a drag is only decidable to within one character, since apps may round a pointer to the nearest or the preceding boundary.
5. `task.toml:6` description names no judge or dimension policy (the contract comment suggests it). The notes are dense with "must" but stay in a first-person voice. The seed `note` field contains an instruction-like sentence that is benign.

## All 53 rows

| # | Check | Verdict | Basis |
|---|---|---|---|
| 1 | natural product request | Pass | `instruction.md` is three short first-person paragraphs; detail lives in notes. |
| 2 | human voice | Pass | First person throughout; notes dense but consistent. |
| 3 | spelling, uncontaminated | Pass | No TODO/CHANGE_ME, no stray paths, no contradiction found; British spelling consistent. |
| 4 | deliverables and runtime contract stated | Pass | `/app`, `node /app/server.js`, `0.0.0.0:3000`, `/api/health`, `DB_PATH`, seed path, no accounts all in `integration.md`; no clock needed. |
| 5 | no grader machinery | Pass | Grep of brief and notes for judge/rubric/criteria/reward/playwright terms: no hits. |
| 6 | achievable, unambiguous | Pass | Every capability reachable from Node 22 + Express + better-sqlite3 + browser; budget and Stop semantics defined in `behaviour.md`. |
| 7 | real working product | Pass | Custom editor, sandboxed runner, revision store; no stub can satisfy it. |
| 8 | identity coherent | Pass | `turing/colderwater-playground-devtools`; description, keywords, slice agree. Nit 5. |
| 9 | agent environment and network | Pass | 2 CPU, 4096 MB, public, no `docker_image`, no secrets. |
| 10 | verifier isolated, pinned, credentialed | Pass | `separate`; `[verifier.env]` equals the frozen block; no model in any `judge.toml`. |
| 11 | timeouts fit | Pass (structure only) | Gates 600+600 < 1500; scored 9000+900+900 = 10800 < 11100; 12600 < 13200. Workload unmeasured (accepted). |
| 12 | no prebuilt image shadow | Pass | `docker_image` absent. |
| 13 | assets match | Pass | `seed_data.json` and six notes exist and are copied. |
| 14 | seed clean | Pass | Empty `snippets`, no PII, no ids to orphan. |
| 15 | Dockerfile builds declared world | Pass | Byte-identical to template. |
| 16 | no answer leak | Pass | `/app` holds only `.gitkeep`; notes carry no criterion text. |
| 17 | solution covers deliverables | Pass | Each note walked against `custom-editor.js`, `app.tsx`, `runtime.ts`, `server.js`. |
| 18 | solution covers graded dimensions | **Fail** | Non-ASCII fixture entry, see above. |
| 19 | solution honours runtime contract | Pass | `solve.sh` valid, LF, writes only `/app`; server resolves from `__dirname`, honours `DB_PATH`. |
| 20 | frozen and deterministic | Pass | Static prebuilt bundle; no graded value depends on time or random ids. Bundle-equals-source not rebuilt by me. |
| 21 | entrypoint safe, always scores | Pass | Template file, identical. |
| 22 | verifier image can launch and grade | Pass (structure only) | Template file, identical; no launch measured (accepted). |
| 23 | verifier and instruction agree | Pass | Port, entry, `DB_PATH`, health path, symlink rule and writable-copy case are all stated in `integration.md`. |
| 24 | grading wiring | Pass | Five `judge.toml` parse; unique ids (2/1/41/6/3); restart server only in functional; prompts carry `{criteria}` and `{app_context}`. |
| 25 | prompts drive the browser | Pass | All five open `http://localhost:3000` through Playwright MCP. |
| 26 | every requirement graded | **Fail** | Two gaps, see above. |
| 27 | nothing unrequired graded | Pass | Each criterion mapped to a note line or a professional default. Nit 1. |
| 28 | independent, non-contradictory | Pass | Stale-save pair and live-update pair share setup but grade different outcomes, as `REVIEW_POLICY.md` asks. |
| 29 | global browser gate | Pass | Two gate dimensions; each scored prompt restates the gate and zeroes on failure; no same-origin demand. |
| 30 | negatives have positive controls | Pass | Stop, supersession, isolation, dynamic code, format error, stale save, restore retry each carry a working control. Nit 3. |
| 31 | plural asks | Pass | Four matches, five dynamic forms, three carets, all listed controls are each checked across the set. |
| 32 | outcome-based, browser-decidable | **Fail** | Coordinate input versus script ban, see above. Nits 2 and 4. |
| 33 | one full-credit bar | Pass | "Refused or added on top" and "with or without its line break" are single outcome bars. |
| 34 | interaction, time, viewport exercised | Pass | Waits, clicks in preview, 390 px resize and reload are all instructed. |
| 35 | core behaviour and durability | Pass | Type-and-run gate; storage-cleared reload; restart tool; second tab. |
| 36 | probes not pre-satisfied | Pass | Judge-chosen fixtures; `MULTI` absent from seed and from the golden's initial state. |
| 37 | later dimensions tolerate mutations | Pass | `app_context.md:21` tells judges not to assume an empty library; fresh pages after restart. |
| 38 | batched criteria scored independently | Pass | All three scored prompts say score independently and continue. |
| 39 | low floor | Pass | Static shell fails render gate; form-field editor or browser-only store fails constraints gate. |
| 40 | graded, discriminates | Pass (design only) | 41 weighted functional criteria of varied depth; no measurement (accepted). |
| 41 | binary and likert fit | Pass | Behaviours binary; three visual likert blocks with anchors 0 to 5. |
| 42 | ranking monotone | Pass (design only) | No inverted weights found; no measurement (accepted). |
| 43 | gates before shaping | Pass | Gates 0.0; functional floor 0.05; template `score.py`. |
| 44 | weights honest | Pass | 0.6/0.2/0.2; functional weights 1.0 to 2.0 track difficulty (sum 57.5). |
| 45 | injection resistant | Pass | Untrusted-submission sentence in all five prompts. |
| 46 | tests out of agent reach | Pass | Agent image has no tests, judge or RewardKit. |
| 47 | deterministic, pinned | Pass | Template pins; no clock-graded rule. |
| 48 | prompts accurate | Pass | All describe Colderwater; no sibling residue. |
| 49 | cross-file contract | **Fail** | Constraints prompt versus its own criterion and the app context, see above. |
| 50 | only task files | Pass | Closed list holds; no `node_modules`, database or cache in the snapshot. |
| 51 | everything parses | Pass | TOML, `bash -n`, `node --check` all clean; zero CR bytes. |
| 52 | security and secrets | Pass | Only the `${OPENROUTER_API_KEY}` template; no host paths or PII. |
| 53 | distinct and authored | Pass | Product-specific criteria throughout. |

## What the task does well

- Negative checks are consistently paired with a working control, and the stale-save, restore and live-update flows are graded as separate outcomes.
- Public notes and criteria line up closely; I found only two ungraded asks and one arguably unrequired clause across 50 criteria.
- The golden's design (opaque-origin runner, nonce policy, loop guards, server-side revision check and restore operation ids) matches every runtime and persistence criterion in the scripted evidence.
