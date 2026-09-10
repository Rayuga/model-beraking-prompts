# Physics and controls

Render with `requestAnimationFrame`, but advance gameplay in fixed 1/120-second
steps with a bounded accumulator. Pause freezes simulation time, ball and drop
positions, and every effect timer. A reload restores the saved state without
advancing time spent away.
Use swept/sub-stepped circle collision so a fast ball cannot tunnel through a
brick. Reflect from the face or corner actually struck and damage a breakable
brick at most once per physics step. Paddle impact position steers the outgoing
angle; recent paddle motion adds a smaller horizontal push. Keep balls above a
minimum useful horizontal and vertical component and at or below the level speed cap
so they cannot settle into horizontal or vertical loops. The paused Brick types drill
is the exception: preserve its supplied 1,000-speed ball on load, then apply the
normal cap by the end of its first fixed step; do not clamp the paused fixture.

Pointer, touch, Left and Right move the paddle; every waiting or sticky-held ball
follows it. Space or a visible Launch control starts or releases that ball. `P` or Escape and a
visible control toggle pause; `R` restarts after game over, including from the reloaded menu when the latest personal record is game-over. Losing one ball during multiball continues play;
only losing the last ball costs one life. Provide a visible optional `Assist paddle` toggle that only intercepts incoming balls and reachable items at ordinary control speed.
It must not change physics, scoring, drops, timers, lives or progression; manual pointer, touch or arrow input turns the assist off immediately.
