# Working-write prerequisite regression

This authoring harness tests the proposed Polish/Visual prerequisite without changing task files or invoking a paid grading model. It uses the actual pinned Playwright MCP `browser_run_code_unsafe` tool, version 0.0.79, in cached `pellmoor-tests:2.0.3`.

The executed regression passed all intended outcomes:

| Case | Observed result |
| --- | --- |
| Golden Polish and Visual before later workflow | Both passed: real HTTP 201, one server note after reload, one note in the independent session. |
| Golden Polish and Visual after offer-to-hired-to-withdrawn | Both passed with the same persistence evidence; both preceding UI transitions returned HTTP 200. |
| Seed compatibility | Candidate identities/stages/panels/scores, capacity and funnel remained unchanged after the two initial notes; Pim's notes remained empty. |
| Styled authenticated read-only fixture | Failed the prerequisite because no normal note-write control exists. |
| Optimistic client-storage fixture | Failed despite HTTP 200 and a note visible after reload: protected server reads and the independent session each contained zero copies. |

These are actual browser/tool observations, not synthesized judge scores. `results.json` contains the seven MCP case results; `seed-preservation.json` retains the before/after snapshots.

Each positive probe signs in through the UI, opens an existing candidate, appends a distinct note through the visible control, captures the real POST response, reloads and reopens, and then independently signs in using a new browser context. A pass requires the note once in both authenticated server reads and visible in both interfaces. The independent context prevents a localStorage-only note from qualifying. The probe uses known selectors for these authored regression fixtures; delivered judge instructions must discover submitted controls, routes and response shapes instead.

Cases:

- Golden Polish and Visual probes before later workflow changes. Their notes target Devi/CAND-106 so Pim/CAND-104 retains the empty notes required by seed fidelity.
- Comparison of seed identities, stages, panel assignments, scores, funnel and capacity before/after those two notes. Revisions and note/activity counts may advance legitimately and are not incorrectly required to remain zero.
- Two real UI transitions, offer to hired and then withdrawn, model a later persisted workflow state. Both dimensions must still be able to append their fresh note on the terminal record, as explicitly allowed by the brief.
- An authenticated styled read-only fixture serves real protected records but exposes no note write. It must fail this prerequisite.
- An authenticated optimistic fixture returns POST 200 and displays a browser-local note after reload, while its server read remains unchanged. It must fail, despite its successful-looking UI and POST acknowledgement.

The two negative fixtures do not claim to be complete task submissions or predict their exact hosted Functional scores. This verifies only the write/persistence prerequisite. Existing shared authentication checks and every dimension's independent criteria still apply.

## Scope decision

Keeping this prerequisite in Polish and Visual preserves basic Render and Constraints checks while preventing a genuine read-only shell from receiving appearance/usability credit. Its remaining credit for correctly implemented authenticated reads is a separate Functional judgment. This does not prove universal rank monotonicity for every imaginable pair under a weighted reward formula; it addresses the concrete no-write and optimistic-client-only cases.

Both dimensions need their own fresh unique note and observations. An earlier dimension's saved note is not independent evidence. Do not delete the note, reset the database, repair application state or rerun an observed product failure into a pass. Avoid the reserved empty-note seed fixture when these checks precede Functional. The new allowance must be reconciled with the existing blanket no-mutations instructions in Polish/Visual, while the common authentication gate itself remains unchanged.

The delivered Visual criteria already permit ordinary scrolling, current persisted data and blocked reviews. No extra branding, golden pixel matching, exact API shape or extra viewport is justified. The single note adds a small ordinary interaction to existing login/reload work; it should not introduce batch, concurrency, assessment, restart or advanced retry requirements into these dimensions or require timeout changes.

Run `setup.sh` in an isolated temporary container with the task mounted read-only at `/source` and this directory at `/evidence`. Successful output is written to `results.json`, raw MCP returns and `seed-preservation.json`. Failures retain `partial-results.json` and their exact tool return. No generated reward value is an Oracle or platform score.
