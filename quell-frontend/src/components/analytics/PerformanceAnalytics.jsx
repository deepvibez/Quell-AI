import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";

const CHART_COLORS = {
  primary: "#6366f1",
  secondary: "#22c55e",
  tertiary: "#f59e0b",
  danger: "#ef4444",
};

const RANGE_OPTIONS = [
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
  { label: "Last 90 days", value: 90 },
];

const PerformanceAnalytics = ({ storeUrl: initialStoreUrl }) => {
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

  const fetchPerformanceData = async (opts = {}) => {
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
        `http://localhost:3000/analytics/performance?${params.toString()}`
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to fetch performance analytics");
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
      fetchPerformanceData();
    } else {
      setError("store_url not found in sessionStorage.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeUrl]);

  const hasData = !!data;

  // Format time
  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  return (
    <div className="w-full h-full p-4 sm:p-6 lg:p-8">
      <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-2xl shadow-lg">
              ⚡
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900">
                Performance & Response Analytics
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Monitor bot response times, quality, and error rates
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
                  fetchPerformanceData({ days: v });
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
              onClick={() => fetchPerformanceData()}
              className="px-4 py-2 text-xs rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm disabled:opacity-60"
              disabled={loading || !storeUrl}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* Meta info */}
        {data?.meta && (
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 border-t border-slate-100 pt-3">
            {data.meta.since && (
              <span>
                Since:{" "}
                <span className="font-medium text-slate-700">
                  {data.meta.since}
                </span>
              </span>
            )}
            {data.meta.timestamp && (
              <span>
                Last updated:{" "}
                <span className="font-medium text-slate-700">
                  {new Date(data.meta.timestamp).toLocaleString()}
                </span>
              </span>
            )}
          </div>
        )}

        {/* Loading / error */}
        {loading && (
          <div className="border border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center bg-slate-50">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
            <div className="text-xs text-slate-500">
              Loading performance data…
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
            {/* Primary KPI Cards - 5 cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

              {/* Avg Session Duration */}
              <div className="p-5 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white hover:shadow-lg transition">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-semibold tracking-wide text-indigo-600 uppercase">
                    Session Time
                  </div>
                  <span className="text-2xl">⏱️</span>
                </div>
                <div className="text-2xl lg:text-3xl font-bold text-indigo-900">
                  {formatTime(data.overview?.avg_session_duration_seconds || 0)}
                </div>
                <div className="mt-1 text-[11px] text-indigo-600">
                  Conversation length
                </div>
              </div>

              {/* Response Rate */}
              <div className="p-5 rounded-2xl border border-green-100 bg-gradient-to-br from-green-50 to-white hover:shadow-lg transition">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-semibold tracking-wide text-green-600 uppercase">
                    Response Rate
                  </div>
                  <span className="text-2xl">✅</span>
                </div>
                <div className="text-2xl lg:text-3xl font-bold text-green-900">
                  {data.overview?.response_rate || 0}%
                </div>
                <div className="mt-1 text-[11px] text-green-600">
                  Messages answered
                </div>
              </div>

              {/* Error Rate */}
              <div className="p-5 rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-white hover:shadow-lg transition">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-semibold tracking-wide text-red-600 uppercase">
                    Error Rate
                  </div>
                  <span className="text-2xl">⚠️</span>
                </div>
                <div className="text-2xl lg:text-3xl font-bold text-red-900">
                  {data.overview?.error_rate || 0}%
                </div>
                <div className="mt-1 text-[11px] text-red-600">
                  Failed responses
                </div>
              </div>
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50">
                <div className="text-xs font-semibold text-slate-600 mb-1">
                  Completion Rate
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {data.overview?.completion_rate || 0}%
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Sessions with 3+ messages
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50">
                <div className="text-xs font-semibold text-slate-600 mb-1">
                  Avg Messages/Session
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {data.performance_metrics?.avg_messages_per_session || 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Per conversation
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50">
                <div className="text-xs font-semibold text-slate-600 mb-1">
                  Total Sessions
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {data.overview?.total_sessions || 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Unique conversations
                </div>
              </div>
            </div>

            {/* Daily Performance Chart */}
            {data.daily_performance?.length > 0 && (
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-slate-900">
                    📈 Daily Performance Trend
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Sessions and messages over time
                  </p>
                </div>
                <div className="h-80 bg-white rounded-xl p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.daily_performance}>
                      <defs>
                        <linearGradient
                          id="colorSessions"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#6366f1"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="#6366f1"
                            stopOpacity={0}
                          />
                        </linearGradient>
                        <linearGradient
                          id="colorMessages"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#22c55e"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="#22c55e"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        tickMargin={8}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="sessions"
                        stroke="#6366f1"
                        fillOpacity={1}
                        fill="url(#colorSessions)"
                        name="Sessions"
                      />
                      <Area
                        type="monotone"
                        dataKey="messages"
                        stroke="#22c55e"
                        fillOpacity={1}
                        fill="url(#colorMessages)"
                        name="Messages"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Hourly Response Time & Channel Performance */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Hourly Activity */}
              {data.hourly_response_time?.length > 0 && (
                <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                  <div className="mb-4">
                    <h2 className="text-sm font-semibold text-slate-900">
                      🕐 Hourly Activity
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Last 24 hours message volume
                    </p>
                  </div>
                  <div className="h-72 bg-white rounded-xl p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.hourly_response_time}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="hour"
                          tick={{ fontSize: 11 }}
                          tickMargin={8}
                          label={{
                            value: "Hour",
                            position: "insideBottom",
                            offset: -5,
                            fontSize: 11,
                          }}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11 }}
                          label={{
                            value: "Messages",
                            angle: -90,
                            position: "insideLeft",
                            fontSize: 11,
                          }}
                        />
                        <Tooltip />
                        <Legend />
                        <Bar
                          dataKey="message_count"
                          fill="#6366f1"
                          radius={[8, 8, 0, 0]}
                          name="Messages"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Channel Performance */}
              {data.channel_performance?.length > 0 && (
                <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                  <div className="mb-4">
                    <h2 className="text-sm font-semibold text-slate-900">
                      📱 Performance by Channel
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Sessions across channels
                    </p>
                  </div>
                  <div className="h-72 bg-white rounded-xl p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.channel_performance}>
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
                          fill="#22c55e"
                          radius={[8, 8, 0, 0]}
                          name="Sessions"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* Top Queries */}
            {data.top_queries?.length > 0 && (
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl border border-blue-100 p-5">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-blue-900">
                    🔥 Most Frequent Queries
                  </h3>
                  <p className="text-[11px] text-blue-600">
                    Top user questions
                  </p>
                </div>
                <div className="space-y-2">
                  {data.top_queries.slice(0, 5).map((query, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-white rounded-xl border border-blue-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                          #{idx + 1}
                        </div>
                        <div className="text-sm text-slate-700 font-medium">
                          {query.query}
                        </div>
                      </div>
                      <div className="px-3 py-1 bg-blue-100 rounded-full text-xs font-semibold text-blue-700">
                        {query.frequency} times
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!loading && !hasData && !error && (
          <div className="border border-dashed border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-500 bg-slate-50">
            No data available. Please check your store URL and try again.
          </div>
        )}
      </div>
    </div>
  );
};

export default PerformanceAnalytics;
