"""Apply the confirmed QC round r4 fixes to the Kittle task (run from the task folder)."""
import tomllib


def edit(p, pairs):
    s = open(p, encoding='utf8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (p, a[:90])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf8', newline='').write(s)


J = 'tests/scored/functional/judge.toml'
edit(J, [
    # rows 30/31: signed-in successes for mentions and search; matter list replayed too
    ("Part A.\nSign in as gwen@kittle.test and confirm her matter list shows \"Pryce lease dispute\" and \"Pryce will\" and not \"Marsh Holdings acquisition\". While signed in, open M-11 and record the request the page makes to load its messages, open her mentions list and record that request, search for \"Survey\" and record that request, and note the M-11 transcript address (the M-11 transcript opens, as a positive control). Sign out: no matter title, name or message stays visible. Then, signed out, replay each recorded request from the app page and open the M-11 transcript address: none returns any matter, message, mention or name data.",
     "Part A.\nAs harriet@kittle.test post \"@Gwen please check JUDGE-CS0\" in M-11. Then sign in as gwen@kittle.test and confirm her matter list shows \"Pryce lease dispute\" and \"Pryce will\" and not \"Marsh Holdings acquisition\", recording the request that loads the matter list. While signed in, open M-11 and record the request that loads its messages, open her mentions list (it shows JUDGE-CS0) and record that request, search for \"Survey\" (it finds \"Survey booked for Friday.\") and record that request, and note the M-11 transcript address (the transcript opens). These are the positive controls. Sign out: no matter title, name or message stays visible. Then, signed out, replay each recorded request from the app page and open the M-11 transcript address: none returns any matter, message, mention or name data."),
    ("Fails if Gwen's list lacks either of her matters or shows M-12, if anything private remains after sign-out,",
     "Fails if any positive control did not work, if Gwen's list lacks either of her matters or shows M-12, if anything private remains after sign-out,"),
    # row 32: replays use identifiers recorded from someone who can see M-12
    ("Part B.\nAs gwen@kittle.test, post \"Lease question JUDGE-CS1\" in M-11 and record the posting request; it must appear in M-11 (positive control). Replay that request from the app page with M-12 as the target instead, replay the message-loading request with M-12 as the target, and open the M-12 transcript address in Gwen's browser.",
     "Part B.\nAs harriet@kittle.test open M-12 and record the request the page makes to load its messages, and note the M-12 transcript address. As gwen@kittle.test, post \"Lease question JUDGE-CS1\" in M-11 and record the posting request; it must appear in M-11 (positive control). From Gwen's session, replay her posting request aimed at M-12 using the M-12 identifier seen in Harriet's recorded request, replay Harriet's recorded M-12 message-loading request, and open the M-12 transcript address in Gwen's browser."),
    # row 31: walled-route matter list replay
    ("Record the requests the page makes to load the M-12 thread, to open the M-12 transcript and to search for \"JUDGE-W0\".",
     "Record the requests the page makes to load the matter list, to load the M-12 thread, to open the M-12 transcript and to search for \"JUDGE-W0\"."),
    ("3. Replaying, as Dev, the recorded thread, transcript and search requests returns nothing from M-12;",
     "3. Replaying, as Dev, the recorded matter-list, thread, transcript and search requests returns nothing from M-12;"),
    # row 32: Sian's identifier comes from Harriet's recorded request
    ("then wall Sian from M-13.\n", "then wall Sian from M-13, recording that request too.\n"),
    ("3. From Sian's session, replay Harriet's recorded wall-lifting request with Sian as the person instead of Dev:",
     "3. From Sian's session, replay Harriet's recorded wall-lifting request with Sian's identifier, as it appears in Harriet's recorded request that walled Sian, in place of Dev's:"),
    # row 28: timer placement owned by polish
    ("the held executor message stays, and the thread shows 7 days beside the title.",
     "the held executor message stays, and the matter's timer setting now reads 7 days."),
    # rows 4/6/27/28: thread time not required; time checked once, in the transcript
    ("Each shows the firm's fixed sent time: 11:00 in the thread (a date there is optional) and 2026-05-12 11:00 in the transcript, in any clear format.",
     "In the M-11 transcript each shows the firm's fixed sent time, 2026-05-12 11:00 UTC, in any clear format."),
    ("Fails if any of them shows a different sent time, or if the order differs",
     "Fails if any of them shows a different sent time in the transcript, or if the order differs"),
    ("JUDGE-T1 sits under JUDGE-T0, and each message shows its author and sent time.",
     "JUDGE-T1 sits under JUDGE-T0, and each message shows its author."),
    ("Fails if any heading part, thread placement, author, time, hold mark or version is wrong or missing, or if chat controls appear.",
     "Fails if any heading part, thread placement, author, hold mark or version is wrong or missing, or if chat controls appear."),
    # row 33: every persistence leg is before/after
    ("Dev's M-13 unread count, how many results a search for \"Survey booked\" returns, and whether searches for \"Probate\" and \"Insurer letter\" return anything.",
     "Dev's M-13 unread count, how many results a search for \"Survey booked\" returns, whether searches for \"Probate\", \"Insurer letter\" and \"Persist gone\" return anything, whether JUDGE-S2 is gone from M-11, and whether a search for \"Persist child JUDGE-S1\" finds it."),
    ("1. Every item noted in step c reads exactly as it did before the restart.\n2. JUDGE-S2 has not come back, a search for \"Persist gone\" finds nothing, and a search for \"Persist child JUDGE-S1\" finds that message in M-11.\n",
     "1. Every item noted in step c reads exactly as it did before the restart.\n"),
    ("Fails if anything noted in step c differs after the restart, if a deleted message returned, if the post-restart search does not find JUDGE-S1, or if the restart tool reports an error.",
     "Fails if anything noted in step c differs after the restart, or if the restart tool reports an error."),
])

edit('tests/scored/functional/prompt.md', [(
    "- Two failed attempts at the same control fail that criterion; continue.\n",
    "- Two failed attempts at the same control fail that criterion; continue.\n"
    "- Use only identifiers you observed on screen or in recorded requests. A not-found answer to an\n"
    "  identifier you guessed is not a refusal.\n")])

edit('tests/scored/polish/judge.toml', [(
    "As gwen@kittle.test open the M-11 transcript. Confirm each reply is clearly shown as part of the thread it answers, by its placement or by a visible reply-to label, so a thread can be followed without opening anything.",
    "At 390 by 844, signed in as gwen@kittle.test, open the M-11 transcript. Confirm documentElement.scrollWidth equals the viewport width and every message's text can be read without scrolling sideways.")])
edit('tests/scored/visual/judge.toml', [(
    "Assess the matter list at desktop width, whether it sits beside the thread or on its own screen.",
    "Assess the matter list at desktop width, whether it sits beside the thread or on its own screen. If no matter shows an unread count when you look, judge identification and selection only and do not lower the score for absent counts.")])

edit('environment/instructions/integration.md', [
    ("so we can tell the server itself is up.",
     "so we can tell the server itself is up. We start it with only `PATH`, `NODE_PATH`, `HOME` (which may not be `/app`), `PORT=3000` and `DB_PATH` set."),
    ("New messages, edits and transcripts carry that time, and timers are measured against it.",
     "New messages, edits and transcripts carry that time, and timers are measured against it. Show times in UTC, as the clock gives them."),
])
edit('environment/instructions/conversations.md', [(
    "and links to http or https addresses that open in a new tab.",
    "and any http or https address typed in a message shown as a link that opens in a new tab.")])

c = tomllib.loads(open(J, encoding='utf8').read())['criterion']
print(len(c), sum(x['weight'] for x in c))
