const STORAGE_KEY = 'torquebay_demo_user';
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
      'X-Demo-User-Id': getDemoUserId(),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed');
    error.status = response.status;
    error.code = data.code;
    throw error;
  }
  return data;
}
