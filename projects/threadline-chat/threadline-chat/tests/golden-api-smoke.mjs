import assert from 'node:assert/strict';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3001';

class Session {
  constructor(name) {
    this.name = name;
    this.token = '';
  }

  async request(path, { method = 'GET', body, headers = {} } = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...headers
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await response.json().catch(() => null);
    return { status: response.status, ok: response.ok, data };
  }

  async login(email) {
    const result = await this.request('/api/auth/login', {
      method: 'POST',
      body: { email, password: 'northstar' }
    });
    assert.equal(result.status, 200, `${this.name} login failed`);
    assert(result.data.sessionToken, `${this.name} login did not return a session token`);
    this.token = result.data.sessionToken;
  }
}

function expectStatus(result, status, label) {
  assert.equal(result.status, status, `${label}: ${JSON.stringify(result.data)}`);
  return result.data;
}

async function messages(session, channelId) {
  return expectStatus(
    await session.request(`/api/channels/${channelId}/messages?limit=100`),
    200,
    `read ${channelId}`
  ).messages;
}

async function send(session, channelId, content, clientId, extra = {}) {
  return session.request(`/api/channels/${channelId}/messages`, {
    method: 'POST',
    body: { content, clientId, ...extra }
  });
}

async function main() {
  const anonymous = new Session('anonymous');
  expectStatus(
    await anonymous.request('/api/auth/login', {
      method: 'POST',
      body: { email: 'priya@northstar.test', password: 'wrong-password' }
    }),
    401,
    'invalid login'
  );
  expectStatus(await anonymous.request('/api/bootstrap'), 401, 'anonymous bootstrap');

  const priya = new Session('Priya');
  const maya = new Session('Maya');
  const jordan = new Session('Jordan');
  const omar = new Session('Omar');
  await Promise.all([
    priya.login('priya@northstar.test'),
    maya.login('maya@northstar.test'),
    jordan.login('jordan@northstar.test'),
    omar.login('omar@northstar.test')
  ]);

  const priyaBootstrap = expectStatus(await priya.request('/api/bootstrap'), 200, 'Priya bootstrap');
  const mayaBootstrap = expectStatus(await maya.request('/api/bootstrap'), 200, 'Maya bootstrap');
  assert.equal(priyaBootstrap.user.id, 'priya');
  assert(!priyaBootstrap.channels.some((channel) => channel.id === 'leadership'));
  assert(mayaBootstrap.channels.some((channel) => channel.id === 'leadership'));

  const forged = expectStatus(await send(
    priya,
    'general',
    'SMOKE-IDENTITY',
    'smoke-identity-001',
    { authorId: 'maya', role: 'admin', createdAt: '2000-01-01T00:00:00.000Z' }
  ), 201, 'forged identity send').message;
  assert.equal(forged.author.id, 'priya');
  assert.notEqual(forged.createdAt, '2000-01-01T00:00:00.000Z');

  const duplicate = expectStatus(
    await send(priya, 'general', 'SHOULD-NOT-REPLACE', 'smoke-identity-001'),
    200,
    'duplicate send'
  );
  assert.equal(duplicate.message.id, forged.id);
  assert.equal(duplicate.message.content, 'SMOKE-IDENTITY');
  assert.equal((await messages(priya, 'general')).filter((item) => item.id === forged.id).length, 1);
  expectStatus(
    await send(priya, 'launch-room', 'SMOKE-CROSS-CHANNEL-ID', 'smoke-identity-001'),
    409,
    'client id reused across channels'
  );

  expectStatus(await priya.request('/api/channels/leadership/messages'), 403, 'private read');
  expectStatus(
    await send(priya, 'leadership', 'SMOKE-PRIVATE-FORGE', 'smoke-private-001'),
    403,
    'private send'
  );
  expectStatus(await priya.request('/api/search?q=staffing&channelId=leadership'), 403, 'private search');

  const edited = expectStatus(await priya.request(`/api/messages/${forged.id}`, {
    method: 'PATCH',
    body: { content: 'SMOKE-IDENTITY-V2', version: forged.version }
  }), 200, 'valid edit').message;
  assert.equal(edited.version, forged.version + 1);
  expectStatus(await priya.request(`/api/messages/${forged.id}`, {
    method: 'PATCH',
    body: { content: 'SMOKE-STALE', version: forged.version }
  }), 409, 'stale edit');
  const history = expectStatus(await priya.request(`/api/messages/${forged.id}/history`), 200, 'edit history').history;
  assert.equal(history.filter((entry) => entry.action === 'edited').length, 1);
  assert.equal(history.find((entry) => entry.action === 'edited').previous.content, 'SMOKE-IDENTITY');

  const mention = expectStatus(
    await send(priya, 'general', 'SMOKE-MENTION @Omar Haddad', 'smoke-mention-001'),
    201,
    'mention send'
  ).message;
  let omarBootstrap = expectStatus(await omar.request('/api/bootstrap'), 200, 'Omar mention bootstrap');
  assert.equal(omarBootstrap.notifications.filter((item) => item.messageId === mention.id).length, 1);
  const movedMention = expectStatus(await priya.request(`/api/messages/${mention.id}`, {
    method: 'PATCH',
    body: { content: 'SMOKE-MENTION @Maya Chen', version: mention.version }
  }), 200, 'mention edit').message;
  omarBootstrap = expectStatus(await omar.request('/api/bootstrap'), 200, 'Omar corrected mentions');
  const mayaAfterMention = expectStatus(await maya.request('/api/bootstrap'), 200, 'Maya corrected mentions');
  assert.equal(omarBootstrap.notifications.filter((item) => item.messageId === mention.id).length, 0);
  assert.equal(mayaAfterMention.notifications.filter((item) => item.messageId === mention.id).length, 1);

  const reactionOne = expectStatus(await omar.request(`/api/messages/${mention.id}/reactions`, {
    method: 'POST', body: { emoji: 'thumbs-up', active: true, userId: 'maya' }
  }), 200, 'reaction add').message;
  const reactionTwo = expectStatus(await omar.request(`/api/messages/${mention.id}/reactions`, {
    method: 'POST', body: { emoji: 'thumbs-up', active: true, userId: 'maya' }
  }), 200, 'reaction duplicate').message;
  assert.equal(reactionOne.reactions[0].count, 1);
  assert.equal(reactionTwo.reactions[0].count, 1);
  assert.deepEqual(reactionTwo.reactions[0].userIds, ['omar']);

  expectStatus(await omar.request(`/api/messages/${mention.id}/pin`, {
    method: 'POST', body: { pinned: true, role: 'admin' }
  }), 403, 'member pin');
  expectStatus(await jordan.request(`/api/messages/${mention.id}/pin`, {
    method: 'POST', body: { pinned: true }
  }), 200, 'moderator pin');
  let pins = expectStatus(await priya.request('/api/channels/general/pins'), 200, 'pins read').messages;
  assert.equal(pins.filter((item) => item.id === mention.id).length, 1);
  assert.equal(pins.find((item) => item.id === mention.id).content, 'SMOKE-MENTION @Maya Chen');

  const parent = expectStatus(
    await send(priya, 'general', 'SMOKE-THREAD-PARENT', 'smoke-thread-parent-001'),
    201,
    'thread parent'
  ).message;
  const firstReply = expectStatus(await priya.request(`/api/messages/${parent.id}/replies`, {
    method: 'POST', body: { content: 'SMOKE-THREAD-REPLY', clientId: 'smoke-thread-reply-001' }
  }), 201, 'thread reply');
  const duplicateReply = expectStatus(await priya.request(`/api/messages/${parent.id}/replies`, {
    method: 'POST', body: { content: 'SMOKE-THREAD-REPLY', clientId: 'smoke-thread-reply-001' }
  }), 200, 'duplicate thread reply');
  assert.equal(duplicateReply.message.id, firstReply.message.id);
  assert.equal(duplicateReply.parent.id, parent.id);
  assert.equal(duplicateReply.parent.replyCount, 1);
  const otherParent = expectStatus(
    await send(priya, 'general', 'SMOKE-THREAD-OTHER', 'smoke-thread-parent-002'),
    201,
    'other thread parent'
  ).message;
  expectStatus(await priya.request(`/api/messages/${otherParent.id}/replies`, {
    method: 'POST', body: { content: 'SMOKE-WRONG-THREAD', clientId: 'smoke-thread-reply-001' }
  }), 409, 'reply client id reused against another parent');
  expectStatus(await priya.request(`/api/messages/${firstReply.message.id}/replies`, {
    method: 'POST', body: { content: 'SMOKE-NESTED-REPLY', clientId: 'smoke-nested-reply-001' }
  }), 404, 'reply used as parent');

  expectStatus(await priya.request(`/api/messages/${movedMention.id}`, {
    method: 'DELETE', body: { version: movedMention.version }
  }), 200, 'message delete');
  pins = expectStatus(await priya.request('/api/channels/general/pins'), 200, 'pins after delete').messages;
  assert(!pins.some((item) => item.id === mention.id));
  assert(!(await messages(priya, 'general')).find((item) => item.id === mention.id).reactions.length);
  assert.equal(expectStatus(await maya.request('/api/bootstrap'), 200, 'Maya after delete').notifications.filter((item) => item.messageId === mention.id).length, 0);

  expectStatus(await maya.request('/api/channels/leadership/members', {
    method: 'POST', body: { userId: 'omar', action: 'add' }
  }), 200, 'add Omar to leadership');
  assert(expectStatus(await omar.request('/api/bootstrap'), 200, 'Omar added bootstrap').channels.some((channel) => channel.id === 'leadership'));
  expectStatus(await maya.request('/api/channels/leadership/members', {
    method: 'POST', body: { userId: 'omar', action: 'remove' }
  }), 200, 'remove Omar from leadership');
  expectStatus(
    await send(omar, 'leadership', 'SMOKE-REVOKED', 'smoke-revoked-001'),
    403,
    'revoked captured send'
  );
  assert(!(await messages(maya, 'leadership')).some((item) => item.content === 'SMOKE-REVOKED'));
  expectStatus(await maya.request('/api/channels/leadership/members', {
    method: 'POST', body: { userId: 'omar', action: 'add' }
  }), 200, 'restore Omar membership');

  const dmOne = expectStatus(await priya.request('/api/direct-messages', {
    method: 'POST', body: { userId: 'maya', members: ['priya', 'maya', 'omar'], creatorId: 'omar' }
  }), 201, 'create direct message');
  const dmTwo = expectStatus(await priya.request('/api/direct-messages', {
    method: 'POST', body: { userId: 'maya' }
  }), 200, 'reopen direct message');
  assert.equal(dmOne.channel.id, dmTwo.channel.id);
  assert.equal(dmOne.channel.kind, 'direct');
  assert.deepEqual(dmOne.channel.members.map((member) => member.id).sort(), ['maya', 'priya']);
  const dmMessage = expectStatus(
    await send(priya, dmOne.channel.id, 'SMOKE-DIRECT-PRIVATE', 'smoke-direct-001'),
    201,
    'send direct message'
  ).message;
  assert.equal(dmMessage.author.id, 'priya');
  assert((await messages(maya, dmOne.channel.id)).some((message) => message.id === dmMessage.id));
  expectStatus(await jordan.request(`/api/channels/${dmOne.channel.id}/messages`), 403, 'non-participant direct read');
  expectStatus(await jordan.request(`/api/search?q=SMOKE-DIRECT-PRIVATE&channelId=${dmOne.channel.id}`), 403, 'non-participant direct search');
  expectStatus(await maya.request(`/api/channels/${dmOne.channel.id}/members`, {
    method: 'POST', body: { userId: 'omar', action: 'add' }
  }), 400, 'direct participant mutation');
  expectStatus(await priya.request('/api/direct-messages', { method: 'POST', body: { userId: 'priya' } }), 400, 'self direct message');
  expectStatus(await priya.request('/api/direct-messages', { method: 'POST', body: { userId: 'not-a-user' } }), 400, 'unknown direct message target');

  const webhookOne = expectStatus(await anonymous.request('/api/hooks/atlas-builds-secret', {
    method: 'POST', body: { eventId: 'smoke-webhook-001', channelId: 'launch-room', text: 'SMOKE-WEBHOOK' }
  }), 201, 'webhook positive');
  const webhookTwo = expectStatus(await anonymous.request('/api/hooks/atlas-builds-secret', {
    method: 'POST', body: { eventId: 'smoke-webhook-001', channelId: 'launch-room', text: 'SMOKE-WEBHOOK' }
  }), 200, 'webhook duplicate');
  assert.equal(webhookOne.message.id, webhookTwo.message.id);
  expectStatus(await anonymous.request('/api/hooks/atlas-builds-secret', {
    method: 'POST', body: { eventId: 'smoke-webhook-002', channelId: 'general', text: 'SMOKE-WEBHOOK-WRONG' }
  }), 403, 'webhook channel mismatch');
  assert.equal((await messages(priya, 'launch-room')).filter((item) => item.content === 'SMOKE-WEBHOOK').length, 1);

  const capturedToken = priya.token;
  expectStatus(await priya.request('/api/auth/logout', { method: 'POST', body: {} }), 200, 'logout');
  priya.token = capturedToken;
  expectStatus(
    await send(priya, 'general', 'SMOKE-LOGGED-OUT', 'smoke-logout-001'),
    401,
    'revoked session replay'
  );

  console.log('Threadline golden API smoke test passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
