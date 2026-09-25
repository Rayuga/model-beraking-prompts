import { login } from '../api';
import { User } from '../types';

export interface LoginCallbacks {
  onLoginSuccess: (user: User) => void;
}

export function renderLogin(container: HTMLElement, callbacks: LoginCallbacks) {
  container.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="login-header">
          <div class="login-brand-icon" aria-hidden="true">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          </div>
          <h2 class="login-title">Sign In to Pellmoor</h2>
          <p class="login-desc">Select a demo account or sign in with your credentials.</p>
        </div>

        <div id="login-error-msg" class="login-error-box" style="display: none;"></div>

        <div class="demo-accounts-grid">
          <button class="demo-account-btn" data-email="hiring@pellmoor.test" data-pass="password123">
            <div class="demo-name">Ruth Aldane</div>
            <div class="demo-role role-hiring-manager">Hiring Manager</div>
            <div class="demo-email">hiring@pellmoor.test</div>
          </button>

          <button class="demo-account-btn" data-email="coord@pellmoor.test" data-pass="password123">
            <div class="demo-name">Cal Meriden</div>
            <div class="demo-role role-coordinator">Coordinator</div>
            <div class="demo-email">coord@pellmoor.test</div>
          </button>

          <button class="demo-account-btn" data-email="panel1@pellmoor.test" data-pass="password123">
            <div class="demo-name">Otis Barre</div>
            <div class="demo-role role-panel">Panel Member</div>
            <div class="demo-email">panel1@pellmoor.test</div>
          </button>

          <button class="demo-account-btn" data-email="panel2@pellmoor.test" data-pass="password123">
            <div class="demo-name">Wren Foss</div>
            <div class="demo-role role-panel">Panel Member</div>
            <div class="demo-email">panel2@pellmoor.test</div>
          </button>
        </div>

        <div class="login-divider"><span>or sign in manually</span></div>

        <form id="manual-login-form" class="manual-login-form">
          <div class="form-group">
            <label for="login-email">Email Address</label>
            <input type="email" id="login-email" class="form-input" placeholder="name@pellmoor.test" required>
          </div>

          <div class="form-group">
            <label for="login-password">Password</label>
            <input type="password" id="login-password" class="form-input" placeholder="••••••••" required>
          </div>

          <button type="submit" id="login-submit-btn" class="btn btn-primary btn-block">Sign In</button>
        </form>
      </div>
    </div>
  `;

  const errorBox = container.querySelector('#login-error-msg') as HTMLElement;
  const showError = (msg: string) => {
    if (errorBox) {
      errorBox.textContent = msg;
      errorBox.style.display = 'block';
    }
  };

  const handleLogin = async (email: string, pass: string) => {
    try {
      errorBox.style.display = 'none';
      const res = await login(email, pass);
      callbacks.onLoginSuccess(res.user);
    } catch (err: any) {
      showError(err.message || 'Login failed. Please check your credentials.');
    }
  };

  // Demo accounts click
  const demoBtns = container.querySelectorAll('.demo-account-btn');
  demoBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const email = btn.getAttribute('data-email');
      const pass = btn.getAttribute('data-pass');
      if (email && pass) {
        handleLogin(email, pass);
      }
    });
  });

  // Manual login form submit
  const form = container.querySelector('#manual-login-form') as HTMLFormElement;
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailInput = container.querySelector('#login-email') as HTMLInputElement;
      const passInput = container.querySelector('#login-password') as HTMLInputElement;
      if (emailInput && passInput) {
        handleLogin(emailInput.value.trim(), passInput.value);
      }
    });
  }
}
