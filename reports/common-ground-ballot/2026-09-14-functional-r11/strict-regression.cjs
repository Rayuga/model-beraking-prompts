const assert = require('node:assert/strict');

module.exports = function(h) {
  const {ruth,leila,owen,api,find,snapshot,view,draft,lifecycle,retain,recall,pass,op}=h;
  let opening;
  async function reload(page) {await page.reload();await page.locator('#app-view').waitFor({state:'visible'});}
  async function member() {return (await api(ruth,'/api/members')).body.members.find(m=>m.id==='user-owen');}
  async function toggle() {
    await reload(ruth);await view(ruth,'members');
    const before=await member();
    const pending=ruth.waitForResponse(r=>r.request().method()==='PATCH'&&new URL(r.url()).pathname==='/api/members/user-owen');
    await ruth.locator('[data-member-id="user-owen"]').click();
    const r=await pending;
    assert.equal(r.status(),200);
    const after=await member();assert.equal(after.active,!before.active);assert.equal(after.revision,before.revision+1);
    return {route:new URL(r.url()).pathname,method:r.request().method(),body:r.request().postDataJSON()};
  }
  async function snapshotCheck(stage) {
    const current=await find(ruth,'Membership validation snapshot');
    assert.deepEqual(current,opening,stage);
    assert.equal(await find(owen,'Membership validation snapshot'),undefined);
    assert.equal((await find(leila,'Membership validation snapshot')).eligible,true);
    assert.equal((await member()).active,false);
    pass('malformed membership downstream snapshot remains fixed '+stage);
  }
  function leaks(value,other,path='') {
    if(value===other&&/particip|submitted/.test(path))return [path];
    if(value&&typeof value==='object')return Object.entries(value).flatMap(([key,v])=>leaks(v,other,path+'.'+key));
    return [];
  }
  return {
    async malformedMembership() {
      assert.equal((await member()).active,false);
      const shape=await toggle();await toggle();
      for(const value of ['omitted',{},[]]) {
        const before=await snapshot(ruth),m=await member();
        const body={...shape.body,expected_revision:m.revision,operation_id:op()};
        if(value==='omitted')delete body.active;else body.active=value;
        const r=await api(ruth,shape.route,shape.method,body);
        retain('malformed-membership-'+(value==='omitted'?'omitted':Array.isArray(value)?'array':'object'),r);
        assert.equal(r.status,400);assert.deepEqual(await snapshot(ruth),before);
      }
      assert.equal((await draft(ruth,'Membership validation snapshot',['Yes','No'])).status,201);
      await lifecycle(ruth,'Membership validation snapshot','open');
      opening=await find(ruth,'Membership validation snapshot');
      assert.deepEqual(opening.turnout.members.map(m=>m.id),['user-leila']);
      await toggle();await toggle();
      await snapshotCheck('after valid activation and pause');
      pass('UI-captured membership shape rejects omitted object and array values without mutation');
    },
    async privacy(stage) {
      for(const [page,other] of [[leila,'user-owen'],[owen,'user-leila']]) {
        await reload(page);
        const payload=(await api(page,'/api/ballots')).body;
        assert.deepEqual(leaks(payload,other),[],stage);
        retain('member-private-'+other+'-'+stage,payload);
      }
      const staff=await find(ruth,'Courtyard closing time');
      assert(staff.turnout.members.some(m=>m.id==='user-owen'&&m.participated));
      pass('Member payload participation privacy with staff positive control '+stage);
    },
    async approval(stage) {
      const saved=recall('partial-turnout-vote');
      const reversed={...saved.body,choice_ids:[...saved.body.choice_ids].reverse()};
      assert.equal(saved.body.choice_ids.length,2);assert.notDeepEqual(reversed.choice_ids,saved.body.choice_ids);
      const before=await snapshot(ruth);
      for(const body of [saved.body,reversed]) {
        const r=await api(leila,saved.route,'POST',body);assert.equal(r.status,201);assert.deepEqual(r.body,saved.receipt);
        assert.deepEqual(await snapshot(ruth),before);
      }
      const b=await find(ruth,'Partial turnout approval');
      const different=b.choices.find(c=>!saved.body.choice_ids.includes(c.id));
      const collision=await api(leila,saved.route,'POST',{...saved.body,choice_ids:[different.id]});
      assert.equal(collision.status,409);assert.match(collision.body.error,/operation|different/i);
      assert.deepEqual(await snapshot(ruth),before);
      const after=await api(leila,saved.route,'POST',reversed);assert.equal(after.status,201);assert.deepEqual(after.body,saved.receipt);
      assert.deepEqual(await snapshot(ruth),before);
      pass('approval set reorder replays exact receipt and mismatch preserves it '+stage);
    },
    snapshotCheck,
  };
};
