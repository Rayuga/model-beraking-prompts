# Latest PatchPad ZIP manual QC audit

All supplied manual-checklist requirements pass on the actual ZIP, which exactly matches the current source.

| Check | Status | Evidence |
| --- | --- | --- |
| Exact task.toml key paths | Pass | No extra or missing keys, including nested metadata. |
| Reference timeouts | Pass | Agent 7200; verifier 13200; build 600 seconds. |
| Version | Pass | Literal 1.0.0 matches the reference file. |
| Exact verifier.env | Pass | All keys and values match the supplied Bazaarbridge reference. |
| tests/Dockerfile API-key mention exclusion | Pass | No matches anywhere in the file. |
| tests/test.sh API-key mention exclusion | Pass | No matches anywhere in the file. |
| environment/Dockerfile API-key mention exclusion | Pass | No matches anywhere in the file. |
| Reasoning effort max | Pass | Explicit Codex config written by verifier Dockerfile. |
| Exact final reward formula | Pass | Exact requested form, without an ungated intermediate. |
| Five verifier folders | Pass | Actual reference directory spelling is tests/, not test/. |
| render judge keys | Pass | The required [judge] table exists; forbidden judge/model keys do not. |
| render comment headers | Pass | No TOML comment lines. |
| render browser gate | Pass | Explicit global browser gate and zero-on-failure rule. |
| constraints judge keys | Pass | The required [judge] table exists; forbidden judge/model keys do not. |
| constraints comment headers | Pass | No TOML comment lines. |
| constraints browser gate | Pass | Explicit global browser gate and zero-on-failure rule. |
| functional judge keys | Pass | The required [judge] table exists; forbidden judge/model keys do not. |
| functional comment headers | Pass | No TOML comment lines. |
| functional browser gate | Pass | Explicit global browser gate and zero-on-failure rule. |
| polish judge keys | Pass | The required [judge] table exists; forbidden judge/model keys do not. |
| polish comment headers | Pass | No TOML comment lines. |
| polish browser gate | Pass | Explicit global browser gate and zero-on-failure rule. |
| visual judge keys | Pass | The required [judge] table exists; forbidden judge/model keys do not. |
| visual comment headers | Pass | No TOML comment lines. |
| visual browser gate | Pass | Explicit global browser gate and zero-on-failure rule. |
| Nested verifier budget | Pass | 12000 total judge seconds < 12600 wrapper < 13200 verifier. |
| User-approved Docketlight judge weights | Pass | Functional/Polish/Visual 0.6/0.2/0.2; Render/Constraints 1.0. This is the later user-approved override to Bazaarbridge weights. |

ZIP SHA-256: `4448ad8c5277126b3b24ef1062fb84e12a9f84a913124d7e340dc32e086f6b62`.

Platform rubric QC is not certified by this local checklist. Remaining risks:

- Polish/Visual credit for weak or nonfunctional submissions remains possible; prior Haiku trial had Functional 0 and overall 0.3033. User deferred score-floor changes and kept Visual appearance-only.
- RewardKit 0.1.7 includes positive Render/Constraints judge weights in its intermediate aggregate; test.sh overwrites it with the gated final formula. Docketlight alignment does not remove this distinction.
- Previously reviewed assumptions such as wrapped-line navigation and the Polish error-observation procedure remain deferred; the platform semantic review may raise them.
