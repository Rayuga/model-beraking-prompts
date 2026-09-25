# Common Ground Ballot: latest run review

GPT-5.4-mini received 0 because its wrong-password error message is inside a hidden authenticated workspace. The server rejects the password correctly, but the sign-in screen never displays the rejection. The current rubric makes visible rejection a prerequisite in every dimension; the runner then forces the final reward to 0 when Render or Constraints is 0. The oracle displays its login error beside the sign-in form and passed all dimensions.

This was reproduced on 14 September 2026 using the unmodified exported GPT and oracle source, mounted read-only in separate network-disabled containers with fresh disposable SQLite databases. This is a local diagnosis, not a provider regrade. The task, frozen release ZIP, exported submissions and recorded scores were not changed.

| Submitted run | Render | Constraints | Functional | Polish | Visual | Final |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| GPT-5.4-mini, `3f3078d2` | 0 | 0 | 0.7647 | 0 | 0 | 0 |
| Oracle, `ddac4cac` | 1 | 1 | 1 | 1 | 1 | 1 |
| Gemini-3.7-flash, `c28cf178` | 1 | 1 | 0.6324 | 0.25 | 1 | 0.6294 |
| Claude-haiku-4-5, `b2f0269b` | 0 | 0 | 0 | 0 | 0 | 0 |

The separate oracle no-op control scored 0 with `graded=0, no_op=1`; the GPT trial has `graded=1, no_op=0` and no recorded run exception. The batch started around 19:42 UTC on 13 September, which is 01:12 IST on 14 September. All five prompt hashes, all five judge configuration hashes, the runner hash and the reward configuration hash match the current task for every trial.

## Confirmed cause

In GPT's exported `public/index.html`, `#app-shell` starts with class `hidden`, and `#banner` is a child of that shell. The `.hidden` CSS rule sets `display: none`. `submitLogin()` catches the 401 and calls `setMessage()`, which inserts the error text into `#banner`. Removing `hidden` from the banner does not make its hidden parent visible.

Both fresh-context probes produced the same result:

| Local observation | GPT | Oracle |
| --- | --- | --- |
| Wrong-password POST | 401 | 401 |
| Error text exists in DOM | Yes | Yes |
| Error is visible on sign-in screen | No | Yes |
| Protected read after wrong password | 401, no ballot data | 401, no ballot data |
| Authentication cookies after wrong password | 0 | 0 |
| Correct login and protected collection | 200, four ballots | 200, four ballots |
| Authenticated refresh | 200 | 200 |

Evidence: [GPT browser results](gpt-reproduction.json), [oracle browser results](oracle-reproduction.json), [GPT screenshot after rejection](gpt-wrong-password.png), and [oracle screenshot after rejection](oracle-wrong-password.png).

The relevant source locations are GPT `public/index.html:42` (hidden shell and its nested banner), `public/app.js:122` (banner rendering), `public/app.js:1053` (login handler), and `server.js:1108` (correct password refusal). The oracle has its dedicated `#login-error` inside the visible login form. The task's `environment/instructions/interface.md` requires useful persistent feedback for refused actions, so the absent message is a real implementation defect.

Every current dimension prompt explicitly requires visible wrong-password rejection and says to assign 0 to every criterion if the shared gate fails. In `tests/test.sh`, the final calculation is:

```python
if data["render"] <= 0.0 or data["constraints"] <= 0.0:
    reward = 0.0
else:
    reward = 0.6 * data["functional"] + 0.2 * data["polish"] + 0.2 * data["visual"]
```

This explains why a nonzero Functional result cannot rescue this run. The 0 represents the mandatory gate failure, not an absence of implemented functionality. Merely making the banner visible would require a fresh full evaluation to establish a revised score.

## Functional findings and judge inconsistencies

The reported 0.7647 Functional result contains five failed criteria. These findings do not cause the final zero independently of the gates.

- **Draft validation:** confirmed at the backend. Blank and repeated choices are silently removed by `normalizeChoices()` (`server.js:658`) and a draft is created with 201. Local probes added one ballot each. These probes confirm backend behavior; they do not replace the rubric's required UI validation workflow.
- **Approval selection limits:** confirmed. `parseSelectionPayload()` deduplicates submitted choice IDs (`server.js:748`). Two copies of the same choice were accepted with 200 and consumed participation, despite the explicit repeated-input rejection requirement.
- **Single-choice validation:** empty and multiple-choice inputs return HTML 500 errors containing `[object Object]`. Local rereads confirmed unchanged ballot and audit data, followed by a valid single-choice vote succeeding. This is defective error handling. However, this particular criterion explicitly asks for a non-2xx response and unchanged state, without specifying a 4xx status; the judge's reason that 500 is insufficient adds a narrower status requirement. Review this rationale instead of treating it as proof that invalid votes were recorded.
- **Cross-ballot rejection:** the invalid choice returns the same 500 and leaves ballot and audit data unchanged. The judge also cites a lost positive control after a separate accepted duplicate-choice probe. The prompt provides an isolated approval control for that case and says not to cascade independent failures. The supplied export has no detailed judge interaction transcript, so the full criterion cannot be independently rescored from the saved rationale.
- **Staff success receipts:** the judge says an exact create replay created a duplicate. A local immediate replay with the identical operation ID and full payload returned the identical 201 response and ballot ID, with zero additional ballots. This reported failure was not reproduced. The full criterion includes seven operations, subsequent mutations and two restarts; this focused replay check does not establish a pass for the full criterion.

The Functional judge also stated that the shared authentication gate passed. That contradicts four other dimensions and the reproduced hidden banner. Under the current prompt's literal gate rule, Functional should also have been 0. This inconsistency does not change the final reward, which is already forced to 0.

The reported mobile Turnout overflow was not independently retested in this review. The oracle's all-dimension score of 1 is from the supplied run; only its authentication behavior was reproduced here.

## Recommended correction

For the generated GPT app, place a persistent, accessible login error inside the visible sign-in form, or place the shared feedback region outside the hidden authenticated shell. Preserve the server's 401 response and protected-data refusal. The backend also needs explicit blank/duplicate input validation and properly handled client errors.

For task review, retain the existing recorded score and flag the inconsistent Functional gate and the unconfirmed receipt-replay judgment. The zero is explained by the written rubric and a reproduced UI defect. If the intended benchmark should distinguish functional quality despite a missing login message, that would require a deliberate rubric change and fresh runs; it is not a correction to this run's arithmetic.

Reproduction from the workspace root:

```powershell
python reports/common-ground-ballot/2026-09-14-latest-run-review/audit.py
python reports/common-ground-ballot/2026-09-14-latest-run-review/run.py
```

The browser script uses the installed `common-ground-ballot-tests:1.0.6` image for Node, Express, SQLite and Chromium. Source provenance and all criterion reasons are saved in [run-analysis.json](run-analysis.json). No scoring service or external credentials are used.
