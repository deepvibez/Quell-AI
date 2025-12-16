import { useMemo, useState, Fragment, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchTokenUsageByStore,
  fetchTokenUsageByDate,
  type TokenUsageByStore,
  type TokenUsageByDate,
  fetchTokenUsageBySession,
  type SessionTokenUsage,
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

const GPT4O_MINI_INPUT_RATE = 0.15 / 1_000_000; // $0.15 per 1M input tokens
const GPT4O_MINI_OUTPUT_RATE = 0.60 / 1_000_000; // $0.60 per 1M output tokens

function formatSince(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function computeStoreCosts(store: TokenUsageByStore) {
  const inputCost = store.input_tokens * GPT4O_MINI_INPUT_RATE;
  const outputCost = store.output_tokens * GPT4O_MINI_OUTPUT_RATE;
  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
  };
}

export default function TokensPage() {
  const [days, setDays] = useState(30);
  const since = useMemo(() => formatSince(days), [days]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<Record<string, { loading: boolean; error?: string; sessions: SessionTokenUsage[] }>>({});

  const handleToggleExpand = useCallback(
    async (storeUrl: string) => {
      if (expanded === storeUrl) {
        setExpanded(null);
        return;
      }
      setExpanded(storeUrl);
      if (!sessionData[storeUrl]) {
        setSessionData((prev) => ({
          ...prev,
          [storeUrl]: { loading: true, sessions: [] },
        }));
        try {
          const data = await fetchTokenUsageBySession(storeUrl, since);
          setSessionData((prev) => ({ ...prev, [storeUrl]: { loading: false, sessions: data } }));
        } catch (err: any) {
          setSessionData((prev) => ({ ...prev, [storeUrl]: { loading: false, error: err?.message || "Failed to load", sessions: [] } }));
        }
      }
    },
    [expanded, since, sessionData]
  );

  const { data: byStore = [], isLoading: loadingStore } = useQuery({
    queryKey: ["admin-token-usage-store", since],
    queryFn: () => fetchTokenUsageByStore({ since }),
    staleTime: 60_000,
  });

  const { data: byDate = [], isLoading: loadingDate } = useQuery({
    queryKey: ["admin-token-usage-date", since],
    queryFn: () => fetchTokenUsageByDate({ since }),
    staleTime: 60_000,
  });

  const totals = useMemo(() => {
    return byStore.reduce(
      (acc, s) => {
        acc.totalTokens += s.total_tokens;
        acc.totalInput += s.input_tokens;
        acc.totalOutput += s.output_tokens;
        const costs = computeStoreCosts(s);
        acc.totalCost += costs.totalCost;
        return acc;
      },
      {
        totalTokens: 0,
        totalInput: 0,
        totalOutput: 0,
        totalCost: 0,
      }
    );
  }, [byStore]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-indigo-900">Token analytics</h1>
          <p className="text-sm text-slate-600">
            Input/output token usage and estimated costs.
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
      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-white border border-indigo-200 rounded-xl shadow-md p-5">
          <div className="text-xs font-medium text-indigo-700 uppercase">
            Total tokens
          </div>
          <div className="mt-3 text-3xl font-semibold text-indigo-900">
            {totals.totalTokens.toLocaleString()}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            Input: {totals.totalInput.toLocaleString()} • Output: {totals.totalOutput.toLocaleString()}
          </div>
        </div>

        <div className="bg-white border border-indigo-200 rounded-xl shadow-md p-5">
          <div className="text-xs font-medium text-indigo-700 uppercase">
            Est. model cost
          </div>
          <div className="mt-3 text-3xl font-semibold text-indigo-900">
            ${totals.totalCost.toFixed(2)}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            Using ${GPT4O_MINI_INPUT_RATE * 1_000_000}/M in, ${GPT4O_MINI_OUTPUT_RATE * 1_000_000}/M out
          </div>
        </div>

        <div className="bg-white border border-indigo-200 rounded-xl shadow-md p-5">
          <div className="text-xs font-medium text-indigo-700 uppercase">
            Active stores
          </div>
          <div className="mt-3 text-3xl font-semibold text-indigo-900">
            {byStore.length.toLocaleString()}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            Stores with any token usage in range
          </div>
        </div>

        <div className="bg-white border border-indigo-200 rounded-xl shadow-md p-5">
          <div className="text-xs font-medium text-indigo-700 uppercase">
            Active days
          </div>
          <div className="mt-3 text-3xl font-semibold text-indigo-900">
            {byDate.length.toLocaleString()}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            Days with recorded token usage
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Tokens over time */}
        <div className="bg-white border border-indigo-200 rounded-xl shadow-md p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-indigo-800">Tokens by day</h2>
            <span className="text-xs text-slate-400">Total tokens vs active stores</span>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={byDate as TokenUsageByDate[]}>
                <XAxis dataKey="date" hide />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  axisLine={{ stroke: "#e6edf3" }}
                />
                <Tooltip wrapperStyle={{ borderRadius: 8, boxShadow: "0 6px 18px rgba(16,24,40,0.08)" }} />
                <Line
                  type="monotone"
                  dataKey="total_tokens"
                  stroke="#4f46e5"
                  strokeWidth={3}
                  dot={false}
                  name="Tokens"
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

        {/* Top stores by tokens */}
        <div className="bg-white border border-indigo-200 rounded-xl shadow-md p-5 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-indigo-800">Top stores by tokens</h2>
            <span className="text-xs text-slate-400">Estimated model</span>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byStore as TokenUsageByStore[]}>
                <XAxis dataKey="store_url" hide />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  axisLine={{ stroke: "#e6edf3" }}
                />
                <Tooltip wrapperStyle={{ borderRadius: 8, boxShadow: "0 6px 18px rgba(16,24,40,0.08)" }} />
                <Bar
                  dataKey={(entry: TokenUsageByStore) =>
                    computeStoreCosts(entry).totalCost
                  }
                  fill="#4f46e5"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed table */}
      <div className="bg-white border border-indigo-200 rounded-xl shadow-md p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-indigo-800">Per-store breakdown</h2>
          <span className="text-xs text-slate-400">Tokens and cost per store</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-indigo-800 border-b bg-indigo-50">
                <th className="py-3 px-3">Store</th>
                <th className="py-3 px-3 text-right">Input tokens</th>
                <th className="py-3 px-3 text-right">Output tokens</th>
                <th className="py-3 px-3 text-right">Total tokens</th>
                <th className="py-3 px-3 text-right">Sessions</th>
                <th className="py-3 px-3 text-right">Est. cost (USD)</th>
                <th className="py-3 px-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {byStore.map((s) => {
                const costs = computeStoreCosts(s);
                return (
                  <Fragment key={s.store_url}>
                    <tr className="border-b last:border-0">
                      <td className="py-3 px-3 text-xs font-medium truncate max-w-[220px] text-slate-800">
                        {s.store_url}
                      </td>
                      <td className="py-3 px-3 text-right text-sm text-slate-700">
                        {s.input_tokens.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right text-sm text-slate-700">
                        {s.output_tokens.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right text-sm text-slate-700">
                        {s.total_tokens.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right text-sm text-slate-700">
                        {s.sessions_with_tokens.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right text-sm text-slate-700">
                        ${costs.totalCost.toFixed(4)}
                      </td>
                      <td className="py-3 px-3 text-xs text-right">
                        <button
                          className="px-3 py-1 border rounded hover:bg-indigo-50 text-sm"
                          onClick={() => handleToggleExpand(s.store_url)}
                        >
                          {expanded === s.store_url ? "Hide" : "View sessions"}
                        </button>
                      </td>
                    </tr>

                    {expanded === s.store_url && (
                      <tr>
                        <td colSpan={7} className="bg-indigo-50 p-0">
                          <div className="p-4">
                            {sessionData[s.store_url]?.loading ? (
                              <div className="text-sm text-slate-500">Loading session breakdown…</div>
                            ) : sessionData[s.store_url]?.error ? (
                              <div className="text-sm text-red-500">{sessionData[s.store_url]?.error}</div>
                            ) : sessionData[s.store_url]?.sessions?.length ? (
                              <div className="overflow-x-auto">
                                <table className="min-w-full border text-sm">
                                  <thead>
                                    <tr className="bg-indigo-100">
                                      <th className="py-2 px-2">Session&nbsp;ID</th>
                                      <th className="py-2 px-2 text-right">Input</th>
                                      <th className="py-2 px-2 text-right">Output</th>
                                      <th className="py-2 px-2 text-right">Total</th>
                                      <th className="py-2 px-2 text-right">First</th>
                                      <th className="py-2 px-2 text-right">Last</th>
                                      <th className="py-2 px-2 text-right">Est. cost</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sessionData[s.store_url].sessions.map((sess) => {
                                      const sessCost = sess.input_tokens * GPT4O_MINI_INPUT_RATE + sess.output_tokens * GPT4O_MINI_OUTPUT_RATE;
                                      return (
                                        <tr key={sess.session_id} className="border-b last:border-0">
                                          <td className="py-1 px-2 font-mono max-w-[120px] truncate text-sm">{sess.session_id}</td>
                                          <td className="py-1 px-2 text-right text-sm">{sess.input_tokens.toLocaleString()}</td>
                                          <td className="py-1 px-2 text-right text-sm">{sess.output_tokens.toLocaleString()}</td>
                                          <td className="py-1 px-2 text-right text-sm">{sess.total_tokens.toLocaleString()}</td>
                                          <td className="py-1 px-2 text-right text-sm">{new Date(sess.first_message).toLocaleString()}</td>
                                          <td className="py-1 px-2 text-right text-sm">{new Date(sess.last_message).toLocaleString()}</td>
                                          <td className="py-1 px-2 text-right text-sm">${sessCost.toFixed(4)}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="text-sm text-slate-500">No session usage data for this store in range.</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}

              {byStore.length === 0 && !loadingStore && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-6 text-center text-sm text-slate-500"
                  >
                    No token usage data available for this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {(loadingStore || loadingDate) && (
          <div className="py-3 px-4 text-sm text-slate-500">
            Loading token analytics…
          </div>
        )}
      </div>
    </div>
  );
}
