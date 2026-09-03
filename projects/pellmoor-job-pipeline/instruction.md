I want our hiring off paper, and the first thing it has to enforce is that nobody jumps a stage.

A candidate moves applied, screening, interview, offer, hired, in that order. Back one stage is fine and happens whenever an interview falls through; back further is not. Rejected and withdrawn are the end of it.

I want a vacancy view with the candidates by stage, a candidate view with their panel, their scores and their notes, and a funnel showing where people are lost — how many reached each stage and how many left at it. Draw the funnel with d3, worked out from where candidates are and where they have been rather than from a count anybody stores.

The paperwork is in `/recruitment`. `hosting-note.txt` fixes where the app goes, what to build it with and how it starts. `interview-policy.docx` carries the stage, panel and scoring rules, and it wins if it disagrees with the note. `vacancies.xlsx` is the pipeline as it stands, with a tab where the joiner funnel is worked out by hand — a chart that disagrees with that tab is wrong. `records/pellmoor_seed_data.json` is the seed; load it exactly, because the paper file quotes those ids.

Sign-in is required; the demo accounts and their password are at the bottom of the hosting note, and what each role may do is in the policy. A vacancy nobody has applied to yet should say so rather than drawing an empty chart.
