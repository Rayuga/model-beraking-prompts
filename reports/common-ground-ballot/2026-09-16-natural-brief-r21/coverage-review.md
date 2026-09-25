# Natural-language brief coverage review — r21

**Result: all 89 inventoried semantic requirements are preserved. Zero remaining coverage gaps and no new product obligations were found.**

This is an editorial comparison of the actual r20 archive brief against the rewritten instruction.md. It checks meaning, boundaries, exact values and runtime compatibility, not matching sentences. No task file was edited by this reviewer. This is not a fresh QC, Oracle or model score.

- Baseline archive: deliverables/common-ground-ballot/2026-09-16-runtime-contract-r20/common-ground-ballot.zip
- Baseline archive SHA-256: `04d5cbc8cab8c7e71494cdf4b4f4c1acc68a928428d8b65556a759101b028b45`
- Reviewed file: projects/common-ground-ballot/instruction.md
- Reviewed file SHA-256: `c48fc3206f078a395ee728e2bdceda6711fff01f1115e8da4ab68b3820f4b04d`
- Inventory: 89 semantic requirements, all retained; 0 unresolved ambiguities; 0 unsolicited new feature requirements.

The final wording explicitly retains the Approval selection maximum, the required Node.js/Express/better-sqlite3 stack, associated control labels, same-account/same-profile tabs, post-submit confirmation privacy and the distinction between always embedding the seed and honoring SEED_PATH at startup. These clarify the prior requirements rather than adding functionality.

The technical details most vulnerable to an editorial rewrite remain explicit: ballot and membership revision 1/+1 rules; no vote/refusal/replay revision advance; original response status **and** body for successful and domain-refused operation receipts; unordered approval retry identity with repeated choices still invalid; per-person namespaces across actions; immutable eligibility; identified participation without choice links; exact browser recovery identity; pre-send persistence, no automatic resend, authentication-expiry retention, no concurrent same-profile attempt and no late resurrection; and the original runtime paths, environment overrides, public-network allowance and /app-only persistence.

The narrative now reads as one product owner's request, retaining the exact technical constraints in connected prose. Whether the external style grader accepts that wording still requires its own QC run; this review does not predict that result.

## Requirement-by-requirement comparison

Line numbers refer to the reviewed file hash above. Multiple lines indicate requirements expressed across more than one paragraph. “Preserved” means semantic coverage, not necessarily identical wording.

| ID | Area | Original requirement | Result | Rewritten instruction lines |
| --- | --- | --- | --- | --- |
| R01 | Scope | Private running ballot workspace for Riverside Residents Association; complete app under /app. | Preserved | 3, 201 |
| R02 | Scope | Authoritative seed at /assets/artifacts/common_ground_seed.json. | Preserved | 25 |
| R03 | Scope | Copy /assets/starter/. into /app and embed seed at /app/common_ground_seed.json. | Preserved | 210 |
| R04 | Scope | Starter supplies SQLite/schema/seed/authentication/six-workspace shell; business routes and pending actions remain to implement; schema/routes/UI names may be adapted. | Preserved | 28, 30 |
| R05 | Scope | Exercise supplied ballots as every demo user, a new Draft-to-Published decision, fresh sign-in and process restart. | Preserved | 219 |
| R06 | Scope | Registration, email delivery, public result links, imports, exports and election certification are out of scope. | Preserved | 217 |
| R07 | People | Four exact demo accounts: Ruth Adebayo Coordinator, Arun Das Observer, Leila Ward/Owen Park Members, with their documented commonground.example emails and shared CommonGround!2026 password. | Preserved | 9, 18 |
| R08 | People | Coordinator prepares/edits ballots, manages active roster and progresses lifecycle. | Preserved | 9 |
| R09 | People | Observer can review ballot setup, turnout, results, members and audit but cannot mutate. | Preserved | 10 |
| R10 | People | Members see eligible ballots, cast one final submission and see own participation. | Preserved | 12 |
| R11 | People | Every protected workspace shows signed-in name, role and Riverside Residents Association; shared header is acceptable. | Preserved | 15 |
| R12 | People | Useful Ballots, Vote, Turnout, Results, Members and Audit workspaces. | Preserved | 14 |
| R13 | People | Seed every record exactly once; restart neither duplicates seed nor overwrites later work. | Preserved | 27 |
| R14 | Ballots | Draft title, optional context, method and at least two distinct nonempty choices. | Preserved | 33 |
| R15 | Ballots | Coordinator can edit Draft; opening freezes wording, method and choices. | Preserved | 34, 39 |
| R16 | Ballots | Single choice requires exactly one choice. | Preserved | 35 |
| R17 | Ballots | Approval requires one or more distinct choices up to maximum; maximum ranges from one to choice count. | Preserved | 36, 38 |
| R18 | Ballots | Opening fixes active-member eligibility; later roster changes affect future snapshots only, including seeded Owen eligibility while paused. | Preserved | 51 |
| R19 | Ballots | Each eligible Member submits once per ballot; choice IDs cannot come from another ballot. | Preserved | 13, 40 |
| R20 | Receipts | Create/edit/membership/lifecycle/vote attempts have operation IDs tied to signed-in person. | Preserved | 104 |
| R21 | Receipts | Exact retries return original response status AND body with no repeated mutation or audit. | Preserved | 106 |
| R22 | Receipts | Same ID with different input is refused. | Preserved | 112 |
| R23 | Receipts | Receipts persist through restart and later ballot/roster changes; replayed Open cannot reopen or recapture eligibility. | Preserved | 108 |
| R24 | Receipts | Approval choices are unordered; reordered same distinct set gets original receipt, including after publication/restart. | Preserved | 116, 117 |
| R25 | Receipts | Repeated choices are invalid input, not a deduplicated equivalent set. | Preserved | 119 |
| R26 | Receipts | One operation namespace per person across actions; Create ID cannot later edit or change membership; collision changes neither records nor original receipt. | Preserved | 113 |
| R27 | Receipts | Different people have independent operation namespaces. | Preserved | 115 |
| R28 | Revisions | New Draft starts at revision 1; supplied seed revisions remain intact. | Preserved | 78, 80 |
| R29 | Revisions | Each accepted draft edit/Open/Close/Publish advances ballot revision exactly one. | Preserved | 78 |
| R30 | Revisions | Voting does not advance ballot revision; refusals/exact replays do not advance revisions. | Preserved | 79, 82 |
| R31 | Revisions | Viewed revision and approval maximum are positive whole numbers; reject list/object/boolean/null/omission coercion; normal HTML text encoding is allowed. | Preserved | 92 |
| R32 | Receipts | Store authorized well-formed stale/wrong-state refusal outcomes. | Preserved | 122 |
| R33 | Receipts | Premature Publish retry after Close returns original refusal. | Preserved | 124 |
| R34 | Receipts | A changed attempt with current information uses a new operation. | Preserved | 125 |
| R35 | Receipts | No requirement to store malformed requests, failed sign-ins or unauthorized attempts as receipts. | Preserved | 126 |
| R36 | Receipts | Refusals/retries never create audit events. | Preserved | 127 |
| R37 | Lifecycle | Draft→Open→Closed→Published; voting only Open; results hidden through Closed; Published terminal. | Preserved | 42 |
| R38 | Lifecycle | Actions use viewed revision; stale writes are refused without changes. | Preserved | 77, 85 |
| R39 | Results | Published single-choice counts each option and total ballots; tie names all top leaders. | Preserved | 45 |
| R40 | Results | Approval shows choice approvals and participating ballots; percentage denominator is participating Members and totals may exceed 100%. | Preserved | 47 |
| R41 | Privacy | Identified participation separate from anonymous selections; no screen/response/result/audit links a person with a choice. | Preserved | 56 |
| R42 | Privacy | Successful vote response confirms participation without returning choices. | Preserved | 60 |
| R43 | Privacy | Members never receive another Member's participation flag/timestamp/identified row; enforce in UI and all protected/nested ballot/turnout/activity responses. | Preserved | 63 |
| R44 | Privacy | Public demo names/roles alone are not participation leakage. | Preserved | 66 |
| R45 | Sessions | Server determines actor/role from server-issued unpredictable session, not browser-supplied account ID. | Preserved | 69 |
| R46 | Sessions | Every successful sign-in has a distinct credential; public account details, modified credentials and unsigned claims cannot grant protected access. | Preserved | 70, 71 |
| R47 | Security | Unknown/stale/malformed/cross-ballot/out-of-role writes leave ballot/revision/turnout/results/history unchanged. | Preserved | 99 |
| R48 | Membership | Membership starts at revision 1; accepted update advances applicable revision exactly one; refusal/replay does not. | Preserved | 81, 82 |
| R49 | Membership | Viewed-revision roster protection includes active→paused→active ABA race; stale refuses with useful refresh guidance/no audit; current update can succeed; opening snapshots remain fixed. | Preserved | 85 |
| R50 | Membership | Missing membership status or object/array is malformed; do not coerce to activation/pause. | Preserved | 96 |
| R51 | Membership | Required membership revision rejects list/object/boolean/null/omission; use actual viewed whole-number revision. | Preserved | 92, 97 |
| R52 | Membership | Refusal preserves status/revision/audit and the next ballot snapshot based on unchanged roster. | Preserved | 97 |
| R53 | Sessions | Sign-out revokes current session; each person can end all their sessions; ended credentials cannot read or mutate protected records. | Preserved | 73, 74 |
| R54 | Audit | Successful create/edit/open/close/publish/membership audit includes action, record, actor and time. | Preserved | 128 |
| R55 | Audit | Voting may add anonymous receipt activity without Member name or selected choices. | Preserved | 130 |
| R56 | Runtime | Public network permitted during implementation/runtime, including external fonts/scripts/styles/APIs. | Preserved | 214 |
| R57 | Runtime | Node.js 22, Express and better-sqlite3 are preinstalled and required stack. | Preserved | 201 |
| R58 | Runtime | Single process node /app/server.js, working directory /app, port 3000 bound 0.0.0.0 serving browser UI. | Preserved | 203, 204 |
| R59 | Runtime | GET /api/health succeeds. | Preserved | 205 |
| R60 | Runtime | Honor DB_PATH, otherwise /app/commonground.db. | Preserved | 207, 208 |
| R61 | Runtime | SQLite persists sessions, ballots, votes, participation, membership, operation receipts and audit across restart. | Preserved | 205 |
| R62 | Runtime | Embed /app/common_ground_seed.json; honor SEED_PATH if supplied, otherwise embedded seed. | Preserved | 210, 211 |
| R63 | Runtime | Only /app survives; /assets and brief are build-time inputs that may be absent at startup. | Preserved | 212 |
| R64 | Interface | Lifecycle/status understandable; staff scan eligibility/turnout without live choice totals; Members receive privacy explanation before final submission. | Preserved | 182 |
| R65 | Interface | Useful validation/refusal messages persist until dismissal or another completed action. | Preserved | 186 |
| R66 | Interface | Disable or explain unavailable actions; hidden controls are not server security. | Preserved | 185 |
| R67 | Interface | Polished responsive layout/light-dark control; all six workspaces reachable at about 390×844 without horizontal page overflow. | Preserved | 190 |
| R68 | Interface | Landmarks, real headings, associated labels, visible keyboard focus, comfortable touch targets and status text independent of color. | Preserved | 195, 196, 198 |
| R69 | Interface | Respect reduced-motion preference. | Preserved | 198 |
| R70 | Interface | Readable consistent typography/spacing/alignment/contrast/hierarchy across lists/turnout/results/roster/forms and both themes/sizes. | Preserved | 192 |
| R71 | Recovery | Pending actions area inside workspace communicates interrupted staff uncertainty. | Preserved | 133 |
| R72 | Recovery | Persist each staff create/edit/open/close/publish/membership attempt before sending. | Preserved | 137 |
| R73 | Recovery | Without usable confirmation retain through reload and later sign-in in same profile; identify action and record. | Preserved | 138 |
| R74 | Recovery | No automatic resend on startup/refresh/sign-in. | Preserved | 140 |
| R75 | Recovery | Unreadable response/server failure does not prove refusal. | Preserved | 144 |
| R76 | Recovery | Confirmed mutation followed by failed read refresh stays confirmed; explain refresh problem separately. | Preserved | 145 |
| R77 | Recovery | Explicit Retry preserves original target/action/inputs/operation ID/viewed revision even after newer changes. | Preserved | 150 |
| R78 | Recovery | Usable success or definite business refusal resolves reminder with outcome and fresh current records; old receipt cannot overwrite newer state. | Preserved | 153, 155 |
| R79 | Recovery | After refusal, changed action is a separate user decision with current information and new ID. | Preserved | 155 |
| R80 | Recovery | Several uncertain actions remain separately recognizable; independent work stays usable. | Preserved | 159 |
| R81 | Recovery | Retry/Dismiss affects one reminder only and never resends whole queue. | Preserved | 160 |
| R82 | Recovery | Dismiss does not undo possibly accepted work; explain that. | Preserved | 161 |
| R83 | Recovery | Logout hides original person's pending details; other account cannot see/replay them; returning owner restores unresolved work. | Preserved | 165 |
| R84 | Recovery | Expired/revoked session preserves uncertainty for original owner's sign-in and never replays as next account. | Preserved | 168 |
| R85 | Recovery | Recovery covers staff writes, never Members' private selections. | Preserved | 141 |
| R86 | Recovery | Same-profile same-account tabs share pending work; resolution/dismissal reflected by next interaction or reload. | Preserved | 172, 173 |
| R87 | Recovery | Stale tab/late response cannot resurrect removed reminder or overwrite another pending attempt. | Preserved | 175 |
| R88 | Recovery | Disable in-flight original action against duplicate attempts; same-profile tabs cannot run one pending attempt concurrently. | Preserved | 177, 178 |
| R89 | Recovery | No storage library/layout mandated; accepted business records/receipts still reside in SQLite. | Preserved | 179, 180 |

The starter-description row includes factual implementation context. Its shorter wording does not remove a product obligation: one-time durable seeding, real authentication and the unfinished ballot/recovery scope are separately explicit in the rewritten request.
