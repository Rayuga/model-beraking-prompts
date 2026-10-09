"""Apply the confirmed QC round r5 fixes to the Kittle task (run from the task folder)."""
import tomllib


def edit(p, pairs):
    s = open(p, encoding='utf8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (p, a[:90])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf8', newline='').write(s)


# Brief: highlight stays (rows 6/27); one live-update window everywhere (row 49).
edit('environment/instructions/conversations.md', [
    ("takes you to it in its thread and highlights it, so you can spot it at once.",
     "takes you to it in its thread and highlights it, so you can spot it at once; it stays highlighted until you open something else."),
    ("every open tab should show it within about five seconds without reloading.",
     "every open tab should show it within about ten seconds without reloading."),
])
edit('environment/instructions/walls-and-retention.md', [
    ("within a few seconds, without them reloading, it is gone from their screen,",
     "within about ten seconds, without them reloading, it is gone from their screen,"),
])

# Golden: a reply parent from another matter gets the plain not-available answer (row 18).
edit('solution/app/server.js', [
    ("    if (!parent || parent.deleted) return res.status(404).json({ error: \"The message you are replying to is no longer available.\" });",
     "    if (!parent) return res.status(404).json({ error: NOT_AVAILABLE });\n"
     "    if (parent.deleted) return res.status(404).json({ error: \"The message you are replying to is no longer available.\" });"),
])

J = 'tests/scored/functional/judge.toml'
edit(J, [
    # row 44: explain the weights that are sums of parts
    ("# Total 42.0.\n",
     "# For example wall_every_route and timer_changes are two 2.0 parts each, and\n"
     "# signin_and_client_scope is 1.5 for sign-in plus 1.5 for client scope. Total 42.0.\n"),
    # row 26 (P3): a parent from a matter Dev CAN see is also refused
    ("it is refused, and JUDGE-W2 appears nowhere, neither in M-11 for Dev or harriet@kittle.test nor in M-12 for Sian.\n",
     "it is refused, and JUDGE-W2 appears nowhere, neither in M-11 for Dev or harriet@kittle.test nor in M-12 for Sian. Then, as Dev, open M-13 and record the request that loads its messages, and replay the reply request once more with the text \"Cross reply JUDGE-W3\" and the identifier of \"Draft will sent for your review.\" from that M-13 request as the message it answers: it is refused too, and JUDGE-W3 appears in neither M-11 nor M-13.\n"),
    ("Fails if Dev's reply did not work, if the cross-matter reply is accepted or shows anywhere,",
     "Fails if Dev's reply did not work, if either cross-matter reply is accepted or shows anywhere,"),
    # row 32 (P3): adapt the wall-lift replay to whatever identifies Sian's wall
    ("3. From Sian's session, replay Harriet's recorded wall-lifting request with Sian's identifier, as it appears in Harriet's recorded request that walled Sian, in place of Dev's: it is refused, and Sian still gets not-available for M-13.",
     "3. From Sian's session, replay Harriet's recorded wall-lifting request adapted to lift Sian's wall instead of Dev's, using whatever identifies Sian or her wall in Harriet's recorded walling request or its response: it is refused, and Sian still gets not-available for M-13."),
    # rows 30/37: timer off actually reads off; lengthening brings nothing back; Sian's refusal needs her access first
    ("3. Change the timer to off: the probate message does not come back.\n4. Set the timer back to 30 days.\n5. As sian@kittle.test, an associate, replay the recorded timer request with 1 day:",
     "3. Change the timer to off: the matter's timer setting now reads off, and the probate message does not come back.\n4. Set the timer back to 30 days: the setting reads 30 days and the probate message still does not come back.\n5. As sian@kittle.test, an associate, open M-13 (she can see it, as a positive control), then replay the recorded timer request with 1 day:"),
    # rows 32/37: Sian's hijack replay uses the current version, after she opens M-13
    ("3. As sian@kittle.test replay Gwen's recorded edit request with the text \"Hijack JUDGE-E1\": it is refused and the message still reads \"Version two JUDGE-E1\".",
     "3. As sian@kittle.test open M-13 (she can see it, as a positive control) and note the message's current version or other change marker from the request that loads the thread. Replay Gwen's recorded edit request with the text \"Hijack JUDGE-E1\" and, if the request carries a version or similar field, that current value, so that only authorship can explain a refusal: it is refused and the message still reads \"Version two JUDGE-E1\"."),
    # row 31: the transcript shows each message's own sent time
    ("2. Messages are oldest first and in their threads: JUDGE-T1 sits under JUDGE-T0, and each message shows its author.",
     "2. Messages are oldest first and in their threads: JUDGE-T1 sits under JUDGE-T0, each message shows its author, and each shows its own sent time; for example \"Survey booked for Friday.\" shows 2026-05-08 15:00 (any clear format), not the generated time."),
    ("Fails if any heading part, thread placement, author, hold mark or version is wrong or missing, or if chat controls appear.\nPart C.",
     "Fails if any heading part, thread placement, author, sent time, hold mark or version is wrong or missing, or if chat controls appear.\nPart C."),
    # row 26: * is literal, and search matches part of a word
    ("Search \"1000 pounds\": JUDGE-Q2 is found (positive control).\nFails if % or _ acts as a wildcard, or if a literal match is missed.",
     "Then post \"Code X*9 JUDGE-Q5\" and \"Code XY9 JUDGE-Q6\". Search \"1000 pounds\": JUDGE-Q2 is found (positive control). Search \"X*9\": JUDGE-Q5 is found and JUDGE-Q6 is not. Search \"urvey booked\": \"Survey booked for Friday.\" is found, because search matches the characters typed, even inside a word.\nFails if %, _ or * acts as a wildcard or operator, if part of a word is not found, or if a literal match is missed."),
    # rows 30/42: persistence only credits what really worked before the restart
    ("c. Note what the app shows now: whether JUDGE-S1 sits under JUDGE-S0, whether JUDGE-S0 shows edited and its earlier version, whether JUDGE-S1 shows On hold, what M-12's timer shows, whether Sian gets not-available for M-11 and Dev for M-12, Dev's M-13 unread count, how many results a search for \"Survey booked\" returns, whether searches for \"Probate\", \"Insurer letter\" and \"Persist gone\" return anything, whether JUDGE-S2 is gone from M-11, and whether a search for \"Persist child JUDGE-S1\" finds it.",
     "c. Before restarting, each of these must already hold (positive controls): JUDGE-S1 sits under JUDGE-S0; JUDGE-S0 shows edited and Harriet can open its earlier version \"Persist parent JUDGE-S0\"; JUDGE-S1 shows On hold; M-12's timer shows 30 days; Sian gets not-available for M-11 and Dev for M-12; Dev's M-13 shows a definite unread count (a number, or clearly none); JUDGE-S2 is gone from M-11 and a search for \"Persist gone\" finds nothing; a search for \"Persist child JUDGE-S1\" finds it; and a search for \"Survey booked\" finds the M-11 message. Note each of these, plus how many results \"Survey booked\" returns, Dev's exact M-13 count, and whether searches for \"Probate\" and \"Insurer letter\" return anything."),
    ("This criterion grades only durability: a feature that did not work before the restart is graded in its own criterion, not here.\nFails if anything noted in step c differs after the restart, or if the restart tool reports an error.",
     "Fails if any step c positive control did not hold before the restart, if anything noted in step c differs after the restart, or if the restart tool reports an error."),
])

edit('tests/scored/polish/judge.toml', [
    ("M-11 opens with that message in view and visibly highlighted, marked differently from the messages around it, and it is still highlighted about ten seconds later.",
     "M-11 opens with that message in view and visibly highlighted, marked differently from the messages around it, and, without opening anything else, it is still highlighted about ten seconds later."),
])

# rows 6/32 (P3): replays keep identifying headers and change any duplicate-send key with the text
edit('tests/scored/functional/prompt.md', [
    ("- Record method, path, body and session credential of the UI's own writes;\n  replays are in-page calls from the app's origin.",
     "- Record method, path, body, session credential and any header that identifies the send\n  (such as an idempotency key) of the UI's own writes; replays are in-page calls from the\n  app's origin. When a replay changes a message's text, also change any duplicate-send key\n  it carries."),
])

c = tomllib.loads(open(J, encoding='utf8').read())['criterion']
print(len(c), sum(x['weight'] for x in c))
