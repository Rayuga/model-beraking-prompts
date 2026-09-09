# PatchPad 2.0.2: review findings and golden fixes

This update responds to the screenshot with 48/53 rubric checks passed.
The five failed rows share some causes; this report separates those causes.

1. Word-navigation expectations are now stated in editing.md: move right
   through the word and following whitespace to the next word's start; Shift
   selects the same span. The existing word-coordinate verifier is retained.
2. overview.md now states that the seeded document begins at revision 1.
3. persistence.md now requests a visible total Find match count. These three
   clarifications resolve the instruction-ambiguity and unrequested-grading
   findings without changing existing expected coordinates or seed values.
4. The golden editor now distinguishes Tab traversal from active editing.
   Tab entry can continue to history, clicking/typing or Enter activates editing,
   and Escape returns to traversal. Active editing still uses Tab/Shift+Tab
   for indentation. Visible help and focus outlines explain/show the state.
5. A new Functional criterion tests a saved marker and full document/history
   equality across two actual server restarts and fresh browser contexts. It
   also checks that startup does not create duplicate seeded records/revisions.
   The trusted lifecycle scripts reuse the GridForge approach, preserving
   SQLite on restart and stopping the current process group on cleanup.

The previous saved/fresh-client criterion is split into weight 0.25 for its
existing behavior and weight 0.25 for server restart persistence. There are
26 Functional criteria, total weight 19.5, and 34 scored criteria overall.
Render and Constraints remain two criteria each; the final 60/40 score split
and time budgets are unchanged. Previous bundle/duplicate-grading fixes remain.

## Network finding: explicit policy disagreement

The user explicitly chose public network access after run-ad33f6bf failed
while Harbor installed OpenHands dependencies in a no-network environment.
PatchPad retains public setup/development networking and a separate allowlisted
verifier. The brief now explicitly distinguishes build access from the
delivered app's local runtime; overview.md no longer prohibits build installs.

The reviewer additionally demands no-network as an enforcement policy against
fetching a prohibited editor during development. Wording cannot satisfy that
policy while retaining public networking. This finding may recur and needs a
platform exception/clarification, or a separately approved network change with
bootstrap dependencies preinstalled and a real agent-setup test. We do not
claim all five platform rows passed or silently switch the network back.

## Validation

- Agent/verifier images build. RewardKit discovery, shell/JavaScript syntax
  and empty-submission reward-zero checks pass.
- Six existing golden browser smoke groups pass.
- Five focused browser groups cover seeded revision and match counts, word
  navigation/selection, keyboard traversal, indentation/Undo/Escape, and full
  persisted data/history across two real restarts.
- Reports and regression helpers remain outside the upload ZIP. Local evidence
  is not a fresh full Oracle or platform rubric score.
