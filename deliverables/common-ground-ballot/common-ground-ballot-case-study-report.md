# Case Study — Common Ground Ballot (Private Membership Voting)

**Scores:** Oracle (reference) 100% · Claude Haiku 4.5 40.64% · GPT-5.4 Mini 16%

## 1. What the task is

Common Ground is a full-stack private ballot workspace for the Riverside Residents Association. The brief requires a real Node.js, Express, and SQLite application with durable server-side state, role-scoped access, anonymous voting, identified turnout, ballot lifecycle controls, exact published results, and an immutable audit history.

Four people use the seeded system: Ruth the Coordinator, Arun the Observer, and members Leila and Owen. The six workspaces are Ballots, Vote, Turnout, Results, Members, and Audit. Their controls and data must change according to the signed-in person's role.

The verifier evaluates browser-visible behavior against the live application at `localhost:3000`. It follows connected workflows, replays genuine requests for safety checks, rereads state after rejected writes, and verifies that refresh and reauthentication preserve valid changes without duplicating seed data.

### Core features asked for

- Sign-in, sign-out, durable sessions, role-specific access, and account-wide session revocation.
- Draft, Open, Closed, and Published ballot states with strict transition and revision rules.
- Single-choice and approval voting with fixed eligibility captured when a ballot opens.
- One final submission per eligible member, exact retry idempotency, and operation-ID mismatch protection.
- Identified turnout kept separate from anonymous vote selections.
- Hidden results before publication and exact published counts, percentages, approval totals, and ties.
- Server-side rejection of malformed, stale, duplicate, cross-ballot, forged-identity, and out-of-role writes.
- Complete lifecycle and membership audit history without leaking private choices.
- Responsive navigation, accessible keyboard forms, persistent feedback, theme support, touch targets, and reduced-motion behavior.

## 2. What we actually verify

The suite contains 28 criteria: 2 Render, 2 Constraints, 19 Functional, and 5 Polish. Render and Constraints are entry gates. Once both gates pass, the final reward is `0.6 × Functional + 0.4 × Polish`.

| Area | How it is graded |
| --- | --- |
| Render | Two browser checks confirm a substantive public page and a working public control. |
| Constraints | Two checks require a same-origin local shell, health endpoint, and usable refresh behavior. |
| Functional | Nineteen connected checks cover seeded roles and states, sessions, lifecycle, eligibility, authorization, voting, privacy, results, revisions, audit, and persistence. |
| Polish | Five browser-visible checks cover responsive navigation, keyboard forms, durable feedback, result hierarchy, themes, touch targets, and reduced motion. |

The heaviest criteria are role and identity enforcement, private single-choice voting, and stale-revision/terminal-state safety at weight 2.0 each. Most other workflow criteria weigh 1.5, so missing one foundational control can break several dependent checks.

## 3. Where each model landed

### 🥇 Oracle (reference) — 100% (28 / 28)

The Oracle passed every Render, Constraints, Functional, and Polish criterion. It completed all 19 Functional chains, proving that the task instructions, deterministic seed, golden implementation, and verifier are mutually executable.

It correctly handled independent sessions and account-wide revocation; draft validation; edit/open locks; eligibility snapshots; role enforcement; cross-ballot rejection; private single and approval voting; retry idempotency; operation mismatch safety; turnout privacy; close/publish boundaries; exact tallies; revision conflicts; audit scope; and durable reauthentication.

### 🥈 Claude Haiku 4.5 — 40.64% (14 / 28 criteria passed)

**Succeeded at:** both Render checks, both Constraints checks, 8 of 19 Functional criteria, and 2 of 5 Polish criteria.

Haiku produced a substantive server-backed application. It loaded reliably, preserved the four seeded ballot states, supported draft editing and opening, froze eligibility correctly, enforced several role boundaries, rejected cross-ballot choices, completed private single-choice voting, blocked a second changed vote, and separated identified turnout from anonymous selections. Its workspaces were responsive and its ballot/result hierarchy was readable.

The most important failures were:

- **Session revocation:** signing Ruth out in one browser context did not revoke her other active session.
- **Draft validation:** a ballot with repeated choice labels was accepted and audited instead of refused.
- **Idempotency:** replaying the exact successful vote returned `409 Already voted` rather than the original successful outcome.
- **Operation mismatch:** the genuine vote request had no operation ID, so reused operations with changed payloads could not be distinguished safely.
- **Approval limits:** a repeated-choice approval submission was accepted and counted.
- **Hidden results:** Courtyard counts and its tie were exposed while the ballot was Closed but not Published.
- **Published arithmetic:** the seeded single-choice tie showed 2 votes and 100% per option instead of 1 vote and 50%; approval results showed inflated 200%/100% values.
- **Revision guidance:** stale writes were refused but did not return the current revision needed for recovery.
- **Audit and durability:** invalid accepted writes created audit events and persisted, leaving extra ballots and inflated tallies after reauthentication.
- **Accessibility and feedback:** the New ballot form lacked proper modal focus containment, voting lacked clear final-submission/privacy guidance, and one clickable turnout control was below the required touch height.

This run demonstrates partial product understanding: the principal screens and several workflows existed, but privacy, idempotency, validation, and exact-result invariants were inconsistent.

### 🥉 GPT-5.4 Mini — 16% (6 / 28 criteria passed)

**Succeeded at:** both Render checks, both Constraints checks, responsive workspace navigation, and theme/touch/reduced-motion quality.

GPT delivered a polished, responsive application shell. The public sign-in page loaded and refreshed, public controls worked, assets stayed same-origin, the health endpoint responded, all six workspace headings were reachable on mobile, and theme switching preserved the active workspace.

It failed all 19 Functional criteria. After sign-in, the application exposed an essentially empty workspace shell rather than the seeded roles, ballots, roster, lifecycle controls, voting forms, turnout records, results, or audit events. Demo accounts did not produce meaningful role differences; invalid credentials were accepted without a refusal message; refresh returned the user to sign-in; and no genuine mutation request existed for the verifier's replay and safety probes.

Because the required records and controls were absent, the verifier could not drive ballot creation, lifecycle transitions, eligibility checks, voting, idempotency, publication, revision conflicts, auditing, or persistence. This is a product-completeness failure rather than a startup failure: the application rendered and behaved responsively, but the core server workflows were not integrated.

## 4. The largest failure cluster

The clearest shared failure cluster is **end-to-end ballot integrity**: input validation, one-final-vote semantics, idempotent operation receipts, hidden pre-publication results, exact published arithmetic, revision safety, and audit/persistence conservation must all agree.

- **GPT-5.4 Mini:** 6/28 criteria passed and a 0.1600 reward. The shell passed both gates and two Polish checks, but no Functional workflow was present.
- **Claude Haiku 4.5:** 14/28 criteria passed and a 0.4064 reward. Several workflows worked, but invalid draft and approval writes were accepted, exact retries were not idempotent, unpublished results leaked, and published tallies were inflated.
- **Oracle:** 28/28 criteria passed and a 1.0000 reward, confirming that all connected requirements can coexist in one implementation.

The all-or-nothing workflow design makes foundational errors expensive. For example, accepting a duplicate approval choice affects participation, results, audit history, and durable state—not just the vote endpoint itself.

## 5. What this tells us

- A convincing shell is not evidence of a complete application. GPT passed startup, same-origin, responsive, and theme checks while failing every Functional criterion.
- Privacy must be verified through information flow. Turnout may identify who participated, but responses, audit records, and pre-publication views must never connect a member to a choice.
- Idempotency is more than duplicate rejection. An exact replay must reproduce the original outcome, while reuse of the same operation ID with a changed payload must be explicitly refused.
- Rejected writes need conservation checks. Ballot revision, participation, anonymous selections, results, receipts, and audit history must all remain unchanged.
- Result arithmetic needs method-specific denominators. Single-choice percentages use total ballots; approval percentages use participating ballots and may legitimately sum above 100% when multiple different choices are approved.
- Persistent errors compound. An invalid write that reaches SQLite survives refresh and reauthentication and contaminates later results and audit checks.
- Accessibility is behavioral. Labels and focus outlines help, but dialogs also need contained focus, final actions need clear consequences, and every touch control needs an adequate target.
- Each score represents one rollout per model, so the comparison is descriptive rather than a population estimate.

## Evaluation note

Task version: v1.0.6. All reported model runs passed the startup gates and completed as graded, non-no-op runs. An earlier Haiku artifact revealed an overly broad verifier symlink preflight; v1.0.6 corrected that verifier issue before the final exact-version run, separating infrastructure defects from model behavior.
