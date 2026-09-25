from pathlib import Path
import shutil

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OLD = ROOT / 'deliverables/pellmoor-job-pipeline/1.0.0-r8-reliability-20260914'
DEST = HERE / 'golden-validation'
DEST.mkdir(parents=True, exist_ok=True)
for name in ('golden-setup.sh', 'golden-evidence-workflows.cjs', 'rewardkit'):
    assert not (DEST / name).exists(), 'Preserve existing validation attempts'
    shutil.copyfile(OLD / name, DEST / name)
setup = (DEST / 'golden-setup.sh').read_text()
setup = setup.replace('cp /source/tests/pellmoor_seed_data.json /recruitment/records/pellmoor_seed_data.json', 'cp /source/environment/assets/recruitment/records/pellmoor_seed_data.json /recruitment/records/pellmoor_seed_data.json')
setup = setup.replace('bash /source/solution/solve.sh', 'python3 /tests/rewardkit-compat.py\nbash /source/solution/solve.sh')
(DEST / 'golden-setup.sh').write_text(setup, newline='\n')
script = (DEST / 'golden-evidence-workflows.cjs').read_text()
marker = "  await group('Legacy stale conflict, successful receipt and rejected receipt keep their exact checkpoints',async()=>{"
assert script.count(marker) == 1
warmup = """  await group('Earlier Polish and Visual notes preserve seed fixtures and become the Functional baseline',async()=>{
    const before=await cand('CAND-106');
    const empty=await cand('CAND-104');
    const funnel=(await role('ROLE-014')).funnel;
    for(const dimension of ['Polish','Visual']) {
      await loginUI('r');await choose('ROLE-015');await open('CAND-106');
      const text=dimension+' independent durable prerequisite '+randomUUID();
      await page.locator('#note').fill(text);
      assert.equal(await clickMutation('#notef button',cp('CAND-106','notes')),201);
      assert(JSON.stringify((await cand('CAND-106')).notes).includes(text));
      await page.reload();await page.locator('#board .cand').first().waitFor();
      await choose('ROLE-015');await open('CAND-106');
      assert((await page.locator('#panel').textContent()).includes(text));
    }
    const after=await cand('CAND-106');
    assert.deepEqual(after.candidate,before.candidate);
    assert.deepEqual(after.panel,before.panel);assert.deepEqual(after.scores,before.scores);
    assert.equal(after.notes.length,before.notes.length+2);
    assert.deepEqual(await cand('CAND-104'),empty);
    assert.deepEqual((await role('ROLE-014')).funnel,funnel);
    assert.equal((await role('ROLE-017')).candidates.length,0);
  });
"""
script = script.replace(marker, warmup + marker)
start = script.index("    await loginUI('r');await choose('ROLE-015');await open('CAND-105');await page.locator('#note').fill('Original legacy successful receipt');")
end = script.index("    before=await state();const rejection=", start)
script = script[:start] + script[start:end].replace('CAND-105', 'CAND-106') + script[end:]
(DEST / 'golden-evidence-workflows.cjs').write_text(script, newline='\n')
print('Prepared original 13 golden regressions plus P/V-before-Functional seed preservation; legacy successful note uses its required CAND-106 fixture')
