# QC mechanism validation, 29 September 2026

`python -B -m unittest discover -s scripts/tests -p test_qc_pipeline.py -v`: **21 passed**. These are synthetic tests of the orchestration, not product or Oracle scores.

Covered failure cases: missing reviews, missing source-reading attestation, duplicate rows, copied reports, wrong candidate hashes, changed live/frozen source, changed checker, malformed JSON/report, a missing input directory after an earlier green result, one failure against two passes, issue-key spoofing, missing/changed runtime evidence, unsupported same-hash fix waivers, self-confirmation and unrelated-file waivers. A correctly confirmed synthetic refutation preserves the original finding and resolves only its own issue.

Actual integration exercise: prepared a frozen Coldwater candidate; three agents independently completed all53+48 rows; reconciliation correctly blocked on findings and missing evidence. Export used the supplied skill's builder to produce a workbook with all three reviews and without internal annotation sheets. After task fixes, round1 correctly became stale and round2 was separately frozen for three new reviews.

The packager's temporary-extraction change reproduced the previous ZIP exactly (`7d176c9af6e57873c32cd1ea4b966fe89e6da181a525339c9676ebeb9871cd94`,50files). The revised task was then packaged separately, with CRC/extraction hash checks passing. Candidate packaging itself is not release clearance.

The pipeline verifies record structure, hashes and completeness. It cannot prove the truth of a natural-language review, genuine independent reasoning, or the adequacy of a cited runtime log. That still needs review. The private portal checker implementation, source-QC model configuration and full paid judge run are not reproduced by these tests.

The task-specific exercise also caught a restart-credit coupling in round2 despite two other reviewers reporting no source defect. It was repaired and frozen as round3. Local structural preflight has50 passing assertions; Coldwater-specific guards have45. Those counts are not the portal's48 static-check results. Round3's fresh direct-browser golden run records58 passing functional facts and one real restart in96.917 seconds; full LLM grading remains unmeasured.
