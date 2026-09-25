A cribbage hand of `5♠ 5♥ 5♦ J♣` with a cut of `5♣` scores twenty-nine, and no web version I have tried gets there. I want a board that counts right.

Two players, six cards each, two apiece into a crib that belongs to the dealer. Then the play to thirty-one — fifteens, pairs, runs and the last card — and when neither can lay the count resets and the other leads. Then the show, in that order: non-dealer, dealer, crib. That is one hand; a game is as many as it takes, the deal alternating and the scores carrying, with the counting left on screen until the next hand is asked for. First to a hundred and twenty-one wins and it stops there, mid-street if that is where it lands, on the target and never past it.

A hand counts the same however the cards arrive, and one card can be in a run, a pair and a fifteen at once, counting in all three. The cut counts in both hands and the crib; only the crib's flush needs all five suits to match.

A dozen hands to reach a hundred and twenty-one, so let me start one near the target — we practise finishes on club night.

Read `/assets/club/README.md`, `/assets/club/house-rules.md`,
`/assets/club/scored-hands.js` and `/assets/club/practice-deals.json` for the rest.
Those forty scored hands are our reference examples; let me try them at a visible
scoring bench as well as play full games. Fixed practice deals let us repeat a
disputed count. Load `/assets/club/records/gambit_seed_data.json` as the ladder.

Put the app in `/app`, start it with `node serve.js` on port 3000 and keep games
in SQLite. Please read the club notes before building the table.

A game must survive a reload with the crib, the cut, the pegs and whose turn it is intact.

Read `/assets/club/recovery.md` too: we keep several games open, practise
complete matches, and need moves to survive interrupted saves and stale tabs.

Before handing it over, try the actual page in a browser: start a game at zero,
discard two cards for each seat, and play a legal card. Reload, reopen that game,
and play the next card. Make sure the cards and controls work throughout, and
fix any browser errors you encounter. Browser-testing tools are provided in
the development image; the club notes explain how to use them.
