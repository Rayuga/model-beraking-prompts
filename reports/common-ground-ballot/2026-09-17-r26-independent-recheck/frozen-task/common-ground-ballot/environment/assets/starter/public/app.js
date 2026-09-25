const views = {
  ballots: 'Build and manage membership decisions.',
  vote: 'Submit one final private choice on an eligible open ballot.',
  turnout: 'Review participation without revealing selections.',
  results: 'Read exact outcomes after publication.',
  members: 'Manage the roster used by future ballots.',
  audit: 'Review administrative activity without private choices.'
};

document.querySelectorAll('[data-email]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelector('#email').value = button.dataset.email;
    document.querySelector('#password').value = 'CommonGround!2026';
  });
});

const status = document.querySelector('#status');
const api = async (url, body) => {
  const response = await fetch(url, body === undefined ? {} : {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed.');
  return result;
};
function showUser(user) {
  document.querySelector('#sign-in').classList.toggle('hidden', !!user);
  document.querySelector('#workspace').classList.toggle('hidden', !user);
  document.querySelector('#identity').textContent = user ? `${user.name} · ${user.role}` : '';
}
document.querySelector('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  try {
    const {user} = await api('/api/auth/login', {
      email: document.querySelector('#email').value,
      password: document.querySelector('#password').value
    });
    showUser(user);
    status.textContent = 'Signed in.';
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
});

for (const [id, route] of [['logout', '/api/auth/logout'], ['logout-all', '/api/auth/logout-all']]) {
  document.querySelector(`#${id}`).addEventListener('click', async () => {
    try { await api(route, {}); showUser(null); status.textContent = 'Signed out.'; }
    catch (error) { status.textContent = error.message; }
  });
}
api('/api/me').then(({user}) => showUser(user)).catch(error => { status.textContent = error.message; });

document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => {
    const view = button.dataset.view;
    document.querySelector('#view-title').textContent = button.textContent;
    document.querySelector('#view-copy').textContent = views[view];
  });
});

document.querySelector('#theme').addEventListener('click', () => {
  const root = document.documentElement;
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
});
