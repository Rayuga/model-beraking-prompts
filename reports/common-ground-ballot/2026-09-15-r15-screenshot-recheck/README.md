# Recheck of the three screenshot QC failures

The supplied screenshot shows platform v8 with 36 files and cites criterion
names that are absent from the current r15 ZIP. The actual ZIP has 37 files;
all of its bytes match the frozen and current project files. These three
source defects are already repaired in r15; no task changes or new checksum
were needed for this recheck.

| Reported issue | Verified r15 correction |
| --- | --- |
| Mandatory constraints had no effect on reward | Health and SQLite are independent all_pass gate criteria. Either failure produces final reward 0. Public networking is permitted by the current brief, so the old no-CDN criterion is removed. |
| Unrelated or duplicate observations were combined | Health and SQLite are separate; theme, touch and reduced motion are separate. The duplicate root-load criterion is gone; Render checks six-workspace navigation. |
| Dimension weights conflicted between files | Numeric dimension weights exist only in judge TOMLs. reward.toml declares the named aggregate and composition roles; score.py reads those weights. The runner contains no hardcoded 60/20/20 coefficients. |

The recheck passed 147 standard checks, 400 archive checks and 103 actual
RewardKit/scorer regressions with synthetic criterion verdicts. They include
independent failures for all six criteria relevant to this screenshot.
No platform QC, Oracle or model run was performed by this recheck.

Upload the r15 common-ground-ballot.zip as a new platform task version and run
QC there, followed by Oracle/NOP and then GPT. Use the existing r15 README for
the complete run sequence and clean-build limitations. The screenshot shows
both model and Oracle stages skipped because rubric QC failed; it does not
show a newly evaluated Oracle failure.

ZIP SHA256: `1cfa7ce8f032883e18a54ae2975c0a05cf5cdf18c0381c466372e7f5d4ab99b2`
