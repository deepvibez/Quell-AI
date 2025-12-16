import React, { useEffect, useState } from "react";
import axios from "axios";

const PRIMARY_GRADIENT = "linear-gradient(135deg, #1d306d, #4f46e5)";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5175";

const ISSUE_TYPES = [
  "Chatbot not responding",
  "Wrong / irrelevant answers",
  "Shopify sync issue",
  "Order / cart flow issue",
  "Channel / WhatsApp issue",
  "Bug / Error message",
  "Feature request",
  "Other",
];

const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const STATUS_BADGE_STYLES = {
  open: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  resolved: "bg-blue-100 text-blue-800",
  closed: "bg-gray-100 text-gray-800",
};

const formatDateTimeIST = (dateString) => {
  if (!dateString) return "-";
  const d = new Date(dateString);
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

export default function Customers() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingTable, setLoadingTable] = useState(false);
  const [error, setError] = useState(null);

  const [showNewTicket, setShowNewTicket] = useState(false);
  const [creating, setCreating] = useState(false);

  const [subject, setSubject] = useState("");
  const [issueType, setIssueType] = useState(ISSUE_TYPES[0]);
  const [priority, setPriority] = useState("Medium");
  const [channel, setChannel] = useState("Website widget");
  const [relatedSessionId, setRelatedSessionId] = useState("");
  const [description, setDescription] = useState("");
  const [includeLogs, setIncludeLogs] = useState(true);

  const [statusFilter, setStatusFilter] = useState("all");

  const [storeUrl, setStoreUrl] = useState(() => {
    return sessionStorage.getItem("store_url") || "";
  });

  // NEW: which type of tickets are we viewing?
  // "internal" = store → Quell support (existing behaviour)
  // "customer" = customer → store tickets from chatbot
  const [viewType, setViewType] = useState("internal");
  const isInternalView = viewType === "internal";

  const resetForm = () => {
    setSubject("");
    setIssueType(ISSUE_TYPES[0]);
    setPriority("Medium");
    setChannel("Website widget");
    setRelatedSessionId("");
    setDescription("");
    setIncludeLogs(true);
  };

  const fetchTickets = async (silent = false) => {
    if (!storeUrl) {
      setError("No store URL found. Please login again.");
      setLoading(false);
      return;
    }

    try {
      if (!silent) setLoading(true);
      setLoadingTable(true);
      setError(null);

      const params = { store_url: storeUrl };
      if (statusFilter !== "all") {
        params.status = statusFilter;
      }

      // 🔁 Use different endpoints based on view type
      const endpoint =
        viewType === "internal"
          ? `${API_URL}/support/tickets`
          : `${API_URL}/api/customer-tickets`;

      const res = await axios.get(endpoint, { params });
      setTickets(res?.data?.data || []);
    } catch (err) {
      console.error("Failed to load tickets:", err);
      setError("Unable to load tickets. Please refresh the page.");
    } finally {
      setLoading(false);
      setLoadingTable(false);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();

    if (!subject.trim() || !description.trim()) {
      return;
    }
    if (!storeUrl) {
      setError("No store URL found. Please login again.");
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const payload = {
        store_url: storeUrl,
        subject,
        issue_type: issueType,
        priority,
        channel,
        related_session_id: relatedSessionId || null,
        description,
        include_logs: includeLogs,
      };

      await axios.post(`${API_URL}/support/tickets`, payload);

      resetForm();
      setShowNewTicket(false);
      fetchTickets(true);
    } catch (err) {
      console.error("Failed to create ticket:", err);
      setError("Could not create ticket. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeUrl, statusFilter, viewType]);

  if (loading && !loadingTable) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading tickets...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            {isInternalView ? "Support Tickets" : "Customer Support Tickets"}
          </h1>
          <p className="text-gray-600">
            {isInternalView
              ? "Raise and track issues related to your Quell AI chatbot."
              : "View tickets raised by your customers from the chatbot."}
          </p>
        </div>

        <div className="flex flex-col items-stretch sm:items-end gap-2">
          {/* Toggle: internal vs customer tickets */}
          <div className="inline-flex bg-gray-100 rounded-xl p-1 shadow-inner">
            <button
              type="button"
              onClick={() => {
                setViewType("internal");
                setShowNewTicket(false);
              }}
              className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                isInternalView
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              My tickets to Quell
            </button>
            <button
              type="button"
              onClick={() => {
                setViewType("customer");
                setShowNewTicket(false);
              }}
              className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                !isInternalView
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              Customer tickets
            </button>
          </div>

          {/* Only internal tickets can be created from here */}
          {isInternalView && (
            <button
              onClick={() => setShowNewTicket(true)}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transform hover:-translate-y-0.5 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              + Raise Ticket
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => fetchTickets()}
            className="ml-4 px-3 py-1 text-xs font-semibold bg-red-100 hover:bg-red-200 rounded-lg"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span className="font-medium">Filter:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <button
          onClick={() => fetchTickets(true)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
        >
          <svg
            className={`w-4 h-4 ${loadingTable ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9M20 20v-5h-.581m-15.357-2a8.003 8.003 0 0015.357 2"
            />
          </svg>
          Refresh
        </button>
      </div>

      {/* Empty State / Table */}
      {tickets.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-10 h-10 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {isInternalView ? "No tickets yet" : "No customer tickets yet"}
          </h3>
          <p className="text-gray-600 mb-6">
            {isInternalView
              ? "If you notice any issue with the chatbot, raise a ticket and our team will help you out."
              : "Once your customers start raising tickets from the chatbot, they will show up here."}
          </p>
          {isInternalView && (
            <button
              onClick={() => setShowNewTicket(true)}
              className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Raise First Ticket
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Ticket
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    {isInternalView ? "Issue Type" : "Customer"}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Channel
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {/* Ticket / Subject */}
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {ticket.subject}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        #{ticket.id}{" "}
                        {isInternalView
                          ? ticket.related_session_id &&
                            `• Session: ${ticket.related_session_id}`
                          : ticket.order_id &&
                            `• Order: ${ticket.order_id}`}
                      </div>
                    </td>

                    {/* Issue Type or Customer */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isInternalView ? (
                        <div className="text-sm text-gray-800">
                          {ticket.issue_type}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-800">
                          {ticket.customer_name ||
                            ticket.customer_email ||
                            ticket.customer_id ||
                            "Unknown"}
                          {ticket.customer_email && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              {ticket.customer_email}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Priority */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-50 text-indigo-700">
                        {ticket.priority}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          STATUS_BADGE_STYLES[ticket.status] ||
                          "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {ticket.status}
                      </span>
                    </td>

                    {/* Created */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTimeIST(
                        ticket.created_at || ticket.createdAt
                      )}
                    </td>

                    {/* Channel */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {ticket.channel || (isInternalView ? "—" : "Chatbot")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Ticket Modal (ONLY for internal view) */}
      {isInternalView && showNewTicket && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 relative">
            <button
              onClick={() => {
                setShowNewTicket(false);
                resetForm();
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <span className="sr-only">Close</span>✕
            </button>

            <h2 className="text-xl font-semibold text-gray-900 mb-1">
              Raise a Support Ticket
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Tell us what’s going wrong with your chatbot and we’ll look into
              it.
            </p>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  placeholder="e.g. Bot is not answering product questions correctly"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Issue type
                  </label>
                  <select
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  >
                    {ISSUE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Channel
                  </label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  >
                    <option>Website widget</option>
                    <option>WhatsApp</option>
                    <option>Instagram</option>
                    <option>Facebook Messenger</option>
                    <option>Telegram</option>
                    <option>Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Related conversation / session ID (optional)
                  </label>
                  <input
                    type="text"
                    value={relatedSessionId}
                    onChange={(e) => setRelatedSessionId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder="Paste session ID from Inbox (if any)"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Describe the problem
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  placeholder="What exactly went wrong? Example questions that failed, link to the page, expected vs actual behaviour, etc."
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  The more details you share, the faster we can debug the
                  chatbot.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="inline-flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={includeLogs}
                    onChange={(e) => setIncludeLogs(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-xs text-gray-600">
                    Attach recent chatbot logs for this store
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewTicket(false);
                      resetForm();
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {creating ? "Creating…" : "Submit Ticket"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
