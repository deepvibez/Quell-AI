import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";

function classNames(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default function Layout() {
  const { logout, user } = useAuth();
  const location = useLocation();

  const navItems = [
    { to: "/", label: "Stores" },
    { to: "/analytics", label: "Analytics" },
    { to: "/tokens", label: "Tokens" },
    { to: "/tickets", label: "Tickets" },
    { to: "/settings", label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="hidden md:flex md:flex-col w-60 bg-slate-900 text-slate-50">
        <div className="h-16 flex items-center px-4 border-b border-slate-800">
          <span className="text-lg font-semibold">Quell Admin</span>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1 text-sm">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                classNames(
                  "flex items-center px-3 py-2 rounded-md transition-colors",
                  isActive
                    ? "bg-slate-800 text-white"
                    : "text-slate-200 hover:bg-slate-800/80 hover:text-white"
                )
              }
              end={item.to === "/"}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-300 space-y-2">
          <div>
            <div className="font-medium">{user?.email ?? "Admin"}</div>
          </div>
          <button
            onClick={logout}
            className="inline-flex items-center px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile + context) */}
        <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b bg-white">
          <div className="flex items-center gap-2">
            <span className="md:hidden font-semibold">Quell Admin</span>
            <span className="hidden md:inline text-sm text-slate-500">
              {location.pathname === "/"
                ? "Stores overview"
                : location.pathname.replace("/", "").split("/")[0]}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs md:text-sm">
            <span className="hidden sm:inline text-slate-500">
              {user?.email ?? "Admin"}
            </span>
            <button
              onClick={logout}
              className="px-3 py-1.5 rounded border border-slate-200 bg-slate-900 text-white text-xs md:text-sm hover:bg-slate-800"
            >
              Log out
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 px-4 md:px-8 py-6 md:py-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
