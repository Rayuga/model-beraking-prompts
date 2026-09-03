# Interface, accessibility and presentation

Use one coherent arcade theme with a responsive canvas, crisp bricks, visible
damage, distinct solid bricks, readable balls and paddle, restrained effects,
and clear start, pause, life-loss, level-complete and game-over treatments.

Keep essential state outside the canvas in ordinary DOM: player identity,
score, lives, level, combo, active power-up and timer, status, controls, unlocked
level choice, revision/sync status, mechanics lab, run history and leaderboard.
Maintain a concise visible event message and recent list for sign-in, launch,
pause, paddle/brick contact, collection, life loss, unlock, lab and terminal state.
Give the focusable canvas an accessible name that summarizes the current state,
and keep the keyboard shortcuts visible.

At 375 pixels wide, sign-in, canvas, HUD, controls and leaderboard must remain
usable without horizontal page scrolling, overlapping text or clipped actions.
Provide strong focus states, keyboard-operable controls, touch-sized targets,
materially reduced animation/transition durations and enough non-color
information to distinguish brick and power-up states. Keep the visible Assist
paddle state clear to both sighted and assistive-technology users.
