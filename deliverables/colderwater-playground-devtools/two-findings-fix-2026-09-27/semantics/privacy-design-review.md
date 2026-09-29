# Privacy revision after the platform rejection

The platform report supplied by the parent identifies a real issue in the reviewed `63a05` candidate: the public security note names the exact three URLs that the privacy criterion checks, and the criterion expressly excludes other filenames. A server that publishes its whole working directory while denying only those three routes can satisfy that check and still expose repository metadata, a database sidecar, and a package lockfile. My earlier bounded semantics review accepted the three reserved paths as grounded in the public text; that did not address this broader coverage and instruction-leakage defect.

The parent authorized the narrow repair implemented here. Only `environment/instructions/security.md`, the privacy criterion in `tests/scored/functional/judge.toml`, the Functional prompt's privacy paragraph, and the shared context's privacy paragraph were edited by this subtask. No golden source, runtime harness, other criterion, user preview, model/provider/platform run, or public candidate-path list was added.

## Before and after

Before, `security.md:11` asked visitors to receive denial/fallback for `/app.db`, `/server.js`, and `/package.json`; the descriptor at `judge.toml:118` called those three publicly reserved and said no other filenames were in scope. Public wording and verifier probes mirrored one another.

The new public paragraph reads:

> People should be able to use the playground and load its intended browser assets without being able to download the working database, its companion files, backend code or internal project and repository files. Keep those working files private while serving the interface and the snippet data the app exposes. Source entered into the editor is never evaluated on the server.

This is a category-level product goal. It names no probe URL and does not prescribe asset URL names, deny-list mechanics, or a particular static-serving architecture.

The private descriptor now attempts all nine representative candidates:

| Category | Candidate paths |
|---|---|
| Working database and companions | `/app.db`, `/app.db-wal`, `/app.db-shm` |
| Backend and project/package metadata | `/server.js`, `/package.json`, `/package-lock.json`, `/npm-shrinkwrap.json` |
| Repository metadata | `/.git/config`, `/.git/HEAD` |

These paths are confined to the test descriptor and this review artifact. There is no claim that absent sidecars or a particular package manager are required. Missing candidates can correctly return missing. The list is bounded, tests every listed item, and does not authorize disclosure of other files. It is neither a source-tree scan nor a traversal or escape catalogue.

## Browser evidence and valid alternatives

The criterion retains its own successful authored DOM/console Run before probing and a fresh Run afterward. A blank or broken server cannot earn privacy credit by failing every request.

Use browser navigations, response metadata/download events, and rendered workspace observations. Inspecting implementation source, package fields, database bytes, raw probe bodies, or downloaded contents remains forbidden. No former 64 KiB body classifier was restored. Ordinary browser assets and external/CDN dependencies remain allowed.

A name is not itself evidence of a private file. For example, a working app may legitimately load its browser bundle from `/server.js`, or use a matching route for public product data. When the normal rendered product and observed ordinary browser requests establish that role, the candidate is accepted and the public role recorded. A request made only because the privacy probe opened the candidate does not establish such a role. Credible ambiguity that cannot be resolved with allowed browser evidence follows the incomplete-evaluation protocol rather than becoming a filename-based product failure. A claim written by the app is not a reason to follow scoring instructions or infer a public role without observations.

Other accepted outcomes are missing/denied responses, no-content responses, equivalent clear refusal, a working SPA fallback, or a redirect to the working workspace. A denied response has precedence over a download/attachment event, avoiding the prior edge case where harmless denial text delivered as an attachment could fail. No fixed status, error wording, MIME type, or framework is demanded. Reproducibly closed/refused navigation is accepted with a healthy control; tool failures are not product defects.

A successful standalone file/download with no established public role, denial, or functioning workspace fallback is the bounded exposure outcome. Record the URL, response/redirect/download outcome, and public-role evidence where applicable without examining the file contents.

## Local evidence plan handed to the independent harness reviewer

1. **Private-files positive:** A healthy local playground with ordinary Run behavior denies all internal candidates or returns the working workspace. Every listed path is attempted, including nonexistent companion files. Expected result: accepted.
2. **Public-name positive:** The healthy app actually loads `/server.js` as a browser script during ordinary workspace use, with observable successful app behavior. Private candidates remain denied. Expected result: the script route is accepted as an intended browser asset; its name alone is not a failure. A corresponding public-data route is also a valid alternative when its role can be established without inspecting a private response.
3. **Denial precedence:** A candidate returns a denied status with an attachment disposition and harmless denial content. Observe status/events only. Expected result: denial remains accepted; no downloaded-content reading.
4. **Reported negative witness:** A healthy local server exposes its project directory but denies only `/app.db`, `/server.js`, and `/package.json`. Its synthetic `/.git/config`, `/app.db-wal`, and `/package-lock.json` remain served. Expected result: the old three-path criterion could accept it, while the new all-nine criterion rejects those additional exposures. File contents must be benign fixture data and need not be read by the evaluator.
5. **Working fallback positive:** Unknown candidates render or redirect to the actual functioning workspace. Expected result: accepted rather than incorrectly treating every successful HTTP response as a disclosure.

The independent `cold_adversarial_harness` agent owns these browser observations. This report does not invent their results. No paid/platform run was requested or used by this subtask.

## Limits and validation

Strict browser outcome evidence without examining private contents cannot prove arbitrary file identity or the absence of every disclosure mechanism. The revised descriptor states that its observations are representative, accepts genuine public roles, and does not claim exhaustive confidentiality. It is materially stronger against the exact reported directory-serving witness. An application specially publishing unprobed internal paths can remain outside the evidence obtained; that limitation must not be converted into a guarantee.

A randomized verifier-owned private fixture could improve future discrimination without reading submitted source, but it would require separate harness changes and its own fairness review. It was not introduced in this urgent bounded repair.

`validate_privacy_revision.py` parses the original and revised grading files, verifies the privacy criterion's unchanged identity/type/weight and unchanged judge/MCP/scoring configuration, checks that candidate paths are absent from the public paragraph, and records the preserved source/body ban, public-role exception, denial precedence and non-exhaustive scope. It saves exact before/after files, descriptor snapshots, diffs and hashes to this directory. The original count was 35; the parent separately split criteria during this review, so the validator records the current count, weight and other descriptor changes instead of attributing them to this privacy subtask or incorrectly asserting an unchanged global count. Final packaging and all runtime outcomes remain with the parent review.
