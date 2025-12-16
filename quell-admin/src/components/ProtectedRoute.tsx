// src/components/ProtectedRoute.tsx
import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) return <div>Loading…</div>;

  if (!user) {
    // redirect to login while preserving attempted path
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  return children;
}
