"""Bring the scripted golden harness in line with the r7 criteria fixes (run from qc/repairs/kittle-2026-10-08)."""
p = 'tests/functional.cjs'
s = open(p, encoding='utf8').read()


def r(a, b):
    global s
    assert s.count(a) == 1, a[:90]
    s = s.replace(a, b)


# wall_every_route leg 2: Dev's own search works.
r("""    for (const q of ['JUDGE-W0', 'heads of terms', 'Fenwick']) assert.deepEqual(await search(dev, q), []);""",
  """    for (const q of ['JUDGE-W0', 'heads of terms', 'Fenwick']) assert.deepEqual(await search(dev, q), []);
    assert.ok((await search(dev, 'Survey booked')).some(t => t.includes('Survey booked for Friday.')), 'Dev search works');""")

# timer_changes: the control offers all four settings.
r("""    await editMsg(harriet, 'Costs estimate sent to Gwen.', 'Costs estimate sent to Gwen JUDGE-TE');""",
  """    assert.deepEqual(await harriet.locator('#timer-select option').allTextContents(), ['Off', '1 day', '7 days', '30 days']);
    await editMsg(harriet, 'Costs estimate sent to Gwen.', 'Costs estimate sent to Gwen JUDGE-TE');""")

# unread: the second context and Gwen sit on M-11.
r("""    const devB = await ctx(); await signIn(devB, 'dev@kittle.test');""",
  """    const devB = await ctx(); await signIn(devB, 'dev@kittle.test'); await openMatter(devB, 'M-11');""")
r("""    await home(gwen);
    assert.ok((await unreadOf(gwen, 'M-13')) >= 2, 'gwen count is her own');""",
  """    await home(gwen); await openMatter(gwen, 'M-11');
    assert.ok((await unreadOf(gwen, 'M-13')) >= 2, 'gwen count is her own');""")

# Polish link_highlight: the copied-link route too.
r("""    const bg = await gwen.locator('#msg-K-3').evaluate(el => getComputedStyle(el).boxShadow);
    assert.ok(bg && bg !== 'none');""",
  """    const bg = await gwen.locator('#msg-K-3').evaluate(el => getComputedStyle(el).boxShadow);
    assert.ok(bg && bg !== 'none');
    await home(gwen); await openMatter(gwen, 'M-13');
    const link = await copyLink(gwen, 'Draft will sent for your review.');
    await openMatter(gwen, 'M-11');
    await gwen.goto(link);
    await gwen.waitForFunction(() => location.pathname === '/matters/M-13' && document.querySelector('#msg-K-8.focused'));""")

# Polish transcript_print: the transcript lists M-11's messages.
r("""    await p.goto(B + '/transcripts/M-11');""",
  """    await p.goto(B + '/transcripts/M-11');
    assert.ok((await p.locator('body').innerText()).includes('Survey booked for Friday.'), 'transcript lists messages');""")

open(p, 'w', encoding='utf8', newline='').write(s)
print('ok')
