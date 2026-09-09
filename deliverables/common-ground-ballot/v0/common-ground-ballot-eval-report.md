# Common Ground Ballot — Evaluation Report

A deterministic private membership ballot workspace evaluated against Oracle, GPT-5.4-mini and Claude Haiku 4.5.

## Product overview

Common Ground combines role-based access, durable sessions, draft-to-publication ballot workflows, fixed eligibility, two vote methods, anonymous selections, identified turnout, exact tallies, optimistic revisions, idempotent writes and audit history in a same-origin Node/Express/SQLite application.

## Overall scores

| Run | Final | Render | Constraints | Functional | Polish | Graded | No-op |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Oracle v1.0.6 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1 | 0 |
| GPT-5.4-mini untouched v1.0.6 | 0.1600 | 1.0000 | 1.0000 | 0.0000 | 0.4000 | 1 | 0 |
| Claude Haiku 4.5 untouched v1.0.6 | 0.4064 | 1.0000 | 1.0000 | 0.4107 | 0.4000 | 1 | 0 |
| No-op | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0 | 1 |

## Feature and subfeature coverage

### Access and roles

- Four deterministic demo accounts with Coordinator, Observer and Member boundaries.
- Unpredictable hashed SQLite sessions, independent sessions and account-wide revocation.

### Ballot lifecycle

- Single-choice and approval ballots move through Draft, Open, Closed and Published states.
- Opening freezes eligibility; revisions and idempotent operation receipts protect every mutation.

### Privacy and results

- Identified turnout is stored separately from anonymous selections.
- Pre-publication results stay hidden; published counts, percentages and ties are exact.

### Persistence and safety

- SQLite state survives refresh, sign-in and restart without duplicate seeding.
- Malformed, stale, cross-ballot, duplicate and identity-forged writes leave dependent state unchanged.

### Interface

- Six responsive workspaces cover ballots, voting, turnout, results, members and audit.
- Keyboard focus, durable feedback, theme, touch targets and reduced motion are exercised.

## Complete verifier matrix

| Dimension | Criterion | Weight | Oracle | GPT | Haiku | GPT/Haiku evidence |
| --- | --- | ---: | --- | --- | --- | --- |
| Render | `public_page_loads` | 1.0 | PASS | PASS | PASS | GPT: After opening the root page and refreshing once, a substantive Common Ground sign-in page remained visible with usable email, password, and sign-in controls. Haiku: The root page remained a substantive Common Ground sign-in page after one refresh, with visible email/password fields and a Sign in control; it was usable and showed no blank, fatal-error, or endless-loading state. |
| Render | `public_control_responds` | 1.0 | PASS | PASS | PASS | GPT: Opening the public demo-account control visibly expanded demo account options, and the page remained usable. No sign-in was performed. Haiku: Opening Use a demo account visibly expanded demo choices, and selecting Ruth · Coordinator populated the sign-in fields while the page remained usable. No sign-in was submitted. |
| Constraints | `same_origin_shell` | 1.0 | PASS | PASS | PASS | GPT: The root document, /styles.css, and /app.js all loaded from http://localhost:3000 (200/304); no CDN, remote font, or third-party runtime request was observed. Haiku: Root loaded with 200; styles.css and app.js loaded from localhost:3000 with 200 (then 304 on refresh). No CDN, remote font, or third-party requests observed. |
| Constraints | `entrypoint_refresh_usable` | 1.0 | PASS | PASS | PASS | GPT: GET /api/health returned 200 with {"ok":true}. After returning to / and refreshing, the root returned 200 and the visible sign-in UI remained usable; no console errors were observed. Haiku: GET /api/health returned 200 with {"ok":true}. After returning to / and refreshing, the root remained reachable and the public sign-in UI was visible and usable. |
| Functional | `seeded_roles_and_ballot_states` | 1.0 | PASS | FAIL | PASS | GPT: Visible sign-in only opens an empty shell; no ballots, roles, roster, methods, choices, statuses, or revisions are shown. Network contained only document/static requests. Haiku: Clean baseline showed Ruth as coordinator, Arun as observer, and Leila/Owen as members. Staff initially showed exactly the four seeded ballots: Annual draft r1, Courtyard single/open r4, Shared approval/closed r8, and Garden single/published r11; Leila was active and Owen inactive. |
| Functional | `distinct_sessions_and_global_revocation` | 1.5 | PASS | FAIL | FAIL | GPT: No account/session control is visible, and two independent authenticated contexts were not available. Haiku: Two independent Ruth sessions were created. Visible sign-out in one returned that context to login, but the other context remained authorized and could still access Ballots. |
| Functional | `draft_validation_and_creation` | 1.5 | PASS | FAIL | FAIL | GPT: No ballot form or draft records are visible, so validation and creation cannot be performed. Haiku: The repeated-label draft was incorrectly accepted with HTTP 201, creating ballot-c4d1ad825aa9005c and an audit create event. The valid Verifier room use draft was created correctly at revision 1 with one audit event, but the validation subcheck failed. |
| Functional | `draft_edit_and_open_lock` | 1.5 | PASS | FAIL | PASS | GPT: No draft or edit/open controls are visible. Haiku: Verifier room use was edited to Verifier room schedule at revision 2, then opened at revision 3 with all three choices and approval limit 2 preserved. An observed post-open PATCH returned HTTP 409 Only draft ballots can be edited; the ballot and audit remained unchanged. |
| Functional | `fixed_eligibility_snapshot` | 1.5 | PASS | FAIL | PASS | GPT: No ballots, roster, or eligibility snapshots are visible. Haiku: Courtyard showed a two-person snapshot and staff turnout later listed Leila and Owen. When Verifier was opened, Leila saw 1 eligible and Owen’s member view omitted it; after reload staff still showed Verifier 1/1 eligible. |
| Functional | `role_and_identity_enforcement` | 2.0 | PASS | FAIL | PASS | GPT: All demo accounts open the same shell without role-specific controls; no genuine mutation requests are generated. Haiku: Arun create and fabricated-user requests returned HTTP 403; Leila create, open, and member-management requests also returned HTTP 403. Rereads showed no unauthorized ballot/member/audit changes, while Ruth’s visible Owen activate/deactivate actions succeeded. |
| Functional | `cross_ballot_choice_rejection` | 1.0 | PASS | FAIL | PASS | GPT: No voting UI or genuine vote request is available for a cross-ballot probe. Haiku: Using the genuine observed vote shape, Leila’s Verifier request with Courtyard’s choice ID returned HTTP 400 Invalid choice ID. Reauthentication showed Verifier still Ready to vote with no participation at that point. |
| Functional | `single_choice_private_vote` | 2.0 | PASS | FAIL | PASS | GPT: No eligible ballot or visible voting flow is available. Haiku: Owen visibly submitted Keep 8 pm and Leila visibly submitted Extend to 9 pm. Both showed private ✓ Voted state; successful POST bodies were {"ok":true} and did not return or display the submitted label. |
| Functional | `vote_retry_idempotency` | 1.5 | PASS | FAIL | FAIL | GPT: No legitimate vote request or success body could be captured. Haiku: The exact replay of Leila’s successful Courtyard request returned HTTP 409 Already voted instead of the original HTTP 200 {"ok":true} response. |
| Functional | `operation_id_mismatch_safety` | 1.5 | PASS | FAIL | FAIL | GPT: No captured vote operation exists for a mismatch probe. Haiku: The captured successful vote request contained no operation-id field. A different-choice request returned generic HTTP 409 Already voted, not an explicit operation-mismatch refusal. |
| Functional | `approval_selection_limits` | 1.5 | PASS | FAIL | FAIL | GPT: No approval ballot or selection controls are visible. Haiku: Empty input was refused (HTTP 400 for the observed request shape) and the UI refused all three selections, but the repeated-choice request was incorrectly accepted with HTTP 200 and recorded Leila’s Verifier participation. |
| Functional | `duplicate_participation_rejection` | 1.0 | PASS | FAIL | PASS | GPT: No successful participation can be established. Haiku: A new changed-choice Courtyard POST after participation returned HTTP 409 Already voted. Subsequent rereads preserved 2 participants, the 1–1 result, revision 5, and audit history. |
| Functional | `identified_turnout_without_choice_link` | 1.5 | PASS | FAIL | PASS | GPT: The Turnout view contains only explanatory copy and no participation data. Haiku: Staff and Arun saw Verifier 1/1 with Leila and Courtyard 2/2 with Leila and Owen. Turnout response bodies contained only user_id/name/has_voted, and visible audit entries contained no submitted choice IDs or labels; member views showed only self-participation. |
| Functional | `close_boundary_and_hidden_results` | 1.5 | PASS | FAIL | FAIL | GPT: No open ballot or close control is visible. Haiku: Courtyard correctly advanced from revision 4 to closed revision 5, and a post-close member vote returned HTTP 409 Ballot is not open. However, Results exposed Courtyard option counts and the tie before publication. |
| Functional | `published_single_choice_tie` | 1.0 | PASS | FAIL | FAIL | GPT: The Results view contains only explanatory copy and no seeded result. Haiku: Garden persisted as a tie naming North lawn and East beds, but each showed 2 votes and 100.0% instead of 1 vote and 50.0%. |
| Functional | `published_approval_tally` | 1.5 | PASS | FAIL | FAIL | GPT: No closed approval ballot or publish control is visible. Haiku: Publishing advanced Shared-space improvements from revision 8 to 9, but results showed Street trees 4/200%, Bike racks 2/100%, and Community noticeboard 2/100%, with no explanation about totals exceeding 100%. |
| Functional | `stale_revision_and_terminal_safety` | 2.0 | PASS | FAIL | FAIL | GPT: No ballot request, revision control, or terminal ballot is available for either probe. Haiku: A legitimate edit advanced the probe ballot to revision 2; the stale revision-1 write returned HTTP 409 Revision conflict but gave no current-revision guidance. Published Garden edit/publish attempts were refused and state stayed unchanged. |
| Functional | `audit_privacy_and_lifecycle_scope` | 1.5 | PASS | FAIL | FAIL | GPT: The Audit view contains no events, and no lifecycle mutations can be performed. Haiku: Successful create/edit/open/close/publish and membership actions each produced named audit entries, and rejected/idempotent requests added none. But the duplicate-label create and repeated-choice vote were incorrectly recorded, including audit vote/create events. |
| Functional | `durable_reauthentication_and_seed_safety` | 1.5 | PASS | FAIL | FAIL | GPT: Refreshing after visible sign-in returns to the sign-in screen, and no workflow records exist to compare. No guessed API routes or direct probes were used because no genuine request was discovered. Haiku: After refresh and reauthentication, state persisted as six ballots including the extra duplicate-label draft, Verifier open r3 with 1/1 participation, Courtyard closed r5, Shared published r9, Garden published r11, and 12 audit events. The rejected writes therefore returned durably and final tallies were inflated. |
| Polish | `responsive_workspace_navigation` | 1.0 | PASS | PASS | PASS | GPT: At 390×844, all six nav controls stayed within x=16–374, were 44px high, and document width equaled the viewport. Each workspace showed distinct heading/copy; desktop navigation was also in bounds. Haiku: At 390×844 all six workspaces were reachable with distinct content; navigation buttons stayed within bounds at 44px high, and scrollWidth matched the 390px viewport with 0px horizontal overflow. |
| Polish | `accessible_keyboard_forms` | 1.0 | PASS | FAIL | FAIL | GPT: Sign-in fields are labeled and focus visibly renders a 3px gold outline, but no ballot/voting form, keyboard choices, or New ballot dialog exists. Workspace has only nav/main landmarks and one heading. Haiku: Focus outlines and tab order were visible/logical, and sign-in fields had associated labels. However, the New ballot form was not exposed as a dialog, and focus escaped it to global controls instead of remaining contained. |
| Polish | `persistent_action_feedback` | 1.0 | PASS | FAIL | FAIL | GPT: The invalid-password sign-in was accepted with no refusal message, and valid sign-in gave no specific success feedback. No persistent status, unavailable-action, or final-vote consequence messaging is present. Haiku: Invalid sign-in produced a persistent “Invalid email or password” alert, and Vote showed “Only members can vote.” But the Vote workspace provided no one-final-submission consequence or privacy explanation. |
| Polish | `ballot_result_visual_hierarchy` | 1.0 | PASS | FAIL | PASS | GPT: Ballots, Turnout, and Results each show only a heading and short sentence; staff ballot data, turnout values, result counts/percentages, status treatment, and empty/restricted states are absent. Haiku: Ballot cards, turnout ratios/rosters, statuses, and result sections had clear headings and readable values. Results displayed exact vote counts and percentages as text alongside visible bars. |
| Polish | `theme_touch_and_motion_quality` | 1.0 | PASS | PASS | FAIL | GPT: Theme switching changed computed colors while preserving the active workspace. At mobile, controls were 44px high and in bounds; reduced-motion mode kept Results visible with 0s transitions and no overflow. Haiku: Light/dark themes retained content and the active workspace, and reduced-motion mode remained usable with no running animations. Primary buttons were 44px high on mobile, but Turnout’s clickable “Show roster” summaries were only 21px high. |

## Interpretation

Oracle passed all 28 criteria, including 19/19 Functional checks, proving the instruction, seed, golden implementation and verifier are mutually executable.

The final untouched GPT-5.4-mini run scored 0.1600. It passed both hard gates and two Polish criteria, but failed every coupled Functional workflow. The artifact presented a responsive multi-workspace shell while its backend and forms did not satisfy the seeded authentication, lifecycle, voting, privacy, revision and persistence contract. This is a genuine product-completeness failure, not an infrastructure or startup failure.

The exact-version Haiku rollout genuinely ran and produced a substantial app. It scored 0.4064 with `graded=1`, `no_op=0`, both gates passing, 0.4107 Functional and 0.4 Polish. Its partial implementation handled several server workflows but missed enough coupled privacy, lifecycle, revision and interface behavior to remain well below Oracle.

## Packaging and QC

- Task version: 1.0.6; Harbor checksum: `fc05930e80336e482fed08572abb8459400dd48abb9724f723fa20c8bb94238e`.
- Criteria: 2 Render, 2 Constraints, 19 Functional and 5 Polish (28 total).
- Functional coverage: 19/19 requirements (100%).
- Both Dockerfiles build; JSON/TOML, Node and shell syntax checks pass; all task text is LF-only.
- Environment/verifier seeds are byte-identical; frozen hashes match coverage.json.
- No-op is exact zero; reward is gated then computed as 0.6 × Functional + 0.4 × Polish.
- The task ZIP has one wrapper and 33 byte-identical, CRC-valid, traversal-safe files.
- Literal-secret and forbidden-runtime-artifact scans pass.

## Remaining observations

The optional strict robustness measurements for eight-run variance, triple rejudging, a dedicated keyword-stuffed artifact and a dedicated refusal-only artifact remain open. They are not task-source, verifier, golden, target-band or packaging defects.

## Evidence

- `common-ground-ballot.zip`
- `common-ground-ballot-oracle-run.zip`
- `common-ground-ballot-gpt-5-4-mini-run.zip`
- `common-ground-ballot-haiku-run.zip`
- `common-ground-ballot-qc-findings.json`
- `Common_Ground_Ballot_QC.xlsx`
- `Common_Ground_Ballot_RL_Scorecard.xlsx`
