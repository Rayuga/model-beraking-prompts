from pathlib import Path
import json, re, tomllib

ROOT=Path(__file__).resolve().parents[3]
TASK=ROOT/'projects/gambit-hollow-cribbage'
OUT=Path(__file__).resolve().parent
p=TASK/'tests/functional/judge.toml'
old=tomllib.loads(p.read_text(encoding='utf-8'))
changes={
'the_twenty_nine_hand':'''Setup: at the visible hand-scoring bench enter 5S 5H 5D JC, cut 5C, hand mode.
1. Submit through the UI and observe the real local scorer response and rendered result.
2. Require total 29, with fifteens 16, pairs 12, runs 0, flush 0 and nobs 1. A displayed constant without a matching working scorer does not establish this observation.''',
'the_app_agrees_with_the_supplied_fixture':'''Setup: discover the actual scorer request from a successful visible bench submission. Read all forty supplied records from /assets/club/scored-hands.js.
1. Submit every record with its four cards, cut and hand/crib mode. All forty totals must equal the supplied totals. Preserve a compact table of input, expected and observed result.
2. Inspect representative maximum, zero, overlapping-run and crib-flush records through the visible bench too. Batched requests are permitted only after discovery; they may calculate scores but never create or modify games. Eight examples alone do not satisfy this criterion.''',
'a_card_counts_in_every_combination':'''Setup: score 4S 5H 5D 6C with cut 9C as a hand through the bench.
Require total 14 with fifteens 6, pairs 2 and runs 6, flush/nobs 0. The duplicated fives participate in both fifteens and both three-card runs as well as their pair; no card is consumed by one scoring category.''',
'the_crib_flush_needs_five':'''Setup: score 2S 5S 8S KS, cut 9H, through the bench in hand mode and then crib mode.
Require hand total 8, including flush 4 and fifteens 4; crib total 4, with flush 0 and fifteens 4. Preserve each separate result before switching mode.''',
'a_five_card_flush_counts_in_both':'''Setup: score 2S 5S 8S KS with cut 9S as both a hand and a crib.
Each result must be 9, with flush 5 and fifteens 4. Check both mode submissions; do not infer the crib answer from the hand result.''',
'the_ace_is_low_and_does_not_wrap':'''Setup: use the scoring bench for these independent hand-mode examples.
1. AS 2H 3D JC, cut KC: total 8, runs 3, fifteens 4 and nobs 1.
2. JS QH KD AC, cut 2C: total 3, runs 3; the ace cannot extend J-Q-K around the top.''',
'nobs_needs_the_matching_suit':'''Setup: score JS 2H 4D 8C with cut 9S, then change only JS to JH.
Require first total 3 with nobs 1 and fifteens 2, then total 2 with nobs 0 and fifteens 2. Observe each live result.''',
'fifteen_in_the_play_is_two':'''Setup: use the named Fifteens, runs and thirty-one practice, both starting scores 0; discard each seat's last two listed cards and cut.
1. In a fresh such game play B:5S then A:TH. Require count 15 and exactly +2 to A, with a fifteen explanation.
2. In the separate zero-score P journey defined in the prompt, A:2S takes the count from 29 to 31. Require exactly +2 to A, reset to 0, B leading and no extra go point. These observations must come from actual game moves, not just the scoring bench.''',
'a_run_in_the_play_need_not_be_in_order':'''Setup: use the zero-score P journey in the prompt.
After B:5S, A:7H, B:6H, require count 18 and exactly +3 to B for the 5-7-6 run, with A still 0. Observe the score and explanation immediately after the third move.''',
'the_count_cannot_pass_thirty_one':'''Setup: in P play B:5S, A:7H, B:6H, A:TH to reach 28, with B to act and 9D still held.
1. Try B:9D through the visible card control if enabled; require refusal in words. A disabled card with a visible explanation of the count limit is also a valid UI refusal.
2. Using the actual observed play route and shape, submit that same B:9D request directly from the browser. Require a controlled refusal and a fresh unchanged game read, including count 28, hands/laid cards, turn and scores. The valid following B:AC must still work. A toast alone without server nonmutation is insufficient.''',
'a_hand_that_is_not_a_hand_is_refused':'''Setup: first establish a valid bench result. Use its actual scorer route/shape for malformed cases that the UI cannot express.
Independently submit a non-card ZZ, only three hand cards, a repeated physical card, a null hand-card entry and a missing/invalid cut. Each must return a controlled refusal with a reason, not a total or an unhandled server error. A subsequent valid hand must still score. Submitted fields may follow the app's own schema; test invalid card content rather than golden-only JSON names.''',
'two_cards_each_go_to_the_crib':'''Setup: start your own zero-score named P practice, dealer A. Before discarding, view each seat through the actual switcher.
1. Each receives the six supplied cards, not a reshuffle.
2. Discard 4S and 6D from A and 8C and KD from B. Each retains exactly its first four supplied cards, crib has four and belongs to A.
3. Cut only after both discards; require the preset QC and B to lead. Capture seat-filtered before/after states through real UI requests.''',
'the_crib_is_hidden_until_the_show':'''Setup: use your own P game before discards and then after both discards, before cut/play.
1. In each seat view, the other seat's unplayed cards are face down; the response does not contain those card identities, stock or hidden crib contributions in any field. Laid public cards and one's own discards are allowed.
2. After discards, A may know 4S/6D and B may know 8C/KD; neither seat response reveals the other's contribution before it is shown. Inspect both actual seat responses, not merely hidden DOM.
3. Continue that game through the show and require the counted crib to reveal its four cards with its breakdown. This is a deliberate shared seat switcher, not an account-authentication boundary; do not demand passwords or forbid switching seats.''',
'moves_out_of_order_are_refused':'''Setup: create a fresh P game. Discover action shapes from successful UI requests on your own games.
Try cut before either discard, discard A twice, and a B play while it is A's turn. For each use an observed route/shape, require controlled refusal and fresh unchanged game/ladder state. Establish the invalid precondition first; do not test against a game already moved past it. Keep positive controls: each first valid discard and an in-turn play must work. UI-disabled actions alone do not establish server refusal.''',
'the_show_counts_in_order':'''Setup: complete zero-score P's eight moves in the prompt; pegging ends with A=3, B=3.
Count through the visible show control. Require separately labelled entries in order non-dealer B (6), dealer A (4), crib A (0), each with its own cards and scoring breakdown. Final scores are A=7, B=9 and phase is between hands. The application may reveal all three ordered entries in one action or step through them. Keep the entries visible until the next hand is requested.''',
'the_game_stops_at_the_target':'''Setup: start P through the visible practice controls with A=120, B=0, discard and cut normally.
Play B:5S then A:TH. The fifteen awards two but A must stop at exactly 121, B=0, with a named winner/game-over state immediately, no further cards or show. Record game and ladder, then replay the captured winning play and try a later ordinary game action with the observed route/shape. Both refuse without another state/counter change; reload preserves the result. Do not play from zero or rely on a random near-finish deal.''',
'a_game_is_a_sequence_of_hands':'''Setup: complete zero-score P through all three show entries, using the exact P sequence in the prompt.
1. A=7/B=9 is between hands, not game over; show remains visible until Next hand.
2. Request the next hand once. Preserve the same game identity and scores, increment hand number to 2, deal six cards each and clear only the previous hand's cut, crib, pile, count, laid cards and show. The game continues until a player reaches 121.''',
'the_deal_alternates_between_hands':'''Setup: use a completed zero-score P hand with dealer A and record its scores.
Next hand makes B dealer, A the next play leader and B owner of the crib; show the hand number and dealer clearly. Play that ordinary hand to its show using legal visible cards, then request the following hand: dealer returns to A and hand number becomes 3. Judge alternation and stable seat ownership independently of the prior criterion's exact P totals.''',
'a_game_survives_a_reload':'''Setup: create P, complete both discards, cut and play B:5S, A:7H, B:6H. Record game identity, both seat views, crib/own discards, cut QC, laid cards, count 18, scores A=0/B=3, next turn A and hand number 1.
Reload, then use the saved-game chooser in a fresh browser context without the original URL hash/storage to reopen that game. Both seat views must match the saved snapshot, including hidden-card boundaries, and the pegs/turn must agree. Continue with A:TH to prove the saved game is playable, not a static snapshot. Do not require the original browser's chosen seat to transfer to a new device.''',
'the_ladder_updates_when_a_game_ends':'''Setup: record the two chosen players' actual played/won counts and existing game summaries. Start His heels finish with A=120/B=113, perform both discards and cut JC.
A wins immediately at 121. Both players' played counts increment once; only A's member won count increments once. One finished game summary records the correct members/scores. Replay that captured cut, then reload: no second counter increment or summary. Use relative baselines so prior games do not invalidate the result. Inspect server results as well as the visible ladder.''',
}
extras=[
('seed_ladder_import',1.0,'''Setup: before any dimension finishes a game, read the supplied records file and open the ladder.
Require all five members with exact stored member numbers, names, played/won counts and all three original game summaries, including unfinished G-1183 with no resumable deal. New games created by other dimensions are allowed; do not require the whole database to contain only seed rows. The visible saved-game chooser must not offer that incomplete historical summary as a playable saved game.'''),
('hand_order_invariance',1.0,'''Setup: discover the scorer through the visible bench. Use hand-mode fixtures 4S 5H 5D 6C/cut 9C (14) and AS AH 2D 2C/cut 3C (16).
Submit all 24 permutations of each four-card hand with unchanged cut. Every result must retain its expected total and breakdown. Batched discovered scoring requests are allowed; record all 48 outcomes. Do not sort or alter the request before sending it to compensate for an app defect.'''),
('pairs_and_last_card_in_real_play',1.0,'''Setup: start the Pairs and pair royal practice at 0/0; keep the first four cards per seat and cut QC.
Play B:5S,A:5H,B:5D,A:5C,B:2H,A:2S,B:3H,A:3S.
After the second card A has 2 for a pair; after the third B has 8 (fifteen 2 plus three-of-a-kind 6); after the fourth A has 14 (another 12 for four-of-a-kind). The final card gives A 2 for the pair plus exactly 1 last-card point, ending pegging at A=19/B=8, count 0 and show. Capture each checkpoint before continuing; no duplicate last-card bonus.'''),
('go_resets_and_other_player_leads',1.0,'''Setup: start Go and the next lead at 0/0, keep the first four per seat and cut QS.
Play B:TH,A:TS,B:9H. At count 29 neither can lay; require one go point to B, count reset to 0 and A leading, with A=2/B=1. Now A:9S must work. Continue B:8H,A:8S: again neither can lay; A receives pair 2 and go 1, scores A=5/B=1, count 0 and B leading. No manual point claim or illegal over-31 move is needed to trigger go.'''),
('heels_immediate_and_capped',1.0,'''Setup: use His heels finish. In one game start 0/0, discard the last two per seat and cut JC: A receives exactly 2 immediately before any play; no show entry is added. In a separate game start A=120/B=113 and repeat: A finishes at 121/B=113 immediately, before play or show. Later cut/play/show attempts refuse without changing the finished snapshot. Keep those two games distinct.'''),
('show_wins_stop_at_each_boundary',1.0,'''Setup: use three separate Pairs and pair royal practices. In each, discard the last two, cut QC and play B:5S,A:5H,B:5D,A:5C,B:2H,A:2S,B:3H,A:3S. This gives pegging increments A=19/B=8; show totals are non-dealer 10, dealer 10, crib 4.
1. Start A=0/B=104: immediately after non-dealer's count B reaches 121, A remains 19, and no dealer/crib count is awarded.
2. Start A=93/B=0: non-dealer becomes 18; dealer then reaches 121, with no crib count awarded.
3. Start A=89/B=0: dealer is 118 after its hand, then crib reaches exactly 121; B remains 18.
Each result stops at its proper entry and persists after reload; no score exceeds 121. Store checkpoints and judge the three cases independently inside this conjunctive criterion.'''),
('practice_and_scoring_do_not_corrupt_saved_games',1.0,'''Setup: create a normal zero-score game and a named fixed practice through the visible controls. Record current games and ladder.
1. Normal game starts at 0/0 with six distinct cards per seat; practice starts accept supplied integer scores from 0 through 120, uses its specified cards/cut and never reshuffles on reload.
2. Negative, fractional and 121-or-higher starting scores are refused without a new game or ladder change. Use the discovered create request if the UI prevents entry.
3. Submit valid hand/pegging bench experiments and invalid/duplicate card experiments. The recorded saved games and ladder remain unchanged. Valid scoring still works after a refusal. Successful game creation may add a saved game, but bench calculations must not.'''),
('runtime_manifest_routes',1.0,'''Read only /app/APP_MANIFEST.md as permitted runtime documentation. Require a fenced bash start command containing node serve.js, the actual SQLite path /app/gambit.db, and main read/scoring/game-action routes consistent with browser-observed requests. GET /api/health must succeed. Do not inspect implementation source or require golden-only route names for any other endpoint.'''),
('final_restart_persistence',1.0,'''Run this last. Record the current full ladder/game summaries, one unfinished playable game's identity and both seat views, and one already finished game's result. Use only the supplied bash /tests/app-lifecycle.sh restart helper to restart the app process, without reseeding or clearing SQLite.
After readiness, reload and reopen the saved game through its chooser; both seat states and ladder summaries must match. The recorded finished game remains finished with unchanged counters. Repeat the process restart once and require the same records with no seed duplication. Continue one legal action on the unfinished game, proving it remains playable. Compare current baselines, not original seed counts.'''),
]
criteria=[]
for c in old['criterion']:
 c=dict(c);c['description']=changes[c['id']];criteria.append(c)
for id,weight,desc in extras:
 c=dict(id=id,name=id,type='binary',weight=weight,description=desc)
 if id=='seed_ladder_import':criteria.insert(0,c)
 else:criteria.append(c)
def block(c):
 return '\n[[criterion]]\n'+''.join((k+' = """\n'+v.strip()+'\n"""\n') if k=='description' else k+' = '+json.dumps(v)+'\n' for k,v in c.items())
header=p.read_text().split('[[criterion]]')[0]
p.write_text(header+''.join(map(block,criteria)),encoding='utf-8',newline='\n')
(OUT/'criterion-changes.json').write_text(json.dumps({'before':old['criterion'],'after':criteria},indent=2)+'\n')

p=TASK/'tests/functional/prompt.md';text=p.read_text(encoding='utf-8')
text=text.replace('r1\n','r2\n',1).replace('Read /assets/club/scored-hands.js', 'Read /assets/club/scored-hands.js')
text=text.replace('Run seed_ladder_import first.', '''Reusable game journey P:
Start the named Fifteens, runs and thirty-one practice at 0/0 unless a criterion
specifies other scores. A discards 4S/6D; B discards 8C/KD; cut QC.
Play B:5S, A:7H, B:6H, A:TH, B:AC, A:2S, B:9D, A:3S.
Counts after moves are 5,12,18,28,29,0,9,0. B earns 3 for the 5-7-6 run;
A earns 2 at thirty-one and 1 for the last card. Pegging ends A=3/B=3.
Show counts B=6, A=4, crib=0, ending A=7/B=9 between hands.
These exact inputs are supplied test data, not permission to inject state.
Use real visible card controls and the seat switcher, verifying whose turn and
which card before each move. Record compact plain-text/JSON checkpoints before
the next irreversible action. Dialog/response listeners precede the action.
Adapt labels/selectors to the implementation. Named action paths and outcomes
remain required; do not treat an incidental setup click as a separately graded
feature. Stop an invalid setup after two attempts and continue independent
criteria; never manufacture evidence or retry a real app defect into a pass.

One P journey can supply distinct recorded observations for discard, privacy,
run, thirty-one, show and continuation checks; each needs its own evidence and
verdict. If a checkpoint was missed or that game is no longer in its required
phase, create a new independent practice through the UI. Do not combine partial
failed attempts to manufacture one passing journey. Other named practices and
the alternative fifteen/near-finish scenarios use their own games.

Run seed_ladder_import first.''')
text=text.replace('and a working scoring/game surface.', 'and a working scoring/game surface through same-origin game-data requests.')
p.write_text(text,encoding='utf-8',newline='\n')

polish=[
('keyboard_controls_and_focus', '''Setup: use the visible game controls, seat switcher and scoring bench with the keyboard.
Require labels/accessible names for starting, choosing cards, discarding, cutting and counting. Tab/Shift+Tab show visible focus; Enter/Space operate cards and buttons; focus after a card action remains on a useful reachable control. No keyboard trap or unintended game mutation from moving focus. Inspect landmarks/headings where applicable; do not demand a navigation landmark when the app has no navigation.'''),
('responsive_controls_and_reachability', '''Inspect at 1280 by 800 and 375 by 760. Through normal vertical scrolling, reach the board, active hand, crib/play controls, saved-game chooser, bench and ladder. No horizontal page overflow, clipped essential label or inaccessible action. Card controls and touch targets remain practical. Grade reachability/operability, not decorative composition.'''),
('illegal_move_feedback', '''Setup: start P at zero and play B:5S,A:7H,B:6H,A:TH to reach 28 with B to act. Try B:9D or inspect its disabled-state explanation.
Require a visible textual reason for the over-31 refusal, readable/announced feedback and a still-usable table. Valid B:AC afterward must work. Feedback must not depend solely on red colour or a silent disabled button. Observe actual UI outcomes; exact response codes are not prescribed.'''),
('pending_action_and_empty_state', '''Setup: open the root without selecting a saved game, then start your own zero-score game.
The no-game view explains how to begin. During a real pending game save, rapid repeated activation of that same control must not create duplicate accepted actions/games; show a busy/pending state or suppress repeated activation. Browser network delay may hold one observed request pending, but do not alter its payload or fabricate success. Resume/close controls and any supplied panels leave the surrounding table usable. Do not require dialogs the app does not have.'''),
('readable_state_and_reduced_motion', '''Setup: inspect an active zero-score P game, its show and scoring bench, then emulate reduced motion.
Names, active seat, dealer, turn, hand number, cut, count, scores and scoring commentary are available as text alongside the SVG. Bench totals and separate scoring categories remain readable and clearly separate from ranked game points. Show entries remain readable until Next hand. Nonessential motion is reduced or already absent; no information is lost. Grade semantic clarity and motion support, not visual taste or rechecking score arithmetic.'''),
]
p=TASK/'tests/polish/judge.toml';header=p.read_text().split('[[criterion]]')[0]
p.write_text(header+''.join(block(dict(id=id,name=id,type='binary',weight=1.0,description=desc)) for id,desc in polish),encoding='utf-8',newline='\n')
for dim in ('render','constraints','polish','visual'):
 p=TASK/f'tests/{dim}/prompt.md';text=p.read_text(encoding='utf-8').replace('r1\n','r2\n',1)
 text=text.replace('and a working scoring/game surface.', 'and a working scoring/game surface through same-origin game-data requests.')
 if dim in ('polish','visual'):
  text=text.replace('{criteria}', '''For a repeatable nonterminal show, start Fifteens, runs and thirty-one with
both scores zero; discard A:4S/6D and B:8C/KD, then cut. Use visible seat/card
controls for B:5S,A:7H,B:6H,A:TH,B:AC,A:2S,B:9D,A:3S, then Count the show.
These are setup steps; score only the dimension's stated observations. Do not
use a random near-target start or finish a game. Preserve other games.

{criteria}''')
 if dim=='visual':
  text=text.replace('{criteria}', '''Use the stated integer anchors 0 through 5, not fractional raw ratings.
Give an independent verdict and visible evidence for all six criteria. A
missing required surface prevents assuming full credit for that surface;
do not zero unrelated criteria unless the shared browser gate itself fails.

{criteria}''')
 p.write_text(text,encoding='utf-8',newline='\n')

cfg=TASK/'task.toml';text=cfg.read_text();text=text.replace('"authentication", ', '').replace('"concurrency", "idempotency", ', '')
cfg.write_text(text,encoding='utf-8',newline='\n')
# Coverage belongs in author evidence; preserve the inherited map before replacing it.
coverage=TASK/'tests/coverage.json'
(OUT/'inherited-coverage.json').write_bytes(coverage.read_bytes())
coverage.unlink()
redundant=TASK/'tests/assets/records/gambit_seed_data.json'
assert redundant.read_bytes()==(TASK/'tests/assets/club/records/gambit_seed_data.json').read_bytes()
redundant.unlink()
print('29 Functional criteria, five interaction Polish criteria, explicit repeatable journeys and external coverage evidence.')
