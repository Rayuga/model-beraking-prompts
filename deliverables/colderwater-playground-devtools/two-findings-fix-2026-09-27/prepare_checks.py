from pathlib import Path

out = Path(__file__).resolve().parent
old = out.parent / 'final-cross-check-2026-09-27'
build = out / 'build_and_check_images.py'
build.write_text(build.read_text(encoding='utf-8').replace('20260927-final-cross-check', '20260927-two-findings-fix'), encoding='utf-8')
test = (old / 'test_regression_guards.py').read_text(encoding='utf-8')
test = test.replace("run('reserved URLs hidden from public note', [('environment/instructions/security.md', '/package.json', '/different-file.json')], False)", """run('privacy probe filenames leak into public note', [('environment/instructions/security.md', 'Keep those working files private', 'Reserve /app.db, /server.js and /package.json. Keep those working files private')], False)
run('sidecar probe removed', [(j, '/app.db-wal', '/other.db-wal')], False)
run('public asset exception removed', [(j, 'path actually used by the working playground', 'path with a suspicious filename')], False)
run('restart regains Duplicate prerequisite', [(j, 'using only New and ordinary Save', 'by making an independent duplicate')], False)
run('restart regains Delete prerequisite', [(j, 'QC Restart Second', 'QC Restart Deleted')], False)
run('deletion confirmation demanded by server-only check', [(j, 'do not require or grade confirmation here', 'require confirmation here')], False)
run('Auto-run absent control poisons gate', [(ctx, 'must not by itself fail Render, Constraints or unrelated checks', 'must fail every gate')], False)""")
(out / 'test_regression_guards.py').write_text(test, encoding='utf-8')
