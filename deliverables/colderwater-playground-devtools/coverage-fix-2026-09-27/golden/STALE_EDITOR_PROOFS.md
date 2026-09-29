# C2 live stale Rename/Delete proof

Prepared proof-only driver; not browser-executed by its author. The parent supplies final task bindings and launches the disposable reference app. No production/golden source or previous evidence is edited.

```js
const {runStaleEditorProofs, mutateConflictClears} = require('./drivers/stale_editor_proofs.cjs');
const report = await runStaleEditorProofs(browser, url, logDir, {expectedConflictClears:false});
// For a separate disposable mutant build only:
const mutantAppText = mutateConflictClears(originalAppText);
```

`browser` is an already-running Playwright Browser. Each operation gets two fresh independent contexts and its own dedicated target/sibling records. The literal titles, filenames and source fixtures match the frozen S25/S28 protocols, so the caller should use a fresh disposable library rather than rerun against records with those titles. Delete additionally establishes a real successful current-revision Delete. Rename uses A's actual successful Rename as its operation control. B changes title, filename and source before A advances the saved revision. B remains open and dirty and invokes the real Rename prompt or confirmed Delete; direct API replay does not substitute for the dirty-editor action. The stale Rename prompt submits B's already-recorded dirty title, avoiding a deliberate prompt edit being mistaken for draft loss.

The report independently records two-editor setup, successful operation control, actual old revision in the request, server conflict refusal, newly caused visible feedback, exact three-field draft retention, full server-list preservation, deliberate latest-load, reapplication/save/reload, current-revision operation recovery and unrelated-record preservation. Feedback snapshots exclude old console history. Draft retention is never asserted as a prerequisite for the recovery legs: the expected mutant can lose the draft while server protection, feedback and recovery remain observable. One operation's incomplete setup does not prevent the other operation from running.

Raw JSON snapshots and the final report are written into a newly named subdirectory of `logDir`, with exclusive file creation. Previous runs are preserved. No scoring/Oracle result is produced: `product_pass` describes the observed conjunction, while `expectations_matched` separately describes the reference/mutant expectation. Missing facts stay `null` and an incomplete observation is explicit.

`mutateConflictClears` is a pure text-to-text function with no filesystem access. It requires exact app.tsx SHA256 `03917011ec2c4aa602ce6390a0427a32d8ff74567fc585a625fc709e583f1838` and unique exact catch anchors. Only Rename and Delete handlers clear title/filename/code on their actual 409 `REVISION_CONFLICT`; error logging and the conflict alert remain. Save's catch, successful actions and all server code remain unchanged. The caller must rebuild only its disposable copy. Exact source drift throws rather than silently adapting.

The copied `workflow_core.cjs` is unchanged from the structural-review proof infrastructure. Both it and this module prohibit the user's port 3420. These app-specific selectors and revision fields are reference-test mechanics, not extra requirements imposed on submitted apps.
