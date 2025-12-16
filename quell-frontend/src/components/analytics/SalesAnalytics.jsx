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
  AreaChart,
  Area,
} from "recharts";

const BAR_ADD_COLOR = "#22c55e";
const BAR_ORDER_COLOR = "#6366f1";
const LINE_COLOR = "#8b5cf6";
const AREA_COLOR = "#f59e0b";

const CHART_COLORS = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
];

const RANGE_OPTIONS = [
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
  { label: "Last 90 days", value: 90 },
];

const SalesAnalytics = ({ storeUrl: initialStoreUrl }) => {
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
        `http://localhost:3000/analytics/sales?${params.toString()}`
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to fetch sales analytics");
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

  // --- Metrics ---
  const addToCart = data?.add_to_cart_events ?? 0;
  const aiConversions = data?.ai_assisted_conversions ?? 0;
  const orders = data?.shopify?.total_orders ?? 0;
  const revenue = data?.shopify?.total_revenue ?? 0;
  const currency = data?.shopify?.currency ?? "USD";

  const convRate =
    addToCart > 0 ? ((orders / addToCart) * 100).toFixed(1) + "%" : "–";

  const aiShare =
    orders > 0 ? ((aiConversions / orders) * 100).toFixed(1) + "%" : "–";

  const addToCartChannel = (data?.add_to_cart_by_channel || []).map((r) => ({
    channel: r.channel,
    events: Number(r.cnt),
  }));

  const ordersByChannel = (data?.orders_by_channel || []).map((r) => ({
    channel: r.channel,
    orders: Number(r.cnt),
  }));

  const topProducts = data?.top_products || [];
  const shopifyRecentOrders = data?.shopify?.recent_orders || [];

  const revenueDisplay = `${currency} ${revenue.toFixed(2)}`;

  // Prepare time series data for orders
  const orderTimeSeries = shopifyRecentOrders
    .reduce((acc, order) => {
      const date = new Date(order.created_at).toLocaleDateString();
      const existing = acc.find((item) => item.date === date);
      if (existing) {
        existing.orders += 1;
        existing.revenue += parseFloat(order.total_price || 0);
      } else {
        acc.push({
          date,
          orders: 1,
          revenue: parseFloat(order.total_price || 0),
        });
      }
      return acc;
    }, [])
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Prepare channel distribution for pie chart
  const channelDistribution = addToCartChannel.map((item, index) => ({
    name: item.channel,
    value: item.events,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));

  return (
    <div className="w-full h-full p-4 sm:p-6 lg:p-8">
      <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center text-emerald-600 text-lg font-semibold shadow-sm">
              🛒
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900">
                Sales Analytics
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Track add-to-cart events, orders, and revenue from your Shopify
                store.
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
              Loading sales analytics…
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
            {/* Top KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: "Add to cart events",
                  value: addToCart,
                  helper: "Tracked add-to-cart actions from chatbot",
                },
                {
                  label: "Orders",
                  value: orders,
                  helper: 'Shopify orders tagged with "quell-order"',
                },
                {
                  label: "Revenue",
                  value: revenueDisplay,
                  helper: "Total revenue from tagged orders",
                },
                {
                  label: "Conversion rate",
                  value: convRate,
                  helper:
                    addToCart > 0
                      ? "Orders / add-to-cart events"
                      : "Need more add-to-cart events",
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-white hover:shadow-sm transition"
                >
                  <div className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                    {item.label}
                  </div>
                  <div
                    className={`mt-2 text-2xl font-bold ${
                      item.label === "Revenue" && revenue === 0 && orders > 0
                        ? "text-yellow-600"
                        : "text-slate-900"
                    }`}
                  >
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

            {/* Warning for no orders */}
            {orders === 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <span className="text-blue-600 text-lg">ℹ️</span>
                <div className="text-xs text-blue-800">
                  <div className="font-semibold mb-1">
                    No orders found with "quell-order" tag
                  </div>
                  <div>
                    To track orders here, add the tag{" "}
                    <span className="font-mono bg-blue-100 px-1 rounded">
                      quell-order
                    </span>{" "}
                    to orders in your Shopify admin, or set up automation to
                    tag orders automatically when they come from your chatbot.
                  </div>
                </div>
              </div>
            )}

            {/* Warning for $0 revenue */}
            {revenue === 0 && orders > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
                <span className="text-yellow-600 text-lg">⚠️</span>
                <div className="text-xs text-yellow-800">
                  <div className="font-semibold mb-1">
                    Orders found but with $0 revenue
                  </div>
                  <div>
                    You have {orders} orders tagged with "quell-order" but all
                    show $0 revenue. These may be test orders, draft orders, or
                    orders with payment pending. Check your Shopify admin for
                    details.
                  </div>
                </div>
              </div>
            )}

            {/* Orders & Revenue Trend - Line Chart */}
            {orderTimeSeries.length > 0 && (
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Orders & Revenue Trend
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Daily orders and revenue over the selected period
                  </p>
                </div>
                <div className="h-80 bg-white rounded-xl p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={orderTimeSeries}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        tickMargin={8}
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 11 }}
                        label={{
                          value: "Orders",
                          angle: -90,
                          position: "insideLeft",
                          style: { fontSize: 11 },
                        }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 11 }}
                        label={{
                          value: `Revenue (${currency})`,
                          angle: 90,
                          position: "insideRight",
                          style: { fontSize: 11 },
                        }}
                      />
                      <Tooltip />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="orders"
                        stroke={BAR_ORDER_COLOR}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                        name="Orders"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="revenue"
                        stroke={AREA_COLOR}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                        name="Revenue"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* AI-assisted metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/60">
                <div className="text-[11px] font-semibold tracking-wide text-emerald-700 uppercase">
                  AI-assisted conversions
                </div>
                <div className="mt-2 text-2xl font-bold text-emerald-800">
                  {aiConversions}
                </div>
                <div className="mt-1 text-[11px] text-emerald-700/80">
                  Sessions with an order and an upstream AI interaction
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-purple-100 bg-purple-50/60">
                <div className="text-[11px] font-semibold tracking-wide text-purple-700 uppercase">
                  AI-assisted share
                </div>
                <div className="mt-2 text-2xl font-bold text-purple-800">
                  {aiShare}
                </div>
                <div className="mt-1 text-[11px] text-purple-700/80">
                  Percentage of orders that had at least one AI-assisted
                  touchpoint
                </div>
              </div>
            </div>

            {/* Channel Distribution & Orders by Channel */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Pie Chart - Channel Distribution */}
              {channelDistribution.length > 0 && (
                <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                  <div className="mb-4">
                    <h2 className="text-sm font-semibold text-slate-900">
                      Channel Distribution
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Add-to-cart events by channel
                    </p>
                  </div>
                  <div className="h-64 bg-white rounded-xl p-3 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={channelDistribution}
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
                          {channelDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Bar Chart - Orders by Channel */}
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Orders by channel
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Which channels close the most orders?
                  </p>
                </div>

                {ordersByChannel.length === 0 ? (
                  <div className="text-xs text-slate-500 italic bg-white rounded-xl p-4">
                    No orders recorded in this period.
                  </div>
                ) : (
                  <div className="h-64 bg-white rounded-xl p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ordersByChannel}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="channel"
                          tick={{ fontSize: 11 }}
                          tickMargin={8}
                        />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar
                          dataKey="orders"
                          name="Orders"
                          fill={BAR_ORDER_COLOR}
                          radius={[8, 8, 0, 0]}
                          barSize={30}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Add-to-cart Events Area Chart */}
            {addToCartChannel.length > 0 && (
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Add-to-cart events by channel
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Where are add-to-cart events coming from?
                  </p>
                </div>
                <div className="h-64 bg-white rounded-xl p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={addToCartChannel}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="channel"
                        tick={{ fontSize: 11 }}
                        tickMargin={8}
                      />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="events"
                        name="Add to cart"
                        stroke={BAR_ADD_COLOR}
                        fill={BAR_ADD_COLOR}
                        fillOpacity={0.6}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Top products (AI touched) */}
            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  Top products (AI touched)
                </h2>
                <p className="text-[11px] text-slate-500">
                  Products most frequently mentioned in AI-assisted flows.
                </p>
              </div>

              {topProducts.length === 0 ? (
                <div className="text-xs text-slate-500 italic bg-white rounded-xl p-4">
                  No product interaction data found in this period.
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">#</th>
                        <th className="text-left px-4 py-2 font-medium">
                          Product
                        </th>
                        <th className="text-left px-4 py-2 font-medium">
                          Product ID
                        </th>
                        <th className="text-right px-4 py-2 font-medium">
                          Mentions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProducts.slice(0, 10).map((p, index) => (
                        <tr
                          key={`${p.product_id}-${index}`}
                          className={
                            index % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                          }
                        >
                          <td className="px-4 py-2 text-slate-500">
                            {index + 1}
                          </td>
                          <td className="px-4 py-2 text-slate-800">
                            {p.title || "Untitled product"}
                          </td>
                          <td className="px-4 py-2 text-slate-500">
                            {p.product_id}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold text-slate-900">
                            {p.cnt}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recent Shopify orders table */}
            {shopifyRecentOrders.length > 0 && (
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                <div className="mb-3">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Recent orders (tagged &quot;quell-order&quot;)
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Latest {shopifyRecentOrders.length} orders from Shopify in
                    this period.
                  </p>
                </div>

                <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">
                          Order
                        </th>
                        <th className="text-left px-4 py-2 font-medium">
                          Created at
                        </th>
                        <th className="text-right px-4 py-2 font-medium">
                          Total
                        </th>
                        <th className="text-left px-4 py-2 font-medium">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {shopifyRecentOrders.map((o, index) => (
                        <tr
                          key={o.id || index}
                          className={
                            index % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                          }
                        >
                          <td className="px-4 py-2 text-slate-800 font-medium">
                            {o.name}
                          </td>
                          <td className="px-4 py-2 text-slate-500">
                            {o.created_at
                              ? new Date(o.created_at).toLocaleString()
                              : "-"}
                          </td>
                          <td
                            className={`px-4 py-2 text-right font-semibold ${
                              Number(o.total_price || 0) === 0
                                ? "text-yellow-600"
                                : "text-slate-900"
                            }`}
                          >
                            {o.currency || currency}{" "}
                            {Number(o.total_price || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-slate-500 text-[11px]">
                            {o.financial_status || "—"} /{" "}
                            {o.fulfillment_status || "unfulfilled"}
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
            No sales analytics data available yet. Trigger some events and then
            refresh this page.
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesAnalytics;
