import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchPlatformOverview,
  fetchTopStores,
  fetchGrowth,
  fetchDailyStats,
  listAdminStores,
} from "../api/admin";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

function formatSince(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const since = useMemo(() => formatSince(days), [days]);

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ["admin-platform-overview", since],
    queryFn: () => fetchPlatformOverview({ since }),
  });

  const { data: topStores } = useQuery({
    queryKey: ["admin-top-stores", since],
    queryFn: () => fetchTopStores({ since, limit: 5, sortBy: "conversations" }),
  });

  const { data: growth } = useQuery({
    queryKey: ["admin-growth", days],
    queryFn: () => fetchGrowth(days),
  });

  const { data: dailyStats } = useQuery({
    queryKey: ["admin-daily-stats", days],
    queryFn: () => fetchDailyStats(days),
  });

  const { data: stores } = useQuery({
    queryKey: ["admin-stores"],
    queryFn: () => listAdminStores(),
    staleTime: 5 * 60_000,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-indigo-900">Platform analytics</h1>
          <p className="text-sm text-slate-600">
            High-level metrics across all connected stores.
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Range:</span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="border rounded px-2 py-1 bg-white border-indigo-200 text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-white border border-indigo-200 rounded-xl shadow-md p-5">
          <div className="text-xs font-medium text-indigo-700 uppercase">Stores</div>
          <div className="mt-3 text-3xl font-semibold text-indigo-900">
            {overview?.stores.total_stores ?? "—"}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            Active: {overview?.stores.active_stores ?? "—"}
          </div>
        </div>

        <div className="bg-white border border-indigo-200 rounded-xl shadow-md p-5">
          <div className="text-xs font-medium text-indigo-700 uppercase">Conversations</div>
          <div className="mt-3 text-3xl font-semibold text-indigo-900">
            {overview?.conversations.total_conversations ?? "—"}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            Messages: {overview?.conversations.total_messages ?? "—"}
          </div>
        </div>

        <div className="bg-white border border-indigo-200 rounded-xl shadow-md p-5">
          <div className="text-xs font-medium text-indigo-700 uppercase">Support</div>
          <div className="mt-3 text-3xl font-semibold text-indigo-900">
            {overview?.tickets.total_tickets ?? "—"}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            Open: {overview?.tickets.open_tickets ?? "—"} / Urgent: {overview?.tickets.urgent_tickets ?? "—"}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Growth chart */}
        <div className="bg-white border border-indigo-200 rounded-xl shadow-md p-5 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-indigo-800">Store growth</h2>
            <span className="text-xs text-slate-400">New installs per day</span>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growth ?? []}>
                <XAxis dataKey="date" hide />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  axisLine={{ stroke: "#e6edf3" }}
                />
                <Tooltip />
                <Bar dataKey="new_stores" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily conversations chart */}
        <div className="bg-white border border-indigo-200 rounded-xl shadow-md p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-indigo-800">Daily conversations</h2>
            <span className="text-xs text-slate-400">Conversations & active stores</span>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyStats ?? []}>
                <XAxis dataKey="date" hide />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  axisLine={{ stroke: "#e6edf3" }}
                />
                <Tooltip
                  wrapperStyle={{ borderRadius: 8, boxShadow: "0 6px 18px rgba(16,24,40,0.08)" }}
                />
                <Line
                  type="monotone"
                  dataKey="conversations"
                  stroke="#4f46e5"
                  strokeWidth={3}
                  dot={false}
                  name="Conversations"
                />
                <Line
                  type="monotone"
                  dataKey="active_stores"
                  stroke="#059669"
                  strokeWidth={3}
                  dot={false}
                  name="Active stores"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top stores table */}
      <div className="bg-white border border-indigo-200 rounded-xl shadow-md p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-indigo-800">Top stores by conversations</h2>
          <span className="text-xs text-slate-400">Showing last {days} days</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-indigo-800 border-b bg-indigo-50">
                <th className="py-3 pr-6">Store</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Conversations</th>
                <th className="py-3 px-4 text-right">Messages</th>
              </tr>
            </thead>
            <tbody>
              {(topStores ?? []).map((s) => (
                <tr key={s.store_url} className="border-b last:border-0">
                  <td className="py-3 pr-6">
                    <div className="font-medium text-slate-800">{s.shop_domain || s.store_url}</div>
                    <div className="text-xs text-slate-500">{s.store_url}</div>
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-600 text-white text-xs font-medium">
                      {s.store_status || "unknown"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-slate-800">
                    {s.conversations.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-800">
                    {s.messages.toLocaleString()}
                  </td>
                </tr>
              ))}
              {(!topStores || topStores.length === 0) && (
                <tr>
                  <td
                    colSpan={4}
                    className="py-6 text-center text-sm text-slate-500"
                  >
                    No activity data available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {loadingOverview && (
        <div className="text-sm text-slate-500">Loading analytics…</div>
      )}

      {stores && stores.length > 0 && (
        <div className="text-sm text-slate-500">Tracking {stores.length} stores.</div>
      )}
    </div>
  );
}
