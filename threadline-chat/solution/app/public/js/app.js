const $ = (selector) => document.querySelector(selector);
const state = {
  bootstrap: null,
  channelId: null,
  messages: [],
  hasMore: false,
  threadId: null,
  threadParent: null,
  replies: [],
  presence: [],
  typingUsers: [],
  eventSource: null,
  viewId: `view-${crypto.randomUUID()}`,
  allUsers: []
};

const emojiMap = { 'thumbs-up': '👍', celebrate: '🎉', eyes: '👀', heart: '❤️', check: '✅' };
const els = {
  loginScreen: $('#login-screen'), loginForm: $('#login-form'), loginEmail: $('#login-email'), loginPassword: $('#login-password'), loginError: $('#login-error'),
  appShell: $('#app-shell'), workspaceName: $('#workspace-name'), channelList: $('#channel-list'), channelName: $('#channel-name'), channelPrivacy: $('#channel-privacy'), channelDescription: $('#channel-description'),
  messageScroller: $('#message-scroller'), messageList: $('#message-list'), loadOlder: $('#load-older-button'), messageForm: $('#message-form'), messageInput: $('#message-input'), sendButton: $('#send-button'), mentionSuggestions: $('#mention-suggestions'),
  profileButton: $('#profile-button'), profileAvatar: $('#profile-avatar'), profileName: $('#profile-name'), profileRole: $('#profile-role'), profileMenu: $('#profile-menu'), logout: $('#logout-button'),
  notificationsButton: $('#notifications-button'), notificationCount: $('#notification-count'), mentionsNavCount: $('#mentions-nav-count'), mentionsNav: $('#mentions-nav'), pinsNav: $('#pins-nav'),
  presenceStack: $('#presence-stack'), presenceCount: $('#presence-count'), membersButton: $('#members-button'), channelPins: $('#channel-pins-button'), typing: $('#typing-indicator'), connection: $('#connection-label'), channelBanner: $('#channel-banner'),
  threadPanel: $('#thread-panel'), threadChannel: $('#thread-channel'), threadList: $('#thread-list'), threadForm: $('#thread-form'), threadInput: $('#thread-input'), closeThread: $('#close-thread-button'),
  searchButton: $('#search-button'), searchDialog: $('#search-dialog'), searchForm: $('#search-form'), searchInput: $('#search-input'), searchResults: $('#search-results'),
  detailDialog: $('#detail-dialog'), detailEyebrow: $('#detail-eyebrow'), detailTitle: $('#detail-title'), detailContent: $('#detail-content'),
  mobileNav: $('#mobile-nav-button'), sidebar: $('#channel-sidebar'), mobileScrim: $('#mobile-scrim'), toastRegion: $('#toast-region'), messageTemplate: $('#message-template')
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function toast(message, type = 'info') {
  const item = document.createElement('div');
  item.className = `toast ${type === 'error' ? 'error' : ''}`;
  item.textContent = message;
  els.toastRegion.append(item);
  setTimeout(() => item.remove(), 4200);
}

function setAvatar(element, user) {
  element.textContent = initials(user?.name || 'Integration');
  element.style.background = user?.color || '#475569';
}

function currentChannel() {
  return state.bootstrap?.channels.find((channel) => channel.id === state.channelId) || null;
}

async function loadLoginUsers() {
  const data = await api('/api/auth/users');
  state.allUsers = data.users;
  els.loginEmail.replaceChildren(...data.users.map((user) => {
    const option = document.createElement('option');
    option.value = user.email;
    option.textContent = `${user.name} · ${user.role}`;
    return option;
  }));
}

async function initialize() {
  try {
    state.bootstrap = await api('/api/bootstrap');
    showApp();
  } catch (error) {
    if (error.status !== 401) toast(error.message, 'error');
    await loadLoginUsers();
    els.loginScreen.hidden = false;
    els.appShell.hidden = true;
  }
}

els.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  els.loginError.textContent = '';
  try {
    await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: els.loginEmail.value, password: els.loginPassword.value }) });
    state.bootstrap = await api('/api/bootstrap');
    showApp();
  } catch (error) {
    els.loginError.textContent = error.message;
  }
});

function showApp() {
  els.loginScreen.hidden = true;
  els.appShell.hidden = false;
  const { user, workspace, channels, notifications } = state.bootstrap;
  els.workspaceName.textContent = workspace.name;
  els.profileName.textContent = user.name;
  els.profileRole.textContent = `${user.email} · ${user.role}`;
  setAvatar(els.profileAvatar, user);
  renderChannels();
  renderNotificationCounts(notifications);
  connectEvents();
  navigateFromHash();
}

async function navigateFromHash() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const requested = params.get('channel');
  const channels = state.bootstrap?.channels || [];
  const channelId = channels.some((channel) => channel.id === requested) ? requested : channels[0]?.id;
  if (!channelId) return;
  await loadChannel(channelId, { updateHash: !requested });
  const messageId = Number(params.get('message'));
  const threadId = Number(params.get('thread'));
  if (threadId) {
    const parent = state.messages.find((message) => Number(message.id) === threadId);
    if (parent) {
      await openThread(parent);
      focusLinkedMessage(messageId || threadId);
    }
  } else if (messageId) {
    focusLinkedMessage(messageId);
  }
}

window.addEventListener('hashchange', () => {
  if (!els.appShell.hidden) navigateFromHash();
});

function renderChannels() {
  els.channelList.replaceChildren(...state.bootstrap.channels.map((channel) => {
    const button = document.createElement('button');
    button.className = `channel-button ${channel.id === state.channelId ? 'active' : ''}`;
    button.dataset.channelId = channel.id;
    const privacy = document.createElement('span');
    privacy.textContent = channel.isPrivate ? '◆' : '#';
    privacy.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'channel-label';
    label.textContent = channel.name;
    button.append(privacy, label);
    if (channel.mentions || channel.unread) {
      const badge = document.createElement('span');
      badge.className = `channel-badge ${channel.mentions ? 'mention' : ''}`;
      badge.textContent = channel.mentions || channel.unread;
      button.append(badge);
    }
    return button;
  }));
}

function renderNotificationCounts(notifications = []) {
  const unread = notifications.filter((item) => !item.readAt).length;
  for (const element of [els.notificationCount, els.mentionsNavCount]) {
    element.hidden = unread === 0;
    element.textContent = String(unread);
  }
}

els.channelList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-channel-id]');
  if (button) loadChannel(button.dataset.channelId);
});

async function loadChannel(channelId, { preserveScroll = false, updateHash = true } = {}) {
  const channel = state.bootstrap.channels.find((item) => item.id === channelId);
  if (!channel) return;
  const oldScroll = els.messageScroller.scrollTop;
  state.channelId = channelId;
  state.messages = [];
  state.hasMore = false;
  closeThread();
  renderChannels();
  els.channelName.textContent = channel.name;
  els.channelPrivacy.textContent = channel.isPrivate ? '◆' : '#';
  els.channelDescription.textContent = channel.description;
  els.messageInput.placeholder = `Message #${channel.name}`;
  els.messageList.innerHTML = '<div class="empty-state">Loading conversation...</div>';
  closeMobileNav();
  if (updateHash) history.replaceState(null, '', `#channel=${encodeURIComponent(channelId)}`);
  try {
    const data = await api(`/api/channels/${encodeURIComponent(channelId)}/messages?limit=30`);
    if (state.channelId !== channelId) return;
    state.messages = data.messages;
    state.hasMore = data.hasMore;
    renderMessages();
    els.loadOlder.hidden = !state.hasMore;
    if (preserveScroll) els.messageScroller.scrollTop = oldScroll;
    else els.messageScroller.scrollTop = els.messageScroller.scrollHeight;
    await publishPresence();
    await markChannelRead();
  } catch (error) {
    els.messageList.innerHTML = `<div class="empty-state">${error.message}</div>`;
  }
}

async function loadOlder() {
  const oldest = state.messages.find((message) => !message.pending)?.id;
  if (!oldest) return;
  const beforeHeight = els.messageScroller.scrollHeight;
  const data = await api(`/api/channels/${encodeURIComponent(state.channelId)}/messages?limit=30&before=${oldest}`);
  state.messages = [...data.messages, ...state.messages];
  state.hasMore = data.hasMore;
  renderMessages();
  els.messageScroller.scrollTop += els.messageScroller.scrollHeight - beforeHeight;
  els.loadOlder.hidden = !state.hasMore;
}
els.loadOlder.addEventListener('click', () => loadOlder().catch((error) => toast(error.message, 'error')));

function appendContent(container, content) {
  const names = state.allUsers.length ? state.allUsers.map((user) => user.name) : (currentChannel()?.members || []).map((user) => user.name);
  const pattern = names.length ? new RegExp(`(@(?:${names.map(escapeRegExp).join('|')}))`, 'gi') : null;
  if (!pattern) return container.append(document.createTextNode(content));
  let cursor = 0;
  for (const match of content.matchAll(pattern)) {
    container.append(document.createTextNode(content.slice(cursor, match.index)));
    const mention = document.createElement('span');
    mention.className = 'mention';
    mention.textContent = match[0];
    container.append(mention);
    cursor = match.index + match[0].length;
  }
  container.append(document.createTextNode(content.slice(cursor)));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderMessages() {
  if (!state.messages.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No messages yet. Start the conversation.';
    els.messageList.replaceChildren(empty);
    return;
  }
  els.messageList.replaceChildren(...state.messages.map((message) => messageElement(message)));
}

function messageElement(message, { thread = false, parent = false } = {}) {
  const article = els.messageTemplate.content.firstElementChild.cloneNode(true);
  article.dataset.messageId = message.id;
  if (message.pending) article.classList.add('pending');
  if (message.failed) article.classList.add('failed');
  if (parent) article.classList.add('thread-parent');
  const avatar = article.querySelector('.message-avatar');
  setAvatar(avatar, message.author);
  article.querySelector('.message-author').textContent = message.author?.name || 'Unknown';
  article.querySelector('.integration-badge').hidden = message.kind !== 'integration';
  article.querySelector('time').textContent = message.pending ? (message.failed ? 'Failed to send' : 'Sending...') : formatTime(message.createdAt);
  article.querySelector('time').dateTime = message.createdAt || '';
  article.querySelector('.edited-label').hidden = !message.editedAt || Boolean(message.deletedAt);
  const content = article.querySelector('.message-content');
  if (message.deletedAt) {
    content.classList.add('deleted');
    content.textContent = 'This message was deleted.';
  } else {
    appendContent(content, message.content || '');
  }
  renderReactions(article.querySelector('.message-reactions'), message);
  const summary = article.querySelector('.thread-summary');
  if (!thread && message.replyCount) {
    summary.hidden = false;
    summary.textContent = `${message.replyCount} ${message.replyCount === 1 ? 'reply' : 'replies'} · Latest ${formatTime(message.latestReplyAt)}`;
    summary.dataset.action = 'reply';
  }
  const actions = article.querySelector('.message-actions');
  if (message.deletedAt || message.pending) actions.hidden = true;
  if (thread) actions.querySelector('[data-action="reply"]').hidden = true;
  const menu = article.querySelector('.message-menu');
  buildMessageMenu(menu, message);
  return article;
}

function renderReactions(container, message) {
  container.replaceChildren(...(message.reactions || []).map((reaction) => {
    const button = document.createElement('button');
    button.className = `reaction-pill ${reaction.userIds.includes(state.bootstrap.user.id) ? 'active' : ''}`;
    button.dataset.action = 'reaction-toggle';
    button.dataset.emoji = reaction.emoji;
    button.title = reaction.users.join(', ');
    button.textContent = `${emojiMap[reaction.emoji] || reaction.emoji} ${reaction.count}`;
    return button;
  }));
}

function buildMessageMenu(menu, message) {
  const add = (label, action, danger = false) => {
    const button = document.createElement('button');
    button.textContent = label;
    button.dataset.action = action;
    if (danger) button.className = 'danger';
    menu.append(button);
  };
  if (message.failed) add('Retry send', 'retry');
  if (!message.pending && !message.deletedAt) {
    if (message.author?.id === state.bootstrap.user.id && message.kind === 'user') add('Edit message', 'edit');
    if (message.author?.id === state.bootstrap.user.id || ['moderator', 'admin'].includes(state.bootstrap.user.role)) add('Delete message', 'delete', true);
    if (['moderator', 'admin'].includes(state.bootstrap.user.role)) add(message.pinned ? 'Unpin message' : 'Pin message', 'pin');
    add('Copy message link', 'copy-link');
    add('View edit history', 'history');
  }
}

function findMessage(id) {
  const key = String(id);
  return [...state.messages, state.threadParent, ...state.replies].filter(Boolean).find((message) => String(message.id) === key);
}

function upsertMessage(collection, message) {
  const index = collection.findIndex((item) => String(item.id) === String(message.id));
  if (index >= 0) collection[index] = message;
  else collection.push(message);
  collection.sort((a, b) => Number(a.id) - Number(b.id));
}

function onMessageAction(event) {
  const actionButton = event.target.closest('[data-action]');
  const article = event.target.closest('.message');
  if (!actionButton || !article) return;
  const message = findMessage(article.dataset.messageId);
  if (!message) return;
  const action = actionButton.dataset.action;
  if (!['more', 'react'].includes(action)) article.querySelector('.message-menu').hidden = true;
  if (action === 'more') {
    const menu = article.querySelector('.message-menu');
    document.querySelectorAll('.message-menu').forEach((item) => { if (item !== menu) item.hidden = true; });
    menu.replaceChildren();
    buildMessageMenu(menu, message);
    menu.hidden = !menu.hidden;
  } else if (action === 'react') {
    showReactionMenu(article, message);
  } else if (action === 'reaction-toggle') {
    toggleReaction(message, actionButton.dataset.emoji);
  } else if (action === 'reply') {
    openThread(message.parentId ? findMessage(message.parentId) : message);
  } else if (action === 'edit') {
    beginEdit(article, message);
  } else if (action === 'delete') {
    deleteMessage(message);
  } else if (action === 'pin') {
    togglePin(message);
  } else if (action === 'copy-link') {
    copyMessageLink(message);
  } else if (action === 'history') {
    showHistory(message);
  } else if (action === 'retry') {
    retryMessage(message);
  }
}

els.messageList.addEventListener('click', onMessageAction);
els.threadList.addEventListener('click', onMessageAction);

function showReactionMenu(article, message) {
  const menu = article.querySelector('.message-menu');
  menu.replaceChildren(...Object.entries(emojiMap).map(([name, symbol]) => {
    const button = document.createElement('button');
    button.dataset.action = 'reaction-toggle';
    button.dataset.emoji = name;
    button.textContent = `${symbol} ${name.replace('-', ' ')}`;
    return button;
  }));
  menu.hidden = false;
}

async function toggleReaction(message, emoji) {
  try {
    const currentlyActive = (message.reactions || []).some((reaction) => reaction.emoji === emoji && reaction.userIds.includes(state.bootstrap.user.id));
    const data = await api(`/api/messages/${message.id}/reactions`, { method: 'POST', body: JSON.stringify({ emoji, active: !currentlyActive }) });
    applyChangedMessage(data.message);
  } catch (error) { toast(error.message, 'error'); }
}

function beginEdit(article, message) {
  const content = article.querySelector('.message-content');
  const input = document.createElement('textarea');
  input.value = message.content;
  input.rows = Math.max(2, message.content.split('\n').length);
  const actions = document.createElement('div');
  actions.className = 'edit-actions';
  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  const save = document.createElement('button');
  save.className = 'primary-button';
  save.textContent = 'Save changes';
  actions.append(cancel, save);
  content.replaceChildren(input, actions);
  input.focus();
  cancel.addEventListener('click', () => rerenderAll());
  save.addEventListener('click', async () => {
    try {
      const data = await api(`/api/messages/${message.id}`, { method: 'PATCH', body: JSON.stringify({ content: input.value, version: message.version }) });
      applyChangedMessage(data.message);
      toast('Message updated');
    } catch (error) { toast(error.message, 'error'); }
  });
}

async function deleteMessage(message) {
  if (!confirm('Delete this message? Its audit history will be preserved.')) return;
  try {
    const data = await api(`/api/messages/${message.id}`, { method: 'DELETE', body: JSON.stringify({ version: message.version }) });
    applyChangedMessage(data.message);
    toast('Message deleted');
  } catch (error) { toast(error.message, 'error'); }
}

async function togglePin(message) {
  try {
    const data = await api(`/api/messages/${message.id}/pin`, { method: 'POST', body: JSON.stringify({ pinned: !message.pinned }) });
    applyChangedMessage(data.message);
    toast(data.pinned ? 'Message pinned' : 'Message unpinned');
  } catch (error) { toast(error.message, 'error'); }
}

async function copyMessageLink(message) {
  const rootId = message.parentId || message.id;
  const thread = message.parentId ? `&thread=${rootId}` : '';
  const link = `${location.origin}${location.pathname}#channel=${encodeURIComponent(message.channelId)}${thread}&message=${message.id}`;
  await navigator.clipboard.writeText(link);
  toast('Message link copied');
}

async function showHistory(message) {
  try {
    const data = await api(`/api/messages/${message.id}/history`);
    openDetail('Message', 'Edit history', data.history.length ? data.history.map((item) => {
      const row = document.createElement('div');
      row.className = 'detail-row';
      const title = document.createElement('strong');
      title.textContent = `${item.action} by ${item.actorName || 'Integration'}`;
      const time = document.createElement('small');
      time.textContent = formatDateTime(item.createdAt);
      row.append(title, document.createElement('br'), time);
      if (item.previous?.content) {
        const previous = document.createElement('p');
        previous.textContent = `Previous: ${item.previous.content}`;
        row.append(previous);
      }
      return row;
    }) : [emptyNode('No history yet.')]);
  } catch (error) { toast(error.message, 'error'); }
}

function applyChangedMessage(message) {
  if (message.parentId) {
    upsertMessage(state.replies, message);
  } else {
    upsertMessage(state.messages, message);
    if (state.threadParent?.id === message.id) state.threadParent = message;
  }
  rerenderAll();
}

function rerenderAll() {
  renderMessages();
  if (state.threadId) renderThread();
}

els.messageForm.addEventListener('submit', (event) => {
  event.preventDefault();
  sendMessage();
});
els.messageInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !els.mentionSuggestions.hidden) return;
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

let typingTimer;
els.messageInput.addEventListener('input', () => {
  els.sendButton.disabled = !els.messageInput.value.trim();
  updateMentionSuggestions();
  publishTyping(true);
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => publishTyping(false), 1800);
});

async function sendMessage(existing = null) {
  const content = existing?.content || els.messageInput.value.trim();
  if (!content || !state.channelId) return;
  const clientId = existing?.clientId || `msg-${crypto.randomUUID()}`;
  const pending = existing || {
    id: clientId,
    channelId: state.channelId,
    parentId: null,
    author: state.bootstrap.user,
    content,
    kind: 'user',
    version: 1,
    createdAt: new Date().toISOString(),
    editedAt: null,
    deletedAt: null,
    reactions: [],
    pinned: false,
    replyCount: 0,
    pending: true,
    clientId
  };
  if (!existing) {
    state.messages.push(pending);
    els.messageInput.value = '';
    els.sendButton.disabled = true;
    renderMessages();
    els.messageScroller.scrollTop = els.messageScroller.scrollHeight;
  } else {
    pending.failed = false;
    renderMessages();
  }
  publishTyping(false);
  try {
    const data = await api(`/api/channels/${encodeURIComponent(pending.channelId)}/messages`, {
      method: 'POST', body: JSON.stringify({ content, clientId })
    });
    state.messages = state.messages.filter((item) => item.id !== clientId && item.id !== data.message.id);
    state.messages.push(data.message);
    state.messages.sort((a, b) => Number(a.id) - Number(b.id));
    renderMessages();
    await markChannelRead();
  } catch (error) {
    pending.pending = false;
    pending.failed = true;
    renderMessages();
    toast(`Message failed: ${error.message}`, 'error');
  }
}

function retryMessage(message) {
  message.pending = true;
  message.failed = false;
  sendMessage(message);
}

function updateMentionSuggestions() {
  const before = els.messageInput.value.slice(0, els.messageInput.selectionStart);
  const match = before.match(/(?:^|\s)@([^\n@]*)$/);
  if (!match) return hideMentionSuggestions();
  const query = match[1].toLowerCase();
  const matches = (currentChannel()?.members || []).filter((member) => member.id !== state.bootstrap.user.id && member.name.toLowerCase().startsWith(query)).slice(0, 5);
  if (!matches.length) return hideMentionSuggestions();
  els.mentionSuggestions.replaceChildren(...matches.map((member) => {
    const button = document.createElement('button');
    button.type = 'button';
    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    setAvatar(avatar, member);
    const name = document.createElement('strong');
    name.textContent = member.name;
    button.append(avatar, name);
    button.addEventListener('click', () => insertMention(member.name, match));
    return button;
  }));
  els.mentionSuggestions.hidden = false;
}

function insertMention(name, match) {
  const cursor = els.messageInput.selectionStart;
  const start = cursor - match[1].length;
  els.messageInput.setRangeText(`${name} `, start, cursor, 'end');
  hideMentionSuggestions();
  els.messageInput.focus();
}
function hideMentionSuggestions() { els.mentionSuggestions.hidden = true; }

async function openThread(message) {
  if (!message || message.pending) return;
  try {
    const data = await api(`/api/messages/${message.id}/replies`);
    state.threadId = message.id;
    state.threadParent = data.parent;
    state.replies = data.replies;
    els.threadChannel.textContent = `#${currentChannel()?.name || ''}`;
    els.threadPanel.hidden = false;
    els.appShell.classList.add('thread-open');
    renderThread();
    els.threadInput.focus();
  } catch (error) { toast(error.message, 'error'); }
}

async function reloadThread() {
  if (!state.threadId) return;
  const data = await api(`/api/messages/${state.threadId}/replies`);
  state.threadParent = data.parent;
  state.replies = data.replies;
  renderThread();
}

function renderThread() {
  const nodes = [messageElement(state.threadParent, { thread: true, parent: true })];
  if (!state.replies.length) nodes.push(emptyNode('No replies yet.'));
  else nodes.push(...state.replies.map((reply) => messageElement(reply, { thread: true })));
  els.threadList.replaceChildren(...nodes);
  els.threadList.scrollTop = els.threadList.scrollHeight;
}

function closeThread() {
  state.threadId = null;
  state.threadParent = null;
  state.replies = [];
  els.threadPanel.hidden = true;
  els.appShell.classList.remove('thread-open');
}
els.closeThread.addEventListener('click', closeThread);

els.threadForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const content = els.threadInput.value.trim();
  if (!content || !state.threadId) return;
  const clientId = `reply-${crypto.randomUUID()}`;
  try {
    const data = await api(`/api/messages/${state.threadId}/replies`, { method: 'POST', body: JSON.stringify({ content, clientId }) });
    els.threadInput.value = '';
    upsertMessage(state.replies, data.message);
    state.threadParent = data.parent;
    const index = state.messages.findIndex((message) => message.id === data.parent.id);
    if (index >= 0) state.messages[index] = data.parent;
    rerenderAll();
  } catch (error) { toast(error.message, 'error'); }
});

els.threadInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    els.threadForm.requestSubmit();
  }
});

async function markChannelRead(messageId = null) {
  const newest = messageId || [...state.messages].reverse().find((message) => Number.isInteger(message.id))?.id;
  if (!newest || !state.channelId) return;
  const data = await api(`/api/channels/${encodeURIComponent(state.channelId)}/read`, { method: 'POST', body: JSON.stringify({ messageId: newest }) });
  state.bootstrap.channels = data.channels;
  state.bootstrap.notifications = data.notifications;
  renderChannels();
  renderNotificationCounts(data.notifications);
}

function connectEvents() {
  state.eventSource?.close();
  els.connection.textContent = 'Connecting...';
  const source = new EventSource(`/api/events?viewId=${encodeURIComponent(state.viewId)}`);
  state.eventSource = source;
  source.addEventListener('ready', () => {
    els.connection.textContent = 'Live updates connected';
    publishPresence();
  });
  source.addEventListener('presence', (event) => {
    const data = JSON.parse(event.data);
    if (data.channelId === state.channelId) {
      state.presence = data.views;
      renderPresence();
    }
  });
  source.addEventListener('typing', (event) => {
    const data = JSON.parse(event.data);
    if (data.channelId === state.channelId) {
      state.typingUsers = data.users.filter((user) => user.id !== state.bootstrap.user.id);
      renderTyping();
    }
  });
  source.addEventListener('change', async (event) => {
    const data = JSON.parse(event.data);
    if (data.channelId === state.channelId && data.message) {
      if (data.message.parentId) {
        if (state.threadId === data.message.parentId) await reloadThread();
        if (data.parent) upsertMessage(state.messages, data.parent);
      } else {
        upsertMessage(state.messages, data.message);
      }
      renderMessages();
      if (document.visibilityState === 'visible') await markChannelRead(data.message.id);
      if (data.type === 'message-created' && data.message.author?.id !== state.bootstrap.user.id) {
        els.messageScroller.scrollTop = els.messageScroller.scrollHeight;
      }
    }
    await refreshBootstrap();
  });
  source.addEventListener('notifications', (event) => {
    const data = JSON.parse(event.data);
    state.bootstrap.notifications = data.notifications;
    renderNotificationCounts(data.notifications);
  });
  source.addEventListener('read-state', (event) => {
    const data = JSON.parse(event.data);
    state.bootstrap.channels = data.channels;
    state.bootstrap.notifications = data.notifications;
    renderChannels();
    renderNotificationCounts(data.notifications);
  });
  source.addEventListener('membership', async () => {
    await refreshBootstrap();
    if (!state.bootstrap.channels.some((channel) => channel.id === state.channelId)) {
      toast('Your channel access changed', 'error');
      loadChannel(state.bootstrap.channels[0]?.id);
    }
  });
  source.onerror = () => { els.connection.textContent = 'Reconnecting...'; };
}

async function refreshBootstrap() {
  try {
    const fresh = await api('/api/bootstrap');
    state.bootstrap = fresh;
    renderChannels();
    renderNotificationCounts(fresh.notifications);
  } catch (error) {
    if (error.status === 401) location.reload();
  }
}

async function publishPresence() {
  if (!state.eventSource || state.eventSource.readyState !== EventSource.OPEN) return;
  try {
    const data = await api('/api/presence', { method: 'POST', body: JSON.stringify({ viewId: state.viewId, channelId: state.channelId }) });
    state.presence = data.views;
    renderPresence();
  } catch { /* Reconnect will publish again. */ }
}

function renderPresence() {
  const others = state.presence.filter((view) => view.user.id !== state.bootstrap.user.id);
  els.presenceStack.replaceChildren(...state.presence.slice(0, 4).map((view) => {
    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.title = view.user.id === state.bootstrap.user.id ? `${view.user.name} (you)` : view.user.name;
    setAvatar(avatar, view.user);
    return avatar;
  }));
  const unique = new Set(state.presence.map((view) => view.user.id)).size;
  els.presenceCount.textContent = `${unique} online`;
  els.channelBanner.hidden = true;
  if (others.length) {
    const grouped = new Map();
    for (const view of others) grouped.set(view.user.name, (grouped.get(view.user.name) || 0) + 1);
    const labels = [...grouped.entries()].map(([name, count]) => count > 1 ? `${name} (${count} views)` : name);
    els.channelBanner.textContent = `${labels.join(', ')} ${labels.length === 1 ? 'is' : 'are'} viewing this channel`;
    els.channelBanner.hidden = false;
  }
}

async function publishTyping(active) {
  if (!state.channelId || state.eventSource?.readyState !== EventSource.OPEN) return;
  try {
    await api('/api/typing', { method: 'POST', body: JSON.stringify({ channelId: state.channelId, viewId: state.viewId, active }) });
  } catch { /* Typing feedback is transient. */ }
}

function renderTyping() {
  const names = state.typingUsers.map((user) => user.name);
  els.typing.textContent = names.length ? `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} typing...` : '';
}

els.searchButton.addEventListener('click', () => {
  els.searchDialog.showModal();
  els.searchInput.focus();
});
els.searchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  els.searchResults.className = 'result-list empty-state';
  els.searchResults.textContent = 'Searching...';
  try {
    const data = await api(`/api/search?q=${encodeURIComponent(els.searchInput.value)}`);
    renderResultList(els.searchResults, data.results, 'No matching messages.');
  } catch (error) { els.searchResults.textContent = error.message; }
});

function renderResultList(container, messages, emptyText) {
  container.className = 'result-list';
  if (!messages.length) return container.replaceChildren(emptyNode(emptyText));
  container.replaceChildren(...messages.map((message) => {
    const button = document.createElement('button');
    button.className = 'result-item';
    const meta = document.createElement('small');
    meta.textContent = `${message.author?.name || 'Integration'} in #${message.channelName || state.bootstrap.channels.find((channel) => channel.id === message.channelId)?.name} · ${formatDateTime(message.createdAt)}`;
    const content = document.createElement('span');
    content.textContent = message.content;
    button.append(meta, content);
    button.addEventListener('click', () => navigateToMessage(message));
    return button;
  }));
}

async function navigateToMessage(message) {
  els.searchDialog.close();
  els.detailDialog.close();
  await loadChannel(message.channelId);
  if (message.parentId) {
    const parent = state.messages.find((item) => item.id === message.parentId);
    if (parent) {
      await openThread(parent);
      focusLinkedMessage(message.id);
    }
  } else {
    focusLinkedMessage(message.id);
  }
  await markChannelRead(message.id);
}

function focusLinkedMessage(id) {
  setTimeout(() => {
    const element = document.querySelector(`.message[data-message-id="${CSS.escape(String(id))}"]`);
    if (element) {
      element.scrollIntoView({ block: 'center' });
      element.animate([{ background: '#fff0b8' }, { background: 'transparent' }], { duration: 1500 });
    }
  }, 50);
}

els.notificationsButton.addEventListener('click', showMentions);
els.mentionsNav.addEventListener('click', showMentions);
function showMentions() {
  const items = state.bootstrap.notifications;
  const nodes = items.length ? items.map((item) => {
    const button = document.createElement('button');
    button.className = 'result-item';
    const meta = document.createElement('small');
    meta.textContent = `${item.authorName} mentioned you in #${item.channelName} · ${formatDateTime(item.createdAt)}`;
    const content = document.createElement('span');
    content.textContent = item.content;
    button.append(meta, content);
    button.addEventListener('click', () => navigateToMessage({ ...item, id: item.messageId, createdAt: item.createdAt }));
    return button;
  }) : [emptyNode('No mentions yet.')];
  openDetail('Notifications', 'Mentions', nodes);
}

els.pinsNav.addEventListener('click', showPins);
els.channelPins.addEventListener('click', showPins);
async function showPins() {
  try {
    const data = await api(`/api/channels/${encodeURIComponent(state.channelId)}/pins`);
    const channelName = currentChannel()?.name;
    const nodes = data.messages.length ? data.messages.map((message) => {
      const button = document.createElement('button');
      button.className = 'result-item';
      const meta = document.createElement('small');
      meta.textContent = `${message.author?.name || 'Integration'} · ${formatDateTime(message.createdAt)}`;
      const content = document.createElement('span');
      content.textContent = message.content;
      button.append(meta, content);
      button.addEventListener('click', () => navigateToMessage({ ...message, channelName }));
      return button;
    }) : [emptyNode('No pinned messages in this channel.')];
    openDetail(`#${channelName}`, 'Pinned messages', nodes);
  } catch (error) { toast(error.message, 'error'); }
}

els.membersButton.addEventListener('click', showMembers);
async function showMembers() {
  const channel = currentChannel();
  if (!channel) return;
  if (!state.allUsers.length) state.allUsers = (await api('/api/auth/users')).users;
  const nodes = state.allUsers.map((user) => {
    const member = channel.members.some((item) => item.id === user.id);
    if (!member && state.bootstrap.user.role !== 'admin') return null;
    const row = document.createElement('div');
    row.className = 'member-row';
    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    setAvatar(avatar, user);
    const label = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = user.name;
    const role = document.createElement('span');
    role.textContent = `${user.role}${member ? ' · member' : ' · not in channel'}`;
    label.append(name, role);
    row.append(avatar, label);
    if (state.bootstrap.user.role === 'admin' && user.id !== state.bootstrap.user.id) {
      const control = document.createElement('button');
      control.className = member ? '' : 'primary-button';
      control.textContent = member ? 'Remove' : 'Add';
      control.addEventListener('click', async () => {
        try {
          await api(`/api/channels/${channel.id}/members`, { method: 'POST', body: JSON.stringify({ userId: user.id, action: member ? 'remove' : 'add' }) });
          await refreshBootstrap();
          els.detailDialog.close();
          showMembers();
        } catch (error) { toast(error.message, 'error'); }
      });
      row.append(control);
    }
    return row;
  }).filter(Boolean);
  openDetail(`#${channel.name}`, 'Channel members', nodes);
}

function openDetail(eyebrow, title, nodes) {
  els.detailEyebrow.textContent = eyebrow;
  els.detailTitle.textContent = title;
  els.detailContent.replaceChildren(...nodes);
  els.detailDialog.showModal();
}

function emptyNode(text) {
  const node = document.createElement('div');
  node.className = 'empty-state';
  node.textContent = text;
  return node;
}

document.querySelectorAll('.dialog-close').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
}));

els.profileButton.addEventListener('click', () => { els.profileMenu.hidden = !els.profileMenu.hidden; });
els.logout.addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST', body: '{}' });
  state.eventSource?.close();
  location.reload();
});

els.mobileNav.addEventListener('click', () => {
  els.sidebar.classList.add('open');
  els.mobileScrim.hidden = false;
});
els.mobileScrim.addEventListener('click', closeMobileNav);
function closeMobileNav() {
  els.sidebar.classList.remove('open');
  els.mobileScrim.hidden = true;
}

document.addEventListener('click', (event) => {
  if (!event.target.closest('.message-menu') && !event.target.closest('[data-action="more"]') && !event.target.closest('[data-action="react"]')) {
    document.querySelectorAll('.message-menu').forEach((menu) => { menu.hidden = true; });
  }
  if (!event.target.closest('#profile-button') && !event.target.closest('#profile-menu')) els.profileMenu.hidden = true;
});

window.addEventListener('beforeunload', () => {
  state.eventSource?.close();
  navigator.sendBeacon?.('/api/typing', new Blob([JSON.stringify({ channelId: state.channelId, viewId: state.viewId, active: false })], { type: 'application/json' }));
});

initialize();
