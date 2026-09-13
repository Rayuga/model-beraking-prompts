from __future__ import annotations
import hashlib
import json
import re
import shutil
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SLUG = 'patchpad-editor-v3'
TASK = ROOT / 'projects' / SLUG
RUNS = ROOT / 'run-outputs' / SLUG
OUT = HERE.parent / 'final-submission-20260913'
REFERENCE = ROOT / 'deliverables/brickfall-breaker-arcade/final-submission-20260912'
SOURCE_ZIP = HERE.parent / '1.0.0-editing-depth-20260913' / (SLUG + '.zip')
TEMPLATES = {'eval': REFERENCE / 'EVAL-REPORT-brickfall-breaker-arcade.docx', 'case': REFERENCE / 'CASE-STUDY-brickfall-breaker-arcade.docx'}
JOBS = {
    'oracle': ('run-08e5c411-7f8e-40a4-afac-47689b9d832a', 'KWEbkhe', 'Oracle'),
    'gpt-5.4-mini-high': ('run-19fa3352-989a-4306-bc14-fc57cca17d9b', 'XDzZG5e', 'GPT-5.4 mini (high)'),
    'gemini-3.7-flash': ('run-94c32bc4-7dcc-4574-b511-b11e07b71564', 'yeYzfVZ', 'Gemini 3.7 Flash (high)'),
    'claude-haiku-4.5': ('run-918618b3-4e1d-47da-988e-7e306001ec0a', 'iP3FvE3', 'Claude Haiku 4.5'),
}
DIMS = ['render', 'constraints', 'functional', 'polish', 'visual']
SHA = 'a3511a525675554aaa1ee89b5e77fb69ad4f7a94a1fc68b7d137bc39053439a6'
CHECKSUM = '132a2f0fb7ae8e5a9a02f154fe7d5de1d2c232c7aaf45e3e3f0c5d057dc9f659'
sha = lambda b: hashlib.sha256(b).hexdigest()
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
tree = lambda p: {f.relative_to(p).as_posix(): sha(f.read_bytes()) for f in sorted(p.rglob('*')) if f.is_file()}
fmt = lambda n: f'{n:.4f}'

# Reuse only the reviewed document rendering helper, with the actual Brickfall final documents as style templates.
helper_path = ROOT / 'deliverables/brickfall-breaker-arcade/submission-preparation-20260912/build_submission.py'
helper = helper_path.read_text(encoding='utf-8')
helper = helper[helper.index('\nNS = ') + 1:helper.index('\ndef fmt(')]
helper = helper.replace('Brickfall task delivery', 'PatchPad task delivery').replace('12 September 2026', '13 September 2026')
helper = helper.replace('assert "0.9583" in text and "0.6094" in text and "0.1689" in text', 'assert "1.0000" in text and "0.5605" in text and "0.2233" in text and "0.7622" in text')
exec(compile(helper, str(helper_path) + ':document-helper', 'exec'), globals())


def load_evidence():
    records = {}
    for key, (job, suffix, label) in JOBS.items():
        trial = RUNS / job / f'{SLUG}__{suffix}'
        result = read(trial / 'result.json')
        reward = read(trial / 'verifier/reward.json')
        details = read(trial / 'verifier/reward-details.json')
        provenance = read(trial / 'verifier/prompt-provenance.json')
        assert result['task_checksum'] == CHECKSUM
        assert result['exception_info'] is None
        assert result['verifier_result']['rewards'] == reward
        assert reward['graded'] == 1 and reward['no_op'] == 0
        assert len([c for d in DIMS for c in details[d]['criteria']]) == 41
        for dim in DIMS:
            for kind, ext in [('prompt', 'md'), ('judge', 'toml')]:
                assert sha((TASK / f'tests/{dim}/{kind}.{ext}').read_bytes()) == provenance['judges'][dim][kind + '_sha256']
            criteria = details[dim]['criteria']
            weighted = sum(c['value'] * c['weight'] for c in criteria) / sum(c['weight'] for c in criteria)
            assert abs(weighted - reward[dim]) <= .000051
        assert sha((TASK / 'tests/test.sh').read_bytes()) == provenance['runner_sha256']
        assert sha((TASK / 'tests/reward.toml').read_bytes()) == provenance['reward_config_sha256']
        assert round(.6 * reward['functional'] + .2 * reward['polish'] + .2 * reward['visual'], 4) == reward['reward']
        records[key] = dict(job=job, suffix=suffix, label=label, path=trial, result=result, rewards=reward, details=details)
    assert records['oracle']['rewards']['reward'] == 1
    assert all(c['value'] == 1 for d in DIMS for c in records['oracle']['details'][d]['criteria'])
    assert .1 <= records['gpt-5.4-mini-high']['rewards']['reward'] <= .7
    nop = read(RUNS / JOBS['oracle'][0] / f'{SLUG}__eNxTkub/verifier/reward.json')
    assert nop['no_op'] == 1 and nop['graded'] == 0 and nop['reward'] == 0
    for f in (TASK / 'solution/app').rglob('*'):
        if f.is_file():
            assert f.read_bytes() == (records['oracle']['path'] / 'artifacts/app' / f.relative_to(TASK / 'solution/app')).read_bytes()
    return records


def job_zips(records):
    secret_key = re.compile(r'(?:api[_-]?key|api[_-]?token|client[_-]?secret|secret[_-]?key|access[_-]?key)', re.I)
    literal = re.compile(r'\b(?:sk-(?:proj-|or-v1-|ant-)?[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{30,})\b')
    secrets = set()
    def find(obj):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if secret_key.search(k) and isinstance(v, str) and len(v) >= 12 and not any(x in v.lower() for x in ['${', 'redacted', 'placeholder', 'your_', 'your-', 'dummy', 'not-set']):
                    secrets.add(v)
                find(v)
        elif isinstance(obj, list):
            for v in obj: find(v)
    for f in RUNS.rglob('*'):
        if f.is_file():
            try:
                text = f.read_text(encoding='utf-8')
                secrets.update(literal.findall(text))
                if f.suffix == '.json': find(json.loads(text))
            except (UnicodeError, ValueError): pass
    audit = {}
    for key, record in records.items():
        src = RUNS / record['job']
        wrapper = f'{SLUG}-{key}-job-directory'
        excluded, changed, hashes = [], [], {}
        with zipfile.ZipFile(OUT / (wrapper + '.zip'), 'x', zipfile.ZIP_DEFLATED) as z:
            for f in sorted(src.rglob('*')):
                if not f.is_file(): continue
                name = f.relative_to(src).as_posix()
                if set(f.relative_to(src).parts) & {'node_modules', '.git', '__pycache__', '.cache', '.codex', 'codex-home'} or f.name.startswith('.env') or re.search(r'\.(?:db|sqlite|sqlite3)(?:-wal|-shm|-journal)?$', f.name):
                    excluded.append(name)
                    continue
                original = f.read_bytes()
                data = original
                try:
                    text = data.decode('utf-8')
                    for s in sorted(secrets, key=len, reverse=True):
                        text = text.replace(s, '[REDACTED_PROVIDER_CREDENTIAL]').replace(json.dumps(s)[1:-1], '[REDACTED_PROVIDER_CREDENTIAL]')
                    data = text.encode('utf-8')
                except UnicodeError:
                    assert not any(s.encode() in data for s in secrets)
                if data != original: changed.append({'file': name, 'source_sha256': sha(original), 'packaged_sha256': sha(data)})
                assert not literal.search(data.decode('utf-8', errors='ignore'))
                assert b'PRIVATE KEY-----' not in data
                info = zipfile.ZipInfo(wrapper + '/' + name, (2026, 9, 13, 0, 0, 0))
                info.create_system = 3
                info.external_attr = (0o100755 if f.suffix == '.sh' else 0o100644) << 16
                info.compress_type = zipfile.ZIP_DEFLATED
                z.writestr(info, data)
                hashes[info.filename] = sha(data)
        with zipfile.ZipFile(OUT / (wrapper + '.zip')) as z:
            assert z.testzip() is None
            assert {n: sha(z.read(n)) for n in z.namelist()} == hashes
            prefix = wrapper + '/' + record['path'].name + '/verifier/'
            assert z.read(prefix + 'reward.json') == (record['path'] / 'verifier/reward.json').read_bytes()
            assert z.read(prefix + 'reward-details.json') == (record['path'] / 'verifier/reward-details.json').read_bytes()
        audit[key] = {'file': wrapper + '.zip', 'excluded': excluded, 'redacted': changed, 'entry_hashes': hashes}
    return audit, len(secrets)


def intro(doc, subtitle):
    doc.paragraph(doc.title, 'Title')
    doc.paragraph(subtitle, color='52657A')
    doc.paragraph('Harbor task: turing/patchpad-editor-v3 | version 1.0.0 | prepared 13 September 2026', size=18)
    doc.paragraph('Scope: recorded platform outcomes. GPT-5.4 mini is the score target; Gemini has no score restriction. The user authorized final packaging with the reported evidence limitations retained. No scores, task requirements or verifier weights were changed.', size=18)


def scores(doc, records):
    rows = []
    for key, r in records.items():
        count = sum(c['value'] == 1 for c in r['details']['functional']['criteria'])
        status = f'{count}/29 Functional'
        if key == 'claude-haiku-4.5': status = 'Functional gate failed; 29 checks skipped'
        rows.append([r['label'], fmt(r['rewards']['reward'])] + [fmt(r['rewards'][d]) for d in DIMS] + [status])
    rows.append(['No-op control', '0.0000', '0', '0', '0', '0', '0', 'graded=0; no_op=1'])
    doc.table(['Run', 'Overall', 'Render', 'Constr.', 'Func.', 'Polish', 'Visual', 'Recorded status'], rows, [1880,850,820,820,820,820,820,3610], size=16)


FEATURES = [
    ['Custom editor and seed', 'Custom DOM/canvas/SVG document surface; supplied Northwind API Incident Report; 1,226 logical lines, original metadata and revision 1.'],
    ['Editing and selection', 'Logical line/cursor positions, word navigation, grapheme-safe Unicode, mouse word/line/range selection, offscreen selection and multiple carets.'],
    ['Clipboard and history', 'Exact multiline/tabbed copy-cut-paste, typing groups, atomic selection replacement, block indentation, Replace All, Undo/Redo and redo-branch invalidation.'],
    ['Saved revisions', 'Explicit Save, no-op save invariants, reload/fresh-client persistence, revision preview and unsaved restore with Undo.'],
    ['Server safety', 'SQLite durability, restart seed idempotence, chained two-tab stale-save conflicts and malformed/contradictory save rejection without mutation.'],
    ['Interface', 'Discoverable controls, focus and readable feedback; five visual axes at 1280 by 800. No mobile or sign-in requirement.'],
]
GPT_GAPS = [
    ['edit_save_reload_and_fresh_client', 'The marker saved and reloaded, but the full pre-save draft comparison was not established.'],
    ['backspace_delete_exact_line_join', 'Two attempts did not establish the required three adjacent lines, so the boundary edits were unverified.'],
    ['multi_caret_full_typing_single_undo', 'The judge did not establish three visible carets, so typing/Undo/Redo was unverified.'],
    ['multi_caret_backspace_delete_sibling', 'The judge did not establish the second caret required for deletion.'],
    ['replace_all_atomic_history_and_branch', 'Replace All and single Undo/Redo worked, but the branch insertion and Redo invalidation checkpoint were not established.'],
]


def build_case(records):
    d = Report('Case Study - PatchPad Editor v3', 'case')
    intro(d, 'A long-report editor combining exact text operations with durable, conflict-safe revisions')
    d.paragraph('Recorded scores: Oracle 1.0000 | GPT-5.4 mini 0.5605 | Haiku 4.5 0.2233 | Gemini 3.7 Flash 0.7622 | no-op 0.0000')
    d.heading('1. What the task is')
    d.paragraph('Build PatchPad from an empty /app: a browser editor for long incident reports, with a custom editing surface, SQLite as the source of truth and a reliable saved-revision history. The supplied Northwind API Incident Report has 1,226 logical lines, including exact generated markers and a tail sentinel. Five detailed instruction files accompany the short product brief.')
    d.table(['Area', 'Required behavior'], FEATURES, [2800,7640])
    d.paragraph('One Node.js application starts with npm start on 0.0.0.0:${PORT:-3000}. Dependencies must be available at startup. Public networking is permitted; document data, saves and history remain local and server-backed. A native textarea/contenteditable or ready-made editor may not implement the document surface; a small hidden input for keyboard or clipboard plumbing is permitted.')
    d.heading('2. Why the task requires more than presentation')
    d.paragraph('The same document must survive distinct state transitions: exact unsaved edits, grouped Undo/Redo, persisted saves, revision restoration and concurrent writes. A visually convincing editor can still split graphemes, change an unselected line during indentation, lose an Undo group or overwrite a newer revision.')
    d.paragraph('Version v3 adds selected-block indentation with preserved selection and atomic history, plus whole-document Replace All Undo/Redo and branch invalidation. These behaviors are stated in the product brief and each has a distinct Functional criterion. The existing 60/20/20 reward formula remains unchanged.')
    d.heading('3. How it is evaluated')
    d.paragraph('Codex with gpt-5.6-luna and max reasoning uses Playwright MCP against the live app. There are 41 criteria: Render 2, Constraints 2, Functional 29, Polish 3 and Visual 5. Functional criterion weights total 22.75. Render/Constraints are prerequisites; the final reward is 60% Functional, 20% Polish and 20% Visual. The agent budget is 7,200 seconds and the separate verifier budget is 13,200 seconds.')
    scores(d, records)
    d.heading('4. Target-model result: GPT-5.4 mini')
    g = records['gpt-5.4-mini-high']
    count = sum(c['value'] == 1 for c in g['details']['functional']['criteria'])
    d.paragraph(f'GPT-5.4 mini with high reasoning completed normally, passed Render and Constraints, and scored 0.5605 overall. Functional was 0.4286 ({count}/29 criteria; 9.75 of 22.75 weight), Polish 0.6667 and Visual 0.8500. Its official reward is within the 0.10-0.70 target band. The internal 0.50 aspiration is not an additional acceptance restriction.')
    d.paragraph('The judge reported unpadded seed markers, incorrect selection/navigation outcomes and block indentation that joined BLOCK-THREE with BLOCK-OUTSIDE. It also credited persistence, chained stale-save conflicts, revision preview/restore, restart durability and the direct API rejection matrix. The run therefore demonstrates substantial implementation alongside reported editing defects.')
    d.paragraph('Five editing/persistence criteria also contain incomplete setup or evidence capture. These are not all proven judge mistakes: an app defect may have prevented setup. They were not reproduced against GPT during this preparation. Missing padded seed markers also block dependent tests; failed criteria should not be counted as separate root defects. The recorded score is preserved, not replaced with an estimated corrected score.')
    d.table(['Recorded criterion', 'Evidence limitation'], [[x.replace('_',' '),y] for x,y in GPT_GAPS], [4200,6240])
    d.heading('5. Oracle and comparison runs')
    d.paragraph('Oracle scored 1.0000 in every dimension and passed all 41 criteria, including all 29 Functional criteria. The empty-submission control scored 0.0000 with graded=0 and no_op=1. The Oracle source exported by the run matches the packaged golden application.')
    d.paragraph('Gemini completed with no trial exception and scored 0.7622. It has no score restriction and is included as comparison evidence. Its judge lost a Restore/Undo checkpoint to a result-assembly error. A focused local browser diagnostic on unchanged source passed revision preview, unsaved Restore and one Undo, while independently reproducing multi-caret typing Undo leaving MULT after typing MULTI. These diagnostics do not change the official score or establish a full regrade.')
    d.paragraph('Haiku completed at 0.2233, with Render/Constraints 1.0, Functional 0.0, Polish 0.6667 and Visual 0.45. Functional reported a zero-width/clipped editor and failed its browser gate, skipping all 29 behavior checks. Other dimensions credited Find/preview interactions. Its total is comparison evidence, not 29 independently demonstrated behavioral failures.')
    d.heading('6. What these results support')
    d.paragraph('The official Oracle-to-GPT gap is 0.4395. Oracle completed all Functional requirements; GPT received stronger presentation scores than Functional scores. This supports reporting a useful measured separation for the target model, while the identified evidence gaps limit causal claims about individual failures. One trial per model is not a repeatability study or complete fairness certification.')
    delivery(d)
    d.save(OUT / f'CASE-STUDY-{SLUG}.docx')


def delivery(d):
    d.heading('Delivery and provenance')
    d.paragraph('The final folder follows the supplied seven-file delivery layout: unchanged task ZIP, Oracle/no-op job-directory ZIP, GPT-mini job-directory ZIP, Gemini job-directory ZIP, Haiku job-directory ZIP, this case study and the companion evaluation report. Job exports preserve recorded scores, criterion reasons, source and trajectories. Runtime databases and caches are excluded; sanitization is packaging-only.')
    d.paragraph('All five trials share task checksum ' + CHECKSUM + '. All logged verifier hashes match the packaged source. All 32 task archive files match current source; the task ZIP checksum is ' + SHA + '.')
    d.paragraph('No deliberate cheating was found in the reviewed source and builder trajectories. The scan found no matching credential tokens or grader-directed tampering. This is a scoped assessment, not an absolute guarantee. Native judge action traces and a platform QC report were not present in the supplied exports. Packaging does not claim either has been produced.')
    d.paragraph('The user authorized this final package after review of GPT evidence gaps. Scores and requirements remain unchanged; Gemini is not subject to the target score band. The evaluation report contains every criterion outcome and the recorded failure explanations, with an index to the included jobs.')


def build_eval(records):
    d = Report('PatchPad Editor v3 - Evaluation Report', 'eval')
    intro(d, 'Harbor Web Development Task | Oracle, target-model and comparison-run evidence')
    d.heading('Headline')
    d.paragraph('Oracle scored 1.0000 and passed all 41 criteria. GPT-5.4 mini (high), the target model, scored 0.5605 within the 0.10-0.70 band. Gemini completed at 0.7622 with no score restriction. Haiku completed at 0.2233 with its Functional browser gate failed. The no-op control scored 0.0000. All four evaluated apps have graded=1, no_op=0 and no trial exception.')
    d.heading('Title, runtime and evaluated features')
    d.paragraph('PatchPad is a custom incident-report editor with exact long-document editing, find/replace, clipboard operations, multiple carets, atomic history and conflict-safe SQLite revisions. The golden app uses a custom DOM surface and Node built-in SQLite, started by npm start; its manifest declares /app/data/patchpad.db. The agent may choose its own custom implementation within the five supplied specifications.')
    d.table(['Area', 'Coverage'], FEATURES, [2800,7640])
    d.paragraph('Five batched browser dimensions use Codex / gpt-5.6-luna, max reasoning, temperature 0 and Playwright MCP. There are 41 criteria: 2 Render, 2 Constraints, 29 Functional, 3 Polish and 5 Visual. Visual reviews only the 1280 by 800 desktop layout. Agent and verifier networking are public. Authentication and mobile layouts are not requirements.')
    d.heading('Overall scores')
    scores(d, records)
    d.paragraph('Binary pass counts differ from weighted scores. Haiku Functional zeros are gate assignments, not independently executed checks. Visual raw ratings use the installed runner normalization: 4 becomes 0.75 and 5 becomes 1.00. The no-op zero is an ungraded floor control, not a model failure.')
    d.heading('Reward arithmetic')
    d.paragraph('If Render <= 0 or Constraints <= 0: Overall = 0. Otherwise: Overall = round(0.6 x Functional + 0.2 x Polish + 0.2 x Visual, 4).')
    rows=[]
    for r in records.values():
        s=r['rewards']; earned=sum(c['value']*c['weight'] for c in r['details']['functional']['criteria'])
        rows.append([r['label'],f'{earned:g} / 22.75 = {fmt(s["functional"])}',f'0.6 x {fmt(s["functional"])} + 0.2 x {fmt(s["polish"])} + 0.2 x {fmt(s["visual"])} = {fmt(s["reward"])}'])
    d.table(['Run','Functional weight earned','Final calculation'],rows,[2600,2450,5390])
    d.heading('Dimension scores and budgets')
    d.table(['Dimension','Criteria','Budget','Role','Oracle','GPT-mini','Gemini','Haiku'],[[dim.title(),str(len(records['oracle']['details'][dim]['criteria'])),str(records['oracle']['details'][dim]['judge']['timeout'])+' s','Gate' if dim in DIMS[:2] else {'functional':'60%','polish':'20%','visual':'20%'}[dim]]+[fmt(r['rewards'][dim]) for r in records.values()] for dim in DIMS],[1750,850,1150,950,1430,1430,1430,1450])
    d.page_break()
    d.heading('All 41 verifiers - recorded results')
    d.paragraph('These are exported verdicts, not substituted local grades. Each evaluated application has an outcome for every criterion; a gate-assigned Fail does not imply the behavior was individually exercised.')
    for dim in DIMS:
        d.heading(dim.title(),2)
        rows=[]
        for index,c in enumerate(records['oracle']['details'][dim]['criteria']):
            row=[c['id'].replace('_',' '),str(c['weight'])]
            for r in records.values():
                other=r['details'][dim]['criteria'][index]; assert c['id']==other['id']
                row.append(str(other['raw'])+'/5' if dim=='visual' else 'Pass' if other['value']==1 else 'Fail')
            rows.append(row)
        d.table(['Criterion (underscores shown as spaces)','Weight','Oracle','GPT-mini','Gemini','Haiku'],rows,[4800,800,1210,1210,1210,1210])
    d.heading('Oracle coverage')
    d.paragraph('All 36 binary criteria passed and all five Visual criteria scored raw 5/5. Every Functional observation is present, including block indentation, Replace All atomic history, stale saves, rejected API probes and two managed restarts. This is a recorded full Oracle pass; preparation did not run a new paid judge.')
    d.page_break()
    d.heading('GPT-5.4 mini - interpretation and evidence gaps')
    d.paragraph('The official 0.5605 is inside the target band. Some failed checks never reached a valid action or complete comparison. This limits attribution; it does not prove the app would pass and does not justify changing the official score.')
    d.table(['Criterion','Unresolved evidence'],[[x.replace('_',' '),y] for x,y in GPT_GAPS],[4200,6240])
    d.paragraph('The judge separately reported unpadded ALPHA markers, Shift+Tab joining the following line, and selected-block indentation altering the outside line. Missing seed markers also blocked the exact offscreen and separate-location setups; those observations share a seed defect and should not be presented as independent root bugs. No focused GPT browser regrade was performed during preparation.')
    d.heading('Failed verifiers - exact exported judge explanations')
    for key,r in records.items():
        if key=='oracle': continue
        d.heading(r['label'],2)
        for dim in DIMS:
            failures=[c for c in r['details'][dim]['criteria'] if c['value']<1]
            if failures:
                d.heading(dim.title()+' - recorded deductions',3)
                d.table(['Criterion / recorded value','Exported judge explanation'],[(c['id'].replace('_',' ')+(' | '+str(c['raw'])+'/5' if dim=='visual' else ' | Fail'),c['reasoning']) for c in failures],[3700,6740])
    d.heading('Comparison-run interpretation')
    d.paragraph('Gemini has no score restriction. It completed normally at 0.7622; its higher score is retained as comparison evidence. The judge explicitly lost the revision Restore/Undo checkpoint to a result-assembly error, and other deductions cite focus/selection setup problems. These do not establish that every failed criterion is an app defect.')
    d.paragraph('A focused offline diagnostic of unchanged Gemini source reproduced multi-caret Undo leaving MULT at all three positions after typing MULTI. Its preview of revision 1, unsaved Restore and single Undo passed complete content comparisons without changing saved content or history. Four local attempts were retained in the workspace review, including focus/coordinate setup failures; the final diagnostic tested typing groups at observed interior positions, not proof of correct start-of-line placement. It used a cached verifier image and is not an official regrade.')
    d.paragraph('Haiku Functional failed its global browser gate: the judge described zero editor width, offscreen text/caret and an intercepted click. It then assigned zero to all 29 criteria without individually testing their behavior. Render/Constraints credited Find interactions and Visual awarded partial credit despite reporting clipped report text. The disagreement remains documented; the final 0.2233 is not silently changed.')
    d.heading('Run index and evidence locations')
    for key,r in records.items():
        d.paragraph(r['label']+' | '+r['job']+' | '+r['path'].name, size=18)
        d.paragraph(f'Archive: {SLUG}-{key}-job-directory.zip. Inside its matching wrapper, {r["path"].name}/verifier/reward.json gives the authoritative score; reward-details.json gives all criterion reasons; prompt-provenance.json gives verifier hashes. Trial result.json records completion and task checksum. Builder trajectories are in agent/trajectory.json for model runs.',size=18)
    d.paragraph('The Oracle job archive also includes patchpad-editor-v3__eNxTkub, the no-op trial, plus the original job-level config, lock, result and logs. There is one supplied Oracle, one no-op and one trial for each comparison/target model; no trial was dropped to select a more favorable score.')
    delivery(d)
    d.save(OUT / f'EVAL-REPORT-{SLUG}.docx')


def main():
    before={'task':tree(TASK),'runs':tree(RUNS),'templates':tree(REFERENCE)}
    records=load_evidence()
    assert sha(SOURCE_ZIP.read_bytes())==SHA
    with zipfile.ZipFile(SOURCE_ZIP) as z:
        assert z.testzip() is None and len(z.namelist())==32
        assert {n.removeprefix(SLUG+'/'):sha(z.read(n)) for n in z.namelist()}==before['task']
    OUT.mkdir(exist_ok=False)
    shutil.copy2(SOURCE_ZIP,OUT/(SLUG+'.zip'))
    archives,secret_count=job_zips(records)
    build_case(records); build_eval(records)
    assert len(list(OUT.iterdir()))==7
    assert before=={'task':tree(TASK),'runs':tree(RUNS),'templates':tree(REFERENCE)}
    for f in OUT.glob('*.docx'):
        with zipfile.ZipFile(f) as z:
            text=' '.join(t.text or '' for t in ET.fromstring(z.read('word/document.xml')).iter(w('t')))
            assert not any(s.lower() in text.lower() for s in ['brickfall','drawbill','Harborview','replacement pending'])
            assert all(s in text for s in ['1.0000','0.5605','0.7622','0.2233','0.0000'])
            if f.name.startswith('EVAL'):
                normalized=' '.join(text.split())
                for r in records.values():
                    for dim in DIMS:
                        for c in r['details'][dim]['criteria']:
                            assert c['id'].replace('_',' ') in text
                            if c['value']<1: assert ' '.join(c['reasoning'].split()) in normalized
    audit={'created':'2026-09-13','format_reference':str(REFERENCE.relative_to(ROOT)),'task_zip_sha256':SHA,'task_checksum':CHECKSUM,'files':tree(OUT),'job_archives':archives,'redacted_secret_count':secret_count,'source_hashes_before_and_after':before,'scores':{k:r['rewards'] for k,r in records.items()},'validation':{'seven_files':True,'all_41_criteria_in_eval':True,'all_recorded_deductions_in_eval':True,'source_and_original_runs_unchanged':True,'task_zip_unchanged':True,'reward_arithmetic_passed':True,'word_rendering_pending':True}}
    (HERE/'package-audit.json').write_text(json.dumps(audit,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'folder':str(OUT),'files':list(audit['files']),'excluded':{k:v['excluded'] for k,v in archives.items()},'redacted_secret_count':secret_count,'validation':audit['validation']},indent=2))

if __name__=='__main__': main()
