// src/api/axios.ts
import axios, { type InternalAxiosRequestConfig } from 'axios';

// Treat VITE_API_BASE as the *full* API root (e.g. http://localhost:3000/api)
// and fall back to http://localhost:3000/api if not provided.
const baseURL = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000/api';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach token automatically
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('quell_token');

  if (token) {
    // ensure headers object exists
    if (!config.headers) {
      // config.headers must be an object; cast to any to satisfy Axios internal types
      config.headers = {} as any;
    }

    // set Authorization header — cast to any because Axios' header typing is strict
    (config.headers as any)['Authorization'] = `Bearer ${token}`;
  }

  return config;
});

export default api;
