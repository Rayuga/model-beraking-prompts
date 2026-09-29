# Colderwater score expectations

No paid Oracle or target-model evaluation has been run for this candidate. There are no Colderwater model runs in the supplied run-outputs directory. The values below are conditional arithmetic and an explicitly provisional planning estimate, not observed model results.

The configured judge is the `claude-code` runner with `z-ai/glm-5.3-flashx`. The supplied target builder in the current standards is `gpt-5.6-luna`. Do not confuse the runner's name with the judge model or silently replace either model.

With both gates passed and Functional strictly above 0.05, the score is `0.6F + 0.2P + 0.2V`. Visual raw anchors are first normalized by RewardKit: `(raw - 1) / 4`.

| Functional | Full Polish and Visual | Polish and Visual both 0.75 |
| ---: | ---: | ---: |
| 0.25 | 0.55 | 0.45 |
| 0.40 | 0.64 | 0.54 |
| 0.50 | 0.70 | 0.60 |
| 0.60 | 0.76 | 0.66 |
| 1.00 | 1.00 | 0.90 |

Either failed gate, or Functional at or below 0.05, produces zero. Therefore a nonzero 0.1-0.4 score is incompatible with full presentation credit under this policy. We cannot promise that every builder lands between 0.1 and 0.7: a broken app legitimately scores zero, while a strong implementation can exceed 0.7.

My provisional planning estimate is roughly **0.55-0.75 for a functioning submission that passes both gates**. This assumes straightforward presentation passes and partial success on the difficult runtime/library work; it is not a calibrated probability interval. A conventional implementation may miss shared callback budgets, exact asynchronous error lines and rollback, stale rename/delete safeguards, imported-source non-execution or compound persistence/recovery behavior. An implementation that handles these well can exceed this estimate. A model run is required before changing difficulty on the basis of a claimed measured score.

For the golden, local runtime observations and rebuilt presentation support the intent of full credit, but they cannot establish that the actual judge will assign every binary pass and six raw-5 visual anchors. A single visual criterion at raw 4 instead of 5 reduces an otherwise perfect final score by about 0.0083. Tool/setup failures, judge interpretation and full-suite timing must be assessed through a real Oracle run. Synthetic all-one scorer inputs are deliberately labelled as arithmetic tests, not Oracle 1.0.

The functional weight remains 49.5. Removing the unrequested supersession notice restores fair credit; the new bounded confidentiality check, actual debounce-reset observation and CSS handler-isolation probe retain meaningful difficulty. See the separate contract/delta review for weight-change bounds. Fixing a false negative is not evidence that the target model will gain that credit.
