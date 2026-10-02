# HireOps: context for a fresh session, 2 October 2026

This note is for a new Claude Code chat that will work on the HireOps task. It was written at the end of a session that worked only on Colderwater, so the HireOps facts below come from reading the HireOps status files, not from running anything. Verify before relying on them.

## What we are trying to do

Author a WebDev benchmark task that the portal accepts. A task is accepted when, on the platform:

- Oracle (the golden solution) scores at least 0.95. We aim for 1.0.
- A no-op submission scores 0.
- GPT-5.6 Luna scores between 0.10 and 0.70. The user prefers about 0.4-0.5.
- The rubric review passes. The portal runs it only once Luna is in band.

Reward is `0.6 x Functional + 0.2 x Polish + 0.2 x Visual`. It is 0 if either gate (render, constraints) fails or Functional is 0.05 or lower. Polish and Visual failing does not zero the reward.

The user has a limited number of portal tries. Treat each upload as expensive.

## The task

- Path: `projects/hireops-recruiting-operations/hireops-recruiting-operations` (note the nested folder).
- Product: a compensation change desk. Finance moves several hires between requisitions and revises packages in one atomic coordinated change, with saved previews, stale-preview refusal, idempotent retry, and the underlying offer desk (requisitions, offers, tiered approvals, equity, referrals, rescission clawbacks, audit).
- Public brief: `instruction.md`, plus `environment/instructions/hireops_rules.md` and `environment/instructions/integration.md`.
- Seven demo accounts, password `Hireops!2026`, listed in `instruction.md`.
- Criteria as of commit `5b1df041`: 1 render gate, 1 constraints gate, **145 Functional (weight 45)**, 5 Polish (weight 9), 5 Visual (weight 6).

## Where it stands

From `deliverables/hireops-recruiting-operations/2026-10-02-permission-repair/REVIEW_STATUS.md`:

- Latest candidate ZIP: `deliverables/hireops-recruiting-operations/2026-10-02-permission-repair/hireops-recruiting-operations.zip`, SHA256 `ef8e76147c1960fe1658c4c492708a79e2f8d542ec99c296ff5cd93708b2df6e`, 37 files, bound to commit `5b1df041`.
- Status: reviewable, **not QC-cleared**.
- Last formal round: `qc/runs/hireops-2026-10-01-transaction-hardening-r3`. 53 of 54 reports were obtained; the row 46 reviewer was stopped by an automated security check and was not retried. One confirmed defect from that round was repaired afterwards (non-Finance Prepare checks) and only focus-reviewed.
- **No Oracle, Luna, configured-judge or hosted measurement exists for HireOps.**
- Open blockers it lists: the inherited shared `test.sh` restart and cleanup behaviour; an uncached verifier image build that failed on a Debian dependency HTTP 403 (a cached build succeeded); missing configured-judge workload, launch-to-grade and reward-discrimination measurements.

## Read these, in this order

1. `AGENTS.md` (workspace rules; they override defaults).
2. `deliverables/hireops-recruiting-operations/2026-10-02-permission-repair/REVIEW_STATUS.md` (latest status).
3. `qc/runs/hireops-2026-10-01-transaction-hardening-r3/RECONCILIATION.md` and `SUMMARY.md` (last round's findings).
4. `qc/repairs/hireops-2026-10-01-transaction-hardening/` (repair history; start with `R2-PROPOSED-REPAIRS.md` and the `post-r3-permission-repair` folder).
5. `qc/hireops/COVERAGE.md` and `qc/hireops/PREFLIGHT_FAIRNESS.md`. `qc/hireops/CURRENT_STATUS_2026-10-01.md` is older than item 2 and describes an 86-criterion version.
6. The task itself: `instruction.md`, both notes, `task.toml`, `tests/app_context.md`, all five `prompt.md` and `judge.toml` files, `solution/solve.sh`, `solution/app/server.js` and `solution/app/src`.
7. `WebDev_guide.md` (a colleague's account of getting two tasks accepted; untracked, in the repo root).
8. `WebDev Rubrics QC.xlsx` (53 quality checks, 48 deterministic checks) and `harbor-webdev-rubric-qc/SKILL.md` with its references.
9. `projects/webdev-task-template` (the canonical shared files).
10. For how the same process went on another task today: `handoffs/COLDERWATER_STATUS_2026-10-02.md` and `qc/repairs/coldwater-2026-10-02-strict/STRICT_CANDIDATE.md`.

## Things worth checking first

These are observations from this session, not confirmed HireOps defects.

1. **Judge time.** 145 Functional criteria run in one judge session with a 9000-second limit. If the judge overruns, the scored suite returns zero for every app, including the golden. Colderwater's 1 October version finished 79 criteria in under half an hour, so 145 may be fine, but it is unmeasured. This is the first thing a portal Oracle run would reveal, and the most likely way to waste a try.
2. **Difficulty.** Nothing has measured Luna on HireOps. The colleague's guide reports that Luna gets server rules right first time and loses points on behaviour that only works in a real browser (state kept across live updates, focus, drafts, multi-row forms). HireOps's difficulty is mostly server-side transaction rules, which is the kind Luna tends to pass. Polish and Visual are 40% of the reward and only 5 criteria each. Get an honest difficulty estimate before spending a try.
3. **Has the golden been driven through every criterion?** The status file describes targeted witnesses and 15 coordinated-domain groups, not one script per criterion. On Colderwater, a per-criterion browser script found golden bugs that source review missed.
4. **Judge-walk review.** On Colderwater the most useful check was a reviewer playing the judge: for each criterion, trace the golden source and ask whether a literal judge would pass it with the tools it has. It found a real golden bug and several steps the judge could not perform.
5. **Gates.** The colleague's rule: a gate should only check that the app loads, signs in and shows backend data. A gate that depends on one widget zeroes real apps.

## Process that worked on Colderwater

- **Scripted golden.** Install the golden with the task's own `solve.sh` in a container from the agent image, launch it the way `tests/test.sh` does (uid 65534, `env -i`, `DB_PATH`, `NODE_PATH`, working directory outside `/app`), and drive Chromium from the verifier image in the app container's network namespace so the app is `http://localhost:3000`. See `qc/repairs/coldwater-2026-10-02-strict/run_golden.sh` and `tests/lib.cjs` for a working pattern. Restart the process for real between persistence phases.
- **Formal QC round.** `python scripts/qc_pipeline.py prepare <task> --run <name> --mode single-per-row`, then one reviewer per prompt in `per-row-review/prompts` (53 rows plus `deterministic.md`), then `python scripts/qc_pipeline.py reconcile qc/runs/<name>`. Any edit needs a new freeze.
- **Quick QC.** One reviewer over all 53 checks plus several narrow judge-walk reviewers (10 to 15 criteria each). Narrow scopes finish in 3 to 7 minutes; broad ones ran over 20 minutes and several died with dropped connections.
- **Packaging.** `git archive --format=zip --prefix=<slug>/ HEAD:<task path>` from committed bytes, then verify every member's hash against the working tree and record the SHA256.

## Practical notes for this machine

- Shells: Git Bash and PowerShell. In Bash, a heredoc whose body contains apostrophes can fail to parse through the tool; write the script to a file in the scratchpad and run it.
- At most 20 subagents run at once. Tell reviewers not to edit files, not to run `py_compile` inside `.qc-cache`, and not to run git commands that change the working tree; one reviewer reverted a source file during a round.
- Deleting files in bulk was blocked by the permission classifier in this session. Ask the user before attempting cleanup.
- Docker is available. Images present include `hireops-agent:20261001-hard-r3` and `hireops-verifier:20261002-permission-repair`, plus several running containers from earlier work; do not stop containers you did not start.
- The configured judge cannot run locally: `z-ai/glm-5.3-flashx` through OpenRouter returned HTTP 401, and there is no working key here. Provider spend and uploads need the user's go-ahead.

## Git state

- Current branch: `task/colderwater-editor-strict`. It contains `main` plus the Colderwater work. HireOps's latest commit is `5b1df041`, on `main` and on this branch.
- Use a separate branch for HireOps, for example `task/hireops-…` created from `main`, so the two tasks stay apart.
- Untracked HireOps material, about 390 MB, was left alone:
  - `deliverables/hireops-recruiting-operations/2026-10-01-handoff-repaired`, `2026-10-01-hardening-r1`, `-r2`, `-r3`, `2026-10-02-permission-repair`
  - `qc/repairs/hireops-2026-10-01-transaction-hardening`
  - `qc/runs/hireops-2026-10-01-handoff-audit`, `-handoff-repairs`, `-transaction-hardening-r1`, `-r2`, `-r3`
  - Six of these contain a 58 MB `local/domain/requests.json`. Decide what to keep before committing; files that size are awkward to push.
- `deliverables/package_staged_candidates.py` is modified and uncommitted (HireOps criterion counts changed in its assertions).

## How the user likes to work

- Short, plain updates. Say what was done, what was verified and what was not.
- Fix first, then run QC, then fix what QC finds. They will ask for a ZIP path and hash.
- Never claim Oracle 1.0, a Luna score or a portal pass without a measured result.

## Prompt to paste into the new chat

```text
We are working on the HireOps task in this repo:
projects/hireops-recruiting-operations/hireops-recruiting-operations

Read handoffs/HIREOPS_NEW_CHAT_CONTEXT_2026-10-02.md first, then the files it
lists in order, including WebDev_guide.md and the task's brief, notes, judge
files and golden source. Do not edit anything yet. Portal tries are limited.

The goal is to get GPT-5.6 Luna into the 0.10-0.70 band (ideally 0.4-0.5) while
the golden still scores Oracle 1.0. I think the task as it stands is not hard
enough: it is mostly server-side rules, and Luna usually gets those right from
the brief. We need to do something exceptional to make it tougher, not just add
more rules.

Step 1. Give me your honest read, briefly:
- the current state of the task and its latest candidate ZIP;
- where you expect Luna to land today, per area, and why;
- what could make the Oracle score below 0.95 on the portal (145 Functional
  criteria in one 9000-second judge session is my main worry).

Step 2. Brainstorm. Come up with at least ten distinct ideas for making this
task genuinely harder for Luna. Think widely before narrowing. For each idea give:
- what the user would see and why a real Finance team would want it;
- why Luna is likely to get it wrong (Luna writes the whole frontend in one go
  and tests with curl, never in a browser);
- how a judge would check it in the browser, including the working control for
  any negative check;
- how much golden work it needs;
- the risk that it fails a correct app or that the judge cannot perform it.

Favour behaviour that only works when built and tested in a real browser:
state that survives live updates from another user, drafts and focus that are
kept, multi-row forms with per-row previews, keyboard-only flows, optimistic
updates that roll back, long lists that stay usable, undo across a multi-step
change, concurrent editors seeing each other's work. Also consider exact-value
edges stated as a rule without the giveaway example, and screens for roles that
Luna tends to lock out or forget. Do not propose hidden requirements, changes to
the reward weights, the judge model or the shared harness, or timing windows the
judge cannot hit.

Step 3. Rank the ideas by expected drop in Luna's score per unit of golden work
and judge time, and recommend the three to five you would build. Say what you
would remove to make room, since 145 Functional criteria is already a lot.

Step 4. Use two independent subagents to attack your shortlist: one arguing that
Luna will still pass each idea, one looking for ways each idea breaks the Oracle,
fails a correct alternative app or cannot be judged. Revise the shortlist with
what they find, then show me the final plan and wait for my go-ahead before
building anything.
```
