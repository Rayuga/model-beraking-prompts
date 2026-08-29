const STORAGE_KEY = 'medledger_demo_user';

// Oracle uses seeded users; this default id must exist after seeding.
export const DEFAULT_USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

export function getDemoUserId() {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_USER_ID;
}
export function setDemoUserId(id) {
  localStorage.setItem(STORAGE_KEY, id);
}

export async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': getDemoUserId(),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed');
    error.status = response.status;
    error.code = data.code;
    error.details = data.details || data;
    throw error;
  }
  return data;
}

export function formatCents(cents) {
  if (cents === null || cents === undefined) return '—';
  return `$${(Number(cents) / 100).toFixed(2)}`;
}
export function formatMs(ms) {
  if (ms === null || ms === undefined) return '—';
  return new Date(Number(ms)).toISOString().slice(0, 10);
}
