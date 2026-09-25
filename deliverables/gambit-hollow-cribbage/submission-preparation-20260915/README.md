# Gambit Hollow final deliverables

The final folder is `../final-submission-20260915/`. It contains the unchanged
task ZIP, four complete run archives and two Word reports. Oracle's archive also
contains the original NOP trial. The model archives are GPT-5.4-mini, Gemini 3.7
Flash and Claude Haiku 4.5; no supplied model has been substituted or relabeled.

Download bundle: `../gambit-hollow-cribbage-final-deliverables.zip`.

The task ZIP SHA-256 is
`06a4f99349469c181d51b8da5520fa0c8bc02332c0433cbfc0d826b374e57f6a`.
All 39 task files match current source, and every golden solution file matches
the Oracle app export. All five trials share the recorded task checksum
`770ea7287ee52452d6f44b7523b120e216b1a4d080969516efdeecdd8c70837c`
and recorded Harbor digest
`sha256:ebe8a7bc5b75c6b6a8151c8cb985d85070042698e2888bc48ded8f6a7c230bb8`.
All exported prompt/judge/runner/reward-config hashes match the delivered task.
The three hash schemes above are different identifiers.

| Run | Overall | Functional | Status |
| --- | ---: | ---: | --- |
| Oracle | 0.9833 | 1.0000 | All 40 Functional criteria passed. |
| GPT-5.4-mini | 0.6616 | 0.7083 | Overall inside 0.1–0.7; 29/40 Functional criteria passed. |
| Gemini 3.7 Flash | 0.8134 | 0.9167 | Above 0.7; 37/40 Functional criteria passed. |
| Claude Haiku 4.5 | 0.0000 | 0.0000 | Agent exit 143; partial artifact graded. |
| NOP | 0.0000 | 0.0000 | Expected no-op control. |

This is the final packaging of supplied evidence, not a claim that Haiku finished
normally. A clean Haiku rerun remains recommended. No Sonnet export was supplied;
if the general checklist requiring Sonnet applies, that evidence is outstanding.
Oracle Visual is 0.9167, below the preferred 1.0. No platform QC report was supplied.
Both Word reports state these qualifications and preserve all recorded scores.

Packaging passed 406 local archive checks and 134 configuration checks.
All four run archives contain every original exported file, byte-for-byte: no
files were excluded and no provider credentials required redaction. Original
exports and task source were left unchanged. Each archive has safe relative
paths, one matching wrapper, no duplicate entries and valid CRCs.

Evidence: `package-audit.json`, `archive-checks.json`, `standard-checks.json`,
`document-render-check.json` and `bundle-audit.json`. Build scripts and generated
PDF previews remain here, outside the seven submission files. No paid run,
browser regrade, Docker rebuild, platform upload or platform QC was performed
during packaging.
