from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
REPORT = Path(__file__).resolve().parent
TASK = ROOT / 'projects/common-ground-ballot'
judge = TASK / 'tests/functional/judge.toml'
text = judge.read_text(encoding='utf-8')
assert 'unforgeable_session_credentials' not in text
judge.write_text(text.rstrip() + '\n\n' + (REPORT/'session-criterion.toml').read_text(encoding='utf-8'), encoding='utf-8', newline='\n')
prompt = TASK / 'tests/functional/prompt.md'
text = prompt.read_text(encoding='utf-8')
text = text.replace('or ended-session credential replay.', 'ended-session credential replay, or the Phase A session-credential integrity probes.')
text = text.replace('listed boundary, replay, mismatch and namespace controls.', 'listed boundary, replay, mismatch, namespace and session-credential integrity controls.')
section = (REPORT/'session-probes.md').read_text(encoding='utf-8')
marker = '## Phase B:'
at = text.index(marker)
text = text[:at].rstrip() + '\n\n' + section.rstrip() + '\n\n' + text[at:]
prompt.write_text(text, encoding='utf-8', newline='\n')
print('Functional: 50 criteria; session integrity explicitly authorized and public.')
