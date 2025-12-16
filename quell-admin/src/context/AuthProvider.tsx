// src/context/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { login as apiLogin, logout as apiLogout, me as apiMe, setToken, type User } from '../api/auth';


type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Try to fetch current user if token exists (React Query v5 object syntax)
  const { refetch } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: apiMe,
    enabled: false,
    onSuccess: (data) => {
      if (data?.user) setUser(data.user);
      else setUser(null);
      setLoading(false);
    },
    onError: () => {
      setUser(null);
      setLoading(false);
    },
  });

  useEffect(() => {
    // if a token exists, call /me once on mount
    const t = localStorage.getItem('quell_token');
    if (t) {
      refetch();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string) {
    setLoading(true);
    try {
      const resp = await apiLogin(email, password);
      if (resp?.token) {
        // token is saved by api.login -> localStorage
        // ensure axios picks it up
        setToken(resp.token);
        // fetch /me to populate user
        const meResp = await apiMe();
        if (meResp?.user) {
          setUser(meResp.user);
          setLoading(false);
          return { success: true };
        }
      }
      setLoading(false);
      return { success: false, message: resp?.message || 'Login failed' };
    } catch (err: any) {
      setLoading(false);
      return { success: false, message: err?.message || 'Login failed' };
    }
  }

  function logout() {
    apiLogout(); // client-side removal
    setUser(null);
    // optionally notify server here if you implement server logout
    qc.clear(); // clear react-query cache
  }

  async function refresh() {
    setLoading(true);
    try {
      const r = await apiMe();
      setUser(r.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
