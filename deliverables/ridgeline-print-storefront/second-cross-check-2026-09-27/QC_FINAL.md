# Ridgeline second full cross-check - 27 September 2026

The fresh full review found and repaired five rubric gaps plus one harness defect. No unresolved concrete Ridgeline blocker remains in the local checks below. This is not a guarantee of platform acceptance or Oracle1.0.

## Current upload

[Replacement ZIP](ridgeline-print-storefront.zip), SHA-256 `e9571f7ec27341ace6c955a81de5cc8fd2199df804ee54b7c90a009b18333f9b`. It contains51 files / 702091 bytes. All CRCs, safe single-root paths, shell modes/LF and source/extraction hashes match. This replaces the preserved9944734b archive in the previous cross-check folder.

Exactly five task files changed: Functional and Polish judge/prompt files plus tests/test.sh. All19 golden/installer files, public notes/assets, configuration, gates, Visual rubric, scoring policy, canonical Python tools and Dockerfiles remain identical. Criterion counts/types/IDs/order/weights are unchanged:25Functional/35weight and37 total. [Exact diff](candidate.diff) and [binding](final_candidate_binding.json).

## Repairs

1. **Keyboard access:** three Tab stops could hide mouse-only print/basket views. Named controls now require keyboard reachability and visible focus, while the existing navigation check uses real keys through detail → catalogue → basket → catalogue. No keyboard purchase or repeated Functional verdict is added.
2. **Sold-out paper filtering:** the old Munken witness could not expose an app that dropped wholly sold-out prints. The same0.1-weight criterion now also checks Colorplan Pristine White with Allotment, Long Field and Nine Windows, then resets to all eight.
3. **Equal-price ties:** removed the unrequested stable ordering condition; both price directions remain required.
4. **Observed local API:** replay follows the actual browser-observed local server URL/origin/credentials instead of imposing same-origin targets on a permitted local topology.
5. **Restart coverage:** setup explicitly records all13 current variant stocks, including zero, before the real process restart. The comparison already existed but an incomplete setup could miss reset stock elsewhere.
6. **Final cleanup:** a server ignoring SIGTERM could leave test.sh blocked in its EXIT wait even after writing reward. Bounded TERM/KILL cleanup now stops resistant parents/children, preserves existing reward and original exit status. Generated restart helper and canonical scoring/MCP Python are unchanged.

## Validation

| Check | Result |
| --- | --- |
| Complete quality review | {'Pass': 45, 'Note': 8} across53 entries |
| Documented deterministic procedures | {'NOTE': 10, 'PASS': 34, 'N-A': 4} across48 local/manual equivalents |
| Final source / extracted-source assertions | 89/89 each |
| Fresh golden browser groups | 8/8,76 real key events,zero page errors |
| Fresh cleanup / orchestration cases | 7/7 and4/4 |
| Independent monetary cases / stock transitions | 20/20 and16/16 |
| Actual final images | Exact12 public inputs and15 verifier files;Chromium152.0.7977.8 |
| Golden identity and criterion map | All19 files unchanged;all37 criteria mapped |

Read the [semantic review](SEMANTIC_REVIEW.md), [golden report](golden/GOLDEN_SECOND_RECHECK.md), [harness review](harness/HARNESS_REVIEW.md), [full findings](qc_final_findings.json) and [client-safe workbook](QC_FINAL.xlsx). The fresh browser chain also covers clean-context server reads, blank-address refusal, collection checkout/cancellation and a lost response followed by cancellation from another visitor before recovery. Earlier unchanged commerce/installer/presentation observations, five restart lifecycle controls and twenty canonical scorer inputs are explicitly reused, not newly rerun. The retained actual restart proof records all13 stock quantities and changed process identity.

## Limits and score effect

The eight quality Notes cover full paid timing, aesthetic/Oracle assignment, legitimate random references/times, provider execution, browser-only architecture/photo identity, finite anti-mock coverage, empirical ranking and remote reproducibility. The private checker executables are unavailable; this applies their documented procedures locally. No complete paid Oracle/model run occurred. Synthetic reward0.64 fixtures test plumbing only.

Weights and60/20/20 policy are unchanged. Added paper coverage has0.001714 reward mass; keyboard checks strengthen existing Polish outcomes. Correcting unsupported tie/origin restrictions can restore deserved credit, while explicit all-stock restart can remove false credit. With passed gates and full presentation, failing the nine high-weight transactional/adversarial criteria while passing the remaining Functional checks would give about0.606. That is a scenario calculation, not a model forecast. Actual Oracle1.0 and model0.1-0.7 remain measurement targets.

The harness review also identified the same old cleanup pattern in the separate Colderwater candidate. This Ridgeline review does not modify or validate that candidate's cleanup; its existing ZIP/hash remains unchanged and that cross-task follow-up is recorded explicitly. No paid call, upload, commit or push was made.
