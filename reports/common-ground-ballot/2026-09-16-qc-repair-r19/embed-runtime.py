from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[3]
TASK = ROOT / 'projects/common-ground-ballot'
TESTS = TASK / 'tests'
PRIVATE = '/opt/common-ground-verifier'
REPORT = Path(__file__).resolve().parent
HELPERS = ('app-lifecycle.py', 'browser-evidence.js', 'codex-trace.py', 'score.py', 'prompt-provenance.py')

def write(path, text):
    path.write_text(text, encoding='utf-8', newline='\n')

sources = {}
for name in HELPERS:
    sources[name] = (TESTS / name).read_text(encoding='utf-8').replace('/tests/browser-evidence.js', PRIVATE + '/browser-evidence.js')
sources['score.py'] = sources['score.py'].replace('Path(__file__).resolve().parent)', 'Path("/tests"))')
sources['codex-trace.py'] = sources['codex-trace.py'].replace("return ['/usr/local/bin/codex-original']", "return ['/usr/local/bin/codex']")
sources['codex-trace.py'] = sources['codex-trace.py'].replace(
    '        return command\n',
    '        if Path(command[0]).resolve() == Path(__file__).resolve():\n            raise ValueError("Trace target must be the real Codex executable")\n        return command\n')
sources['prompt-provenance.py'] = '''import hashlib
import json
import re
import sys
from pathlib import Path

def record_provenance():
    root = Path('/tests')
    private = Path('/opt/common-ground-verifier')
    sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
    record = {'task': 'common-ground-ballot', 'task_version': '1.0.0', 'judges': {}}
    for dimension in ('render', 'constraints', 'functional', 'polish', 'visual'):
        prompt = root / dimension / 'prompt.md'
        text = prompt.read_text()
        versions = re.findall(r'^Prompt version: (.+)$', text, re.M)
        assert re.findall(r'^Task version: (.+)$', text, re.M) == ['1.0.0']
        assert len(versions) == 1 and re.fullmatch('common-ground-ballot-' + dimension + r'-v1\\.0\\.0-r[1-9]\\d*', versions[0])
        record['judges'][dimension] = {'prompt_version': versions[0], 'prompt_sha256': sha(prompt), 'judge_sha256': sha(root / dimension / 'judge.toml')}
    record['runner_sha256'] = sha(root / 'test.sh')
    record['reward_sha256'] = sha(root / 'reward.toml')
    record['resource_sha256'] = {name: sha(private / name) for name in ('score.py', 'app-lifecycle.py', 'browser-evidence.js', 'codex-trace.py', 'prompt-provenance.py')}
    return record

if __name__ == '__main__':
    record = record_provenance()
    Path(sys.argv[1]).write_text(json.dumps(record, indent=2) + '\\n')
    print('Prompt provenance: ' + json.dumps(record, sort_keys=True), flush=True)
'''
runner = (TESTS / 'test.sh').read_text(encoding='utf-8')
for name in HELPERS:
    runner = runner.replace('/tests/' + name, PRIVATE + '/' + name)
bootstrap = '''# Evaluator helpers are materialized outside RewardKit's reward-discovery tree.
# Keep the installed Codex binary untouched. A private PATH shim wraps only exec;
# version/login/help are passed to the genuine absolute executable.
install -d -m 700 /opt/common-ground-verifier /opt/common-ground-verifier/bin
'''
for number, (name, source) in enumerate(sources.items()):
    delimiter = 'COMMON_GROUND_HELPER_' + str(number)
    assert delimiter not in source
    bootstrap += f"cat > {PRIVATE}/{name} <<'{delimiter}'\n{source.rstrip()}\n{delimiter}\n"
bootstrap += '''chmod 700 /opt/common-ground-verifier/codex-trace.py
ln -sfn /opt/common-ground-verifier/codex-trace.py /opt/common-ground-verifier/bin/codex
export CODEX_TRACE_REAL_COMMAND='["/usr/local/bin/codex"]'
export PATH="/opt/common-ground-verifier/bin:$PATH"
test -x /usr/local/bin/codex
timeout 20 codex --version > "$LOG_DIR/codex-version.txt" 2>&1
'''
runner = runner.replace('python3 ' + PRIVATE + '/prompt-provenance.py', bootstrap + '\npython3 ' + PRIVATE + '/prompt-provenance.py', 1)
write(TESTS / 'test.sh', runner)
helper_report = REPORT / 'runtime-sources'
helper_report.mkdir(exist_ok=True)
for name, source in sources.items():
    write(helper_report / name, source)
    (TESTS / name).unlink()
readme = '''# Common Ground Ballot package

The complete implementer brief is `instruction.md`. Copy the supplied foundation
and authoritative seed into `/app` before implementing the remaining workflows.
`solution/solve.sh` installs the reference application for Oracle runs.

Five verifier dimensions run serially. Each uses the adjacent `prompt.md` named by
its `judge.toml`. `tests/test.sh` creates private evaluator helpers under
`/opt/common-ground-verifier`; RewardKit discovers no root Python helper as a reward.
The image retains the genuine Codex executable. The runner installs an idempotent
private PATH shim for trace collection and forwards login/version/help unchanged.

'''
readme += (TESTS / 'SCORING.md').read_text(encoding='utf-8').replace('invokes score.py', 'invokes its generated private scorer').replace('Otherwise score.py', 'Otherwise the scorer')
write(TASK / 'README.md', readme)
(TESTS / 'SCORING.md').unlink()
for dimension in ('render', 'constraints', 'polish', 'visual'):
    prompt = TESTS / dimension / 'prompt.md'
    text = prompt.read_text(encoding='utf-8')
    for name in HELPERS:
        text = text.replace('/tests/' + name, PRIVATE + '/' + name)
    text = re.sub(r'(Prompt version: common-ground-ballot-\w+-v1\.0\.0-)r\d+', r'\g<1>r19', text)
    write(prompt, text)
print('Private runtime helpers embedded; five adjacent prompts retained; forbidden helper entries removed.')
