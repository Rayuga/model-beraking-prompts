# Pellmoor job pipeline

The latest task revision is the [15 September r11 reward schema repair](1.0.0-r11-reward-schema-repair-20260915/README.md).
It restores the required canonical reward entry while preserving positive judge
weights and the existing final gate and 60/20/20 formula. It preserves r9's rubric
fixes and the unchanged golden solution.

- [Latest task ZIP](1.0.0-r11-reward-schema-repair-20260915/pellmoor-job-pipeline.zip)
- [Current change and validation](1.0.0-r11-reward-schema-repair-20260915/REPAIR_REPORT.md)
- [Previous r10 static repair](1.0.0-r10-static-repair-20260915/STATIC_REPAIR_REPORT.md)
- [Previous r9 rubric repair](1.0.0-r9-qc-repair-20260915/QC_REPAIR_REPORT.md)
- [Previous r8 repair](1.0.0-r8-reliability-20260914/README.md)
- [15 September Oracle crosscheck](1.0.0-crosscheck-20260915/CROSSCHECK.md)
- [Latest all-model review](1.0.0-r8-reliability-20260914/RUN_REVIEW.md)
- [Implementation and validation](1.0.0-batch-offers-20260914/IMPLEMENTATION_REPORT.md)
- [Batch all-model run review](1.0.0-batch-run-review-20260914/RUN_REVIEW.md)
- [Second GPT run diagnosis](1.0.0-gpt-rerun-review-20260914/RUN_REVIEW.md)

The newest uploaded r7 runs scored Oracle 0.8386, GPT 0, Gemini 0.8545 and
Haiku 0.2153. Oracle lost interaction evidence and had clipped dialog controls.
GPT's browser check could not launch, and its submitted UI had an undefined
function. The current r11 package needs fresh platform QC and Oracle/GPT runs.
Exact image builds remain unverified; this is not a final verified submission.
Historical dated packages and the older root ZIP are preserved unchanged.
