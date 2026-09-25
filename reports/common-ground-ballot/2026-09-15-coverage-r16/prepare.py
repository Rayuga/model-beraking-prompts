from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
OLD = ROOT / 'reports/common-ground-ballot/2026-09-15-oracle-ready-r15'
TASK = ROOT / 'projects/common-ground-ballot'
for name in ['validate.py', 'run-local.py', 'browser-regression.cjs', 'auth-gate.cjs',
             'session-regression.cjs', 'mcp-crosscheck.cjs', 'qc-score-regression.py',
             'polish-regression.cjs', 'role-matrix.cjs', 'agent-smoke.cjs',
             'strict-regression.cjs', 'staff-regression.cjs']:
    content = (OLD / name).read_text(encoding='utf-8').replace('20260915-r15', '20260915-r16')
    content = content.replace('functional=39, polish=8', 'functional=43, polish=10')
    content = content.replace('all 56 criteria', 'all 62 criteria')
    if name == 'run-local.py':
        content = content.replace("'qc','polish','roles']", "'qc','polish','roles','coverage']")
        content = content.replace("    elif args.mode=='roles':", "    elif args.mode=='coverage':\n        browser(script='coverage-regression.cjs')\n    elif args.mode=='roles':")
        content = content.replace("    mutation = os.environ.get('LOCAL_MUTATION')", "    from coverage_mutants import mutate\n    mutate(APP, os.environ.get('COVERAGE_MUTATION'))\n    mutation = os.environ.get('LOCAL_MUTATION')")
    (OUT / name).write_text(content, encoding='utf-8', newline='\n')
(OUT / 'Dockerfile.local-verifier').write_text('FROM ballot-verifier:20260915-r15-local\nRUN rm -rf /tests\nCOPY . /tests\nRUN chmod +x /tests/test.sh && chmod -R go-rwx /tests\nWORKDIR /tests\n', encoding='utf-8')

# Current profile is detected by the new prompt version, so historical r15
# packages remain checkable without requiring the added criteria retroactively.
new_polish = "{'status_text_without_color','unavailable_action_guidance'} if ballot_r16 else set()"
old_set = "{'responsive_workspace_navigation','keyboard_control_operation','semantic_labels_and_landmarks','visible_and_managed_focus','persistent_action_feedback','theme_switch_preserves_workspace','comfortable_touch_targets','reduced_motion_preference'}"
for name in ['check-standard.py', 'check-upload.py']:
    path = ROOT / 'references/task-templates' / name
    source = path.read_text(encoding='utf-8')
    if name == 'check-standard.py':
        anchor = "    ballot_r15 = centralized_ballot and (task/'tests/SCORING.md').is_file()"
        extra = "\n    ballot_r16 = ballot_r15 and 'common-ground-ballot-polish-v1.0.0-r8' in (task/'tests/polish/prompt.md').read_text(encoding='utf-8')"
        guard = "            if dim=='polish':"
        checks = "            if dim=='functional' and ballot_r16:\n                check('Observer positive read coverage', {'observer_ballot_setup_access','observer_published_results_access','observer_members_access','observer_audit_access'} <= ids)\n"
    else:
        anchor = "        ballot_r15=wrapper=='common-ground-ballot' and 'tests/SCORING.md' in files"
        extra = "\n        ballot_r16=ballot_r15 and b'common-ground-ballot-polish-v1.0.0-r8' in files.get('tests/polish/prompt.md',b'')"
        guard = "                    if d=='polish':"
        checks = "                    if d=='functional' and ballot_r16:check('Observer positive read coverage',{'observer_ballot_setup_access','observer_published_results_access','observer_members_access','observer_audit_access'} <= criterion_ids)\n"
    assert anchor in source and guard in source and old_set in source
    source = source.replace(anchor, anchor + extra, 1)
    source = source.replace(old_set, '(' + old_set + ' | (' + new_polish + '))', 1)
    source = source.replace(guard, checks + guard, 1)
    path.write_text(source, encoding='utf-8', newline='\n')

path = TASK / 'tests/polish/prompt.md'
content = path.read_text(encoding='utf-8')
content = content.replace('Do not submit it or alter existing graded ballots for this presentation check.',
    'Keep that form-inspection ballot uncast unless the missing participation-state setup below requires a dedicated presentation submission; never alter existing Functional ballots for these presentation checks.')
path.write_text(content, encoding='utf-8', newline='\n')
print('Copied validation drivers and updated only the r16 checker profile.')
