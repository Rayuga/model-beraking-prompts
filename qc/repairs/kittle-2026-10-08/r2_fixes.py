"""Apply the confirmed QC round r2 fixes to the Kittle task (run from the task folder)."""
import re
import tomllib


def edit(p, pairs):
    s = open(p, encoding='utf8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (p, a[:80])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf8', newline='').write(s)


J = 'tests/scored/functional/judge.toml'
s = open(J, encoding='utf8').read()
for cid, w in [('edits_and_stale_edit', '1.5'), ('safe_formatting', '1.5'), ('unread_and_new_messages_line', '1.5'),
               ('live_updates_keep_my_work', '1.5'), ('deleted_and_expired_messages', '4.0')]:
    s, n = re.subn(r'(id = "%s"\nname = "%s"\ntype = "binary"\nweight = )[\d.]+' % (cid, cid), r'\g<1>%s' % w, s)
    assert n == 1, cid
open(J, 'w', encoding='utf8', newline='').write(s)

edit(J, [
    ("In a separate browser context sign in as harriet@kittle.test, open M-13 and wall Sian from M-13 with the app's control, recording that request.\n",
     "In a separate browser context sign in as harriet@kittle.test and open M-13. With the app's controls, wall dev@kittle.test from M-13 and lift that wall again, recording both requests; then wall Sian from M-13.\n"),
    ("3. From Sian's session, replay Harriet's recorded wall request changed to lift Sian's own wall: it is refused, and Sian still gets not-available for M-13.",
     "3. From Sian's session, replay Harriet's recorded wall-lifting request with Sian as the person instead of Dev: it is refused, and Sian still gets not-available for M-13."),
    ("Open the probate message's earlier versions: \"Probate estimate is 2,400 pounds.\" is listed (positive control).",
     "Open the probate message's earlier versions and record that request: \"Probate estimate is 2,400 pounds.\" is listed (positive control)."),
    ("2. Searching \"Probate\", \"2,400\" and \"4,200\" finds nothing,",
     "2. Replaying the recorded earlier-versions request now returns not-available with no \"2,400\" or \"4,200\". Searching \"Probate\", \"2,400\" and \"4,200\" finds nothing,"),
    ("6. Release the hold on the seeded \"Insurer letter acknowledged.\" (sent 3 May on the seven-day M-11): it disappears at once, and searching \"Insurer letter\" finds nothing.\n",
     "6. Release the hold on the seeded \"Insurer letter acknowledged.\" (sent 3 May on the seven-day M-11) with the app's control, recording the request: it disappears at once, and searching \"Insurer letter\" finds nothing.\n7. As sian@kittle.test replay the recorded release request against JUDGE-H1: it is refused and JUDGE-H1 is still On hold.\n"),
    ("if Sian can place a hold,", "if Sian can place or release a hold,"),
    ("in this order, quickly: \"Order A JUDGE-O\", \"Order B JUDGE-O\", \"Order C JUDGE-O\". All carry the same clock time. In the M-11 thread for harriet@kittle.test and for gwen@kittle.test, after reloads, in a search for \"JUDGE-O\" and in the M-11 transcript, they appear in the order A, B, C every time.\nFails if the order differs in any of these places or between reloads.",
     "in this order, quickly: \"Order C JUDGE-O\", \"Order A JUDGE-O\", \"Order B JUDGE-O\". Each shows the firm's fixed sent time 2026-05-12 11:00 (any clear format) in the thread and the transcript. In the M-11 thread for harriet@kittle.test and for gwen@kittle.test, after reloads, in a search for \"JUDGE-O\" and in the M-11 transcript, they appear in the order C, A, B every time.\nFails if any of them shows a different sent time, or if the order differs in any of these places or between reloads."),
    ("3. \"Landlord's notice received and filed.\" is marked On hold and edited, and shows both its versions, including \"Landlords notice recieved.\".\nFails if any heading part, thread placement, author, time, hold mark, edited mark or version is wrong or missing, or if chat controls appear.",
     "3. \"Landlord's notice received and filed.\" is marked On hold and shows both its versions, including \"Landlords notice recieved.\".\nFails if any heading part, thread placement, author, time, hold mark or version is wrong or missing, or if chat controls appear."),
])

s = open(J, encoding='utf8').read()
a = s.index('[[criterion]]\nid = "persistence"')
s = s[:a] + '''[[criterion]]
id = "persistence"
name = "persistence"
type = "binary"
weight = 2.0
description = """
Before restarting, as harriet@kittle.test:
a. In M-11 post "Persist parent JUDGE-S0", reply to it with "Persist child JUDGE-S1", edit JUDGE-S0 to "Persist parent JUDGE-S0 edited", place a hold on JUDGE-S1, and post and then delete "Persist gone JUDGE-S2".
b. Set M-12's timer to 30 days, and wall sian@kittle.test from M-11.
c. Note, as Harriet, how many results a search for "Survey booked" returns and whether searches for "Probate" and "Insurer letter" return anything; note, as dev@kittle.test, his M-13 unread count.
Then call restart_app once. After it reports success, open a fresh page and sign in again.
1. JUDGE-S1 is still nested under the edited JUDGE-S0, JUDGE-S0 shows edited and Harriet can open its earlier version, JUDGE-S1 is On hold, and JUDGE-S2 has not come back.
2. A search for "Persist child JUDGE-S1" finds that message in M-11, and a search for "Persist gone" finds nothing.
3. M-12 shows 30 days; Sian gets not-available for M-11; Dev gets not-available for M-12; Dev's M-13 count is unchanged.
4. The searches noted in step c return exactly what they returned before the restart.
Finally lift Sian's wall on M-11 and set M-12's timer back to off.
Fails if anything noted changed, if a deleted message returned, if a search result count changed (for example because data was imported again), or if the restart tool reports an error.
"""
'''
open(J, 'w', encoding='utf8', newline='').write(s)

edit('tests/gates/render/judge.toml', [(
    "This is a basic reachability/sign-in gate only. If the gate fails, assign 0;\nif the signed-in populated surface loads without any of the basic failures\nabove, assign 1.",
    "This is a basic reachability/sign-in gate only. Assign 1 only if every check\nholds; otherwise assign 0.")])
edit('tests/scored/functional/prompt.md', [(
    "- Two failed attempts at the same control fail that criterion; continue.\n",
    "- Two failed attempts at the same control fail that criterion; continue.\n"
    "- If messages this criterion is about to post already exist from an earlier attempt at the same\n"
    "  criterion, add \"-2\" to every JUDGE text in this attempt and check those instead.\n")])
edit('tests/app_context.md', [("Harriet Rowe, Partner (timers and holds)", "Harriet Rowe, Partner (timers, holds and walls)")])
edit('tests/scored/polish/judge.toml', [(
    "Confirm it reads as a document: a comfortable line length, each message's author and time set apart from its text, and replies visibly indented under their parents.",
    "Confirm replies are visibly set under the message they answer, so a thread can be followed without reading any \"in reply to\" text.")])
edit('instruction.md', [("The finished app goes in `/app`.", "The finished app goes in `/app`, starting from `/app/server.js`.")])
edit('environment/instructions/walls-and-retention.md', [(
    "A partner places or releases a hold on any message", "Only a partner places or releases a hold, on any message")])
edit('environment/instructions/conversations.md', [
    ("Messages sent at the same time stay in one consistent order wherever you see them",
     "Messages sent at the same time stay in the order they were sent wherever you see them"),
    ("Typing `@` and a name mentions someone who can see the matter.",
     "Typing `@` and a name (a first name is enough) mentions someone who can see the matter.")])
edit('environment/instructions/integration.md', [(
    "and don't put symbolic links in `/app` outside `node_modules`; we won't run an app that has them.",
    "and don't put symbolic links anywhere in `/app`; we won't run an app that has them.")])

c = tomllib.loads(open(J, encoding='utf8').read())['criterion']
print(len(c), sum(x['weight'] for x in c))
