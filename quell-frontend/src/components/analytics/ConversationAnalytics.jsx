import React, { useEffect, useState, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

const BAR_COLOR = "#4f46e5";

const DAYS_OPTIONS = [
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
  { label: "Last 90 days", value: 90 },
];

const ConversationAnalytics = ({ storeUrl: initialStoreUrl }) => {
  const [storeUrl, setStoreUrl] = useState(
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
    const effectiveStore = opts.storeUrl ?? storeUrl;
    const effectiveDays = opts.days ?? days;

    if (!effectiveStore) {
      setError("store_url missing. Make sure it's saved in sessionStorage.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        store_url: effectiveStore,
        days: String(effectiveDays),
      });

      const res = await fetch(
        `http://localhost:3000/analytics/conversations?${params.toString()}`
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to fetch analytics");
      }

      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Analytics fetch failed:", err);
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
  }, [storeUrl]);

  const hasData = !!data;

  const channelChartData = data?.conversations_by_channel || [];
  const rawDailyUsage = data?.daily_usage || [];
  const rawHourlyUsage = data?.hourly_usage || [];

  const dailyUsageData = useMemo(
    () =>
      rawDailyUsage.map((d) => {
        const date = new Date(d.date);
        return {
          ...d,
          dateLabel: date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
        };
      }),
    [rawDailyUsage]
  );

  const hourlyUsageData = useMemo(
    () =>
      rawHourlyUsage.map((d) => ({
        ...d,
        hourLabel:
          typeof d.hour === "string"
            ? d.hour.slice(11, 16) // "YYYY-MM-DD HH:00" -> "HH:00"
            : d.hour,
      })),
    [rawHourlyUsage]
  );

  return (
    <div className="w-full h-full p-4 sm:p-6 lg:p-8">
      <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-600 text-lg font-semibold shadow-sm">
              📈
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900">
                Conversational Analytics
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Usage and engagement across conversations, channels and time.
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
                {DAYS_OPTIONS.map((opt) => (
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

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 border-t border-slate-100 pt-3">
          {data?.meta?.timestamp && (
            <span>
              Last updated:{" "}
              <span className="font-medium text-slate-700">
                {new Date(data.meta.timestamp).toLocaleString()}
              </span>
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-50 border border-slate-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Live data</span>
          </span>
        </div>

        {loading && (
          <div className="border border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center bg-slate-50">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
            <div className="text-xs text-slate-500">Loading analytics…</div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-xs">
            <div className="font-semibold mb-1">Something went wrong</div>
            <div>{error}</div>
          </div>
        )}

        {!loading && hasData && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                {
                  label: "Total conversations",
                  value: data.total_conversations,
                  helper: "Distinct sessions overall",
                },
                {
                  label: "Active sessions (today)",
                  value: data.active_sessions_today,
                  helper: "Sessions with messages today",
                },
                {
                  label: "Active sessions (this week)",
                  value: data.active_sessions_week,
                  helper: "Sessions in current ISO week",
                },
                {
                  label: "Messages",
                  value: `${data.messages.customer} / ${data.messages.bot}`,
                  helper: "Customer / Bot",
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-white hover:shadow-sm transition"
                >
                  <div className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                    {item.label}
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    {item.value}
                  </div>
                  {item.helper && (
                    <div className="mt-1 text-[11px] text-slate-400">
                      {item.helper}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Channel breakdown
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      How many conversations started on each channel.
                    </p>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-600">
                    Sessions per channel
                  </span>
                </div>

                <div className="h-64 bg-white rounded-xl p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={channelChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="channel"
                        tick={{ fontSize: 11 }}
                        tickMargin={8}
                      />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="sessions"
                        name="Sessions"
                        fill={BAR_COLOR}
                        radius={[8, 8, 0, 0]}
                        barSize={30}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  {channelChartData.map((ch) => (
                    <div
                      key={ch.channel}
                      className="p-3 rounded-xl border border-slate-100 bg-white text-center"
                    >
                      <div className="text-[11px] font-medium text-slate-600 capitalize">
                        {ch.channel}
                      </div>
                      <div className="text-lg font-semibold text-blue-600">
                        {ch.sessions}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Daily usage
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Unique conversations per day.
                    </p>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-600">
                    Last {data.meta?.days ?? days} days
                  </span>
                </div>

                {dailyUsageData.length === 0 ? (
                  <div className="text-xs text-slate-500 italic bg-white rounded-xl p-4">
                    No daily usage data available for this period.
                  </div>
                ) : (
                  <div className="h-64 bg-white rounded-xl p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={dailyUsageData}
                        margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="dateLabel"
                          tick={{ fontSize: 11 }}
                          tickMargin={8}
                        />
                        <YAxis allowDecimals={false} />
                        <Tooltip
                          labelFormatter={(_, payload) =>
                            payload?.[0]?.payload?.date
                              ? new Date(
                                  payload[0].payload.date
                                ).toLocaleDateString()
                              : ""
                          }
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="conversations"
                          name="Conversations"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Hourly usage
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Conversations grouped by hour (last 24 hours).
                  </p>
                </div>
                <span className="text-[10px] px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-600">
                  Last 24 hours
                </span>
              </div>

              {hourlyUsageData.length === 0 ? (
                <div className="text-xs text-slate-500 italic bg-white rounded-xl p-4">
                  No hourly data available.
                </div>
              ) : (
                <div className="h-64 bg-white rounded-xl p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={hourlyUsageData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="hourLabel"
                        tick={{ fontSize: 10 }}
                        tickMargin={8}
                      />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="conversations"
                        name="Conversations"
                        stroke="#0ea5e9"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}

        {!loading && !hasData && !error && (
          <div className="border border-dashed border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-500 bg-slate-50">
            No analytics data available yet. Send some messages to your bot and
            then refresh this page.
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationAnalytics;
