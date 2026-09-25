A cribbage hand of `5♠ 5♥ 5♦ J♣` with a cut of `5♣` scores twenty-nine, and no web version I have tried gets there. I want a board that counts right.

Two players, six cards each, two apiece into a crib that belongs to the dealer. Then the play to thirty-one — fifteens, pairs, runs and the last card — and when neither can lay the count resets and the other leads. Then the show, in that order: non-dealer, dealer, crib. That is one hand; a game is as many as it takes, the deal alternating and the scores carrying, with the counting left on screen until the next hand is asked for. First to a hundred and twenty-one wins and it stops there, mid-street if that is where it lands, on the target and never past it.

A hand counts the same however the cards arrive, and one card can be in a run, a pair and a fifteen at once, counting in all three. The cut belongs to every hand at the show, and to the crib only if it suits.

A dozen hands to reach a hundred and twenty-one, so let me start one near the target — we practise finishes on club night.

`club/` has the rest. `README.md` is where our machine runs. `scored-hands.js` is forty hands with their totals and the rule each catches — your scorer must agree with every line, and that is the first thing I will check. `house-rules.md` settles muggins, the go and a tie. `records/gambit_seed_data.json` is the club ladder to load.

A game must survive a reload with the crib, the cut, the pegs and whose turn it is intact.
