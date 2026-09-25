from pathlib import Path
import re

base = Path('projects/gambit-hollow-cribbage/tests')
p = base/'functional/judge.toml'
s = p.read_text(encoding='utf-8')
s = s.replace('The visible saved-game chooser must not offer that incomplete historical summary as a playable saved game.', 'Historical summaries may be on a separate read route documented in APP_MANIFEST.md; inspect that route if they are absent from the playable list. Absence from the resume chooser is not missing seed storage. The chooser must not offer the incomplete historical summary as playable.')
s = s.replace("Try cut before either discard, discard A twice, and a B play while it is A's turn. For each use an observed route/shape, require controlled refusal and fresh unchanged game/ladder state.", "Require no cut reveal or heels award before both discards. If cutting is a separate observed action, test its premature server refusal; if cutting is automatic, inspect before/after each discard instead. Also try discarding A twice and a B play while it is A's turn, using fresh request identities and the current revision. Both invalid actions must refuse with unchanged fresh game/ladder reads.")
s = s.replace('Count through the visible show control.', 'Observe the automatically counted show, or use its visible control if supplied.')
s = s.replace('ending pegging at A=19/B=8, count 0 and show.', 'ending pegging at A=19/B=8 and proceeding to the show. The final count may remain visible or clear to zero.')
s = s.replace('the documented default SQLite path /app/gambit.db and support for DB_PATH relocation, and main read/scoring/game-action routes', 'the documented default SQLite path /app/gambit.db and main read/scoring/game-action routes')
s = s.replace('Do not fail a supported relocation because no database was created at the default path.', 'Do not require DB_PATH wording in the manifest or fail a supported relocation because no database was created at the default path. Require the newly documented revision/action-identifier contract and historical-summary route to agree with actual requests and responses.')
s = s.replace('then replay the captured winning play and try a later ordinary game action', 'then submit the winning play again with a NEW action identifier and current revision and try a later ordinary game action')
s = s.replace('Replay that captured cut, then reload:', 'Submit that cut as a new action with a fresh identifier and current revision, then reload:')
s = s.replace('No manual point claim or illegal over-31 move is needed to trigger go.', 'A labelled Go control is allowed when no legal card remains; it must not require manual point claims or an illegal over-31 move.')

criteria = [
('complete_club_match',2,'''Setup: start Club night - complete match at 0/0. Follow recovery.md and the supplied rounds. Each hand's preset a cards belong to its current dealer; b cards belong to its non-dealer. Keep the first four, discard the last two. Use the round sequences in the prompt, swapping actors when B deals.
Play all seven hands through the visible UI until the win. Require stable game/member identity, exact deals and cut for every round, alternating dealer, correct pegging/show checkpoints and carried scores. After each completed hand scores A/B are 7/9,25/42,51/53,60/61,82/70,91/77,121/95. Hand seven reaches 120/95 after dealer's show, then stops at 121 in the crib. Preserve the show until Next hand. No manual score edits or injected game state. Starting at zero is required; a near-target substitute does not establish a complete match. The ladder changes only once at the terminal hand, with both played counts +1 and only A's won count +1; historical records and other games remain unchanged.'''),
('one_player_exhausted_pegging',1,'''Setup: start One hand runs out first at 0/0, discard the last two per seat and cut 9S. Play B:AS,A:TS,B:2H,A:JH,B:3D,B:4C,A:QD,A:KC.
At count 26 A cannot lay but B can: B plays again. At 30 B receives exactly one go point and the count resets. B is out of cards, so A's QD and KC must both work without requiring a card from B. Final pegging is A=1/B=1, then show totals non-dealer 8, dealer 5, crib 2 yield A=8/B=9. No skipped remaining card, duplicate go or deadlocked turn. A labelled Go acknowledgement is allowed where no legal card remains.'''),
('last_card_thirty_one',1,'''Setup: start Thirty-one on the last card at 0/0, discard the last two per seat and cut QC. Play B:5S,A:6H,B:TD,A:TC,B:8S,A:9H,B:7D,A:7C.
The first TC gives A four points (pair and 31) and resets the count with B leading. B's 7D gives three for the 8-9-7 run. The final 7C gives A four (pair and 31), ending pegging A=8/B=3 with no extra last-card/go point. The ordered show totals 6,2,12 yield A=22/B=9. Inspect scoring reasons and fresh server states, not merely a scorer simulation.'''),
('independent_saved_games',1,'''Setup: create two distinct zero-score games with the same members: P and Pairs. Record both identities and both seat views. Discard in P, play Pairs to count 15, reopen P from the chooser, then switch back.
Each game retains its own cards, cut, pile, scores, phase, dealer, revision and turn. An action in either changes only that game's revision/state, not its sibling or ladder. Finish one separate near-target game for the same members; it updates the ladder exactly once without changing either unfinished snapshot. Both unfinished games remain resumable and playable.'''),
('stale_tabs_and_revisions',2,'''Setup: open the same fresh P game in two independent pages at revision 0. In page one accept A's discard. In page two, still showing revision 0, submit B's otherwise legal discard.
The stale action must be refused server-side with no changes to game, revision or ladder. The stale page must explain and refresh to the latest saved state without silently applying its old action. Selecting and submitting B's discard again from the updated view succeeds exactly once. Creation revision is 0; each accepted mutation increments it by exactly one, independently per game. Using an observed action shape with a fresh identifier, also omit the revision, supply a non-integer revision, and supply the previous revision: each refuses unchanged. Preserve a valid-action positive control. Adapt field/header names to the documented actual contract.'''),
('durable_creation_identity',2,'''Setup: capture a real successful UI create request, including its action identifier and input; record the original status, game identity and creation response. Repeat that exact request twice through the browser request context.
Both retries return the same original acceptance and game identity; only one game was created and no ladder counters changed. Now independently start a second game through the UI with identical players/settings: it must have a new action identifier and a different game identity. Preserve the first captured request for recovery_phase_matrix's restart probe. Do not award a pass for suppressing all future games with the same settings.'''),
('accepted_action_replay',2,'''Setup: in fresh P capture a successful A-discard request and its acceptance, then accept B's discard using the current revision. Replay the exact first request with its original identifier, input and older revision.
Return its original acceptance without another mutation or revision increment; fresh reads still show both discards. Repeat with a winning action in a separate near-target game: exact retries return its original acceptance with no extra points, finished summary or ladder increment. A genuinely new post-terminal action must still refuse. Preserve the winning request and result for recovery_phase_matrix's restart probe. Receipt equality means stable original game/acceptance data; incidental transport headers are not compared.'''),
('accepted_identifier_binding',1,'''Setup: retain an accepted request from your own game. Reuse its identifier with changed card input, then with another existing game as target, and then with a different observed action route. Keep other metadata appropriate to each probe.
All three must return a controlled refusal, not apply a new action or return another game's success. Fresh reads of both games, revisions and ladder remain unchanged. An identical original retry still returns its original acceptance afterward, and a valid new action with a new identifier still works. Only the accepted identity is bound; do not demand a particular policy for identifiers on previously rejected requests.'''),
('lost_response_retry_ui',2,'''Setup: use a fresh P game and a real UI discard. With browser network interception, forward this exact request to the actual server once, record its successful response, then abort delivery to the page. Do not fabricate a server success or change request fields.
The UI must show that save confirmation is missing and offer a labelled safe retry without allowing further game moves. Record the accepted server state and revision. Reload the page, then use the retry control: it sends the original identifier, payload and expected revision, confirms the same acceptance and does not apply the discard twice. Read the latest table after confirmation. For the stale-receipt case, accept the other seat's discard from another page before retrying: the recovered page must display the latest two-discard state, not roll back to the earlier receipt. Valid play remains possible after recovery. If interception failed to forward/abort as specified, record a setup error and repeat once; never retry a demonstrated app defect into a pass.'''),
('recovery_phase_matrix',2,'''Setup: prepare separate games paused after one discard; both discards (automatic cut is allowed); a go/reset; and the completed show before Next hand. Also retain a finished game, the accepted create and winning-action requests from the replay checks, and a Club night series paused between hands. Record both seat-filtered states for every game, revisions, ladder, summaries and all identities. If a prerequisite capture is unavailable, build your own independent valid case rather than inheriting another criterion's failure.
Reload/reopen the unfinished games through their chooser and compare every saved phase, cards, privacy, count, turn, score and revision. Use bash /tests/app-lifecycle.sh restart once for this matrix, without reseeding or edits. Reopen and compare again; finished results/counters and all unrelated games remain unchanged. Retry the captured create and winning action with their exact original identities after restart: original acceptance, no duplicates. Continue one legal action in each unfinished game; the series must deal its next prescribed round with the correct alternating dealer. Compare relative current baselines and ignore incidental timestamps. This is a real process restart, not merely page reload.'''),
]
for id,weight,description in criteria:
    s += f'\n[[criterion]]\nid = "{id}"\nname = "{id}"\ntype = "binary"\nweight = {weight:.1f}\ndescription = """\n{description}\n"""\n'
p.write_text(s,encoding='utf-8',newline='\n')

protocol = '''Read /assets/club/recovery.md and the permitted /app/APP_MANIFEST.md before
game probes. Discover the submitted browser's actual revision and action-identity
fields from real requests; no particular header or route names are required.
Use the UI for successful game setup. For a new direct invalid-action probe,
use a fresh action identity and the currently observed game revision unless the
criterion specifically tests stale/missing revisions or exact retries. This
avoids confusing an old acceptance receipt with acceptance of a new illegal move.
An exact accepted-request retry returns its original acceptance; a new illegal
post-terminal action still refuses. Fresh reads establish whether state changed.
Automatic cut/show and labelled Go controls are allowed as recovery.md describes.
Judge their ordering and outcomes, not the presence of a separate action route.
'''
p=base/'functional/prompt.md';s=p.read_text(encoding='utf-8')
s=s.replace('Captured real request replays are\nallowed only for specified invalid/out-of-turn/post-terminal checks.', 'Captured real requests may be replayed for the explicitly specified invalid-action, revision, identity and recovery checks.')
s=s.replace('Read /assets/club/scored-hands.js',protocol+'\nRead /assets/club/scored-hands.js')
s=s.replace('before\nthe next irreversible action.', 'before\nthe next irreversible action.')
s=s.replace('Only that final\ncriterion may use bash /tests/app-lifecycle.sh restart;', 'Only recovery_phase_matrix (one restart) and final_restart_persistence (two restarts)\nmay use bash /tests/app-lifecycle.sh restart;')
s=s.replace('then Count the show.', 'then observe the automatic show or use its visible control.')
journeys='''
Complete-match round sequences, written for dealer A / non-dealer B:
pegging: B:5S,A:7H,B:6H,A:TH,B:AC,A:2S,B:9D,A:3S.
pairs: B:5S,A:5H,B:5D,A:5C,B:2H,A:2S,B:3H,A:3S.
go: B:TH,A:TS,B:9H,A:9S,B:8H,A:8S,B:7H,A:7S.
tail: B:AS,A:TS,B:2H,A:JH,B:3D,B:4C,A:QD,A:KC.
last31: B:5S,A:6H,B:TD,A:TC,B:8S,A:9H,B:7D,A:7C.
When B deals, swap A/B actors and card ownership. Local dealer/non-dealer
pegging increments are respectively 3/3,19/8,8/1,1/1,8/3.
Ordered show totals (non-dealer,dealer,crib) are respectively
6/4/0,10/10/4,10/11/7,8/5/2,6/2/12. Scores cap at 121 immediately.
Keep compact per-hand checkpoints instead of dumping the full DOM after every
move. Use batches of sequential real Playwright interactions with checks after
each mutation; do not replace required UI play with backend state injection.
Budget guide within 9000 seconds: shared setup and discovery 600, scoring and
existing game checks 3000, complete match and new pegging 1800, replay/stale/UI
recovery 1800, restart matrix/final persistence 900, reporting reserve 900.
These are planning allowances, not independent deadlines or permission to skip
criteria. Continue independent checks after failures and report missing evidence.

'''
s=s.replace('{criteria}',journeys+'{criteria}');p.write_text(s,encoding='utf-8',newline='\n')

p=base/'polish/judge.toml';s=p.read_text(encoding='utf-8')
s=s.replace('for starting, choosing cards, discarding, cutting and counting.', 'for starting, choosing cards, discarding and any supplied cut/count controls. Automatic cutting/counting does not require an additional manual button.')
s=s.replace('Browser network delay may hold one observed request pending, but do not alter its payload or fabricate success.', 'Hold the first real game POST pending with browser network interception, confirm it is still pending, then attempt repeated mouse and keyboard activation before releasing it. Record request/response timing, accepted game IDs and observed busy state. Two clicks after separate completed saves do not test this requirement. Do not alter payloads or fabricate success. If the first request was never held, that is a setup error, not proof of a duplicate-action defect.')
p.write_text(s,encoding='utf-8',newline='\n')
for dim,rev in [('render',5),('constraints',4),('functional',6),('polish',6),('visual',5)]:
    p=base/dim/'prompt.md';s=p.read_text(encoding='utf-8')
    s=re.sub(r'(Prompt version: gambit-hollow-cribbage-'+dim+r'-v1\.0\.0-r)\d+',rf'\g<1>{rev}',s)
    if dim!='functional':
        s=s.replace('{criteria}','The brief allows automatic cut/show and a labelled Go control. Use the actual\nUI flow; a separate cut or Count the show button is not required. Game saves\nnow carry revision/action identifiers; use the normal UI so its own metadata\nis sent. Only Functional grades stale requests and durable receipt correctness.\n\n{criteria}')
        s=s.replace('then Count the show.', 'then observe the automatic show or use its supplied control.')
    p.write_text(s,encoding='utf-8',newline='\n')
