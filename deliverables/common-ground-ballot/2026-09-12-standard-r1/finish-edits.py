from pathlib import Path

exec((Path(__file__).parent / 'migrate.py').read_text().split('old_cfg =', 1)[0])
for dimension in ['render', 'constraints', 'functional', 'polish', 'visual']:
    p = task / f'tests/{dimension}/prompt.md'
    text = get(p).replace('require a meaningful interactive app at http://localhost:3000 that survives refresh,', 'require a meaningful interactive app at http://localhost:3000 without a fatal browser error that survives refresh,')
    text = text.replace('A blank page, static mock, hardcoded seed-only shell, or missing authenticated backend makes every criterion in this dimension fail.', 'If any global browser gate condition fails, assign 0 to every criterion in this dimension. A blank page, fatal browser error, static mock, hardcoded seed-only shell, or missing authenticated backend fails the gate.')
    edit(p, text)

for p in task.rglob('*'):
    if p.is_file() and p.suffix in {'.sh', '.py', '.js', '.css', '.html', '.toml', '.md'}:
        data = p.read_bytes()
        if b'\r\n' in data:
            p.write_bytes(data.replace(b'\r\n', b'\n'))
