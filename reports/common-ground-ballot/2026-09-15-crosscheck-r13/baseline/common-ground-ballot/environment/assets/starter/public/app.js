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

document.querySelector('#login-form').addEventListener('submit', (event) => {
  event.preventDefault();
  document.querySelector('#sign-in').classList.add('hidden');
  document.querySelector('#workspace').classList.remove('hidden');
});

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
