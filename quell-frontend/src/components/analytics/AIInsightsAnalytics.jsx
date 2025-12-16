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
  PieChart,
  Pie,
  Cell,
} from "recharts";

const CHART_COLORS = {
  primary: "#6366f1",
  secondary: "#22c55e",
  tertiary: "#f59e0b",
  quaternary: "#ec4899",
  positive: "#22c55e",
  negative: "#ef4444",
  neutral: "#94a3b8",
};

const RANGE_OPTIONS = [
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
  { label: "Last 90 days", value: 90 },
];

const AIInsightsAnalytics = ({ storeUrl: initialStoreUrl }) => {
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
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [analysisStatus, setAnalysisStatus] = useState(null);

  const fetchAIInsights = async (opts = {}) => {
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
        `http://localhost:3000/analytics/ai-insights?${params.toString()}`
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to fetch AI insights");
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

  const triggerAIAnalysis = async (sessionId = null) => {
    if (!storeUrl) {
      alert("Store URL not found!");
      return;
    }

    setAnalyzing(true);
    setAnalysisStatus(null);
    setError(null);

    try {
      const body = { store_url: storeUrl };

      if (sessionId) {
        body.session_id = sessionId;
      } else {
        body.limit = 50;
      }

      const res = await fetch("http://localhost:3000/analytics/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (res.ok) {
        if (sessionId) {
          setAnalysisStatus({
            type: "success",
            message: `✅ Successfully analyzed session: ${sessionId}`,
          });
        } else {
          setAnalysisStatus({
            type: "success",
            message: `✅ Successfully analyzed ${json.analyzed_count} out of ${json.total_sessions} conversations!`,
            details: json,
          });
        }

        // Refresh insights after 3 seconds
        setTimeout(() => fetchAIInsights(), 3000);
      } else {
        setAnalysisStatus({
          type: "error",
          message: `❌ Analysis failed: ${json.error || json.details}`,
        });
      }
    } catch (err) {
      setAnalysisStatus({
        type: "error",
        message: `❌ Analysis failed: ${err.message}`,
      });
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    if (storeUrl) {
      fetchAIInsights();
    } else {
      setError("store_url not found in sessionStorage.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeUrl]);

  const hasData = !!data;

  // Prepare sentiment data for pie chart
  const sentimentData = hasData
    ? data.sentiment_distribution.map((s) => ({
        name: s.sentiment.charAt(0).toUpperCase() + s.sentiment.slice(1),
        value: s.count,
        color:
          s.sentiment === "positive"
            ? CHART_COLORS.positive
            : s.sentiment === "negative"
            ? CHART_COLORS.negative
            : CHART_COLORS.neutral,
      }))
    : [];

  return (
    <div className="w-full h-full p-4 sm:p-6 lg:p-8">
      <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-2xl shadow-lg">
              🤖
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900">
                AI-Powered Customer Insights
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Deep learning analysis of customer conversations and behavior
                patterns
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
                  fetchAIInsights({ days: v });
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
              onClick={() => fetchAIInsights()}
              className="px-4 py-2 text-xs rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm disabled:opacity-60"
              disabled={loading || !storeUrl}
            >
              {loading ? "Refreshing…" : "Refresh Data"}
            </button>
          </div>
        </div>

        {/* Analysis Trigger Section */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-purple-900 mb-1">
                🚀 Analyze Conversations
              </h3>
              <p className="text-xs text-purple-700">
                Use AI to analyze customer conversations and extract deep
                insights
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => triggerAIAnalysis()}
                disabled={analyzing}
                className="px-5 py-2.5 text-sm rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition shadow-md disabled:opacity-60 font-semibold"
              >
                {analyzing ? "🔄 Analyzing..." : "🤖 Analyze Recent Chats"}
              </button>
            </div>
          </div>

          {/* Analysis Status */}
          {analysisStatus && (
            <div
              className={`mt-4 p-4 rounded-xl ${
                analysisStatus.type === "success"
                  ? "bg-green-50 border border-green-200 text-green-800"
                  : "bg-red-50 border border-red-200 text-red-800"
              }`}
            >
              <div className="text-sm font-semibold">
                {analysisStatus.message}
              </div>
              {analysisStatus.details && (
                <div className="text-xs mt-2 space-y-1">
                  <div>
                    Analyzed: {analysisStatus.details.analyzed_count} /{" "}
                    {analysisStatus.details.total_sessions}
                  </div>
                  {analysisStatus.details.failed_count > 0 && (
                    <div className="text-orange-700">
                      Failed: {analysisStatus.details.failed_count}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
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
            {data.csat_metrics?.total_analyzed > 0 && (
              <span>
                Analyzed Conversations:{" "}
                <span className="font-medium text-slate-700">
                  {data.csat_metrics.total_analyzed}
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
            <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-3" />
            <div className="text-xs text-slate-500">
              Loading AI insights…
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
        {!loading && hasData && data.csat_metrics?.total_analyzed > 0 && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 to-white hover:shadow-lg transition">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-semibold tracking-wide text-purple-600 uppercase">
                    Predicted CSAT
                  </div>
                  <span className="text-2xl">⭐</span>
                </div>
                <div className="text-3xl font-bold text-purple-900">
                  {data.csat_metrics?.avg_predicted_csat || 0}
                  <span className="text-lg text-purple-500">/5</span>
                </div>
                <div className="mt-1 text-[11px] text-purple-600">
                  Customer satisfaction score
                </div>
              </div>

              <div className="p-5 rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white hover:shadow-lg transition">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-semibold tracking-wide text-orange-600 uppercase">
                    Drop-off Risk
                  </div>
                  <span className="text-2xl">⚠️</span>
                </div>
                <div className="text-3xl font-bold text-orange-900">
                  {(
                    parseFloat(data.risk_metrics?.avg_drop_off_risk || 0) * 100
                  ).toFixed(0)}
                  %
                </div>
                <div className="mt-1 text-[11px] text-orange-600">
                  Average abandonment risk
                </div>
              </div>

              <div className="p-5 rounded-2xl border border-green-100 bg-gradient-to-br from-green-50 to-white hover:shadow-lg transition">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-semibold tracking-wide text-green-600 uppercase">
                    Purchase Intent
                  </div>
                  <span className="text-2xl">🛒</span>
                </div>
                <div className="text-3xl font-bold text-green-900">
                  {(
                    parseFloat(
                      data.risk_metrics?.avg_purchase_likelihood || 0
                    ) * 100
                  ).toFixed(0)}
                  %
                </div>
                <div className="mt-1 text-[11px] text-green-600">
                  Likelihood to convert
                </div>
              </div>

              <div className="p-5 rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-white hover:shadow-lg transition">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-semibold tracking-wide text-red-600 uppercase">
                    Frustration Level
                  </div>
                  <span className="text-2xl">😤</span>
                </div>
                <div className="text-3xl font-bold text-red-900">
                  {(
                    parseFloat(data.risk_metrics?.avg_frustration || 0) * 100
                  ).toFixed(0)}
                  %
                </div>
                <div className="mt-1 text-[11px] text-red-600">
                  Customer frustration
                </div>
              </div>
            </div>

            {/* Sentiment & Intent Charts */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Sentiment Distribution */}
              {sentimentData.length > 0 && (
                <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                  <div className="mb-4">
                    <h2 className="text-sm font-semibold text-slate-900">
                      😊 Sentiment Analysis
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Overall customer emotional tone
                    </p>
                  </div>
                  <div className="h-72 bg-white rounded-xl p-3 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sentimentData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name}: ${(percent * 100).toFixed(0)}%`
                          }
                          outerRadius={90}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {sentimentData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Intent Distribution */}
              {data.intent_distribution?.length > 0 && (
                <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                  <div className="mb-4">
                    <h2 className="text-sm font-semibold text-slate-900">
                      🎯 Customer Intent
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      What customers want to achieve
                    </p>
                  </div>
                  <div className="h-72 bg-white rounded-xl p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.intent_distribution}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="intent"
                          tick={{ fontSize: 11 }}
                          tickMargin={8}
                        />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar
                          dataKey="count"
                          fill="#8b5cf6"
                          radius={[8, 8, 0, 0]}
                          name="Conversations"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* Top Topics */}
            {data.top_topics?.length > 0 && (
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-5">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-indigo-900">
                    📌 Trending Topics
                  </h3>
                  <p className="text-[11px] text-indigo-600">
                    Most discussed themes in conversations
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.top_topics.map((topic, idx) => (
                    <div
                      key={idx}
                      className="px-4 py-2 bg-white rounded-full border border-indigo-200 text-sm font-medium text-indigo-700 shadow-sm hover:shadow-md transition"
                    >
                      {topic.topic}{" "}
                      <span className="ml-1 text-indigo-400">
                        ({topic.count})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Engagement Quality */}
            {data.engagement_quality?.length > 0 && (
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-slate-900">
                    💬 Engagement Quality
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    How well conversations are engaging customers
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {data.engagement_quality.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-white rounded-xl border border-slate-200 text-center"
                    >
                      <div className="text-2xl font-bold text-slate-900">
                        {item.count}
                      </div>
                      <div className="text-xs text-slate-600 capitalize mt-1">
                        {item.quality}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* No data state */}
        {!loading &&
          hasData &&
          data.csat_metrics?.total_analyzed === 0 && (
            <div className="border-2 border-dashed border-purple-200 rounded-2xl p-12 text-center bg-purple-50">
              <div className="text-6xl mb-4">🤖</div>
              <h3 className="text-lg font-bold text-purple-900 mb-2">
                No AI Analysis Yet
              </h3>
              <p className="text-sm text-purple-700 mb-6">
                Click "Analyze Recent Chats" to start analyzing your
                conversations with AI
              </p>
              <button
                onClick={() => triggerAIAnalysis()}
                disabled={analyzing}
                className="px-6 py-3 text-sm rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition shadow-lg disabled:opacity-60 font-semibold"
              >
                {analyzing ? "🔄 Analyzing..." : "🤖 Start AI Analysis"}
              </button>
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

export default AIInsightsAnalytics;
