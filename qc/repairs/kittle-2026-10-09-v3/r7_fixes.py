"""Apply the confirmed QC round r7 fixes to the Kittle task (run from the task folder)."""
import tomllib


def edit(p, pairs):
    s = open(p, encoding='utf8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (p, a[:90])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf8', newline='').write(s)


J = 'tests/scored/functional/judge.toml'
edit(J, [
    # row 30: Dev's own search works (positive control for the walled searches)
    ("2. Searching \"JUDGE-W0\", \"heads of terms\" and \"Fenwick\" returns nothing, with no snippet, count or matter name from M-12.",
     "2. Searching \"JUDGE-W0\", \"heads of terms\" and \"Fenwick\" returns nothing, with no snippet, count or matter name from M-12, while Dev's search for \"Survey booked\" finds the M-11 message (positive control)."),
    # row 28: the highlight is graded once, in polish link_highlight
    ("and following the link opens M-13 at that message, shown highlighted.",
     "and following the link opens M-13 at that message."),
    # rows 26/35: timer options and durable earlier versions
    ("If the app lets Harriet open earlier versions (that viewer itself is graded in edits_and_stale_edit),",
     "The matter's timer control offers off, 1 day, 7 days and 30 days (positive control). If the app lets Harriet open earlier versions (that viewer itself is graded in edits_and_stale_edit),"),
    ("JUDGE-S0 shows edited;",
     "JUDGE-S0 shows edited, and if the app shows earlier versions, opening JUDGE-S0's lists \"Persist parent JUDGE-S0\";"),
    # rows 31/32: which view each unread session is on
    ("In the first, open M-13 so it is read up to its newest message, then open M-11; within about ten seconds M-13 shows no unread count in either context.",
     "In the first, open M-13 so it is read up to its newest message, then open M-11; in the second, open M-11. Within about ten seconds M-13 shows no unread count in either context, and both stay on M-11 until a step says otherwise."),
    ("4. As gwen@kittle.test, M-13 shows her own unread count",
     "4. As gwen@kittle.test, with M-11 open, M-13 shows her own unread count"),
    # row 32: the scroll position is noted before the changes
    ("scroll the thread so it is not at the very bottom,",
     "scroll the thread so it is not at the very bottom and note which message is at the top of the view,"),
])

P = 'tests/scored/polish/judge.toml'
edit(P, [
    # row 28: link_highlight owns the highlight for both routes, self-contained
    ("As gwen@kittle.test search \"Survey booked\" and open the result for \"Survey booked for Friday.\". M-11 opens with that message in view and visibly highlighted, marked differently from the messages around it, and, without opening anything else, it is still highlighted about ten seconds later. Fails if nothing sets the message apart, or if the highlight is gone after about ten seconds.",
     "As gwen@kittle.test search \"Survey booked\" and open the result for \"Survey booked for Friday.\". M-11 opens with that message in view and visibly highlighted, marked differently from the messages around it, and, without opening anything else, it is still highlighted about ten seconds later. Then in M-13 use the copy-link control on \"Draft will sent for your review.\", open M-11, and go to the copied address in the browser: M-13 opens with that message highlighted the same way. Fails if nothing sets the opened message apart on either route, or if the highlight is gone after about ten seconds."),
    # row 30: the transcript must actually list the matter
    ("At 390 by 844, signed in as gwen@kittle.test, open the M-11 transcript. Confirm documentElement.scrollWidth equals the viewport width and every message's text can be read without scrolling sideways.",
     "At 390 by 844, signed in as gwen@kittle.test, open the M-11 transcript. It lists M-11's messages, including \"Survey booked for Friday.\" (positive control). Confirm documentElement.scrollWidth equals the viewport width and every message's text can be read without scrolling sideways."),
])

for p in (J, P):
    c = tomllib.loads(open(p, encoding='utf8').read())['criterion']
    print(p, len(c), sum(x['weight'] for x in c))
