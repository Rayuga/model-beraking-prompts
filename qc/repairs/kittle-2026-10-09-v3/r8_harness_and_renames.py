"""r8 follow-ups: row 48 renames in the task, and the harness brought in line with the r8 criteria.
Run from the worktree root."""
import tomllib

T = 'projects/kittle-matter-chat/'


def edit(p, pairs):
    s = open(p, encoding='utf8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (p, a[:90])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf8', newline='').write(s)


# Row 48: names that match what they check.
edit(T + 'tests/scored/polish/judge.toml', [
    ('id = "transcript_print"\nname = "transcript_print"', 'id = "transcript_phone"\nname = "transcript_phone"')])
edit(T + 'tests/scored/visual/judge.toml', [
    ('id = "phone_chambers"\nname = "phone_chambers"', 'id = "phone_thread"\nname = "phone_thread"')])
edit(T + 'tests/app_context.md', [
    ("The library of messages grows", "The set of messages grows")])
for d in ('polish', 'visual'):
    c = tomllib.loads(open(T + f'tests/scored/{d}/judge.toml', encoding='utf8').read())['criterion']
    print(d, [x['id'] for x in c])

# Harness.
p = 'qc/repairs/kittle-2026-10-08/tests/functional.cjs'
s = open(p, encoding='utf8').read()


def r(a, b):
    global s
    assert s.count(a) == 1, a[:90]
    s = s.replace(a, b)


# signin Part B: the cross post uses new text and key; Harriet's M-12 load is a positive control.
r("""    assert.equal((await replay(gwen, { ...req, url: req.url.replace('M-11', 'M-12') })).status, 404);""",
  """    assert.equal((await replay(gwen, { ...req, url: req.url.replace('M-11', 'M-12'), body: JSON.stringify({ body: 'Cross post JUDGE-CS2', client_key: 'cs2' }) })).status, 404);""")
r("""    const h12 = lastReq(harriet, 'GET', /\\/api\\/matters\\/M-12$/);""",
  """    const h12 = lastReq(harriet, 'GET', /\\/api\\/matters\\/M-12$/);
    assert.ok(JSON.stringify((await replay(harriet, h12)).data).includes('heads of terms'), 'Harriet M-12 load');""")
r("""    assert.ok(!JSON.stringify((await api(harriet, 'GET', '/api/matters/M-12')).data).includes('JUDGE-CS1'));""",
  """    assert.ok(!/JUDGE-CS1|JUDGE-CS2/.test(JSON.stringify((await api(harriet, 'GET', '/api/matters/M-12')).data)));""")

# wall_added_live leg 1: Sian keeps M-11 and M-13.
r("""    await sian.waitForFunction(() => !document.querySelector('#matter-list').textContent.includes('M-12') && /Not available/.test(document.querySelector('#main').innerText), null, { timeout: 10000 });""",
  """    await sian.waitForFunction(() => !document.querySelector('#matter-list').textContent.includes('M-12') && /Not available/.test(document.querySelector('#main').innerText), null, { timeout: 10000 });
    const sl = await sian.locator('#matter-list').innerText();
    assert.ok(sl.includes('M-11') && sl.includes('M-13'), 'other matters stay');
    await openMatter(sian, 'M-11'); assert.ok((await sian.locator('#thread').innerText()).includes('Survey booked for Friday.'));""")

# edits leg 2: the stale-edit reason stays about ten seconds.
r("""    await gwen2.waitForSelector('#composer-error:not([hidden])');""",
  """    await gwen2.waitForSelector('#composer-error:not([hidden])');
    await sleep(10000);
    assert.ok((await gwen2.locator('#composer-error').innerText()).trim().length > 0, 'stale-edit reason stays');""")

# timer_changes: the edited text is the control.
r("""    assert.equal(await msgLi(harriet, 'JUDGE-TE').locator('.edited').count(), 1);""",
  """    assert.equal(await msgLi(harriet, 'Costs estimate sent to Gwen JUDGE-TE').count(), 1);""")

# persistence before: Sian can still open M-13.
r("""    assert.equal((await api(sian, 'GET', '/api/matters/M-11')).status, 404);
    assert.equal((await api(dev, 'GET', '/api/matters/M-12')).status, 404);
    assert.deepEqual(await search(harriet, 'Persist gone'), []);""",
  """    assert.equal((await api(sian, 'GET', '/api/matters/M-11')).status, 404);
    assert.equal((await api(sian, 'GET', '/api/matters/M-13')).status, 200);
    assert.equal((await api(dev, 'GET', '/api/matters/M-12')).status, 404);
    assert.deepEqual(await search(harriet, 'Persist gone'), []);""")

open(p, 'w', encoding='utf8', newline='').write(s)
print('ok')
