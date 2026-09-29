# Generic breaker helper: raw findings and adjudication

`generic-breaker-audit.json` preserves the actual helper output. Its process exits zero even when its returned findings contain `fail`; the exit code is not a pass certificate. The final independent workbook review separately applies the current staged contract.

| Raw finding | Evidence and disposition |
| --- | --- |
| `verifier_contract`: database cleared before grading | The helper expects an initial `rm -f "$APP_DB"` string. The current canonical template does not perform that deletion, and ordinary launches/restarts must preserve saved records. The task keeps the canonical behavior. Fresh local harness and real-restart observations check durability; golden reinstallation is a separate lifecycle. This is a stale helper expectation, not a reason to delete user data. |
| `leniency`: `optional` | The two uses allow a language indicator without requiring one, and allow a supersession notice without requiring one. They do not excuse failed stated product behavior. The platform screenshot itself rejected the forced supersession notice. Removing these implementation freedoms to satisfy a keyword matcher would reintroduce a false failure. |
| `prompt_hygiene`: missing `re-read` | The prompt explicitly requires fresh reads of identities, fields and revisions after rejected mutations, and the criteria spell out those observations. A particular hyphenated spelling is not the required behavior. |
| `prompt_hygiene`: missing `positive control` | The prompt says to perform each criterion's meaningful successful control before negative operations; individual criteria establish concrete successful writes/runs. The exact phrase is also present in criterion text. This is a literal-string mismatch, not missing controls. |
| Enforcement-share note: 38.4% | This is a keyword-based categorization of criterion weights. It is neither a measured model score nor a requirement to move weights away from valuable requested behavior. The unchanged total is 49.5 across 33 Functional criteria. |

These findings remain visible rather than being silently suppressed. The source/extraction audit, browser evidence and the 53/48 review have different scopes and are reported separately.
