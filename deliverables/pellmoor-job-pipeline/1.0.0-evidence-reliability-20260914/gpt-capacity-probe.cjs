const assert = require('node:assert/strict');
const fs = require('node:fs');
const {randomUUID} = require('node:crypto');
const root = 'http://localhost:3000';
const cookies = {};
const report = {scope: 'Controlled API diagnostic on isolated unmodified GPT source, using cached dependency versions; not a platform rescore', steps: []};
async function request(who, method, route, body) {
  const response = await fetch(root + route, {method, headers: {'Content-Type':'application/json', ...(cookies[who] ? {Cookie: cookies[who]} : {})}, body: body === undefined ? undefined : JSON.stringify(body)});
  const cookie = response.headers.get('set-cookie');
  if (cookie) cookies[who] = cookie.split(';')[0];
  return {status: response.status, body: await response.json()};
}
const read = async () => (await request('r', 'GET', '/api/vacancies/ROLE-017')).body;
async function write(who, route, body) {
  const before = await read();
  const submitted = {...body, expectedRevision: before.vacancy.revision, operationId: randomUUID()};
  const result = await request(who, 'POST', route, submitted);
  report.steps.push({route, request: submitted, status: result.status, message: result.body.message});
  return {...result, request: submitted, before, after: await read()};
}
async function prepare(name) {
  let result = await write('c', '/api/vacancies/ROLE-017/candidates', {name});
  assert.equal(result.status, 200);
  const id = result.body.vacancy.candidates.find(c => c.name === name).id;
  for (const nextStage of ['screening', 'interview']) {
    result = await write('r', `/api/candidates/${id}/stage`, {nextStage});
    assert.equal(result.status, 200);
  }
  for (const memberEmail of ['panel1@pellmoor.test', 'panel2@pellmoor.test']) {
    result = await write('c', `/api/candidates/${id}/panel/add`, {memberEmail});
    assert.equal(result.status, 200);
  }
  for (const who of ['o', 'w']) {
    result = await write(who, `/api/candidates/${id}/scores`, {score: 4});
    assert.equal(result.status, 200);
  }
  return id;
}
async function main() {
  for (const [who, email] of Object.entries({r:'hiring', c:'coord', o:'panel1', w:'panel2'})) {
    assert.equal((await request(who, 'POST', '/api/login', {email: email+'@pellmoor.test', password:'password123'})).status, 200);
  }
  const a = await prepare('Capacity witness A');
  const b = await prepare('Capacity witness B');
  const first = await write('r', `/api/candidates/${a}/stage`, {nextStage:'offer'});
  assert.equal(first.status, 200);
  assert.equal(first.after.vacancy.available, 0);
  const second = await write('r', `/api/candidates/${b}/stage`, {nextStage:'offer'});
  report.capacity_probe = second;
  report.confirmed_overbooking = second.status === 200 && second.after.vacancy.reserved === 2 && second.after.vacancy.openings === 1;
  assert(report.confirmed_overbooking, JSON.stringify(second));
  console.log(JSON.stringify({confirmed_overbooking:report.confirmed_overbooking,status:second.status,capacity:second.after.vacancy}));
}
main().catch(error => {report.error = error.stack; process.exitCode=1; console.error(error);}).finally(() => fs.writeFileSync('/evidence/gpt-capacity-probe.json',JSON.stringify(report,null,2)));
