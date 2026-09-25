# Common Ground Ballot r13 cross-check

Use the September 15 r13 ZIP instead of r12. Its SHA256 is
`7a0b5cae1b78ddbc565f387f925caf1e78106dff6582ba6dd0abe8a51a8765f6`.
Only tests/functional/prompt.md changed inside the package. The golden app,
all 22 Functional criteria and weights, all other judges, shared gates, seed,
brief, runtime configuration and version 1.0.0 are unchanged from r12.

The review found a concrete tool interaction that the prior direct Playwright
regressions did not exercise. In pinned Playwright MCP 0.0.79, the native
End all sessions confirmation returned a Modal state before the surrounding
browser_run_code_unsafe snippet produced its Result. An automatic dialog
listener does not guarantee the remaining script's capture is returned.
Continuing revocation checks and a fresh-login positive control in that same
snippet can therefore lose evidence or run ahead of the next judge observation.
The retained failing tool response is in attempt-1-native-dialog. This is a
reproduced measurement hazard; the original platform export lacks the detailed
action trace needed to prove it caused that run's reported surviving session.

r13 separates capture preparation, the visible click, native-dialog handling,
completed mutation capture, revocation measurements, and the final fresh-login
control into separate tool calls. Captured credentials stay in evaluator-owned
Playwright process memory; they are neither printed nor placed in app storage.
Both current sessions and both retained credentials must still lose protected
access. The original MCP page/context remains open through temporary-context
cleanup. A failed or missing observation never receives a pass.

The review also removed a contradictory Courtyard-only replay instruction,
split the crowded first-vote stage into six explicit checkpoints, and made
the changed-set approval mismatch plus both subsequent successes explicit at
publication and each restart. The generic refresh/reauthenticate sentence now
respects the session-survival and revocation sequence. Seven question-mark
substitutions in r12 possessives were corrected, and the prompt uses LF lines.
The existing local approval regression now checks both original and reordered
successes after each mismatch, as the unchanged criterion requires.

Validation is rerun against files extracted from the exact frozen ZIP:

- 45 full browser groups, including two real app restarts and all five shared
  authentication gates before/after mutations.
- Seven focused session and authentication groups.
- 13 groups through the actual pinned MCP stdio server: two independent-session
  sequences, one-/two-participant Member privacy with Ruth/Arun positive controls,
  approval replay/mismatch checks while Open and Published, and privacy, receipts
  and exact result totals after both real restarts.
- Five runtime checks and 15 runner-harness cases. The harness uses score stubs;
  it does not obtain model scores.
- Three deliberately broken local variants detected through MCP: a retained
  initiating session credential, leaked identified Member turnout, and an
  incorrectly order-sensitive approval receipt.
- 115 standard checks and 317 actual archive checks.

The session mutant is particularly useful: both current browser reads return
401 after local sign-out, but replaying the retained initiating credential
returns protected data with 200. The check rejects this broken implementation;
clearing a browser cookie cannot manufacture a server-revocation pass.

Two local test-driver issues are retained transparently: the initial combined
native-dialog snippet lost its returned evidence, and the next driver attempt
waited for an incorrect membership toast label. The latter was fixed by
capturing the actual UI mutation response. The mutation-analysis assertion
was also corrected to inspect retained-credential replay, since the app
legitimately clears the current browser cookie. None of these changes alters
an app failure or recorded platform score into a pass.

Clean Docker builds were attempted again. The verifier confirmed that the
configured package proxy remains unresolvable; the remaining stalled agent
build was stopped after that blocker was established, so passing runtime evidence uses current frozen task files with
cached dependencies. This is not a clean-build pass. Harbor auth status reports
not authenticated, and the configured direct OpenAI judge credential is absent.
No scored r13 Oracle/GPT run or platform QC pass is claimed. The actual MCP
checks validate the execution mechanics without an LLM choosing the actions.

The next platform check is Oracle on this exact ZIP. Require every Functional
criterion to pass and the required overall Oracle threshold; then rerun GPT
on this same revision. Keep the full action trace and reward details for every
attempt. Local passing evidence reduces known failure risks but cannot
guarantee the outcome of an unrun scored judge.
