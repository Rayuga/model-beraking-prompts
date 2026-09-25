import { User } from '../types';
import { toggleTheme } from '../theme';

export interface HeaderCallbacks {
  onLogout: () => void;
}

export function renderHeader(container: HTMLElement, currentUser: User | null, callbacks: HeaderCallbacks) {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';

  container.innerHTML = `
    <header class="app-header">
      <div class="header-brand">
        <div class="brand-logo" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <div class="brand-text">
          <h1 class="brand-title">Pellmoor Hiring Workspace</h1>
          <span class="brand-tagline">Pipeline & Assessment Control</span>
        </div>
      </div>

      <div class="header-controls">
        <button id="theme-toggle-btn" class="theme-toggle-btn" aria-label="Toggle light or dark theme" title="Switch Theme">
          <span class="theme-icon light-icon" aria-hidden="true">☀️</span>
          <span class="theme-icon dark-icon" aria-hidden="true">🌙</span>
          <span class="theme-label">${currentTheme === 'dark' ? 'Dark' : 'Light'}</span>
        </button>

        ${currentUser ? `
          <div class="user-profile-badge">
            <div class="user-avatar" aria-hidden="true">${currentUser.name.charAt(0)}</div>
            <div class="user-info">
              <span class="user-name">${currentUser.name}</span>
              <span class="user-role-tag role-${currentUser.role.replace(' ', '-')}">${currentUser.role}</span>
            </div>
          </div>
          <button id="logout-btn" class="btn btn-sm btn-outline" title="Sign Out">Sign Out</button>
        ` : ''}
      </div>
    </header>
  `;

  // Bind Theme Toggle
  const themeBtn = container.querySelector('#theme-toggle-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const newTheme = toggleTheme();
      const lbl = container.querySelector('.theme-label');
      if (lbl) lbl.textContent = newTheme === 'dark' ? 'Dark' : 'Light';
    });
  }

  // Bind Logout
  const logoutBtn = container.querySelector('#logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      callbacks.onLogout();
    });
  }
}
