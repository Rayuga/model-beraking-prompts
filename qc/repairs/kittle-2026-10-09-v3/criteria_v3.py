"""v3 criteria: stricter functional legs for the new brief requirements and a polish set of
real interaction checks. Run from the task folder."""
import re
import tomllib


def edit(p, pairs):
    s = open(p, encoding='utf8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (p, a[:90])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf8', newline='').write(s)


def weight(p, cid, w):
    s = open(p, encoding='utf8').read()
    s, n = re.subn(r'(id = "%s"\nname = "%s"\ntype = "binary"\nweight = )[\d.]+' % (cid, cid), r'\g<1>' + w, s)
    assert n == 1, cid
    open(p, 'w', encoding='utf8', newline='').write(s)


J = 'tests/scored/functional/judge.toml'
edit(J, [
    ("# 1.5 and a single small behaviour is 1.0; a criterion with parts takes their sum.\n",
     "# 1.5 and a single small behaviour is 1.0; a criterion with parts takes their sum.\n"
     "# Total 42.0.\n"),

    # wall_every_route: a reply aimed from M-11 at an M-12 message (core wall part, +2.0)
    ("4. Opening the M-12 transcript address directly in Dev's browser shows not-available.\n"
     "Fails if Dev's list lacks M-11 or M-13,",
     "4. Opening the M-12 transcript address directly in Dev's browser shows not-available.\n"
     "5. As Dev in M-11 reply to \"Rent review meeting moved to the afternoon.\" with \"Reply check JUDGE-W1\" and record that reply request; JUDGE-W1 appears under that message (positive control). From Dev's session replay it with the text \"Cross reply JUDGE-W2\" and, as the message it answers, the identifier of \"Wall check JUDGE-W0\" as it appears in Sian's recorded M-12 thread request: it is refused, and JUDGE-W2 appears nowhere, neither in M-11 for Dev or harriet@kittle.test nor in M-12 for Sian.\n"
     "Fails if Dev's reply did not work, if the cross-matter reply is accepted or shows anywhere, if Dev's list lacks M-11 or M-13,"),

    # wall_mentions_and_links: lower-case mention, and @ suggestions that respect walls and client scope (+2.0)
    ("As harriet@kittle.test, open M-12, use the app's control to copy the link",
     "Part A.\nAs harriet@kittle.test, open M-12, use the app's control to copy the link"),
    ("and in M-11 post \"@Dev survey update JUDGE-M2\".",
     "and in M-11 post \"@dev survey update JUDGE-M2\" exactly as written, in lower case."),
    ("Fails if Harriet's preview or link did not work, if Dev sees any part of the linked M-12 message or its matter, if Dev's mentions reveal JUDGE-M1, or if the M-11 mention JUDGE-M2 is missing for Dev.\n",
     "Fails if Harriet's preview or link did not work, if Dev sees any part of the linked M-12 message or its matter, if Dev's mentions reveal JUDGE-M1, or if the M-11 mention JUDGE-M2 is missing for Dev.\n"
     "Part B.\n"
     "As harriet@kittle.test open M-12 and type \"@\" in the message box: the app suggests people who can see M-12, including Sian Lloyd and Paul Marsh, and never Dev Anand or Gwen Pryce. If showing the suggestions made a request, record it. Clear the box, open M-11 and type \"@\": the suggestions include Dev Anand, Sian Lloyd and Gwen Pryce, and never Paul Marsh. Pick Dev from those suggestions, type \" suggestion check JUDGE-M3\" after what the pick put in, and send: as dev@kittle.test the mentions list shows JUDGE-M3. Finally, as dev@kittle.test, replay any recorded M-12 suggestion request: it returns no names and nothing from M-12.\n"
     "Fails if typing @ shows no suggestions, if the M-12 suggestions include Dev or Gwen or the M-11 suggestions include Paul, if picking a suggestion does not make a working mention, or if Dev's replay returns any name or M-12 data.\n"
     "Both parts must hold; failing either fails this criterion.\n"),

    # timer_changes: editing does not make a message younger (+2.0)
    ("Open the probate message's earlier versions and record that request: \"Probate estimate is 2,400 pounds.\" is listed (positive control).\n"
     "1. Change the M-13 timer to 7 days with the app's control, recording the request: the probate message disappears at once, the held executor message stays,",
     "Open the probate message's earlier versions and record that request: \"Probate estimate is 2,400 pounds.\" is listed (positive control). Then edit Harriet's seeded \"Costs estimate sent to Gwen.\" (sent 3 May) to \"Costs estimate sent to Gwen JUDGE-TE\" with the app's edit control: it shows edited (positive control).\n"
     "1. Change the M-13 timer to 7 days with the app's control, recording the request: the probate message and JUDGE-TE disappear at once (JUDGE-TE was sent nine days ago; editing it today does not make it younger), the held executor message stays,"),
    ("Searching \"Probate\", \"2,400\" and \"4,200\" finds nothing, while searching \"executor\" finds the held message; the M-13 transcript contains neither \"2,400\" nor \"4,200\" but does contain the executor message.",
     "Searching \"Probate\", \"2,400\", \"4,200\" and \"JUDGE-TE\" finds nothing, while searching \"executor\" finds the held message; the M-13 transcript contains none of \"2,400\", \"4,200\" and \"JUDGE-TE\" but does contain the executor message."),
    ("Fails if the positive control did not work, if shortening does not delete the eight-day-old message and its earlier version at once,",
     "Fails if a positive control did not work, if shortening does not delete the eight-day-old message and its earlier version at once, if the edited nine-day-old JUDGE-TE survives,"),

    # edits_and_stale_edit: mentions follow edits and deletes (+1.5)
    ("As gwen@kittle.test in M-13 post \"Version one <i>JUDGE-E1</i>\" exactly as written.",
     "Part A.\nAs gwen@kittle.test in M-13 post \"Version one <i>JUDGE-E1</i>\" exactly as written."),
    ("Fails if the edit lacks the edited mark or its literal earlier version, if the stale edit overwrites the newer one or throws the typed text away, if Sian can edit Gwen's message, or if the transcript does not mark the edit.\n",
     "Fails if the edit lacks the edited mark or its literal earlier version, if the stale edit overwrites the newer one or throws the typed text away, if Sian can edit Gwen's message, or if the transcript does not mark the edit.\n"
     "Part B.\n"
     "As harriet@kittle.test in M-13 post \"Plain note JUDGE-ME1\"; as dev@kittle.test the mentions list has no JUDGE-ME1. As Harriet edit it to \"@Dev plain note JUDGE-ME1\": Dev's mentions list now shows JUDGE-ME1. Edit it again to \"Plain note JUDGE-ME1 done\": Dev's mentions list no longer shows JUDGE-ME1. Then post \"@Dev short lived JUDGE-ME2\": Dev's mentions list shows it (positive control). Delete it with the app's control: Dev's mentions list no longer shows JUDGE-ME2. Re-open or reload Dev's mentions list for each check.\n"
     "Fails if a mention edited into a message does not reach Dev's list, if a mention edited out stays on it, or if a deleted message's mention stays on it.\n"
     "Both parts must hold; failing either fails this criterion.\n"),

    # search_and_transcript: literal characters (+1.5)
    ("Fails if any heading part, thread placement, author, hold mark or version is wrong or missing, or if chat controls appear.\n"
     "Both parts must hold; failing either fails this criterion.\n",
     "Fails if any heading part, thread placement, author, hold mark or version is wrong or missing, or if chat controls appear.\n"
     "Part C.\n"
     "As gwen@kittle.test in M-11 post \"Deposit is 100% JUDGE-Q1\", \"Deposit is 1000 pounds JUDGE-Q2\", \"Ref A_1 JUDGE-Q3\" and \"Ref AB1 JUDGE-Q4\". Search \"100%\": JUDGE-Q1 is found and JUDGE-Q2 is not. Search \"A_1\": JUDGE-Q3 is found and JUDGE-Q4 is not. Search \"1000 pounds\": JUDGE-Q2 is found (positive control).\n"
     "Fails if % or _ acts as a wildcard, or if a literal match is missed.\n"
     "All three parts must hold; failing any fails this criterion.\n"),
])
for cid, w in [('wall_every_route', '4.0'), ('wall_mentions_and_links', '4.0'), ('timer_changes', '4.0'),
               ('edits_and_stale_edit', '3.0'), ('search_and_transcript', '4.0')]:
    weight(J, cid, w)

P = 'tests/scored/polish/judge.toml'
s = open(P, encoding='utf8').read()
head = s[:s.index('[[criterion]]')]
crit = '''[[criterion]]
id = "enter_sends"
name = "enter_sends"
type = "binary"
weight = 1.0
description = """
As gwen@kittle.test open M-13, click in the message box and type "Enter check JUDGE-K1", press Shift+Enter, type "second line JUDGE-K1" and press Enter. Exactly one message is sent, showing both lines with "second line JUDGE-K1" on its own line, and the message box is empty afterwards. Fails if Shift+Enter sends, if Enter does not send, or if the lines arrive as two messages.
"""

[[criterion]]
id = "escape_closes"
name = "escape_closes"
type = "binary"
weight = 1.0
description = """
As gwen@kittle.test in M-13, open the edit control on her message "Enter check JUDGE-K1", change the text to "Escaped edit JUDGE-K1" and press Escape: the edit closes without saving, and after a reload the message still reads "Enter check JUDGE-K1" with no "edited" mark. Then open the reply control on any message and press Escape: the reply closes. Fails if Escape saves, leaves either box open, or changes the message.
"""

[[criterion]]
id = "delete_confirm"
name = "delete_confirm"
type = "binary"
weight = 1.0
description = """
As gwen@kittle.test in M-13 post "Confirm check JUDGE-K2" and use its delete control. The app asks to confirm before anything is deleted (in the page or as a browser dialog). Decline: the message stays, also after a reload. Use the delete control again and confirm: the message goes. Fails if one click deletes without asking, or if declining deletes the message.
"""

[[criterion]]
id = "link_highlight"
name = "link_highlight"
type = "binary"
weight = 1.0
description = """
As gwen@kittle.test search "Survey booked" and open the result for "Survey booked for Friday.". M-11 opens with that message in view and visibly highlighted, marked differently from the messages around it, and it is still highlighted about ten seconds later. Fails if the message is not brought into view or nothing sets it apart.
"""

[[criterion]]
id = "transcript_print"
name = "transcript_print"
type = "binary"
weight = 1.0
description = """
At 390 by 844, signed in as gwen@kittle.test, open the M-11 transcript. Confirm documentElement.scrollWidth equals the viewport width and every message's text can be read without scrolling sideways.
"""

[[criterion]]
id = "refusal_in_place"
name = "refusal_in_place"
type = "binary"
weight = 1.0
description = """
Sign out, then try to sign in as gwen@kittle.test with a wrong password, and wait about ten seconds without touching anything. The reason must appear in words next to the sign-in form and still be there after the wait. Then sign in with the right password: no reason is shown. Fails if the refusal shows no reason, shows it only as a passing toast that has gone after the wait, or shows it far from the form.
"""
'''
open(P, 'w', encoding='utf8', newline='').write(head + crit)

edit('tests/app_context.md', [
    ("Sign-in; the matter list with unread counts; a matter thread with nested replies, each message's reply, edit, delete, copy-link and (for partners) hold controls, and timer and wall controls for partners; a mentions list; search; the transcript page for a matter.",
     "Sign-in; the matter list with unread counts; a matter thread with nested replies, each message's reply, edit, delete, copy-link and (for partners) hold controls, and timer and wall controls for partners; a message box that suggests people when you type @; a mentions list; search; the transcript page for a matter."),
    ("- A replay means",
     "- Deleting asks for confirmation. When a step says to delete a message, confirm it, in the page or in a browser dialog.\n- A replay means"),
])

for p in (J, P):
    c = tomllib.loads(open(p, encoding='utf8').read())['criterion']
    print(p, len(c), sum(x['weight'] for x in c))
