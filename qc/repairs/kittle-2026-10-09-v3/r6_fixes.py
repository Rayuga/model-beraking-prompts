"""Apply the confirmed QC round r6 fixes to the Kittle task (run from the task folder)."""
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
s, n = re.subn(r'(id = "persistence"\nname = "persistence"\ntype = "binary"\nweight = )[\d.]+', r'\g<1>4.0', s)
assert n == 1
open(J, 'w', encoding='utf8', newline='').write(s)

edit(J, [
    # row 42: persistence protects walls and retention (two core parts); earlier versions graded once
    ("# signin_and_client_scope is 1.5 for sign-in plus 1.5 for client scope. Total 42.0.\n",
     "# signin_and_client_scope is 1.5 for sign-in plus 1.5 for client scope, and persistence\n"
     "# is 2.0 for durable walls plus 2.0 for durable retention and holds. Total 44.0.\n"),
    # rows 6/27: W3 accepts any refusal, or the reply filed under its own parent in M-13
    ("and replay the reply request once more with the text \"Cross reply JUDGE-W3\" and the identifier of \"Draft will sent for your review.\" from that M-13 request as the message it answers: it is refused too, and JUDGE-W3 appears in neither M-11 nor M-13.",
     "and replay the reply request once more with the text \"Cross reply JUDGE-W3\" and the identifier of \"Draft will sent for your review.\" from that M-13 request as the message it answers. Either it is refused in any way and JUDGE-W3 appears nowhere, or JUDGE-W3 is filed as a reply under \"Draft will sent for your review.\" in M-13, its own parent's matter; it must never appear in M-11 or under a message of another matter."),
    ("Fails if Dev's reply did not work, if either cross-matter reply is accepted or shows anywhere, if Dev's list lacks M-11 or M-13, if any M-12 title, number, message text, author or count reaches Dev by any of these routes, if a refusal is anything but a plain not-available, or if any of Sian's positive controls did not work.",
     "Fails if Dev's reply did not work, if JUDGE-W2 is accepted or shows anywhere, if JUDGE-W3 shows in M-11 or under a message of another matter, if Dev's list lacks M-11 or M-13, if any M-12 title, number, message text, author or count reaches Dev by any of these routes, if a refusal of an M-12 route (legs 3 and 4 and the JUDGE-W2 replay) is anything but a plain not-available, or if any of Sian's positive controls did not work."),
    # row 18: M-12 mention is typed, since Dev is rightly never suggested there
    ("In M-12, post \"@Dev please review JUDGE-M1\" using the mention feature (it posts normally; Dev must simply never hear of it),",
     "In M-12, type and post \"@Dev please review JUDGE-M1\" as written (Dev is walled from M-12, so he is not expected among any suggestions there; it posts normally and Dev must simply never hear of it),"),
    # row 38: the live wall uses Sian on M-12, which no later criterion needs, so a broken lift cannot cascade
    ("In one browser context sign in as sian@kittle.test, open M-13, post \"Before wall JUDGE-WL0\" and record that posting request; keep the page open. In a separate browser context sign in as harriet@kittle.test and open M-13. With the app's controls, wall dev@kittle.test from M-13 and lift that wall again, recording both requests; then wall Sian from M-13, recording that request too.\n"
     "1. In Sian's page, without reloading, within about ten seconds M-13 disappears from her list and its thread stops showing messages or says it is not available.\n"
     "2. From Sian's session, replay her recorded posting request with the text \"Too late JUDGE-WL1\": it is refused, and as Harriet M-13 has no JUDGE-WL1.\n"
     "3. From Sian's session, replay Harriet's recorded wall-lifting request adapted to lift Sian's wall instead of Dev's, using whatever identifies Sian or her wall in Harriet's recorded walling request or its response: it is refused, and Sian still gets not-available for M-13.\n"
     "4. As Harriet lift the wall with the app's control: after a reload Sian sees M-13 again, including JUDGE-WL0.\n"
     "Fails if Sian keeps seeing M-13 messages after the wall, if her post reaches M-13, if she can lift her own wall, or if lifting the wall does not give her M-13 back.",
     "In one browser context sign in as sian@kittle.test, open M-12, post \"Before wall JUDGE-WL0\" and record that posting request; keep the page open. In a separate browser context sign in as harriet@kittle.test and open M-12. With the app's controls, wall Sian from M-12 and lift that wall again, recording both requests (Sian's page may briefly change; that is fine). Then wall Sian from M-12 once more.\n"
     "1. In Sian's page, without reloading, within about ten seconds M-12 disappears from her list and its thread stops showing messages or says it is not available.\n"
     "2. From Sian's session, replay her recorded posting request with the text \"Too late JUDGE-WL1\": it is refused, and as Harriet M-12 has no JUDGE-WL1.\n"
     "3. From Sian's session, replay Harriet's recorded wall-lifting request: it is refused, and Sian still gets not-available for M-12.\n"
     "4. As Harriet lift Sian's wall with the app's control: after a reload Sian sees M-12 again, including JUDGE-WL0.\n"
     "Fails if Sian keeps seeing M-12 messages after the wall, if her post reaches M-12, if she can lift her own wall, or if lifting the wall does not give her M-12 back."),
    # rows 32/42: the version viewer is graded once (edits); here versions are checked only where the app shows them
    ("Open the probate message's earlier versions and record that request: \"Probate estimate is 2,400 pounds.\" is listed (positive control).",
     "If the app lets Harriet open earlier versions (that viewer itself is graded in edits_and_stale_edit), open the probate message's earlier versions, confirm \"Probate estimate is 2,400 pounds.\" is listed, and record the request that returned them, whether a dedicated request or the thread request if they arrived with it."),
    ("2. Replaying the recorded earlier-versions request now returns no text of the deleted message:",
     "2. If an earlier-versions request was recorded, replaying it now returns no text of the deleted message:"),
    # row 37: Sian's refused change is harmless if a weak app accepts it (off never deletes)
    ("then replay the recorded timer request with 1 day: it is refused, and as Harriet after a reload M-13 still shows 30 days.",
     "then replay the recorded timer request with the setting off: it is refused, and as Harriet after a reload M-13 still shows 30 days."),
    # row 28: the transcript sent time is graded once (search_and_transcript); here only the order
    ("In the M-11 transcript each shows the firm's fixed sent time, 2026-05-12 11:00 UTC, in any clear format. In the M-11 thread",
     "In the M-11 thread"),
    ("Fails if any of them shows a different sent time in the transcript, or if the order differs in any of these places or between reloads.",
     "Fails if the order differs in any of these places or between reloads."),
    # row 42: persistence no longer depends on the earlier-versions viewer
    ("JUDGE-S0 shows edited and Harriet can open its earlier version \"Persist parent JUDGE-S0\";",
     "JUDGE-S0 shows edited;"),
])

# row 26: message links also highlight the opened message
s = open(J, encoding='utf8').read()
a = "and following the link opens M-13 at that message."
assert s.count(a) == 1, 'message_links'
s = s.replace(a, "and following the link opens M-13 at that message, shown highlighted.")
open(J, 'w', encoding='utf8', newline='').write(s)

P = 'tests/scored/polish/judge.toml'
edit(P, [
    # row 38: escape_closes posts its own message; row 26: an escaped reply posts nothing
    ("As gwen@kittle.test in M-13, open the edit control on her message \"Enter check JUDGE-K1\", change the text to \"Escaped edit JUDGE-K1\" and press Escape: the edit closes without saving, and after a reload the message still reads \"Enter check JUDGE-K1\" with no \"edited\" mark. Then open the reply control on any message and press Escape: the reply closes. Fails if Escape saves, leaves either box open, or changes the message.",
     "As gwen@kittle.test in M-13 post \"Escape check JUDGE-K3\". Open its edit control, change the text to \"Escaped edit JUDGE-K3\" and press Escape: the edit closes without saving, and after a reload the message still reads \"Escape check JUDGE-K3\" with no \"edited\" mark. Then open the reply control on it, type \"Escaped reply JUDGE-K3\" and press Escape: the reply closes, and after a reload no \"Escaped reply JUDGE-K3\" was posted. Fails if Escape saves or posts anything, leaves either box open, or changes the message."),
    # row 28: navigation to the result is graded in functional; polish grades the highlight
    ("Fails if the message is not brought into view or nothing sets it apart.",
     "Fails if nothing sets the message apart, or if the highlight is gone after about ten seconds."),
    # row 33: Fails-if lines list every step
    ("Fails if Shift+Enter sends, if Enter does not send, or if the lines arrive as two messages.",
     "Fails if Shift+Enter sends, if Enter does not send, if the lines arrive as two messages, or if the box still holds the text."),
])
edit('tests/scored/polish/prompt.md', [(
    "Score each criterion independently from browser-visible evidence. One failed\ncriterion does not zero the others.",
    "Score each criterion independently from browser-visible evidence. One failed\ncriterion does not zero the others. A criterion passes only if every step it\nnames holds; its \"Fails if\" sentence names the main failures but never excuses\na step it does not mention.")])

# row 48: edit and delete belong to the author
edit('tests/app_context.md', [(
    "each message's reply, edit, delete, copy-link and (for partners) hold controls,",
    "each message's reply and copy-link controls, edit and delete on your own messages, (for partners) hold controls,")])

for p in (J, P):
    c = tomllib.loads(open(p, encoding='utf8').read())['criterion']
    print(p, len(c), sum(x['weight'] for x in c))
