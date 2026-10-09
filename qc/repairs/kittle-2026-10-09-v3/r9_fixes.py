"""Apply the confirmed QC round r9 fixes to the Kittle task (run from the task folder)."""
import tomllib


def edit(p, pairs):
    s = open(p, encoding='utf8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (p, a[:90])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf8', newline='').write(s)


# row 30: escape_closes shows a normal save and send work (positive controls)
P = 'tests/scored/polish/judge.toml'
edit(P, [(
    "the reply closes, and after a reload no \"Escaped reply JUDGE-K3\" was posted. Fails if Escape saves or posts anything, leaves either box open, or changes the message.",
    "the reply closes, and after a reload no \"Escaped reply JUDGE-K3\" was posted. Then, as positive controls, edit the message to \"Saved edit JUDGE-K3\" and save it the normal way: after a reload it reads \"Saved edit JUDGE-K3\"; and reply to it with \"Sent reply JUDGE-K3\" and send it the normal way: the reply appears under it. Fails if Escape saves or posts anything, leaves either box open, or changes the message, or if the normal save or send does not work.")])

# row 42: persistence requires only a core of its own controls; feature items graded elsewhere count only if they worked
J = 'tests/scored/functional/judge.toml'
edit(J, [
    ("c. Before restarting, each of these must already hold (positive controls): JUDGE-S1 sits under JUDGE-S0; JUDGE-S0 reads \"Persist parent JUDGE-S0 edited\" (note whether it shows an edited mark), and if the app shows earlier versions, opening JUDGE-S0's lists \"Persist parent JUDGE-S0\"; JUDGE-S1 shows On hold; M-12's timer shows 30 days; Sian gets not-available for M-11 while she can still open M-13, and Dev gets not-available for M-12; Dev's M-13 shows a definite unread count (a number, or clearly none); JUDGE-S2 is gone from M-11 and a search for \"Persist gone\" finds nothing; a search for \"Persist child JUDGE-S1\" finds it; and a search for \"Survey booked\" finds the M-11 message. Note each of these, plus how many results \"Survey booked\" returns, Dev's exact M-13 count, and whether searches for \"Probate\" and \"Insurer letter\" return anything.",
     "c. Before restarting, these core items must already hold (positive controls): JUDGE-S1 sits under JUDGE-S0; JUDGE-S0 reads \"Persist parent JUDGE-S0 edited\" (note whether it shows an edited mark); JUDGE-S2 is gone from M-11; and Gwen's \"Survey booked for Friday.\" shows in M-11. Then note how each of these other items stands, whether or not it worked (each is graded in its own criterion, so here it only has to stay the same): if the app shows earlier versions, whether opening JUDGE-S0's lists \"Persist parent JUDGE-S0\"; whether JUDGE-S1 shows On hold; what M-12's timer shows; what Sian gets for M-11 and M-13 and what Dev gets for M-12; Dev's exact M-13 unread count; what searches for \"Persist gone\", \"Persist child JUDGE-S1\", \"Survey booked\" (and how many results), \"Probate\" and \"Insurer letter\" return."),
    ("Fails if any step c positive control did not hold before the restart, if anything noted in step c differs after the restart, or if the restart tool reports an error.",
     "Fails if any step c core item did not hold before the restart, if any core item or anything noted in step c differs after the restart, or if the restart tool reports an error."),
])

for p in (J, P):
    c = tomllib.loads(open(p, encoding='utf8').read())['criterion']
    print(p, len(c), sum(x['weight'] for x in c))
