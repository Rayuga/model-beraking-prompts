# Frozen r8 golden visual crosscheck

Source: the extracted task from `1.0.0-r8-reliability-20260914`, archive SHA256 `e2cb22b029d958b29bc817003149236a0b0baa51803982fbee1d69ee171c81af`. The source was mounted read-only. No task files were edited during this review.

The browser audit covers 1280 by 800 and 390 by 844, both themes, sign-in, vacancy overview/funnel, candidate details at top and bottom, candidate empty sections, empty vacancy, unselected batch planning at top and bottom, and selected blocked review at top and bottom. The same coverage is captured first with seed records, then with 14 additional notes/activity events and eight additional applicants created through ordinary authenticated application endpoints in the disposable local database. The extra records are authoring stress fixtures, not mutations performed by the Visual judge.

## Evidence and interpretation

The corrected automated audit passed all 88 screenshot views with zero page errors, zero horizontal page overflow and zero clipped batch action areas; measurements are in `results.json`. The authored UI compiles successfully. Successful login, full reload and populated protected reads precede workspace inspection. These bounds/error checks are separate from appearance judgments. The local fixture does not run the complete shared authentication gate; separate crosschecks cover those observations.

Manual inspection found no additional material appearance defect on the sampled rendered surfaces. The existing six anchors are appropriate to the public interface brief:

| Axis | Observed appearance |
| --- | --- |
| Typography | Product/vacancy titles, stage labels, candidate names, counts, panel headings and secondary history use readable, consistent tiers. Phone labels wrap without widening the page. |
| Colour and contrast | Both themes retain legible text, distinct stage/card surfaces and coherent accent/error colours. Disabled confirmation remains visually distinguishable. |
| Spacing and layout | Cards and dialogs use consistent gutters and grouping. The corrected batch footer stays fully inside the dialog with long candidate lists. Candidate notes/activity remain reachable by ordinary scrolling. |
| Hierarchy and scanability | Vacancy selection, capacity, funnel, stage columns and the candidate drawer remain visibly distinct. Batch capacity, eligibility warning, ordered candidates and actions have a clear order. |
| Overall craft | Sign-in, main workspace, empty states, drawer and batch review share the same component treatment. No additional decorative assets or branding are required by the brief. |
| Responsive consistency | Desktop columns adapt to a stacked phone view; the funnel changes its label arrangement and the drawer uses phone width. Theme and hierarchy remain consistent. |

This is a qualitative authoring review, not a fabricated six-axis judge score or a hosted Oracle result. The unchanged anchors should remain in place.

## Scrolling clarification

The frozen r8 Visual rubric already permits ordinary vertical scrolling. Interpret that allowance by inspecting both the top and bottom of long pages, drawers and dialogs before reporting clipping. Content outside the current scrollport, but readable when scrolled into view, is not itself a spacing defect. Visible collisions, content that cannot be reached, and action controls cut off by their container still count as defects. This audit interpretation requires no task edit or replacement ZIP; the existing anchors, weights and required surfaces remain unchanged.

The prior uploaded r7 Oracle spacing deduction was concrete: its negative sticky footer offset clipped the action control. The r8 layout fixes that defect; this review does not dismiss the earlier observation merely because the old dialog scrolled.

## Limits and capture correction

- Tests use cached image `pellmoor-tests:2.0.3` with current frozen golden files copied and built inside it. This is not an exact current verifier-image build or a hosted grading run.
- The first attempt captured dark sign-in too soon after asynchronous Sign out and therefore saved a transient workspace under four sign-in filenames. That capture mistake is preserved in `attempt-1/`, including its original script and results. The corrected script explicitly awaits the visible sign-in surface and allows authored visual transitions to finish. The complete corrected run passed, and all four corrected dark sign-in images were manually inspected: they show the actual readable sign-in form at both required sizes, with a separate Signed out confirmation and no clipping.
- The stress fixture extends notes, activity and applicant lists. It does not reproduce every possible later Functional database state or every assessment-history combination.
- Selected review is truthfully blocked by the existing records, as the Visual prompt explicitly allows. This audit does not assign functional correctness credit or manufacture an eligible review.
- Manual inspection samples the screenshot set; automated bounds/error checks cover every captured view. A fresh Oracle is still required to establish the hosted Visual score.
