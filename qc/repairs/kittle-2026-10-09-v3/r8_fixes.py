"""Apply the confirmed QC round r8 fixes to the Kittle task (run from the task folder)."""
import tomllib


def edit(p, pairs):
    s = open(p, encoding='utf8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (p, a[:90])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf8', newline='').write(s)


J = 'tests/scored/functional/judge.toml'
edit(J, [
    # row 32: the cross-post replay uses new text (so no duplicate-send key masks it); row 30: Harriet's load is a control
    ("As harriet@kittle.test open M-12 and record the request the page makes to load its messages, and note the M-12 transcript address. As gwen@kittle.test, post \"Lease question JUDGE-CS1\" in M-11 and record the posting request; it must appear in M-11 (positive control). From Gwen's session, replay her posting request aimed at M-12 using the M-12 identifier seen in Harriet's recorded request,",
     "As harriet@kittle.test open M-12 and record the request the page makes to load its messages (it shows M-12's messages, positive control), and note the M-12 transcript address. As gwen@kittle.test, post \"Lease question JUDGE-CS1\" in M-11 and record the posting request; it must appear in M-11 (positive control). From Gwen's session, replay her posting request aimed at M-12 using the M-12 identifier seen in Harriet's recorded request, with the text \"Cross post JUDGE-CS2\","),
    ("(check as harriet@kittle.test that M-12 has no JUDGE-CS1)",
     "(check as harriet@kittle.test that M-12 has no JUDGE-CS1 or JUDGE-CS2)"),
    # row 30: the live wall must not take Sian's other matters with it
    ("1. In Sian's page, without reloading, within about ten seconds M-12 disappears from her list and its thread stops showing messages or says it is not available.",
     "1. In Sian's page, without reloading, within about ten seconds M-12 disappears from her list and its thread stops showing messages or says it is not available, while M-11 and M-13 stay in her list and opening M-11 still shows its messages without signing in again (positive control)."),
    ("Sian gets not-available for M-11 and Dev for M-12;",
     "Sian gets not-available for M-11 while she can still open M-13, and Dev gets not-available for M-12;"),
    # row 28: the edited mark is graded once (edits_and_stale_edit)
    ("with the app's edit control: it shows edited (positive control).",
     "with the app's edit control: it now reads \"Costs estimate sent to Gwen JUDGE-TE\" (positive control)."),
    ("JUDGE-S0 shows edited, and if the app shows earlier versions,",
     "JUDGE-S0 reads \"Persist parent JUDGE-S0 edited\" (note whether it shows an edited mark), and if the app shows earlier versions,"),
    # row 27: shortened quotes and snippets are fine
    ("Check the thread, the reply's quote, a search for \"JUDGE-F1\" (the snippet), and the M-13 transcript.",
     "Check the thread, the reply's quote, a search for \"JUDGE-F1\" (the snippet), and the M-13 transcript; a shortened quote or snippet is fine, and whatever part of the text it shows must appear literally."),
])

# row 32: any changed target or parent also changes the duplicate-send key
edit('tests/scored/functional/prompt.md', [(
    "When a replay changes a message's text, also change any duplicate-send key\n  it carries.",
    "When a replay changes a message's text, target matter or parent, also change\n  any duplicate-send key it carries.")])

# row 31: one in-app refusal reason is checked, not only the sign-in one
edit(J, [(
    "change the text to \"Version stale JUDGE-E1\" and save: the edit is refused,",
    "change the text to \"Version stale JUDGE-E1\" and save: the edit is refused with a reason in words shown next to the edit box that is still there about ten seconds later,")])

c = tomllib.loads(open(J, encoding='utf8').read())['criterion']
print(len(c), sum(x['weight'] for x in c))
