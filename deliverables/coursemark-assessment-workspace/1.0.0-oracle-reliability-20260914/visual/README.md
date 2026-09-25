Golden presentation fixes for the current Oracle-reliability revision.

- Mobile header and navigation occupy 185px at 375px, down from 256px in the prior rendered baseline. All five navigation buttons remain visible, untruncated and 48px high.
- Courses uses the available desktop canvas with a course summary and the assessment schedule already available to the signed-in account.
- Attempt IDs retain exact content but use a separate, wrapping metadata line; names and statuses use normal capitalization.
- Disabled buttons have an explicit readable foreground/background instead of opacity. The submitted status uses a darker amber.
- Mobile batch-release actions wrap as whole controls, preserving complete labels. Worksheet score and feedback share a row, putting both rubric rows and Save selected grades in the 375px viewport.
- Golden app.js changes only render presentation; stylesheet changes preserve element IDs, control labels, events and runtime behavior.

Validation: 36 rendered screenshots (the original 34 surfaces plus two actual generated-attempt-ID screens); all five workspace views checked at 320, 375, 768, 1024 and 1280px for horizontal page overflow. Navigation bounds, label fit and mobile target heights pass. Used a fresh isolated container from cached coursemark-tests:1.0.17 without network. This is presentation evidence, not a Visual judge score or Oracle acceptance result.

See verification.json for source hashes, responsive-observations.json for measurements and visual-review/ for screenshots.
