"""Apply the confirmed QC round r3 fixes to the Kittle task (run from the task folder)."""
import re
import tomllib


def edit(p, pairs):
    s = open(p, encoding='utf8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (p, a[:90])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf8', newline='').write(s)


J = 'tests/scored/functional/judge.toml'
s = open(J, encoding='utf8').read()
s, n = re.subn(r'(id = "signin_and_client_scope"\nname = "signin_and_client_scope"\ntype = "binary"\nweight = )[\d.]+', r'\g<1>3.0', s)
assert n == 1
open(J, 'w', encoding='utf8', newline='').write(s)

edit(J, [
    # rows 26/31: signed-out and other-client checks cover transcript, mentions and search
    ("While signed in, open one of her matters and record the request the page makes to load its messages. Sign out: no matter title, name or message stays visible. Then, signed out, replay that recorded request from the app page: it must return no matter, message or name data.",
     "While signed in, open M-11 and record the request the page makes to load its messages, open her mentions list and record that request, search for \"Survey\" and record that request, and note the M-11 transcript address (the M-11 transcript opens, as a positive control). Sign out: no matter title, name or message stays visible. Then, signed out, replay each recorded request from the app page and open the M-11 transcript address: none returns any matter, message, mention or name data."),
    ("Fails if Gwen sees M-12, if anything private remains after sign-out, if the signed-out replay returns matter or message data, or if the wrong password signs in.",
     "Fails if Gwen's list lacks either of her matters or shows M-12, if anything private remains after sign-out, if any signed-out replay or the transcript address returns matter, message, mention or name data, or if the wrong password signs in."),
    ("Replay that request from the app page with M-12 as the target instead, and also replay the message-loading request with M-12 as the target.\nFails if the M-11 post did not work, if either replay returns or writes anything in M-12",
     "Replay that request from the app page with M-12 as the target instead, replay the message-loading request with M-12 as the target, and open the M-12 transcript address in Gwen's browser.\nFails if the M-11 post did not work, if any of these returns or writes anything in M-12"),
    # row 30: transcript positive control for the walled route
    ("Sian sees JUDGE-W0 in the thread and her search finds it (positive control).",
     "Sian sees JUDGE-W0 in the thread, her search finds it, and the M-12 transcript shows it (positive controls)."),
    ("Fails if any M-12 title, number, message text, author or count reaches Dev by any of these routes, or if Sian's positive control did not work.",
     "Fails if Dev's list lacks M-11 or M-13, if any M-12 title, number, message text, author or count reaches Dev by any of these routes, if a refusal is anything but a plain not-available, or if any of Sian's positive controls did not work."),
    # row 36: judge-typed text must not itself say M-12
    ("then in M-11 post \"See the M-12 terms JUDGE-L1 \" followed by that link.",
     "then in M-11 post \"See the linked terms JUDGE-L1 \" followed by that link."),
    # row 6: one placeholder description
    ("JUDGE-X1 stays, shown under the same kind of deleted-message placeholder,",
     "JUDGE-X1 stays, with a placeholder saying the original message was deleted in place of a quote,"),
    # rows 6/27/32: any no-data answer for a deleted message's versions; row 28: hold mark is graded elsewhere
    ("the probate message disappears at once, the held executor message stays marked On hold, and the thread shows 7 days beside the title.",
     "the probate message disappears at once, the held executor message stays, and the thread shows 7 days beside the title."),
    ("2. Replaying the recorded earlier-versions request now returns not-available with no \"2,400\" or \"4,200\".",
     "2. Replaying the recorded earlier-versions request now returns no text of the deleted message: a not-available answer, an error or an empty list are all fine, as long as neither \"2,400\" nor \"4,200\" appears."),
    ("Fails if shortening does not delete the eight-day-old message and its earlier version at once, if the held message is deleted, if turning the timer off brings anything back, or if Sian's change is accepted.",
     "Fails if the positive control did not work, if shortening does not delete the eight-day-old message and its earlier version at once, if the held message is deleted, if the 7-day setting is not shown, if turning the timer off brings anything back, or if Sian's change is accepted."),
    # row 30: search positive control in the hold criterion
    ("it disappears at once, and searching \"Insurer letter\" finds nothing.\n7.",
     "it disappears at once, searching \"Insurer letter\" finds nothing, and searching \"Hold child JUDGE-H1\" finds JUDGE-H1 (positive control for search).\n7."),
    # rows 27/32: thread may show the time only
    ("Each shows the firm's fixed sent time 2026-05-12 11:00 (any clear format) in the thread and the transcript.",
     "Each shows the firm's fixed sent time: 11:00 in the thread (a date there is optional) and 2026-05-12 11:00 in the transcript, in any clear format."),
    # row 28: persistence grades only what held before the restart
    ("c. Note, as Harriet, how many results a search for \"Survey booked\" returns and whether searches for \"Probate\" and \"Insurer letter\" return anything; note, as dev@kittle.test, his M-13 unread count.\nThen call restart_app once. After it reports success, open a fresh page and sign in again.\n1. JUDGE-S1 is still nested under the edited JUDGE-S0, JUDGE-S0 shows edited and Harriet can open its earlier version, JUDGE-S1 is On hold, and JUDGE-S2 has not come back.\n2. A search for \"Persist child JUDGE-S1\" finds that message in M-11, and a search for \"Persist gone\" finds nothing.\n3. M-12 shows 30 days; Sian gets not-available for M-11; Dev gets not-available for M-12; Dev's M-13 count is unchanged.\n4. The searches noted in step c return exactly what they returned before the restart.\nFinally lift Sian's wall on M-11 and set M-12's timer back to off.\nFails if anything noted changed, if a deleted message returned, if a search result count changed (for example because data was imported again), or if the restart tool reports an error.",
     "c. Note what the app shows now: whether JUDGE-S1 sits under JUDGE-S0, whether JUDGE-S0 shows edited and its earlier version, whether JUDGE-S1 shows On hold, what M-12's timer shows, whether Sian gets not-available for M-11 and Dev for M-12, Dev's M-13 unread count, how many results a search for \"Survey booked\" returns, and whether searches for \"Probate\" and \"Insurer letter\" return anything.\nThen call restart_app once. After it reports success, open a fresh page and sign in again.\n1. Every item noted in step c reads exactly as it did before the restart.\n2. JUDGE-S2 has not come back, a search for \"Persist gone\" finds nothing, and a search for \"Persist child JUDGE-S1\" finds that message in M-11.\nFinally lift Sian's wall on M-11 and set M-12's timer back to off.\nThis criterion grades only durability: a feature that did not work before the restart is graded in its own criterion, not here.\nFails if anything noted in step c differs after the restart, if a deleted message returned, if the post-restart search does not find JUDGE-S1, or if the restart tool reports an error."),
])

P = 'tests/scored/functional/prompt.md'
edit(P, [
    ("in the same criterion or an earlier one, while that target was eligible.",
     "in the same criterion, while that target was eligible."),
    ("- Two failed attempts at the same control fail that criterion; continue.\n",
     "- Two failed attempts at the same control fail that criterion; continue.\n- A criterion passes only if every numbered leg and every listed positive control holds; its\n  \"Fails if\" line names the main failures but never excuses a leg it does not mention.\n"),
])
edit('tests/app_context.md', [(
    "- A replay means",
    "- If a copy-link control only writes to the clipboard, read it with navigator.clipboard.readText() from the app page, granting clipboard permission to the context if asked.\n- A replay means")])
edit('tests/scored/polish/judge.toml', [(
    "Confirm replies are visibly set under the message they answer, so a thread can be followed without reading any \"in reply to\" text.",
    "Confirm each reply is clearly shown as part of the thread it answers, by its placement or by a visible reply-to label, so a thread can be followed without opening anything.")])
edit('tests/scored/visual/judge.toml', [(
    "Assess the matter list beside the thread at desktop width.",
    "Assess the matter list at desktop width, whether it sits beside the thread or on its own screen.")])
edit('instruction.md', [(
    "The finished app goes in `/app`, starting from `/app/server.js`.",
    "The finished app goes in `/app`, starting from `/app/server.js` and keeping its data in `/app/app.db`.")])

c = tomllib.loads(open(J, encoding='utf8').read())['criterion']
print(len(c), sum(x['weight'] for x in c))
