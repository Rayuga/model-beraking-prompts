"""Adversarial orchestration tests. Synthetic fixtures are not task QC evidence."""
import contextlib
import copy
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SPEC=importlib.util.spec_from_file_location('qc_pipeline',Path(__file__).parents[1]/'qc_pipeline.py')
qc=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(qc)


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='synthetic-qc-test-')
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name).resolve()
        self.enterContext(patch.object(qc,'ROOT',self.root))
        self.enterContext(patch.object(qc,'ENGINE_FILES',['engine.py']))
        (self.root/'engine.py').write_text('synthetic checker')
        self.task=self.root/'projects/fixture';self.task.mkdir(parents=True)
        (self.task/'source.txt').write_text('original')
        self.run=self.root/'qc/runs/fixture';self.run.mkdir(parents=True)
        cache=self.root/'.qc-cache/fixture'
        (cache/'task').mkdir(parents=True);(cache/'task/source.txt').write_text('original')
        (cache/'rules').mkdir();(cache/'rules'/qc.WORKBOOK).write_text('synthetic workbook')
        rules=qc.hashes(cache/'rules')
        self.enterContext(patch.object(qc,'rules_hashes',return_value=rules))
        self.inventory={'quality':[{'id':'feature_check','what':'Check the product'}],
                        'deterministic':[{'name':'syntax','what':'Parse files'}]}
        self.enterContext(patch.object(qc,'inventory',return_value=self.inventory))
        self.enterContext(patch.object(qc,'preflight',return_value={'passed':True}))
        inputs={'task':qc.hashes(self.task),'rules':rules}
        self.manifest={'task':'projects/fixture','cache':'.qc-cache/fixture','inputs':inputs,
                       'input_sha256':qc.canonical_digest(inputs),'engine_inputs':qc.engine_hashes()}
        qc.save(self.run/'manifest.json',self.manifest);qc.save(self.run/'checklist.json',self.inventory)
        for rid in qc.REVIEWERS:
            qc.save(self.run/(rid+'.json'),{'reviewer':rid,'input_sha256':self.manifest['input_sha256'],
                'read_sources':dict.fromkeys(['workbook','skill','template'],True),
                'quality':[{'id':'feature_check','verdict':'Pass','risk':False,'evidence':rid+' synthetic observation'}],
                'deterministic':[{'name':'syntax','verdict':'Pass','risk':False,'evidence':rid+' synthetic parse'}]})
        log=self.root/'synthetic-runtime.txt';log.write_text('SYNTHETIC TEST FIXTURE ONLY')
        qc.save(self.run/'runtime-evidence.json',{key:{'observed':True,'input_sha256':self.manifest['input_sha256'],
            'command':'synthetic unit-test fixture','artifacts':{'synthetic-runtime.txt':qc.digest(log)}} for key in qc.RUNTIME_ROWS})

    def update(self,rid,change):
        path=self.run/(rid+'.json');report=qc.read(path);change(report);qc.save(path,report)

    def reconcile(self):
        with contextlib.redirect_stdout(io.StringIO()):qc.reconcile(self.run)
        return qc.read(self.run/'summary.json')

    def fail(self,row):
        row.update(verdict='Fail',risk=True,counterexample='Synthetic partial app',suggested_fix='Fix synthetic condition')

    def test_complete_synthetic_records_can_pass(self):
        self.assertEqual(self.reconcile()['status'],'LOCAL_REVIEW_PASS')

    def test_missing_review_cannot_pass(self):
        (self.run/'reviewer-3.json').unlink()
        self.assertEqual(self.reconcile()['status'],'INCOMPLETE')

    def test_single_failure_is_not_outvoted(self):
        self.update('reviewer-2',lambda r:self.fail(r['quality'][0]))
        result=self.reconcile()
        self.assertEqual(result['status'],'BLOCKED');self.assertEqual(len(result['unresolved']),1)

    def test_duplicate_row_cannot_pass(self):
        self.update('reviewer-1',lambda r:r['quality'].append(copy.deepcopy(r['quality'][0])))
        self.assertEqual(self.reconcile()['status'],'STALE_OR_INVALID')

    def test_read_attestation_is_required(self):
        self.update('reviewer-1',lambda r:r['read_sources'].update(skill=False))
        self.assertEqual(self.reconcile()['status'],'STALE_OR_INVALID')

    def test_identical_reports_are_rejected(self):
        original=qc.read(self.run/'reviewer-1.json')
        self.update('reviewer-2',lambda r:r.update(quality=original['quality'],deterministic=original['deterministic']))
        self.assertEqual(self.reconcile()['status'],'STALE_OR_INVALID')

    def test_live_task_edit_invalidates_review(self):
        (self.task/'source.txt').write_text('changed')
        self.assertEqual(self.reconcile()['status'],'STALE_OR_INVALID')

    def test_frozen_task_edit_invalidates_review(self):
        (self.root/'.qc-cache/fixture/task/source.txt').write_text('changed snapshot')
        self.assertEqual(self.reconcile()['status'],'STALE_OR_INVALID')

    def test_checker_edit_invalidates_review(self):
        (self.root/'engine.py').write_text('different engine')
        self.assertEqual(self.reconcile()['status'],'STALE_OR_INVALID')

    def test_exception_overwrites_previous_green(self):
        self.assertEqual(self.reconcile()['status'],'LOCAL_REVIEW_PASS')
        (self.run/'checklist.json').write_text('{ broken')
        with self.assertRaises(ValueError):self.reconcile()
        self.assertEqual(qc.read(self.run/'summary.json')['status'],'STALE_OR_INVALID')
        self.assertNotIn('LOCAL_REVIEW_PASS',(self.run/'SUMMARY.md').read_text())

    def test_extra_key_cannot_collapse_failures(self):
        for rid in qc.REVIEWERS[:2]:
            def mutate(r):self.fail(r['quality'][0]);r['quality'][0]['key']='same-forged-key'
            self.update(rid,mutate)
        keys=[x['key'] for x in self.reconcile()['unresolved']]
        self.assertEqual(len(set(keys)),2);self.assertNotIn('same-forged-key',keys)

    def test_runtime_required_even_with_all_green_reviewers(self):
        (self.run/'runtime-evidence.json').unlink()
        result=self.reconcile()
        self.assertEqual(result['status'],'BLOCKED');self.assertEqual(len(result['evidence_gaps']),4)

    def test_runtime_artifact_change_blocks(self):
        (self.root/'synthetic-runtime.txt').write_text('changed evidence')
        self.assertEqual(self.reconcile()['status'],'BLOCKED')

    def test_same_hash_fix_waiver_is_rejected(self):
        self.update('reviewer-2',lambda r:self.fail(r['quality'][0]))
        qc.save(self.run/'adjudications.json',[{'key':'reviewer-2:quality:feature_check','status':'fixed'}])
        self.assertEqual(self.reconcile()['status'],'STALE_OR_INVALID')

    def test_reason_and_arbitrary_file_are_not_enough(self):
        self.update('reviewer-2',lambda r:self.fail(r['quality'][0]))
        qc.save(self.run/'adjudications.json',[{'key':'reviewer-2:quality:feature_check','status':'refuted',
            'reason':'Someone said so','evidence_refs':['engine.py'],'evidence_sha256':{'engine.py':qc.digest(self.root/'engine.py')},
            'confirmed_by':'invented reviewer'}])
        self.assertEqual(self.reconcile()['status'],'STALE_OR_INVALID')

    def test_malformed_report_is_rejected(self):
        qc.save(self.run/'reviewer-1.json',[])
        self.assertEqual(self.reconcile()['status'],'STALE_OR_INVALID')

    def test_independent_hash_bound_confirmation_resolves_a_false_positive(self):
        self.update('reviewer-2',lambda r:self.fail(r['quality'][0]))
        decision={'key':'reviewer-2:quality:feature_check','status':'refuted',
            'reason':'Synthetic counterexample is contradicted by this fixture',
            'evidence_refs':['engine.py'],'evidence_sha256':{'engine.py':qc.digest(self.root/'engine.py')},
            'confirmed_by':'reviewer-3','confirmation_ref':'confirmation.json'}
        confirmation={k:decision[k] for k in ['key','status','reason','evidence_sha256']}
        confirmation.update(reviewer='reviewer-3',input_sha256=self.manifest['input_sha256'])
        qc.save(self.root/'confirmation.json',confirmation)
        qc.save(self.run/'adjudications.json',[decision])
        result=self.reconcile()
        self.assertEqual(result['status'],'LOCAL_REVIEW_PASS')
        self.assertEqual(result['unresolved'],[])
        self.assertEqual(qc.read(self.run/'reviewer-2.json')['quality'][0]['verdict'],'Fail')

    def test_same_reviewer_cannot_confirm_own_waiver(self):
        self.update('reviewer-2',lambda r:self.fail(r['quality'][0]))
        qc.save(self.root/'confirmation.json',{})
        qc.save(self.run/'adjudications.json',[{'key':'reviewer-2:quality:feature_check','status':'refuted',
            'reason':'self approved','evidence_refs':['engine.py'],
            'evidence_sha256':{'engine.py':qc.digest(self.root/'engine.py')},
            'confirmed_by':'reviewer-2','confirmation_ref':'confirmation.json'}])
        self.assertEqual(self.reconcile()['status'],'STALE_OR_INVALID')

    def test_missing_directory_overwrites_previous_green(self):
        self.assertEqual(self.reconcile()['status'],'LOCAL_REVIEW_PASS')
        (self.task/'source.txt').unlink();self.task.rmdir()
        with self.assertRaises(ValueError):self.reconcile()
        self.assertEqual(qc.read(self.run/'summary.json')['status'],'STALE_OR_INVALID')

    def test_wrong_report_hash_rejected(self):
        self.update('reviewer-1',lambda r:r.update(input_sha256='wrong candidate'))
        self.assertEqual(self.reconcile()['status'],'STALE_OR_INVALID')

    def test_workspace_escape_rejected(self):
        with self.assertRaises(ValueError):qc.local('../outside')


if __name__=='__main__':unittest.main()
