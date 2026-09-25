Coursemark scored-run review — 14 September 2026

The verifier repair worked. Four submitted apps now have graded = 1, no_op = 0, populated per-criterion results and recomputable scores. Oracle is 0.9583, with every Functional and Polish criterion passing. It falls short of the requested 1.0 solely on Visual. GPT is 0.7697 and Gemini 0.7160, so the requested upper bound of 0.7 is not yet met. Haiku's 0.0707 is confounded by its agent being killed with exit 137; it is not a clean completed-model comparison.

| Run | Final reward | Functional | Polish | Visual | Status |
|---|---:|---:|---:|---:|---|
| [Oracle](../../../run-outputs/coursemark-assessment-workspace/run-3435d99c-5793-4f19-9435-9492308e5ff4/coursemark-assessment-workspace__GF7MiZZ/verifier/reward.json) | **0.9583** | 1.0000 | 1.0000 | 0.7917 | Graded |
| [GPT-5.4-mini](../../../run-outputs/coursemark-assessment-workspace/run-b19e4809-a3cd-46ad-b909-8b3e777f2b92/coursemark-assessment-workspace__KCqABqc/verifier/reward.json) | **0.7697** | 0.7333 | 0.8571 | 0.7917 | Graded |
| [Gemini 3.7 Flash](../../../run-outputs/coursemark-assessment-workspace/run-a8142a00-fb44-40d8-929c-9dd903f12c3f/coursemark-assessment-workspace__uxGNe9a/verifier/reward.json) | **0.7160** | 0.6615 | 0.9286 | 0.6667 | Graded |
| [Claude Haiku 4.5](../../../run-outputs/coursemark-assessment-workspace/run-217ff20f-9ff7-4a88-8947-e32b59b9c44f/coursemark-assessment-workspace__X7eYTTR/verifier/reward.json) | **0.0707** | 0.1179 | 0.0000 | 0.0000 | Agent exit 137; partial app graded |
| [Nop](../../../run-outputs/coursemark-assessment-workspace/run-3435d99c-5793-4f19-9435-9492308e5ff4/coursemark-assessment-workspace__HrNAw5F/verifier/reward.json) | **0.0000** | 0.0000 | 0.0000 | 0.0000 | No app; ungraded fallback |

Render and Constraints are 1.0 for all four graded apps. Nop contains no submitted app and remains graded = 0. These are actual platform results, unlike the previous fallback-zero exports or the earlier local API probes.

All five trials use platform task checksum `6d4f99ea2b0cbc3d837f13951d0572ff7a8c41e2ddd2889195ca3174345bc465`. Every imported prompt, judge, runner and reward-configuration hash matches the delivered source. Oracle's deployed server, browser files, package and app manifest also match. The platform task checksum and ZIP SHA-256 use different scopes and must not be compared as interchangeable hashes.

Use `verifier/reward.json` and the outer trial result for the final reward. The short `rewardkit.log` contains intermediate aggregates that count the gate dimensions: Oracle 0.9861, GPT 0.9232, Gemini 0.9053 and Haiku 0.6902. The task runner correctly applies the final 60/20/20 formula after those logs. All final rewards and all five dimension aggregates were recomputed successfully. The [machine-readable summary](run-summary.json) and [complete 220-row criterion spreadsheet](criterion-results.csv) preserve the evidence.

GPT passes 26/31 Functional criteria, earning 35.75 of 48.75 weight. Five failures lose 13.0 weight:

| Failed Functional criterion | Weight | What actually failed |
|---|---:|---|
| question_validation_and_publish_lifecycle | 1 | Empty drafts leave Publish enabled. The backend rejects the click, but the brief requires the control to be unavailable. |
| start_attempt_and_single_active_guard | 1 | A fresh operation while an attempt is already active returns 200 with the existing attempt instead of refusing the new start. No duplicate record is required for this failure. |
| server_rubric_numeric_validation | 4 | Empty-string scores are coerced to zero and accepted; other tested malformed values are rejected. |
| unreleased_write_and_audit_privacy | 4 | Privacy and exact submit replay pass. The failure is objective-only completion: the attempt remains submitted and release returns 409 not_ready. It is not a score leak. |
| write_metadata_and_owned_fields | 3 | Revision and operation validation pass, but create requests containing claimed actor/status/total/timestamps are accepted with the claims ignored. This violates explicit reject-on-owned-fields behavior; it does not demonstrate privilege escalation. |

Four backend defects were independently reproduced on the exported GPT app in a fresh disposable database: duplicate-active start returned 200; empty score returned 200 with revision +1; a draft containing server-owned claims returned 201 with revision +1; and an objective-only submission could not be released (409 not_ready). Positive rubric saves worked; missing/null/Boolean/nonnumeric/negative/over-maximum values were rejected without revision changes. See [GPT supplementary observations](gpt-reproduction.json). The remaining enabled-Publish finding is recorded by the platform judge; platform browser traces and screenshots are not included in these exports.

GPT's passed behavior is substantial: real sessions and account-wide revocation; seeded schedules and accommodations; student/TA filtering and answer-key privacy; exact expiry; answer persistence; normal mixed-assessment grading and release; audit ordering; stale-tab rejection/fresh retry; restart persistence; fixed reference time after writes; actor-scoped receipts; route/input binding; reordered-JSON replay; and authoring validation. Four of the six newly added hardening criteria now pass, contributing 14 of their 21 weight.

This explains why the earlier conditional 0.692 ceiling did not apply. That calculation assumed all seven previously demonstrated weaknesses persisted. The fresh GPT solution fixed several of them. It was never a measured or guaranteed score cap for a newly generated solution. For this run the actual calculation is `0.6 × 0.7333 + 0.2 × 0.8571 + 0.2 × 0.7917 = 0.76974`, rounded to 0.7697.

GPT also fails two Polish criteria: closing a dialog returns focus to the document body, and student views omit explicit accommodation cues. Functional timing correctness and visible accommodation explanation are different observations. Its Visual score is identical to Oracle's, so the golden currently has no Visual advantage over GPT.

Oracle passes 31/31 Functional, 14/14 Polish, 2/2 Render and 2/2 Constraints criteria. All six new hardening criteria pass on the platform. There is no recorded functional golden defect to repair from this run. The entire 0.0417 shortfall comes from these Visual ratings:

| Visual axis | Raw rating | Normalized value | Judge's reason for lost credit |
|---|---:|---:|---|
| Typography | 4 | 0.75 | Long attempt IDs, audit metadata and compact mobile navigation are slightly small/dense. |
| Color and contrast | 4 | 0.75 | Some muted metadata and disabled controls have softer contrast. |
| Spacing and layout | 4 | 0.75 | Persistent purple main outline and dense mobile header. |
| Hierarchy and scanability | 5 | 1.00 | Full credit. |
| Overall craft | 4 | 0.75 | Minor responsive details prevent top-tier finish. |
| Responsive consistency | 4 | 0.75 | Mobile navigation and some dialog content are compact/scroll-dependent. |

The framework records raw 4 as normalized 0.75 and raw 5 as 1.0; use the recorded values, not 4/5 = 0.8. The mean is 0.7917. With the other dimensions fixed at 1, overall reward is `0.8 + 0.2 × 0.7917 = 0.95834`. Oracle exceeds 0.95 but does not meet the user's explicit 1.0 target.

The focused golden improvement is visual, preserving all working behavior: restrict the large main outline to keyboard focus instead of every mouse navigation; increase tiny mobile navigation and secondary text; simplify the dense mobile identity/reference header; improve muted-text contrast; and wrap long IDs and dialog content deliberately. Current CSS corroborates the observations: `.content:focus` creates the persistent outline, mobile tabs use `clamp(0.56rem, 2.45vw, 0.72rem)`, mobile secondary text uses 0.6rem, and audit times use 0.68rem with light gray. At 375px the tab text is about 9.19px. Preserve keyboard focus visibility, all five reachable tabs, session/revision/time context and natural dialog scrolling. Scrolling alone is allowed by the brief and must not be made a failure. Recheck actual screenshots at both required sizes and rerun Oracle; do not lower Visual anchors or claim future 1.0 without a new run.

Gemini passes 24/31 Functional criteria and 13/14 Polish criteria. Its seven Functional deductions are:

- One visible answer save generates two accepted requests/revision increments.
- The UI requires both rubric scores together, preventing the required independent criterion-save workflow.
- Empty-draft Publish stays enabled.
- The judge did not successfully finish the fresh-current-revision retry in the two-tab workflow; a rejected stale write alone does not establish whether retry is broken.
- The judge did not complete the numeric-validation baseline/matrix/replacement journey before the final restart.
- The objective-only grading/release UI does not expose a working release path, although score privacy passes.
- Receipt identities are global: Nora's legitimate write using Ada's second operation ID returns 409 “Operation identifier belongs to another user”, violating independent actor namespaces.

The numeric-validation deduction is an evidence-quality issue. A supplementary API reproduction against exactly this exported Gemini source accepted the baseline and replacement saves, rejected all seven malformed score cases with 400, and preserved revision on each rejection. See [Gemini supplementary observations](gemini-reproduction.json). This supports the backend, but it does not replace the required visible UI journey or authorize changing the recorded verdict. The two-tab retry likewise needs a complete reproduction before classifying its zero as a confirmed application defect. No detailed judge trajectory accompanies these exports, and there is no recorded verifier timeout; do not invent a timeout explanation for an unfinished subtest.

If only the weight-4 numeric criterion were legitimately awarded after a completed rerun, Gemini would gain roughly 0.0492 overall, moving from 0.7160 to about 0.7652. That is conditional arithmetic, not a corrected official score. Therefore the present Gemini score may understate capability; it is not a reliable basis for declaring the task difficult enough.

Gemini's Polish failure is missing visible keyboard focus on sign-in inputs. Visual scores are typography 4, color 5, spacing 3, hierarchy 4, craft 4 and responsive consistency 2. Mobile Attempts/Gradebook/Audit crop or hide columns, and horizontal navigation clips items. These are more substantial responsive weaknesses than Oracle's or GPT's minor deductions.

Haiku's agent exits 137 after approximately eight minutes, reported as UnknownApiError. The export does not establish whether this was OOM, an external kill or another infrastructure cause. Its partial app still reaches grading, passing only five Functional criteria: seeded sign-in/identity, bearer transport, instructor seeded schedule, account-wide token revocation and reauthentication isolation. It lacks core authoring, answer editing, grading/release, timing and receipt workflows. The judge reports exposed answer keys and a missing TA grading queue.

Haiku's Polish zero is a global-gate failure caused by an unresolved Syncing state after authenticated reload. Its Visual zero is a different shared-gate failure: old tokens still authorized reads after visible sign-out, with blank overlays and unresolved sync also observed. Earlier dimensions reported revocation success, so this inconsistency needs trace-level follow-up; it cannot be summarized as twenty independently measured UI/aesthetic failures. Rerun a completed Haiku generation before treating its 0.0707 as a clean difficulty result.

The next revision should separate three jobs. First improve the golden's evidenced visual defects, leaving its passing functional implementation intact. Second make judge execution complete and reviewable: preserve valid rubric baselines, execute the full invalid-value matrix, complete stale-tab refresh/retry, and retain actual request/response evidence before the final restart. Preserve score records; do not award unexecuted criteria automatically. Third add substantive coverage of existing course-integrity requirements where it is still thin: grading from concurrent staff tabs, replay across grade/release state transitions, exactly-once state/revision/audit behavior, and completion/release across objective-only, written-only and mixed assessments under manual submit and expiry. Expand only explicitly documented product requirements and update the golden/tests together.

Do not raise a few failure weights or duplicate the same defect across criteria merely to force this one GPT result below 0.7. The latest model learned most prior hardening requirements, and one sample per model cannot establish a robust range. Freeze a revised package and rerun Oracle plus multiple model samples. The acceptance targets remain Oracle = 1.0 and the requested model range, with completed grading and independent evidence for every criterion.

This review creates analysis files only. It does not modify the task, change stored scores, produce a new ZIP or claim the current package meets both targets. Supplementary probes used the cached `coursemark-tests:1.0.17` runtime and fresh databases with the supplied seed; they did not mutate the exported apps. The full platform verdicts follow so every pass and deduction can be audited.


**Oracle: complete recorded verdicts.** [Original reward details](../../../run-outputs/coursemark-assessment-workspace/run-3435d99c-5793-4f19-9435-9492308e5ff4/coursemark-assessment-workspace__GF7MiZZ/verifier/reward-details.json).


Render (1.0000):

| Criterion | Raw | Value | Weight | Recorded reason |
|---|---|---:|---:|---|
| page_load_and_refresh | yes | 1.00 | 1 | Gate passed: anonymous protected reads returned 401; visible login produced a 64-character bearer token authorizing populated /api/me and /api/courses data; credentialless replay returned 401; wrong password returned 401; two distinct tokens were both invalidated by one visible sign-out. Root loaded and fully reloaded with the Coursemark sign-in UI, HTTP 200 documents, and no page errors. |
| basic_public_control_interaction | yes | 1.00 | 1 | In a fresh signed-out context, the visible email field accepted and retained the exact seed address ada.mensah@coursemark.example without submitting the form. |

Constraints (1.0000):

| Criterion | Raw | Value | Weight | Recorded reason |
|---|---|---:|---:|---|
| same_origin_application_shell | yes | 1.00 | 1 | The local root served a usable Coursemark sign-in shell. Visible login produced a 200 POST to localhost /api/auth/login, a 64-character bearer token, and populated 200 reads from localhost /api/me and /api/courses. Anonymous and wrong-password reads returned 401 without protected content; two credentials were invalidated by visible sign-out. No fatal page errors occurred. |
| self_contained_entry_and_reload | yes | 1.00 | 1 | A fresh signed-out context received rendered HTML (200 text/html with doctype) at the local root, accepted email input, and remained usable after a full reload at the same URL. Email, password, and sign-in controls remained visible with nonblank content, without submitting the form or navigating externally. |

Functional (1.0000):

| Criterion | Raw | Value | Weight | Recorded reason |
|---|---|---:|---:|---|
| seeded_password_signin_and_identity | yes | 1.00 | 1 | Wrong password was rejected; Ada's successful login and identity response returned her identity, Instructor role, fixed reference time, and revision. |
| bearer_session_transport | yes | 1.00 | 1.25 | Distinct high-entropy bearer tokens authorized protected reads, survived reload, and anonymous reads returned no protected data. |
| instructor_workspace_and_seeded_schedule | yes | 1.00 | 1.25 | A-01 through A-04 retained exact seeded titles, states, openings, and due times after reload. |
| ta_student_authority_and_answer_key_privacy | yes | 1.00 | 1 | Luis was scoped to grading; students saw only their own controls, no draft A-02, and no answer keys; Ada alone had authoring/release authority. |
| nora_accommodation_and_active_attempt | yes | 1.00 | 1 | Nora's A-01 showed the required accommodation, effective due, 60-minute AT-100 allowance, 12:30Z expiry, and both questions without key or score. |
| ben_extension_and_exact_expiry | yes | 1.00 | 1 | Ben's extension and 14:00Z effective due were correct; AT-103 was A-04 and auto-submitted exactly at 12:00Z with score 5, one attempt, one audit event, and hidden score. |
| availability_and_attempt_limit_guards | yes | 1.00 | 1 | Draft, closed, exhausted, and already-active assessments correctly refused new attempts without state changes. |
| answer_save_revision_and_restore | yes | 1.00 | 1 | Nora's exact answers saved with one revision increment and restored after reload without duplication. |
| submission_scoring_and_terminal_lock | yes | 1.00 | 1 | AT-100 submitted once, scored objective 4 for staff, preserved its written answer, hid score from Nora, and became terminal. |
| assigned_ta_scope_and_score_bounds | yes | 1.00 | 1 | Luis saw only AT-100, AT-101, and AT-103; over-maximum grading was rejected without mutation and unauthorized actions were absent. |
| rubric_completion_and_derived_total | yes | 1.00 | 1 | RC-3=2 and RC-4=2.5 were accepted once each; AT-101 became graded with objective 0, rubric 4.5, total 4.5/10, persisting after reload. |
| release_privacy_immutability_and_retry | yes | 1.00 | 1 | Pre-release privacy held; Ada's release created one revision/event, exact replay was idempotent, and Ben then saw the released total and feedback. |
| draft_validation_and_creation | yes | 1.00 | 1 | Invalid due/opening order was rejected without mutation; Canopy survey practical was created with the requested values and persisted as an unpublished draft. |
| question_validation_and_publish_lifecycle | yes | 1.00 | 1 | Empty publish and duplicate options were rejected; the valid written item published once and the published item was immutable and student-visible without start access. |
| audit_visibility_and_exactly_once_events | yes | 1.00 | 1 | Audit was durable, newest-first, correctly scoped, and contained events only for accepted publishes, submits, grades, releases, and auto-submit. |
| gradebook_totals_and_account_isolation | yes | 1.00 | 1 | Ada saw the full gradebook, Luis only his queue, and Nora and Ben saw no cross-account private records; durable data persisted. |
| two_tab_revisions_receipts_and_duplicate_guard | yes | 1.00 | 1.5 | Exact replays were idempotent, stale writes returned 409 with authoritative state, operation reuse with changed input was rejected, and rapid double-submit created one record/revision. |
| account_wide_token_revocation | yes | 1.00 | 1.25 | Two Nora sessions had distinct tokens; visible sign-out invalidated the other token before any mutation. |
| reauthentication_and_cross_account_isolation | yes | 1.00 | 1 | Wrong-password reauthentication stayed signed out; correct login restored Nora's values, and Ben/Nora private records remained isolated. |
| start_attempt_and_single_active_guard | yes | 1.00 | 1 | Ben's A-01 start created one 12:00Z attempt with 45-minute allowance and 12:45Z expiry; exact replay was idempotent and a fresh start returned 409. |
| server_rubric_numeric_validation | yes | 1.00 | 4 | Invalid RC-1 score shapes and bounds returned 4xx without state changes; visible 1-to-2 replacement advanced once and replaced the grade. |
| multiple_choice_authoring_and_key_privacy | yes | 1.00 | 0.5 | The authored Oak/Pine question persisted with points and staff-visible key; Ben saw prompt/options but no key. |
| effective_due_caps_adjusted_duration | yes | 1.00 | 0.5 | Nora's Short deadline check retained a 45-minute adjusted allowance but expired at the earlier 12:05Z due cap with one active attempt. |
| runtime_manifest_routes | yes | 1.00 | 0.5 | APP_MANIFEST.md documented the required server, SQLite path, and observed authentication, read, authoring, attempt, grading, release, and audit routes. |
| fixed_reference_under_course_writes | yes | 1.00 | 4 | Three intervening drafts did not move the fixed reference; Ben's attempt started, expired, submitted, and audited at exactly 12:00Z/12:45Z. |
| unreleased_write_and_audit_privacy | yes | 1.00 | 4 | Ben's objective-only submit response and audit omitted awarded score before release; exact replay was idempotent, release exposed it to Ben but not Nora. |
| receipt_actor_and_scope_isolation | yes | 1.00 | 4 | Nora could not replay Ada's create receipt; a distinct Ada operation identity was accepted for Nora's legitimate save and attributed to Nora. |
| receipt_route_and_input_binding | yes | 1.00 | 3 | Cross-route identity reuse returned operation-mismatch 409; reordered identical create input replayed the original receipt, while changed input was rejected unchanged. |
| server_authoring_validation | yes | 1.00 | 3 | Invalid dates, duration/attempt types, duplicate or empty options, and invalid points returned 400 with unchanged revision; valid Oak/Pine/Birch authoring persisted with key. |
| write_metadata_and_owned_fields | yes | 1.00 | 3 | Invalid revision and operation metadata shapes and claimed server-owned fields were rejected with 400 and no mutation; a final valid UI create succeeded once. |
| restart_persistence_and_seed_idempotence | yes | 1.00 | 1 | After the required restart, all four captured protected snapshots matched exactly, AT-103 remained single, the revoked token stayed 401, and the retained answer-save replay returned its original response without new state. |

Polish (1.0000):

| Criterion | Raw | Value | Weight | Recorded reason |
|---|---|---:|---:|---|
| sign_in_labels_and_keyboard_focus | yes | 1.00 | 1 | Coursemark heading and associated Email/Password labels are visible; keyboard reaches Email, Password, and Sign in with visible focus styling. |
| sign_in_help_and_error_recovery | yes | 1.00 | 1 | Demo accounts and shared password are visible. Wrong password produces the worded alert “Email or password is incorrect.” while controls remain usable. |
| mobile_shell_has_no_page_overflow | yes | 1.00 | 1 | At 375×812, signed-out and authenticated document widths equal the viewport; mobile session details and Sign out remain inside the viewport. |
| mobile_navigation_and_touch_targets | yes | 1.00 | 1 | All five navigation buttons are reachable, non-overlapping, inside the viewport, and 46px high. |
| landmarks_headings_and_current_view | yes | 1.00 | 1 | Navigation and main landmarks exist; each view has one visible matching h1 and exactly one navigation control with aria-current="page". |
| keyboard_view_navigation_and_focus | yes | 1.00 | 1 | Keyboard reached and activated Courses, Assessments, Attempts, Gradebook, and Audit in order; focus indicators and usable main focus remained after changes. |
| record_grouping_and_readable_values | yes | 1.00 | 1 | Courses, assessments, attempts, gradebook entries, and audit events use articles/cards with headings and explicit text labels for dates, scores, and statuses. |
| records_avoid_raw_payload_presentation | yes | 1.00 | 1 | All five workspaces render readable product content; no raw JSON, serialized arrays, or unbroken payload dumps were presented. |
| dialog_labels_focus_and_closure | yes | 1.00 | 1 | Dialogs have visible headings, associated labels, and named Close actions. Tab focus stayed within the native dialog; Escape closed it and returned focus to the workspace control. |
| form_validation_and_scrollable_dialogs | yes | 1.00 | 1 | The mobile rubric dialog scrolls internally within the viewport. Invalid score 9 produced “Score must be from 0 to 3. Nothing was saved.”, kept the dialog open, and left revision 43 unchanged. |
| session_revision_and_sync_summary | yes | 1.00 | 1 | Desktop and mobile summaries show Ada Mensah, email, Instructor role, reference time, Revision 43, Synced, and Sign out. |
| role_workflow_and_privacy_cues | yes | 1.00 | 1 | Student views show due/effective expiry and “+15 minutes accommodation”; unreleased feedback is explicitly hidden. Staff views show grading, draft/published, release, and audit states in words. |
| consistent_controls_and_feedback | yes | 1.00 | 1 | Coursemark remains identifiable on public and protected screens. Controls use consistent labels, disabled/enabled states and focus styling; sync and error feedback are textual and visible. |
| reduced_motion_preserves_state | yes | 1.00 | 1 | With prefers-reduced-motion enabled, representative controls, dialogs, and alerts reported 0.00001s transitions/animations; aria-current selection, Synced status, and validation text remained usable. |

Visual (0.7917):

| Criterion | Raw | Value | Weight | Recorded reason |
|---|---|---:|---:|---|
| visual_typography | 4 | 0.75 | 1 | Strong serif display hierarchy and readable UI type throughout; long attempt IDs, audit metadata, and compact mobile navigation are slightly small or dense. |
| visual_color_and_contrast | 4 | 0.75 | 1 | Cohesive purple, cream, and white palette with clear statuses and scores; some muted metadata and disabled controls have softer contrast. |
| visual_spacing_and_layout | 4 | 0.75 | 1 | Cards, forms, dialogs, and timelines use consistent spacing and alignment; the persistent purple main outline and dense mobile header add minor visual friction. |
| visual_hierarchy_and_scanability | 5 | 1.00 | 1 | Active workspace, identity, primary actions, statuses, scores, feedback, and audit events are consistently easy to locate. |
| visual_overall_craft | 4 | 0.75 | 1 | Sign-in, five workspaces, and dialogs share a deliberate education-product identity with polished cards, badges, overlays, and controls; a few small responsive details keep it from feeling flawless. |
| visual_responsive_consistency | 4 | 0.75 | 1 | Desktop-to-mobile adaptation is coherent: cards stack, navigation remains usable, and dialogs reflow cleanly, though mobile navigation and some dialog content become more compact or scroll-dependent. |

**GPT-5.4-mini: complete recorded verdicts.** [Original reward details](../../../run-outputs/coursemark-assessment-workspace/run-b19e4809-a3cd-46ad-b909-8b3e777f2b92/coursemark-assessment-workspace__KCqABqc/verifier/reward-details.json).


Render (1.0000):

| Criterion | Raw | Value | Weight | Recorded reason |
|---|---|---:|---:|---|
| page_load_and_refresh | yes | 1.00 | 1 | Shared Playwright HTTP gate passed: correct login returned a 64-character bearer token and populated identity/course data; anonymous and wrong-password reads returned 401; both tokens were revoked by visible sign-out. Fresh signed-out root and reload returned 200 HTML with the Coursemark sign-in UI, no page errors, blank screen, raw JSON, server error, or spinner. |
| basic_public_control_interaction | yes | 1.00 | 1 | In a fresh signed-out context, the visible Email field accepted ada.mensah@coursemark.example exactly, remained visible and editable, and no form submission occurred. |

Constraints (1.0000):

| Criterion | Raw | Value | Weight | Recorded reason |
|---|---|---:|---:|---|
| same_origin_application_shell | yes | 1.00 | 1 | The local root returned rendered HTML with usable Email, Password, and Sign in controls. UI login produced a 200 local authentication response and a populated protected /api/state read using a 64-character Bearer token. Anonymous replay and wrong-password probes returned 401 without protected data; two distinct tokens were both revoked after one visible sign-out. No fatal page errors were observed. |
| self_contained_entry_and_reload | yes | 1.00 | 1 | A fresh signed-out context loaded http://localhost:3000/ as text/html, accepted email-field input, and fully reloaded the same root URL with status 200. The sign-in shell remained usable after reload, with no directory listing, raw response, blank screen, or protected navigation. |

Functional (0.7333):

| Criterion | Raw | Value | Weight | Recorded reason |
|---|---|---:|---:|---|
| seeded_password_signin_and_identity | yes | 1.00 | 1 | Wrong-password rejection, correct Ada identity, UTC reference moment, and revision were verified through HTTP responses. |
| bearer_session_transport | yes | 1.00 | 1.25 | High-entropy bearer tokens authorized protected reads before and after reload; anonymous reads were rejected. |
| instructor_workspace_and_seeded_schedule | yes | 1.00 | 1.25 | Ada saw seeded A-01 through A-04 with exact titles, states, openings, and due times after reload. |
| ta_student_authority_and_answer_key_privacy | yes | 1.00 | 1 | Luis had assigned grading only; students had own-attempt controls, no draft A-02, and seeded student responses omitted keys. |
| nora_accommodation_and_active_attempt | yes | 1.00 | 1 | Nora's A-01 accommodation, effective due, active AT-100 timing, and two keyless questions matched. |
| ben_extension_and_exact_expiry | yes | 1.00 | 1 | Ben's extension and AT-103 A-04 auto-submit, exact expiry, score 5, sole-attempt consumption, and hidden score passed. |
| availability_and_attempt_limit_guards | yes | 1.00 | 1 | Draft, closed, exhausted, and existing-active-attempt states correctly refused new starts without state changes. |
| answer_save_revision_and_restore | yes | 1.00 | 1 | Both Nora answers saved with one revision each and restored exactly after reload. |
| submission_scoring_and_terminal_lock | yes | 1.00 | 1 | AT-100 submission produced one revision/event, objective score 4 for staff, preserved text, and terminal student privacy. |
| assigned_ta_scope_and_score_bounds | yes | 1.00 | 1 | Luis saw only AT-100, AT-101, and AT-103; over-maximum RC-3 was rejected without mutation. |
| rubric_completion_and_derived_total | yes | 1.00 | 1 | RC-3=2 and RC-4=2.5 persisted with one event/revision each; total became 4.5/10. |
| release_privacy_immutability_and_retry | yes | 1.00 | 1 | AT-101 release advanced once; exact replay returned the original receipt; Ben then saw released scores and feedback. |
| draft_validation_and_creation | yes | 1.00 | 1 | Invalid due/opening order was rejected; Canopy was created with the requested schedule and persisted as an unpublished draft. |
| question_validation_and_publish_lifecycle | no | 0.00 | 1 | Duplicate options were rejected, but the empty draft's Publish control remained enabled and sent a rejected request. |
| audit_visibility_and_exactly_once_events | yes | 1.00 | 1 | Audits were durable, newest-first, role-filtered, and accepted events appeared exactly once in the functional journey. |
| gradebook_totals_and_account_isolation | yes | 1.00 | 1 | Ada saw all attempts/totals, Luis only his queue, and students only their own private records; reload preserved them. |
| two_tab_revisions_receipts_and_duplicate_guard | yes | 1.00 | 1.5 | Exact receipts, stale 409 responses, fresh retry, operation mismatch, and rapid duplicate guarding all passed. |
| account_wide_token_revocation | yes | 1.00 | 1.25 | Two Nora tokens were distinct and both were rejected after one visible account-wide sign-out. |
| reauthentication_and_cross_account_isolation | yes | 1.00 | 1 | Wrong-password reauth stayed signed out; correct Nora reauth restored values, and Ben/Nora data remained isolated. |
| start_attempt_and_single_active_guard | no | 0.00 | 1 | A fresh start request while Ben's A-01 attempt was active returned HTTP 200 with the existing receipt instead of a rejection. |
| server_rubric_numeric_validation | no | 0.00 | 4 | Malformed and out-of-range scores were rejected, but an empty-string score was accepted as zero. |
| multiple_choice_authoring_and_key_privacy | yes | 1.00 | 0.5 | Tree identification practice retained Oak/Pine, Oak key, and 3 points for staff; Ben's authored-question start exposed options without a key. |
| effective_due_caps_adjusted_duration | yes | 1.00 | 0.5 | Nora's Short deadline attempt used adjusted duration but expired at the earlier exact 12:05Z cap. |
| runtime_manifest_routes | yes | 1.00 | 0.5 | APP_MANIFEST.md matched the observed start command, SQLite path, bearer auth, and routes. |
| fixed_reference_under_course_writes | yes | 1.00 | 4 | Three additional drafts left the reference at 2026-09-02T12:00:00Z; Ben's start, submit, and audit were exactly at that moment. |
| unreleased_write_and_audit_privacy | no | 0.00 | 4 | Pre-release numeric privacy and exact submit replay passed, but releasing the objective-only attempt returned 409 not_ready because it remained submitted. |
| receipt_actor_and_scope_isolation | yes | 1.00 | 4 | Nora's reuse of Ada's create receipt returned 403; her legitimate answer save using Ada's second opId succeeded. |
| receipt_route_and_input_binding | yes | 1.00 | 3 | Cross-route and changed-input reuse returned operation-mismatch 409; reordered JSON replay returned the original create receipt. |
| server_authoring_validation | yes | 1.00 | 3 | Invalid dates, duration/limit types, duplicate/empty options, and invalid points all returned 400 without mutation; valid Oak/Pine/Birch persisted. |
| write_metadata_and_owned_fields | no | 0.00 | 3 | Malformed revision and operation metadata were rejected, but a create carrying actor/status/total/timestamp claims was accepted with those claims ignored. |
| restart_persistence_and_seed_idempotence | yes | 1.00 | 1 | The required restart preserved revision 43, assessments, attempts, grades, audits, privacy, and AT-103 exactly; Nora's accepted answer replay returned its original revision-38 receipt without mutation, and a revoked token remained 401. |

Polish (0.8571):

| Criterion | Raw | Value | Weight | Recorded reason |
|---|---|---:|---:|---|
| sign_in_labels_and_keyboard_focus | yes | 1.00 | 1 | The public page shows a Coursemark heading and associated Email/Password labels. Keyboard Tab reaches Email, Password, and Sign in in order, with visible focus outlines. |
| sign_in_help_and_error_recovery | yes | 1.00 | 1 | Demo help lists all four documented accounts and Coursemark!2026. The exact wrong password returned HTTP 401 with a visible worded alert; fields and Sign in remained enabled. |
| mobile_shell_has_no_page_overflow | yes | 1.00 | 1 | At 375×812, signed-out and authenticated document scroll width measured 375px. The session summary and Sign out control stayed within the viewport width. |
| mobile_navigation_and_touch_targets | yes | 1.00 | 1 | All five workspace links were pointer-clickable at 375px, non-overlapping, and mapped to the matching view. Links were 44px high and primary buttons were about 48px high. |
| landmarks_headings_and_current_view | yes | 1.00 | 1 | The workspace has navigation and main landmarks, a visible active-view heading, and exactly one nav link with aria-current="page". Each view change replaced the main content with the matching heading. |
| keyboard_view_navigation_and_focus | yes | 1.00 | 1 | Keyboard Tab reached Courses, Assessments, Attempts, Gradebook, and Audit in a sensible order. Enter activated each, updated the heading/current view, and retained visible focus. |
| record_grouping_and_readable_values | yes | 1.00 | 1 | All five workspaces use article/card boundaries with headings and labels. Dates, scores, statuses, feedback, and grading states are written as text, not conveyed by color alone. |
| records_avoid_raw_payload_presentation | yes | 1.00 | 1 | Courses, assessments, attempts, gradebook, and audit records render as readable product content with labels and actions; no serialized JSON, arrays, or payload dumps were presented. |
| dialog_labels_focus_and_closure | no | 0.00 | 1 | The Create draft dialog has a heading, associated labels, Close/Cancel actions, contained keyboard focus, and Escape closure. After Escape or Close, focus returned to the document body rather than a usable workspace control. |
| form_validation_and_scrollable_dialogs | yes | 1.00 | 1 | At 375×812 the form dialog used an internal scrolling container with scrollHeight greater than clientHeight. Invalid due/duration/attempt values produced the worded alert “Opening time must be before due time,” while the dialog stayed open and revision remained 43. |
| session_revision_and_sync_summary | yes | 1.00 | 1 | The authenticated header shows Ada’s name, email, Instructor role, UTC reference moment, Revision 43, and Sign out. The visible status banner reports the signed-in/session state. |
| role_workflow_and_privacy_cues | no | 0.00 | 1 | Student views expose due/expiry times and Feedback hidden/released; staff views expose grading, publication, release, and audit states. No student workspace or attempt form exposed accommodation text. |
| consistent_controls_and_feedback | yes | 1.00 | 1 | Coursemark remains identified on public and protected screens. Repeated controls retain recognizable labels, keyboard focus is visible, sign-in status is a visible status region, and errors are visible worded alerts with distinct alert/status semantics. |
| reduced_motion_preserves_state | yes | 1.00 | 1 | With prefers-reduced-motion set to reduce, representative buttons, dialogs, statuses, and alerts reported 0s transition and animation durations. View selection, status text, and wrong-password error text remained usable. |

Visual (0.7917):

| Criterion | Raw | Value | Weight | Recorded reason |
|---|---|---:|---:|---|
| visual_typography | 4 | 0.75 | 1 | Clear hierarchy across sign-in, workspaces, records, dates, scores, and dialogs; long mobile IDs and metadata wrap a little awkwardly but remain readable. |
| visual_color_and_contrast | 4 | 0.75 | 1 | Cohesive navy/slate palette with strong blue actions and differentiated status pills. Supporting metadata is slightly soft on pale backgrounds. |
| visual_spacing_and_layout | 4 | 0.75 | 1 | Consistent card padding, 16px margins, rounded controls, and responsive full-width layouts. Long single-column lists and persistent sign-in content add vertical bulk. |
| visual_hierarchy_and_scanability | 5 | 1.00 | 1 | Section labels, workspace headings, active navigation, primary actions, status pills, and score summaries are consistently easy to locate and scan. |
| visual_overall_craft | 4 | 0.75 | 1 | Sign-in, all five workspaces, and dialogs share a deliberate education-product identity with polished cards, buttons, pills, and modal styling; minor roughness remains in the very long page structure. |
| visual_responsive_consistency | 4 | 0.75 | 1 | Desktop and mobile preserve the same palette, typography, hierarchy, and control styling while adapting headers, navigation, cards, and dialogs effectively. Some long labels and identifiers wrap heavily on mobile. |

**Gemini 3.7 Flash: complete recorded verdicts.** [Original reward details](../../../run-outputs/coursemark-assessment-workspace/run-a8142a00-fb44-40d8-929c-9dd903f12c3f/coursemark-assessment-workspace__uxGNe9a/verifier/reward-details.json).


Render (1.0000):

| Criterion | Raw | Value | Weight | Recorded reason |
|---|---|---:|---:|---|
| page_load_and_refresh | yes | 1.00 | 1 | Shared browser gate passed. Fresh signed-out root and reload both returned HTTP 200 with a usable Coursemark sign-in page, visible email field and Sign In control, no blank/raw-JSON/server-error state, spinner, or fatal page errors. |
| basic_public_control_interaction | yes | 1.00 | 1 | Without submitting or authenticating, the visible identifier field accepted ada.mensah@coursemark.example and remained editable with the exact value. |

Constraints (1.0000):

| Criterion | Raw | Value | Weight | Recorded reason |
|---|---|---:|---:|---|
| same_origin_application_shell | yes | 1.00 | 1 | Gate passed. The local root and auth/course requests returned successful HTTP responses; correct login produced distinct 64-character bearer tokens, populated identity/course data, and reload preserved the authenticated course view. Anonymous and wrong-password reads returned 401 without protected content, and one visible sign-out invalidated both tokens. No fatal page errors occurred. |
| self_contained_entry_and_reload | yes | 1.00 | 1 | In a fresh signed-out context, / returned rendered text/html with a usable Course Sign-In shell. The email field accepted input, and a full reload kept / available with the sign-in form and email field usable. No external navigation, protected API request, spinner, or page error occurred. |

Functional (0.6615):

| Criterion | Raw | Value | Weight | Recorded reason |
|---|---|---:|---:|---|
| seeded_password_signin_and_identity | yes | 1.00 | 1 | Wrong-password sign-in visibly returned 401 with no protected data; the correct exchange returned Ada Mensah, her email, Instructor role, reference time 2026-09-02T12:00:00Z, and nonnegative revision. |
| bearer_session_transport | yes | 1.00 | 1.25 | Successful sign-ins issued distinct 64-character bearer tokens; protected reads used same-origin Authorization Bearer requests, reload remained authorized, and signed-out reads returned 401 without records. |
| instructor_workspace_and_seeded_schedule | yes | 1.00 | 1.25 | Ada’s protected assessment list and reload showed seeded A-01 through A-04 with distinct titles, statuses, and exact opening/due times. |
| ta_student_authority_and_answer_key_privacy | yes | 1.00 | 1 | Luis saw only assigned grading work; students saw only their own controls, not draft A-02; Ada alone had authoring/publish/release controls; student responses omitted answer keys. |
| nora_accommodation_and_active_attempt | yes | 1.00 | 1 | Nora saw A-01 with +15 minutes, effective due 13:00Z and 60-minute allowance; seeded AT-100 remained active from 11:30Z to 12:30Z with both questions and no key or score. |
| ben_extension_and_exact_expiry | yes | 1.00 | 1 | Ben saw the +60-minute A-01 deadline extension to 14:00Z while duration stayed 45 minutes. AT-103 was correctly tied to A-04, auto-submitted at 12:00Z, scored Parallel veins as 5, became non-editable, and produced one auto-submit audit event while hiding the score from Ben. |
| availability_and_attempt_limit_guards | yes | 1.00 | 1 | Draft A-02, closed A-03, exhausted A-04 for Ben, and a second Nora A-01 start were refused; visible revision, attempt, and audit state did not change. |
| answer_save_revision_and_restore | no | 0.00 | 1 | The exact answers and reload restoration worked, but the visible save generated two accepted answer requests and advanced the revision twice instead of exactly once. |
| submission_scoring_and_terminal_lock | yes | 1.00 | 1 | Nora’s AT-100 submission advanced one revision, created one submit event, became terminal, preserved the written answer, and staff saw objective score 4. Nora saw no score and no subsequent answer or submit control. |
| assigned_ta_scope_and_score_bounds | yes | 1.00 | 1 | Luis saw only AT-100, AT-101, and AT-103; released unassigned AT-102 was absent. RC-3 above its maximum was visibly rejected with no state change, and Luis/students lacked unauthorized publish, release, or grading actions. |
| rubric_completion_and_derived_total | no | 0.00 | 1 | The final AT-101 values and derived total 4.5 were correct, but the UI would not accept RC-3 independently; it required both rubric criteria in one save, so the required two accepted rubric writes and two revision/event increments were not demonstrated. |
| release_privacy_immutability_and_retry | yes | 1.00 | 1 | Before release Ben saw no AT-101 score. Ada’s release advanced one revision and one event; exact same-session replay returned the original success without duplication. Ben then saw 4.5, both rubric scores, and exact feedback, while other students did not. |
| draft_validation_and_creation | yes | 1.00 | 1 | A due time before opening was rejected without revision/draft/audit change. Canopy survey practical was then created through the UI with the required values, persisted after reload, and had no publish audit. |
| question_validation_and_publish_lifecycle | no | 0.00 | 1 | Duplicate options were rejected and the valid written item published correctly, but the empty Canopy draft’s Publish control was enabled rather than unavailable. |
| audit_visibility_and_exactly_once_events | yes | 1.00 | 1 | Audit views were durable, newest-first, and account-scoped. Accepted publish, submit/auto-submit, rubric-grade, and release operations produced their expected single events; invalid, terminal, and replayed writes did not add events. |
| gradebook_totals_and_account_isolation | yes | 1.00 | 1 | Ada saw the full course gradebook, Luis saw only his assigned queue, and student attempt/feedback views were isolated. Reload, reauthentication, and restart preserved the recorded submissions, grades, release, expiry, and authored assessments. |
| two_tab_revisions_receipts_and_duplicate_guard | no | 0.00 | 1.5 | A replayed accepted Tab-A create was idempotent, stale Tab-B requests returned 409, operation reuse was rejected, and rapid double-submit created one record. However, the required fresh-current-revision retry of Tab B was not successfully completed and no B draft was accepted. |
| account_wide_token_revocation | yes | 1.00 | 1.25 | Two same-account sessions received distinct tokens; visible sign-out in one tab caused the other tab’s next protected request to return 401 and return to sign-in. A fresh login worked. |
| reauthentication_and_cross_account_isolation | yes | 1.00 | 1 | Nora’s wrong-password attempt remained signed out; correct reauthentication restored her values unchanged. Ben saw no Nora private data, and Nora saw no Ben attempts, grades, or events. |
| start_attempt_and_single_active_guard | yes | 1.00 | 1 | Ben’s A-01 start created one AT-104 at 12:00Z with 45-minute allowance, 12:45Z expiry, assigned grader, and no released score. Reload showed Continue; exact replay was idempotent; a fresh active-start request returned 400 without change. |
| server_rubric_numeric_validation | no | 0.00 | 4 | The required AT-100 RC-1 numeric-validation baseline, complete invalid-value matrix, and replacement save were not completed before the mandated final restart. |
| multiple_choice_authoring_and_key_privacy | yes | 1.00 | 0.5 | Ada created and published Tree identification practice with Oak/Pine, Oak key, and 3 points; staff reload retained the key. Ben received the prompt/options without an answer field or key. |
| effective_due_caps_adjusted_duration | yes | 1.00 | 0.5 | Nora’s Short deadline check showed a 45-minute adjusted allowance but a 12:05Z effective due cap; starting at 12:00Z created one active attempt and reload preserved it and its revision. |
| runtime_manifest_routes | yes | 1.00 | 0.5 | The permitted manifest read documented `node /app/server.js`, SQLite `/app/coursemark.db`, and authentication, read, authoring, start, answer, submit, grade, release, and audit routes/methods matching observed browser requests. |
| fixed_reference_under_course_writes | yes | 1.00 | 4 | After publishing a fresh objective assessment and creating three drafts, the reference time remained exactly 2026-09-02T12:00:00Z. Ben’s attempt started and submitted at 12:00Z, expired at 12:45Z, and its audit timestamp was exactly 12:00Z. |
| unreleased_write_and_audit_privacy | no | 0.00 | 4 | The objective-only submission acknowledgement, attempt detail, gradebook, and audit stayed score-private and exact replay was idempotent, but Ada’s objective-only UI exposed automatic grading without a Release control, so the required release-and-post-release check could not be completed. |
| receipt_actor_and_scope_isolation | no | 0.00 | 4 | Nora’s actual answer-save request using Ada’s second operation identity was rejected with 409 `Operation identifier belongs to another user`, rather than succeeding in Nora’s independent identity namespace. |
| receipt_route_and_input_binding | yes | 1.00 | 3 | Reusing the create operation/body on the observed A-16 publish route returned 409; replaying the original create with reordered JSON keys returned the original 201 receipt without a write; changing the title with the reused identity returned 409 and left state unchanged. |
| server_authoring_validation | yes | 1.00 | 3 | Invalid dates, Boolean/null/array/object duration and attempt values, duplicate/empty options, and Boolean/null points all returned 400 without state changes. A valid Oak/Pine/Birch question persisted with all distinct choices and the staff key. |
| write_metadata_and_owned_fields | yes | 1.00 | 3 | Missing, null, Boolean, array, object, fractional, negative, and nonnumeric revisions, including an array containing the current revision, all returned 400. Invalid operation identities and client-supplied server-owned status fields were rejected; an ordinary fresh UI create succeeded. |
| restart_persistence_and_seed_idempotence | yes | 1.00 | 1 | After only `bash /tests/app-lifecycle.sh restart`, protected snapshots for all accounts matched pre-restart hashes and revision 39, authored records and attempts remained unchanged, AT-103 was not duplicated, the retained exact answer request replay returned its original 200 response without another write, and a revoked Ada token still returned 401. |

Polish (0.9286):

| Criterion | Raw | Value | Weight | Recorded reason |
|---|---|---:|---:|---|
| sign_in_labels_and_keyboard_focus | no | 0.00 | 1 | Coursemark heading and associated Email Address/Password labels are present, but keyboard focus on both inputs has no visible outline or box shadow; only Sign In shows a visible focus ring. |
| sign_in_help_and_error_recovery | yes | 1.00 | 1 | Demo-account help is visible. Wrong-password authentication returned HTTP 401 and a visible role=alert message while fields and Sign In stayed enabled. |
| mobile_shell_has_no_page_overflow | yes | 1.00 | 1 | At 375x812, document and body scroll widths were 375px in signed-out and authenticated states; session metadata and Sign out stayed inside the viewport. |
| mobile_navigation_and_touch_targets | yes | 1.00 | 1 | All five workspace tabs were pointer-clickable, including after internal horizontal nav scrolling, without overlap; each tab was 44px high. |
| landmarks_headings_and_current_view | yes | 1.00 | 1 | Navigation and main landmarks exist, each view has matching headings, exactly one tab has aria-current=page, and only the active panel is visible. |
| keyboard_view_navigation_and_focus | yes | 1.00 | 1 | Tab and Enter reached and activated Courses, Assessments, Attempts, Gradebook, and Audit Log in order; focus rings were visible and remained on the selected tab. |
| record_grouping_and_readable_values | yes | 1.00 | 1 | Courses and Assessments use cards with labeled metadata; Attempts, Gradebook, and Audit use headed tables. Dates, scores, and statuses are written as text. |
| records_avoid_raw_payload_presentation | yes | 1.00 | 1 | All five workspaces render readable cards or tables; no raw JSON, serialized arrays, or payload dumps appeared in visible content. |
| dialog_labels_focus_and_closure | yes | 1.00 | 1 | The Create Assessment Draft dialog has a heading, aria-labelledby/aria-modal, associated labels, named close actions, trapped keyboard focus, Escape closure, and focus returned to Create New Draft. |
| form_validation_and_scrollable_dialogs | yes | 1.00 | 1 | At 375x812, the invalid due-time submission returned HTTP 400 with visible worded validation, kept the dialog open, enabled scrolling in the modal body, and preserved Rev #39. |
| session_revision_and_sync_summary | yes | 1.00 | 1 | Authenticated view visibly shows Ada Mensah, email, Instructor role, fixed reference time, Rev #39, Synced, and Sign Out. |
| role_workflow_and_privacy_cues | yes | 1.00 | 1 | Nora's student view shows active accommodations, extra time, effective due/duration values, and hidden-until-released feedback. Ada's staff views expose textual Draft/Published, Grade, Release, and Audit states. |
| consistent_controls_and_feedback | yes | 1.00 | 1 | Coursemark remains identifiable publicly and after sign-in; repeated Refresh/Sign Out controls retain recognizable labels, workspace controls show focus, and Synced, sign-in errors, and form errors are visibly textual. |
| reduced_motion_preserves_state | yes | 1.00 | 1 | With reduced motion enabled, representative controls, dialog, status, and error elements reported 0.00001s animation/transition durations and auto scrolling; selected views and text remained usable. |

Visual (0.6667):

| Criterion | Raw | Value | Weight | Recorded reason |
|---|---|---:|---:|---|
| visual_typography | 4 | 0.75 | 1 | Readable, consistent sans-serif typography establishes clear headings, labels, dates, scores, and supporting text. Dense table content and small secondary metadata are minor drawbacks. |
| visual_color_and_contrast | 5 | 1.00 | 1 | The forest-green palette is cohesive, with clear status colors, legible text, distinct controls, and well-separated record surfaces across screens and dialogs. |
| visual_spacing_and_layout | 3 | 0.50 | 1 | Desktop cards, tables, dialogs, and margins are well organized, but the Courses view leaves substantial unused space and several mobile tables feel cramped or clipped. |
| visual_hierarchy_and_scanability | 4 | 0.75 | 1 | Active navigation, workspace headings, primary actions, statuses, and key record details are easy to locate. Mobile table views reduce scanability by omitting or cropping secondary columns. |
| visual_overall_craft | 4 | 0.75 | 1 | Sign-in, workspaces, cards, badges, tables, and dialogs share a deliberate, finished education-product style. The main weaknesses are sparse course composition and uneven mobile table treatment. |
| visual_responsive_consistency | 2 | 0.25 | 1 | Sign-in, Courses, Assessments, and dialogs adapt well, but Attempts, Gradebook, and Audit mobile screenshots hide or crop important columns, while the horizontal navigation also clips items. |

**Claude Haiku 4.5: complete recorded verdicts.** [Original reward details](../../../run-outputs/coursemark-assessment-workspace/run-217ff20f-9ff7-4a88-8947-e32b59b9c44f/coursemark-assessment-workspace__X7eYTTR/verifier/reward-details.json).


Render (1.0000):

| Criterion | Raw | Value | Weight | Recorded reason |
|---|---|---:|---:|---|
| page_load_and_refresh | yes | 1.00 | 1 | Shared HTTP auth gate passed. In a fresh signed-out context, the root returned HTML 200 with Coursemark, Email, Password, and Sign In controls; full reload returned the same usable page with no page errors, blank state, raw JSON, or server error. |
| basic_public_control_interaction | yes | 1.00 | 1 | Without signing in, the visible email field accepted ada.mensah@coursemark.example and retained the exact editable value; the form was not submitted. |

Constraints (1.0000):

| Criterion | Raw | Value | Weight | Recorded reason |
|---|---|---:|---:|---|
| same_origin_application_shell | yes | 1.00 | 1 | The local root rendered a usable sign-in shell. Visible login produced a 64-character Bearer credential and populated identity/course data through local /api/auth and /api/courses requests. Anonymous and wrong-password reads returned 401 without protected content; distinct credentials were both invalidated by one visible sign-out. No uncaught page errors occurred. |
| self_contained_entry_and_reload | yes | 1.00 | 1 | A fresh signed-out context received rendered HTML (200 text/html) at http://localhost:3000/, accepted email-field input, and fully reloaded to the same local entry with the sign-in shell still usable. No external navigation, build/install step, authentication submission, or protected-data request was needed. |

Functional (0.1179):

| Criterion | Raw | Value | Weight | Recorded reason |
|---|---|---:|---:|---|
| seeded_password_signin_and_identity | yes | 1.00 | 1 | Ada’s correct login returned her identity, instructor role, reference time, and revision 0; the wrong password returned 401. |
| bearer_session_transport | yes | 1.00 | 1.25 | Distinct high-entropy bearer tokens authorized protected reads and reloads; anonymous reads returned 401 without protected data. |
| instructor_workspace_and_seeded_schedule | yes | 1.00 | 1.25 | Ada’s protected course response contained A-01 through A-04 with exact titles, states, opening times, and due times. |
| ta_student_authority_and_answer_key_privacy | no | 0.00 | 1 | Ben’s AT-103 response leaked the answer key, and Luis had no visible assigned grading queue. |
| nora_accommodation_and_active_attempt | no | 0.00 | 1 | AT-100 and both questions were visible, but the required accommodation allowance, effective due, and expiry were absent. |
| ben_extension_and_exact_expiry | no | 0.00 | 1 | Ben’s due time remained 13:00, AT-103 stayed in progress, and its answer key was exposed. |
| availability_and_attempt_limit_guards | no | 0.00 | 1 | Draft A-02 was hidden, but closed A-03, Ben’s exhausted A-04, and Nora’s active A-01 still showed Attempt. |
| answer_save_revision_and_restore | no | 0.00 | 1 | Nora’s visible attempt review had no answer fields or Save control. |
| submission_scoring_and_terminal_lock | no | 0.00 | 1 | No visible Nora submission workflow was available; AT-100 remained in progress. |
| assigned_ta_scope_and_score_bounds | no | 0.00 | 1 | Luis’s attempt queue was empty and Gradebook showed Access denied. |
| rubric_completion_and_derived_total | no | 0.00 | 1 | Luis could not access AT-101 or save rubric criteria. |
| release_privacy_immutability_and_retry | no | 0.00 | 1 | No visible grading or release workflow was available. |
| draft_validation_and_creation | no | 0.00 | 1 | Ada had no visible New assessment control. |
| question_validation_and_publish_lifecycle | no | 0.00 | 1 | No question authoring form or usable draft workflow was available. |
| audit_visibility_and_exactly_once_events | no | 0.00 | 1 | The required publish, submit, grade, and release event set was not produced; audit showed only an unexpected submit event. |
| gradebook_totals_and_account_isolation | no | 0.00 | 1 | Ada could see course attempts, but Luis lacked the required assigned queue and later totals/release states were absent. |
| two_tab_revisions_receipts_and_duplicate_guard | no | 0.00 | 1.5 | No authoring operation or receipt could be captured. |
| account_wide_token_revocation | yes | 1.00 | 1.25 | Two independent Nora sessions received distinct tokens; signing out one caused the other token to receive 401 and return to sign-in. |
| reauthentication_and_cross_account_isolation | yes | 1.00 | 1 | Wrong-password sign-in stayed signed out, correct reauthentication restored Nora’s records, and Ben’s records remained isolated. |
| start_attempt_and_single_active_guard | no | 0.00 | 1 | Ben’s A-01 start created an attempt at 12:00, but revision, expiry, Continue state, and exact replay behavior failed. |
| server_rubric_numeric_validation | no | 0.00 | 4 | No visible rubric-save request was available for controlled numeric validation. |
| multiple_choice_authoring_and_key_privacy | no | 0.00 | 0.5 | No fresh-draft or multiple-choice authoring workflow was available. |
| effective_due_caps_adjusted_duration | no | 0.00 | 0.5 | Short deadline check could not be authored or started through visible controls. |
| runtime_manifest_routes | no | 0.00 | 0.5 | The manifest documented the required command, database, and routes, but save, submit, grade, release, and authoring requests were not observed. |
| fixed_reference_under_course_writes | no | 0.00 | 4 | The required fresh authoring and course-write sequence was unavailable. |
| unreleased_write_and_audit_privacy | no | 0.00 | 4 | No qualifying authored objective-only attempt and release workflow was produced. |
| receipt_actor_and_scope_isolation | no | 0.00 | 4 | No instructor draft-create receipt or operation identity was captured. |
| receipt_route_and_input_binding | no | 0.00 | 3 | No original create or publish receipt existed for replay tests. |
| server_authoring_validation | no | 0.00 | 3 | No authoring requests could be generated through visible controls. |
| write_metadata_and_owned_fields | no | 0.00 | 3 | No observed instructor write request was available for metadata or owned-field validation. |
| restart_persistence_and_seed_idempotence | no | 0.00 | 1 | Restart preserved records and rejected a revoked token, but the retained accepted start replay returned 400 rather than its original response. |

Polish (0.0000):

| Criterion | Raw | Value | Weight | Recorded reason |
|---|---|---:|---:|---|
| sign_in_labels_and_keyboard_focus | no | 0.00 | 1 | Shared gate failed due to an unresolved visible “Syncing...” spinner after authenticated reload. |
| sign_in_help_and_error_recovery | no | 0.00 | 1 | Shared gate failed due to an unresolved visible “Syncing...” spinner after authenticated reload. |
| mobile_shell_has_no_page_overflow | no | 0.00 | 1 | Shared gate failed due to an unresolved visible “Syncing...” spinner after authenticated reload. |
| mobile_navigation_and_touch_targets | no | 0.00 | 1 | Shared gate failed due to an unresolved visible “Syncing...” spinner after authenticated reload. |
| landmarks_headings_and_current_view | no | 0.00 | 1 | Shared gate failed due to an unresolved visible “Syncing...” spinner after authenticated reload. |
| keyboard_view_navigation_and_focus | no | 0.00 | 1 | Shared gate failed due to an unresolved visible “Syncing...” spinner after authenticated reload. |
| record_grouping_and_readable_values | no | 0.00 | 1 | Shared gate failed due to an unresolved visible “Syncing...” spinner after authenticated reload. |
| records_avoid_raw_payload_presentation | no | 0.00 | 1 | Shared gate failed due to an unresolved visible “Syncing...” spinner after authenticated reload. |
| dialog_labels_focus_and_closure | no | 0.00 | 1 | Shared gate failed due to an unresolved visible “Syncing...” spinner after authenticated reload. |
| form_validation_and_scrollable_dialogs | no | 0.00 | 1 | Shared gate failed due to an unresolved visible “Syncing...” spinner after authenticated reload. |
| session_revision_and_sync_summary | no | 0.00 | 1 | Shared gate failed due to an unresolved visible “Syncing...” spinner after authenticated reload. |
| role_workflow_and_privacy_cues | no | 0.00 | 1 | Shared gate failed due to an unresolved visible “Syncing...” spinner after authenticated reload. |
| consistent_controls_and_feedback | no | 0.00 | 1 | Shared gate failed due to an unresolved visible “Syncing...” spinner after authenticated reload. |
| reduced_motion_preserves_state | no | 0.00 | 1 | Shared gate failed due to an unresolved visible “Syncing...” spinner after authenticated reload. |

Visual (0.0000):

| Criterion | Raw | Value | Weight | Recorded reason |
|---|---|---:|---:|---|
| visual_typography | 0 | 0.00 | 1 | Shared gate failed: both 64-character credentials remained authorized with HTTP 200 course reads after one visible account-wide sign-out. |
| visual_color_and_contrast | 0 | 0.00 | 1 | Shared authentication gate failed because prior same-account bearer credentials were not invalidated by visible sign-out. |
| visual_spacing_and_layout | 0 | 0.00 | 1 | Shared authentication gate failed because both previously issued credentials continued authorizing populated course data after sign-out. |
| visual_hierarchy_and_scanability | 0 | 0.00 | 1 | Shared gate prerequisite failed: account-wide sign-out did not invalidate the two authenticated bearer credentials. |
| visual_overall_craft | 0 | 0.00 | 1 | The required working-page/authentication prerequisite failed; blank modal overlays and an unresolved Syncing state were also observed. |
| visual_responsive_consistency | 0 | 0.00 | 1 | Per the failed shared gate, this visual dimension must receive 0 despite desktop and mobile screenshots being collected. |
