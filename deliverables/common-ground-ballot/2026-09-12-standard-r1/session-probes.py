from pathlib import Path

exec((Path(__file__).parent / 'migrate.py').read_text().split('old_cfg =', 1)[0])
p = task / 'tests/functional/judge.toml'
text = get(p)
needle = 'A local-only logout, ordinary logout revoking the other session, or either session surviving End all sessions fails.'
text = text.replace(needle, needle + '\nBefore each sign-out, retain the actual session credential used by a successful protected read. After ordinary sign-out, replay that read with the ended credential; after End all sessions, replay it with each ended credential. Every replay must return non-2xx. Use the browser request context with captured authentication headers for HttpOnly cookies, or a same-origin request with the actual bearer header; do not mutate browser cookies/storage or print credential values. An unauthenticated request after merely clearing a local cookie is not proof of server revocation.')
edit(p, text)
p = task / 'tests/functional/prompt.md'
text = get(p).replace('common-ground-ballot-functional-v1.0.0-r1','common-ground-ballot-functional-v1.0.0-r2')
text = text.replace('or server-side role enforcement.', 'server-side role enforcement, or ended-session credential replay.')
text = text.replace('The sole permitted infrastructure action', 'For ended-session checks only, the browser request context may replay a previously observed same-origin protected read with its captured authentication headers. Do not use it for UI setup, manufacture sessions, alter cookies/storage, or log secrets.\n\nThe sole permitted infrastructure action')
edit(p, text)
p = out / 'browser-regression.cjs'
text = get(p)
text = text.replace("  const second = await person('ruth');", """  const second = await person('ruth');
  const credential = async page => (await page.context().cookies()).filter(c=>c.name==='cg_session').map(c=>c.name+'='+c.value).join('; ');
  const oldSecond = await credential(second);
  const revokedRead = async (page, cookie) => {
    const response = await page.context().request.get('http://localhost:3000/api/ballots', {headers:{Cookie:cookie}});
    assert.equal(response.status(),401);
  };""")
text = text.replace("  await signIn(second, 'ruth');", "  await revokedRead(second, oldSecond);\n  await signIn(second, 'ruth');\n  const allSecond = await credential(second), allRuth = await credential(ruth);")
text = text.replace("  await signIn(ruth, 'ruth');", "  await revokedRead(second, allSecond);\n  await revokedRead(ruth, allRuth);\n  await signIn(ruth, 'ruth');")
edit(p, text)
for p in [task/'tests/functional/judge.toml',task/'tests/functional/prompt.md']:
    p.write_bytes(p.read_bytes().replace(b'\r\n', b'\n'))
