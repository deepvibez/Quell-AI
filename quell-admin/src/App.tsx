// src/App.tsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";

// Your existing layout + pages
import AdminLayout from "./components/Layout"; // <-- create later if missing
import StoresPage from "./pages/StoresPage";   // <-- will create later
import AnalyticsPage from "./pages/AnalyticsPage";
import TokensPage from "./pages/TokensPage";
import TicketsPage from "./pages/TicketsPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <Routes>
      {/* Public route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected admin routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<StoresPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="tokens" element={<TokensPage />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
