import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const CHART_COLORS = {
  primary: "#6366f1",
  secondary: "#22c55e",
  tertiary: "#f59e0b",
  quaternary: "#ec4899",
  quinary: "#8b5cf6",
  senary: "#14b8a6",
};

const ENGAGEMENT_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#6366f1"];

const RANGE_OPTIONS = [
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
  { label: "Last 90 days", value: 90 },
];

const CustomerBehaviorAnalytics = ({ storeUrl: initialStoreUrl }) => {
  const [storeUrl] = useState(
    initialStoreUrl ||
      (typeof window !== "undefined"
        ? sessionStorage.getItem("store_url")
        : "") ||
      ""
  );
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async (opts = {}) => {
    const effectiveStore = storeUrl;
    const effectiveDays = opts.days ?? days;

    if (!effectiveStore) {
      setError("store_url missing. Make sure it's saved in sessionStorage.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const today = new Date();
      const sinceDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      sinceDate.setDate(sinceDate.getDate() - effectiveDays);
      const since = sinceDate.toISOString().slice(0, 10);

      const params = new URLSearchParams({
        store_url: effectiveStore,
        since,
      });

      const res = await fetch(
        `http://localhost:3000/analytics/customer-behavior?${params.toString()}`
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to fetch customer behavior analytics");
      }

      const json = await res.json();

      setData({
        ...json,
        meta: { ...(json.meta || {}), since, days: effectiveDays },
      });
    } catch (err) {
      setError(err.message || "Fetch error");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (storeUrl) {
      fetchData();
    } else {
      setError("store_url not found in sessionStorage.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeUrl]);

  const hasData = !!data;

  // Format duration for display
  const formatDuration = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  // Prepare engagement data for pie chart
  const engagementData = hasData
    ? [
        {
          name: "Low (1-2 msgs)",
          value: data.engagement_distribution?.low || 0,
          color: ENGAGEMENT_COLORS[0],
        },
        {
          name: "Medium (3-5 msgs)",
          value: data.engagement_distribution?.medium || 0,
          color: ENGAGEMENT_COLORS[1],
        },
        {
          name: "High (6-10 msgs)",
          value: data.engagement_distribution?.high || 0,
          color: ENGAGEMENT_COLORS[2],
        },
        {
          name: "Very High (10+ msgs)",
          value: data.engagement_distribution?.very_high || 0,
          color: ENGAGEMENT_COLORS[3],
        },
      ].filter((item) => item.value > 0)
    : [];

  // Prepare visitor types for pie chart
  const visitorData = hasData
    ? [
        {
          name: "New Visitors",
          value: data.visitor_types?.new_visitors || 0,
          color: CHART_COLORS.quaternary,
        },
        {
          name: "Returning Visitors",
          value: data.visitor_types?.returning_visitors || 0,
          color: CHART_COLORS.secondary,
        },
      ].filter((item) => item.value > 0)
    : [];

  return (
    <div className="w-full h-full p-4 sm:p-6 lg:p-8">
      <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center text-purple-600 text-lg font-semibold shadow-sm">
              👥
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900">
                Customer Behavior Analytics
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Understand how customers interact with your chatbot and browse
                your store.
              </p>
              {storeUrl && (
                <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px]">
                  <span className="uppercase tracking-wide text-slate-400">
                    Store
                  </span>
                  <a
                    href={
                      storeUrl.startsWith("http")
                        ? storeUrl
                        : `https://${storeUrl}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                  >
                    {storeUrl}
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">Date range</span>
              <select
                value={days}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setDays(v);
                  fetchData({ days: v });
                }}
                className="text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {RANGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => fetchData()}
              className="px-4 py-2 text-xs rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm disabled:opacity-60"
              disabled={loading || !storeUrl}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 border-t border-slate-100 pt-3">
          {data?.meta?.since && (
            <span>
              Since:{" "}
              <span className="font-medium text-slate-700">
                {data.meta.since}
              </span>
            </span>
          )}
          {data?.meta?.timestamp && (
            <span>
              Last updated:{" "}
              <span className="font-medium text-slate-700">
                {new Date(data.meta.timestamp).toLocaleString()}
              </span>
            </span>
          )}
        </div>

        {/* Loading / error */}
        {loading && (
          <div className="border border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center bg-slate-50">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
            <div className="text-xs text-slate-500">
              Loading customer behavior analytics…
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-xs">
            <div className="font-semibold mb-1">Something went wrong</div>
            <div>{error}</div>
          </div>
        )}

        {/* Main content */}
        {!loading && hasData && (
          <div className="space-y-6">
            {/* Overview KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: "Total Sessions",
                  value: data.overview?.total_sessions || 0,
                  helper: "Unique conversation sessions",
                  icon: "💬",
                },
                {
                  label: "Unique Customers",
                  value: data.overview?.unique_customers || 0,
                  helper: "Individual users who interacted",
                  icon: "👤",
                },
                {
                  label: "Avg Session Duration",
                  value: formatDuration(
                    data.overview?.avg_session_duration_seconds || 0
                  ),
                  helper: "Average time spent per session",
                  icon: "⏱️",
                },
                {
                  label: "Avg Messages/Session",
                  value: data.overview?.avg_messages_per_session || 0,
                  helper: "Messages exchanged per conversation",
                  icon: "📊",
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white hover:shadow-md transition"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                      {item.label}
                    </div>
                    <span className="text-xl">{item.icon}</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {item.value}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {item.helper}
                  </div>
                </div>
              ))}
            </div>

            {/* Visitor Types & Engagement Distribution */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Visitor Types Pie Chart */}
              {visitorData.length > 0 && (
                <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                  <div className="mb-4">
                    <h2 className="text-sm font-semibold text-slate-900">
                      Visitor Types
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      New vs returning visitors (
                      {data.visitor_types?.return_rate} return rate)
                    </p>
                  </div>
                  <div className="h-64 bg-white rounded-xl p-3 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={visitorData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name}: ${(percent * 100).toFixed(0)}%`
                          }
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {visitorData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Engagement Distribution Pie Chart */}
              {engagementData.length > 0 && (
                <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                  <div className="mb-4">
                    <h2 className="text-sm font-semibold text-slate-900">
                      Engagement Levels
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Session distribution by message count
                    </p>
                  </div>
                  <div className="h-64 bg-white rounded-xl p-3 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={engagementData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name}: ${(percent * 100).toFixed(0)}%`
                          }
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {engagementData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* Peak Hours & Peak Days */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Peak Hours */}
              {data.peak_hours?.length > 0 && (
                <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                  <div className="mb-4">
                    <h2 className="text-sm font-semibold text-slate-900">
                      Peak Hours
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      When are customers most active?
                    </p>
                  </div>
                  <div className="h-64 bg-white rounded-xl p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.peak_hours}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="hour"
                          tick={{ fontSize: 11 }}
                          tickMargin={8}
                          label={{
                            value: "Hour of Day",
                            position: "insideBottom",
                            offset: -5,
                            style: { fontSize: 11 },
                          }}
                        />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="sessions"
                          stroke={CHART_COLORS.primary}
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                          name="Sessions"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Peak Days */}
              {data.peak_days?.length > 0 && (
                <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                  <div className="mb-4">
                    <h2 className="text-sm font-semibold text-slate-900">
                      Peak Days
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Which days see the most activity?
                    </p>
                  </div>
                  <div className="h-64 bg-white rounded-xl p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.peak_days}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="day"
                          tick={{ fontSize: 11 }}
                          tickMargin={8}
                        />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar
                          dataKey="sessions"
                          fill={CHART_COLORS.secondary}
                          radius={[8, 8, 0, 0]}
                          name="Sessions"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* Channel Preference */}
            {data.channel_preference?.length > 0 && (
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Channel Preference
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Preferred communication channels
                  </p>
                </div>
                <div className="h-64 bg-white rounded-xl p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.channel_preference}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="channel"
                        tick={{ fontSize: 11 }}
                        tickMargin={8}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="sessions"
                        fill={CHART_COLORS.primary}
                        radius={[8, 8, 0, 0]}
                        name="Sessions"
                      />
                      <Bar
                        dataKey="unique_users"
                        fill={CHART_COLORS.tertiary}
                        radius={[8, 8, 0, 0]}
                        name="Unique Users"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Common Queries */}
            {data.common_queries?.length > 0 && (
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                <div className="mb-3">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Most Common Queries
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Top 10 questions asked by customers
                  </p>
                </div>

                <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">#</th>
                        <th className="text-left px-4 py-2 font-medium">
                          Query
                        </th>
                        <th className="text-right px-4 py-2 font-medium">
                          Frequency
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.common_queries.map((q, index) => (
                        <tr
                          key={index}
                          className={
                            index % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                          }
                        >
                          <td className="px-4 py-2 text-slate-500">
                            {index + 1}
                          </td>
                          <td className="px-4 py-2 text-slate-800">
                            {q.query}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold text-slate-900">
                            {q.frequency}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {!loading && !hasData && !error && (
          <div className="border border-dashed border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-500 bg-slate-50">
            No customer behavior data available yet. Start engaging with
            customers to see insights here.
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerBehaviorAnalytics;
