// Use environment variable for API URL, fallback to relative path in production
const API_URL = import.meta.env.VITE_API_URL || (
  import.meta.env.MODE === 'production' 
    ? '/api'  // Same domain in production
    : 'http://localhost:3001/api'  // Localhost in development
);

let authToken: string | null = localStorage.getItem('auth_token');

export function setAuthToken(token: string) {
  authToken = token;
  localStorage.setItem('auth_token', token);
}

export function clearAuthToken() {
  authToken = null;
  localStorage.removeItem('auth_token');
}

export function getAuthToken() {
  return authToken;
}

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const headers: any = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Auth
export const auth = {
  signup: (data: { email: string; password: string; firstName: string; lastName: string }) =>
    fetchAPI('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  
  login: (data: { email: string; password: string }) =>
    fetchAPI('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
};

// Accounts
export const accounts = {
  list: () => fetchAPI('/accounts'),
  
  create: (data: { username: string; cookies: string }) =>
    fetchAPI('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  
  delete: (id: number) =>
    fetchAPI(`/accounts/${id}`, { method: 'DELETE' }),
};

// Campaigns
export const campaigns = {
  list: () => fetchAPI('/campaigns'),
  
  get: (id: number) => fetchAPI(`/campaigns/${id}`),
  
  create: (data: any) =>
    fetchAPI('/campaigns', { method: 'POST', body: JSON.stringify(data) }),
  
  update: (id: number, data: any) =>
    fetchAPI(`/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  
  start: (id: number) =>
    fetchAPI(`/campaigns/${id}/start`, { method: 'POST' }),
  
  pause: (id: number) =>
    fetchAPI(`/campaigns/${id}/pause`, { method: 'POST' }),
  
  stop: (id: number) =>
    fetchAPI(`/campaigns/${id}/stop`, { method: 'POST' }),
};

// Followers
export const followers = {
  extract: (data: { accountId: number; targetUsername: string; quantity: number }) =>
    fetchAPI('/extract-followers', { method: 'POST', body: JSON.stringify(data) }),
};

// Dashboard
export const dashboard = {
  stats: () => fetchAPI('/dashboard/stats'),
};

// Follow Campaigns
export const followCampaigns = {
  list: () => fetchAPI('/follow-campaigns'),
  
  get: (id: number) => fetchAPI(`/follow-campaigns/${id}`),
  
  create: (data: any) =>
    fetchAPI('/follow-campaigns', { method: 'POST', body: JSON.stringify(data) }),
  
  update: (id: number, data: any) =>
    fetchAPI(`/follow-campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  
  start: (id: number) =>
    fetchAPI(`/follow-campaigns/${id}/start`, { method: 'POST' }),
  
  pause: (id: number) =>
    fetchAPI(`/follow-campaigns/${id}/pause`, { method: 'POST' }),
  
  stop: (id: number) =>
    fetchAPI(`/follow-campaigns/${id}/stop`, { method: 'POST' }),
};

// User Settings
export const userSettings = {
  getProfile: () => fetchAPI('/user/profile'),
  
  updateProfile: (data: { firstName: string; lastName: string; email: string }) =>
    fetchAPI('/user/profile', { method: 'PUT', body: JSON.stringify(data) }),
  
  updatePassword: (data: { currentPassword: string; newPassword: string }) =>
    fetchAPI('/user/password', { method: 'PUT', body: JSON.stringify(data) }),
};
