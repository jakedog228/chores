const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    credentials: 'include'
  });

  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Request failed');
  }

  return response.json();
}

export const authApi = {
  getStatus: () => request('/auth/status'),
  login: (password) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password })
  }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  setup: (password) => request('/auth/setup', {
    method: 'POST',
    body: JSON.stringify({ password })
  })
};

export const peopleApi = {
  getAll: () => request('/people')
};

export const choresApi = {
  getByMonth: (month) => request(`/chores?month=${month}`),
  complete: (id, completedBy, { force = false } = {}) => request(`/chores/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ completedBy, force })
  }),
  uncomplete: (id, { force = false } = {}) => request(`/chores/${id}/uncomplete`, {
    method: 'PATCH',
    body: JSON.stringify({ force })
  })
};

export const trashApi = {
  getState: () => request('/trash'),
  voteFull: (voter) => request('/trash/vote-full', {
    method: 'POST',
    body: JSON.stringify({ voter })
  }),
  revokeVote: (voter) => request('/trash/vote', {
    method: 'DELETE',
    body: JSON.stringify({ voter })
  }),
  complete: (completedBy, position = null) => request('/trash/complete', {
    method: 'POST',
    body: JSON.stringify({ completedBy, position })
  })
};

export const homeApi = {
  get: (user) => request(`/home?user=${encodeURIComponent(user)}`)
};
