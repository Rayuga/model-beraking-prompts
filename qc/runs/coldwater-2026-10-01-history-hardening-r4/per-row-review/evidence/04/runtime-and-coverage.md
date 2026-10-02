# Row 04 evidence: deliverables and runtime contract

Reviewer: `row-reviewer-04`  
Frozen input: `449588674bad7d501440fbacd72762e35316d5e9b197902f727ae88734a4b30b`

## Governing check

The frozen workbook `rules/WebDev Rubrics QC.xlsx` has SHA-256
`6d44970b2ff67fefad1e2327e743fc226fcd4c50ff55baf899f41069a9b3fd7f`.
`Quality Checks` row 5 is quality check 4,
`instruction_states_deliverables_and_runtime_contract`. It requires every graded
demand to be publicly asked for and lists the entry path, start command, port,
storage/`DB_PATH`, health path, fixed clock, seed and accounts as runtime facts.
`Internal Quality Checks` row 5 gives the same instruction/contract interpretation.

The frozen skill's `references/quality-checks.md`, check 4, repeats that exact
fact-list procedure. Its `references/staged-task-contract.md:166-180` says the
database path honoring `DB_PATH` is stated in the instruction and consumed by
`test.sh` and the restart helper.

## Runtime-fact matrix

| Fact | Public statement | Result |
|---|---|---|
| Deliverable path | `task/instruction.md:9`; `task/environment/instructions/integration.md:5` say the app goes in `/app`. | Covered |
| Start command / entry | `integration.md:5` states `node /app/server.js`. | Covered |
| Bind address / port | `integration.md:5` states `0.0.0.0:3000`; line 7 states `PORT=3000`. | Covered |
| Health path | `integration.md:5` requires prompt success from `GET /api/health`. | Covered |
| Durable shared storage | `integration.md:9` requires saved records/history/retry recognition to survive reload and process restart and be shared across independent browser contexts; line 13 rules out a separate service. | Covered behaviorally |
| `DB_PATH` | No occurrence in `instruction.md` or any of the six `/instructions` notes. The launch-variable list at `integration.md:7` names `PORT`, `NODE_PATH`, `PATH`, and `HOME`, but omits `DB_PATH`. Meanwhile `task/tests/test.sh:95-111` computes `APP_DB` and launches with `DB_PATH="$APP_DB"`; the generated restart helper repeats it at lines 153-161. | **Missing** |
| Seed | `task/instruction.md:5` and `integration.md:11` name `/assets/seed_data.json`; the seed is an empty-snippets scope document. | Covered |
| Accounts | `task/instruction.md:1`, `overview.md:7`, and `policy.md:3` explicitly say there are no accounts or sign-in and there is one shared library. | Covered |
| Fixed clock | No fixed clock or explicit statement that no fixed wall clock is supplied/required appears in the public instructions. No date-based product behavior is graded, but the workbook's required runtime-fact list is still not fully stated. | **Missing contract statement; no date-criterion mismatch observed** |
| Public network posture | `instruction.md:9`, `integration.md:13`, `security.md:9`, and `policy.md:7` allow app/CDN network access while separately blocking user-authored snippet networking. | Covered; the workbook explicitly says no no-network constraint is required |

## Criterion-to-requirement coverage

The five frozen `judge.toml` files contain 96 criteria: two gates, 82 functional,
six polish, and six visual. I inspected all criterion descriptions and their
scenario prompt, not only their IDs.

* The Render gate's real authored JavaScript run, preview interaction and console
  observation come from `instruction.md:1`, `behaviour.md:5-21`, and `ui.md:3-7`.
* The Constraints gate's UI Save and independent-context readback come from
  `instruction.md:1,7`, `integration.md:9`, and `behaviour.md:25-29`.
* Language dispatch, fresh documents, cancellation, Stop, last-good recovery,
  interactivity, five-second shared deadline, source-line errors, console
  behavior and auto-run outcomes come from `behaviour.md:5-21` and
  `security.md:3-9`.
* Origin isolation, supported literal JavaScript/inline classic HTML, unsupported
  dynamic execution families, harmless text occurrences and snippet-network
  refusal come from `security.md:3-11`.
* Saved-record identity/fidelity, browser/process durability, stale Save behavior,
  immutable history, inspection without mutation/execution, restore append,
  idempotent restore retry, racing changes and restart durability come from
  `integration.md:9` and `behaviour.md:25-40`.
* Editor features, named/reachable/focus-visible controls, keyboard-only library
  navigation, narrow-screen reachability and workspace organization come from
  `instruction.md:7`, `overview.md:1-7`, and `ui.md:3-9`.
* The six visual Likert criteria measure professional readability, contrast,
  layout, hierarchy, coherent control treatment and responsive consistency.
  These are supported by `instruction.md:7` and `ui.md:3,9` and do not impose
  exact colors, branding, routes, selectors or pane arrangements.

No grader-only product demand was found. Exact marker strings, scenario-owned
fixture names and bounded probes in `functional/prompt.md` are evidence probes,
not extra product requirements. The judges allow route and control-label
discovery where the public notes leave those choices open.

## Adversarial alternatives

**Plausible broken app that could pass:** an app hard-coded to `/app/app.db` can
pass in the ordinary writable-`/app` launch, including the one restart, while
ignoring the verifier's `DB_PATH` contract. That is precisely why merely seeing
successful golden scripted persistence does not repair this instruction gap.

**Publicly conforming alternative that could fail:** the public instructions let
an implementation choose its persistence location, provided state survives a
process restart. A builder may reasonably place a SQLite file relative to
`server.js` or under another durable path and ignore the unstated `DB_PATH`.
If the verifier falls back from `/app` to its copied tree, its intended database
path is communicated only through `DB_PATH`; an otherwise conforming app can
then use a different file/location than the harness expects. The exact fallback
was not executed in this read-only row review, so this is a contract-risk
counterexample, not a measured runtime failure.

## Evidence boundary

`raw-evidence-index.json` binds 83 artifacts to this frozen input; all 83 current
artifact hashes match the index. Its own scope and limits say the evidence is
scripted golden browser evidence and not a configured RewardKit, Oracle, Luna or
portal result. This row therefore uses the scripts only as supporting product
evidence. No configured grading run or private deterministic checker run was
performed or claimed here.
