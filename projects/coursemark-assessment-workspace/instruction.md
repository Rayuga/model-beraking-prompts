# University assessment workspace

I’m looking for a web app that handles the assessment lifecycle for a university course — not a static LMS mockup. It should have persistent course records, real authentication, and clear boundaries between students and teaching staff.

Students need access to their own courses, eligible assessments, timed attempts, saved answers, and released feedback. Instructors manage assessments, rubric grading, result release, and course progress. Teaching assistants can grade submissions assigned to them, but they cannot publish assessments or release grades. Organize the work across courses, assessments, attempts, a gradebook, and an audit view without exposing one student’s work to another.

Timing, accommodations, scoring, grading, release, and permission rules are in `/assets/artifacts/coursemark_rules.md`; use `/assets/artifacts/coursemark_seed.json` for the starting records.

For demo access, all accounts use `Coursemark!2026`: `ada.mensah@coursemark.example` is the Instructor, `luis.ortega@coursemark.example` is the Teaching assistant, and `nora.kim@coursemark.example` plus `ben.okafor@coursemark.example` are Students. Show the current identity and role after sign-in.

Keep the implementation in `/app` with Node.js, Express, and SQLite. Run `node /app/server.js` on port `3000`, serve `/app/public/index.html`, expose `GET /api/health`, and persist to `/app/coursemark.db`. The browser should not rely on external assets or runtime installation.
