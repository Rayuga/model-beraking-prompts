# HireOps bidirectional coverage ledger

Authoring ledger, 2026-09-30. This is not a QC clearance or a claim of golden execution. Candidate source is still being edited; freeze and bind hashes after authoring. All IDs below refer to tests/gates or tests/scored. Functional has 45 independently scored rows sharing ten scenario protocols; Polish has 9; Visual has 5. Both gates have one row. Shared canonical reward remains 0.6/0.2/0.2 with functional floor0.05.

## Source and evidence legend

Public sources: instruction.md (I); environment/instructions/hireops_rules.md sections1–9 (R1–R9); environment/instructions/integration.md (INT). All paths below are relative to projects/hireops-recruiting-operations/hireops-recruiting-operations unless noted.

Golden source support is an inspection target, NOT a passing test:
- G-auth: solution/app/src/index.js currentUser/auth/login and src/db.js seeded users.
- G-rules: solution/app/src/rules.js composition, safeResult/halfUpRatio/sumSafe, validDate/addMonths/completedMonths, vesting and headroom.
- G-actions: solution/app/src/index.js and action handlers registered by that module; settlement transaction implementation and role checks must be inspected in the current bytes.
- G-store: solution/app/src/db.js schema/seedIfEmpty plus DB_PATH; solve.sh lifecycle and server.js entry.
- G-views: solution/app/public/js/hireops.js renderWorkspaces and public/js/app.js, styles.css; src/index.js compositionView/offerView/referralAccrualView/reqView/bootstrap.
- G-audit: src/index.js audit/afterImage and action transaction callsites; public/js/hireops.js history UI.

No row in this ledger has fresh golden browser evidence attached yet. Root's forthcoming tests must record criterion-level results and distinguish source inspection, API tests, browser/MCP tests, image runs and configured judge runs. A source function existing is not sufficient evidence.

## Forward public-promise map

| Public promise and explicit variants | Owner IDs / protocol | Golden support / current evidence gap |
|---|---|---|
| Real populated signed-in operational product; wrong password then valid control | hro_gate_render | G-auth/G-views; browser gate execution pending |
| Real saved server data, not static/no-op/localStorage | hro_gate_shared; independent-context req creation/read | G-store/G-actions; exact MCP newContext feasibility pending |
| Seven seeded accounts; names, roles and held approver tiers | hro_accounts / P1,P5 | G-auth/G-views; all seven sign-ins pending |
| Any signed-in role may open requisition, including Auditor | hro_req_identity plus hro_raise_roles / P1,P5 | G-actions; positive matrix pending |
| Recruiter, Comp, all Approvers and Finance may raise; Auditor cannot | hro_offer_identity,hro_raise_roles / P1,P5 | G-actions; server replay and UI controls pending |
| Newly raised offer starts PENDING, captures candidate, req, six inputs and separate dates | hro_offer_identity / P1 | G-actions/G-views; fresh UI read pending |
| Caller IDs nonblank, exact spaces /?# retained, no prefix/length restriction | hro_req_identity,hro_offer_identity / P1 | G-actions; exact product response/UI comparison pending |
| Same-kind duplicate and whitespace-only IDs refused, originals unchanged; cross-kind names allowed | hro_duplicate_identity / P1 | G-actions; positive and negative witnesses pending |
| Nonnegative integer cents/shares; negative/fraction/nonfinite/nonnumeric/unsafe reject | hro_numeric_validation / P2 | G-rules/G-actions; invalid create/revise/budget pending |
| Exact safe integer input/computed limits; overflow refuses; signed adjustments allowed | hro_numeric_validation,hro_revision_signing / P2,P4 | G-rules; max-safe zero-spread positive and doubled-spread overflow pending |
| Valid date-only UTC and millisecond Z instants; impossible/missing required dates refused | hro_date_validation / P2 | G-rules/G-actions; offer/referral/effective-date cases pending |
| Intrinsic units*max(fair-strike,0), including equal/below strike | hro_intrinsic / P3 | G-rules/G-views; three-way spread evidence pending |
| Annual intrinsic/4 rounded once half-up, including quarter/half cent | hro_annual / P3 | G-rules; intrinsic.01 and.02 cases pending |
| Run-rate base+annual equity, excludes bonus/relocation | hro_runrate / P3,P4 | G-rules/G-views |
| Band basis base+half-up bonus/2+annual equity; relocation excluded | hro_basis / P3,P4 | G-rules/G-views; odd-cent bonus witness |
| Half-open200000/350000 boundaries, exact edges and immediately below | hro_bands / P3 | G-rules; four boundary offers |
| Approval only approver role, server403 on forbidden roles | hro_approval_role / P5 | G-auth/G-actions; successful action then replays |
| Approver tier at least requirement; tier2/II,tier3/I allowed; insufficient tiers403 with explanation | hro_tier / P5 | G-rules/G-actions |
| Distinct raiser/approver; self approval prohibited | hro_dual / P5 | Seed OFF-DC is Bill tier2; same actor's unrelated positive control |
| Approval run-rate fits live headroom, equality accepted and shortfall explained | hro_approval_budget / P6 | G-rules/G-actions; bonus-heavy fitting offer and final cent |
| Live headroom from every movement, ignores stale planning scalar | hro_commitment / P4 plus untouched seed REQ-ENG-2 | Seed budget450000-200000-197000=53000, not scalar60000 |
| Approval negative commitment movement and new headroom | hro_commitment / P4 | G-actions/G-store |
| Equity grant only when units positive, original start and schedule visible | hro_grant / P4 + zero-unit control | G-actions/G-views |
| Signing remittance full upfront amount; zero bonus no nonzero payment | hro_signing / P4 + zero-bonus control | G-actions/G-views |
| Referral only with referrer; credited employee not candidate;10000 split5000/5000 | hro_referral_creation / P4 + no-referrer control | G-actions/G-views |
| Revision allowed Recruiter/all Approvers/Finance; Comp/Auditor403 | hro_revision_roles / P5 | G-auth/G-actions |
| Revision crosses band without reapproval/new authority requirement | hro_revision_roles / P5 | Ample-budget Recruiter revision intoIII |
| Six revision economics editable; original candidate/req/dates/referrer retained; unique linked successor | hro_revision_lineage / P4 | G-actions/G-store; two-generation chain |
| Old offer economics immutable, predecessor SUPERSEDED, successor alreadyCOMMITTED, only one latest | hro_revision_lineage / P4 | G-actions/G-store |
| Revision reversal+replacement, new rate<=headroom+old; equality/downward/overrun | hro_revision_budget / P6 | G-rules/G-actions;100000 boundary |
| Original signing payment plus signed predecessor delta, visible net=current bonus | hro_revision_signing / P4 | G-actions/netSigningOutflow; decrease then increase |
| Prior grants superseded, original units/prices/date retained; replacement revised terms at original start | hro_revision_equity / P4 | G-actions/G-store |
| Zero-unit revision leaves no active grant | hro_revision_equity / separate P4 control | G-actions; control must be exercised |
| Referral minted once; unchanged after first/second revisions and rescission | hro_referral_immutable / P4 | G-actions/G-store; compare original values even if arithmetic wrong |
| Finance-only rescission; all other seeded roles403 | hro_rescission_role / P5 | G-auth/G-actions |
| Effective date stored; latest run-rate released exactly once | hro_release / P4 | G-actions/G-views |
| Signing vest-first40%@12,+5/month,cap24; retained half-up then subtract | hro_claw,hro_caps / P4,P7 | G-rules; odd cents12/13mo,24/32mo |
| Latest lineage bonus basis, original clock, appended contra; final net vested, no old payment rewrite | hro_claw,hro_history / P4 | G-actions/netSigningOutflow |
| Equity vest-first20%@12,+4/month,cap32; retained units half-up then subtract | hro_cancel,hro_caps / P4,P7 | G-rules;13 units@20%,7@24% and68% |
| Only latest replacement grant cancels; old grants untouched | hro_cancel,hro_revision_equity / P4 | G-actions/G-store |
| UTC original-anchor anniversaries clamp day, preserve time/ms, no iterative drift, before-start zero | hro_months / P7 | G-rules; Feb29/ms pair,Jan31-to-Mar30,before-start |
| Separate referral start and fixed reference,6month half-open cliff, UTC calendar addition | hro_referral_clock / P8 | G-rules/referralVested; exact/ms-after/Jan31 fixtures |
| DRAFT cannot approve or commit money; PENDING cannot revise/rescind | hro_stale / P5 | Seed OFF-301 plus fresh pending control |
| Stale ancestor and repeated approve/revise/rescind refuse without effects | hro_stale / P4,P9 | G-actions; compare saved business state and receipts |
| Overlapping affordable approvals cannot overcommit; whole settlement commits atomically | hro_competing / P6 | G-actions transaction; Promise.all observed requests, winner-only side effects |
| Current server session identity/role/tier overrides body claims; claims ignored on otherwise valid request | hro_claim_identity / P9 | G-auth/G-actions; no rejection exception for harmless forged claims |
| Stored inputs override claimed band,commitment,clawback,cancel values; claims ignored | hro_claim_economics / P9 | G-rules/G-actions; normal successful request control |
| Anonymous operational reads401 with no records | hro_anon_read / P9 | G-auth; authenticated populated positive control |
| Anonymous operational writes401, no new record; previous valid write persists | hro_anon_write / P9 | G-auth/G-store; independent-context readback |
| Readable per-action actor/target and before-after audit text, all three action types | hro_audit_text / P4 or separate ordinary controls | G-audit/G-views |
| Structured immutable receipt with actor/headroom/relevant computed before-after state | hro_afterimage / P4 | G-audit; observe at creation then after subsequent actions |
| Refusals leave all business/economic/action-receipt data unchanged | hro_stale plus rejection-owning rows / P4,P9 | G-store/G-actions/G-audit; generic security logs may grow |
| All required product screens/visible dollar cents/whole units/rates; input economics alongside derived values | hro_offer_identity,hro_intrinsic,hro_annual,hro_runrate,hro_basis,hro_bands,hro_grant,hro_claw,hro_cancel | G-views; assert presented raw equity terms and amounts, not only API |
| Dashboard open requisitions,total headroom,committed count,pending approvals update | hro_dashboard / P10 | G-views/bootstrap; state-relative deltas tolerate gates |
| Data and audit available after reload/fresh sign-in as other role | hro_readback,hro_history / P4,P10 | G-store/G-views; independent context required |
| Restart retains fresh writes, all recorded lineage/ledger/audit; seed idempotence | hro_restart / P10 last | G-store; one real restart_app, ordinary fresh pending control |
| Light/dark switching; preference survives reload | hro_pol_theme,hro_pol_theme_saved | G-views; rendered before/after plus reload |
| Phone operation/no keyboard lockout; reachable navigation and forms, visible focus | hro_pol_mobile,hro_pol_keyboard | G-views; actual390x844 and pointer-free route |
| Screen-reader navigation/main landmarks,headings,labels | hro_pol_semantics | G-views; rendered accessibility tree only |
| Legible success/error feedback, correction preserves entered valid fields | hro_pol_outcomes,hro_pol_preserve | G-views; invalid then corrected successful form |
| Readable empty/loading/failure states | hro_pol_empty,hro_pol_loading,hro_pol_outcomes | G-views; actual pending observation or supported response delay |
| Polished visual design/headline prominence/readability | five hro_vis_* rows | G-views/styles; anchored independent visual properties |

Monetary historical immutability has one owner: hro_history compares original commitment/reversal/replacement/payment/adjustment amounts, IDs and links after later transitions. It does not regrade offer/grant/audit/snapshot or refusal invariants owned elsewhere. Signed-in name is explicitly required by hro_accounts alongside role/tier.

## Runtime requirements that browser grading cannot fully prove

I/INT require Node22, Express, SQLite, one process/port3000/0.0.0.0, /app/server.js, DB_PATH, health independent of DB, copying required seed into /app, no startup installs, no external backend, clean installer and seed-once lifecycle. Canonical harness starts the declared entry/port and passes DB_PATH, but browser behavior cannot establish a database engine, dependency set, startup install absence or query-free health. Keep these as explicit template/runtime authoring checks against G-store and Dockerfiles, plus actual image/installer/restart tests. Do not add source-inspection to any browser judge. Constraint gate proves operational shared persistence only. The public Node/Express/SQLite mandate is inherited template policy; this observability limitation is a QC finding to reconcile, not a claim of complete browser coverage.

Additional finite-coverage limitations: no browser test proves all concurrency schedules, arbitrary identifier lengths or every possible safe integer. Named representatives distinguish concrete wrong implementations; all universal promises still require source review plus broader golden tests. API replays require actual observed routes/schema and cannot establish a UI's usability. Complete configured judge timing, launch, reward discrimination/ordering, Oracle and Luna scores remain unmeasured.

## Reverse-map discipline and independence

Every criterion above has at least one public source. No private ID/fixture appears in participant-facing requirements. Scenario protocols allocate dedicated records; seed OFF-DC and OFF-301 are dedicated state witnesses, REQ-ENG-2 remains read-only. Gates create only unique requisitions; Polish may create unique requisitions/pending offers but never settle economics. Visual is read-only.

Computed-value rows own correctness; history/readback/restart compare recorded actual values, preserving credit for stable but numerically wrong data. Separate role/tier/budget/security refusals each require successful controls. Where a complex chain fails, ordinary independent controls can establish audit,release,readback and durability; chain-specific properties still require their actual transition. No row inherits another row's pass flag. Refusal plus unchanged financial state is one coherent outcome, not a free negative for a dead handler.

Equal positive weights within each dimension are task-specific; canonical dimension weights and floor are unchanged. Gate pass is not enough for source QC. The45-row Functional workload is not yet measured against9000 seconds. Two hour-scale template budgets do not certify feasibility. Before freeze, compare this ledger to current criterion bytes and attach exact raw golden evidence rather than upgrading this plan to Pass.

