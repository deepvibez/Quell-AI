// src/api/auth.ts
import api from './axios';

export type User = {
  id: number;
  name?: string;
  email?: string;
  // add any extra fields your backend returns
};

type LoginResponse = {
  success: boolean;
  token?: string;
  user?: User;
  message?: string;
  // your backend may include stores or other data — add here if needed
};

/**
 * Login - posts credentials to backend, stores token in localStorage on success
 * Returns the full response object so callers can inspect success / message / user
 *
 * NOTE: `api` baseURL should already include `/api`, so we call `/auth/login` here.
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
  if (data?.token) {
    // save token for later requests (axios interceptor will attach it)
    localStorage.setItem('quell_token', data.token);
  }
  return data;
}

/**
 * logout - client-side only (removes token). If backend needs a server-side logout call,
 * you can add it here (e.g. await api.post('/api/auth/logout')).
 */
export function logout() {
  localStorage.removeItem('quell_token');
}

/**
 * me - fetch current authenticated user from /auth/me
 * (backend route is protected; axios interceptor will send Authorization header)
 */
export async function me(): Promise<{ success: boolean; user?: User; message?: string }> {
  const { data } = await api.get('/auth/me');
  return data;
}

/**
 * setToken (optional helper) - useful if you obtain token elsewhere and want to set it
 */
export function setToken(token: string | null) {
  if (token) localStorage.setItem('quell_token', token);
  else localStorage.removeItem('quell_token');
}
