
import hashlib,json,os,subprocess,sys
from pathlib import Path
case=sys.argv[1]
before={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in Path('/tests').rglob('*') if p.is_file()}
Path('/app').mkdir();Path('/app/server.js').write_text(Path('/evidence/probe-app.cjs').read_text())
if case=='assets_symlink': os.symlink('/tests','/assets')
else: Path('/assets').mkdir()
Path('/usr/local/bin/rewardkit').write_text(Path('/evidence/rewardkit-stub.py').read_text());Path('/usr/local/bin/rewardkit').chmod(0o755)
env=dict(os.environ,REWARDKIT_JUDGE='local-fixture',REWARDKIT_MODEL='local-fixture',ROW46_SYNTHETIC_PRIVATE_MARKER='synthetic-value-only',ANTHROPIC_AUTH_TOKEN='synthetic-value-only')
proc=subprocess.run(['/bin/bash','/tests/test.sh'],env=env,capture_output=True,text=True,timeout=20)
report={'case':case,'test_sh_returncode':proc.returncode,'harness_stderr':proc.stderr,'before_file_sha256':before,'tests_mode_after':oct(Path('/tests').stat().st_mode & 511),'observation':json.loads(Path('/probe-observation.json').read_text()),'final_reward':json.loads(Path('/logs/verifier/reward.json').read_text()),'fixture': 'Actual test.sh; local non-grading RewardKit transport stub exits 19; no provider and no configured grade.'}
print(json.dumps(report))
