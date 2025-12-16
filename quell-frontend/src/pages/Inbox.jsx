import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const PRIMARY_COLOR = '#1d306d';
const PRIMARY_GRADIENT = 'linear-gradient(135deg, #1d306d, #4f46e5)';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5175';

// Ticket constants
const ISSUE_TYPES = [
  'Chatbot not responding',
  'Wrong / irrelevant answers',
  'Shopify sync issue',
  'Order / cart flow issue',
  'Channel / WhatsApp issue',
  'Bug / Error message',
  'Feature request',
  'Other',
];

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

// Helper: Format time in IST with date
const formatTimeIST = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

// Helper: Format date-only in IST (for date dropdown)
const formatDateIST = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Helper: get a stable IST date key (YYYY-MM-DD)
const getISTDateKey = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  // en-CA gives YYYY-MM-DD
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

// Helper: Format time for message bubbles (just time)
const formatTimeOnly = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

// Helper: Parse JSON safely
const parseJSON = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return null;
  }
};

export default function Inbox() {
  const [sessions, setSessions] = useState([]);
  const [groupedCustomers, setGroupedCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [customerSessions, setCustomerSessions] = useState([]);
  const [selectedSessionDate, setSelectedSessionDate] = useState(''); // date key (YYYY-MM-DD)

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessionsError, setSessionsError] = useState(null);
  
  // Ticket modal state
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketIssueType, setTicketIssueType] = useState(ISSUE_TYPES[0]);
  const [ticketPriority, setTicketPriority] = useState('Medium');
  const [ticketChannel, setTicketChannel] = useState('Website widget');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketIncludeLogs, setTicketIncludeLogs] = useState(true);

  // ✅ Use lazy initialization to read from sessionStorage synchronously
  const [storeUrl, setStoreUrl] = useState(() => {
    const url = sessionStorage.getItem('store_url');
    if (!url) {
      // can't call setSessionsError here (state update in init), so we just return null
      return null;
    }
    return url;
  });

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  // If storeUrl is missing after mount, show error
  useEffect(() => {
    if (!storeUrl) {
      setSessionsError('No store URL found. Please login again.');
    }
  }, [storeUrl]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Memoized fetch sessions
  const fetchSessions = useCallback(async () => {
    if (!storeUrl) {
      setSessionsError('No store URL found. Please login again.');
      return;
    }
    try {
      setSessionsError(null);
      const res = await axios.get(`${API_URL}/api/inbox?store_url=${storeUrl}`);
      const allSessions = res.data.data || [];
      setSessions(allSessions);

      // Group by customer
      const grouped = {};
      allSessions.forEach((session) => {
        const customerKey = session.user_email || session.user_name || 'Guest';
        if (!grouped[customerKey]) {
          grouped[customerKey] = {
            customer: customerKey,
            sessions: [],
            totalUnread: 0,
            latestTime: session.last_message_at
          };
        }
        grouped[customerKey].sessions.push(session);
        grouped[customerKey].totalUnread += Number(session.unread_count) || 0;
        if (new Date(session.last_message_at) > new Date(grouped[customerKey].latestTime)) {
          grouped[customerKey].latestTime = session.last_message_at;
        }
      });

      const customersArray = Object.values(grouped).sort(
        (a, b) => new Date(b.latestTime) - new Date(a.latestTime)
      );

      setGroupedCustomers(customersArray);
    } catch (err) {
      console.error('Failed to load sessions:', err);
      setSessionsError('Unable to load conversations. Please refresh the page.');
    }
  }, [storeUrl]);

  // Socket + initial fetch
  useEffect(() => {
    if (!storeUrl) return;

    fetchSessions();

    const socket = io(API_URL);
    socketRef.current = socket;

    socket.emit('join_store_room', storeUrl);

    const handleNewMessage = (newMessage) => {
      // Update messages if viewing this session
      if (selectedSessionId === newMessage.session_id) {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === newMessage.id);
          return exists ? prev : [...prev, newMessage];
        });
      }
      // Refresh sessions to update unread counts
      fetchSessions();
    };

    socket.on('conversation:new_message', handleNewMessage);

    return () => {
      socket.off('conversation:new_message', handleNewMessage);
      socket.disconnect();
    };
  }, [selectedSessionId, fetchSessions, storeUrl]);

  const handleSelectSession = useCallback(
    async (sessionId) => {
      if (!storeUrl) {
        setError('No store URL found. Please login again.');
        return;
      }
      if (!sessionId) return;

      setSelectedSessionId(sessionId);
      setLoading(true);
      setError(null);

      try {
        const res = await axios.get(
          `${API_URL}/api/inbox/${sessionId}/messages?store_url=${storeUrl}`
        );
        setMessages(res.data.data || []);

        // Mark as read
        await axios.post(`${API_URL}/api/inbox/${sessionId}/mark-read`, {
          store_url: storeUrl
        });

        // Update local state
        setSessions((prev) =>
          prev.map((s) =>
            s.session_id === sessionId ? { ...s, unread_count: 0 } : s
          )
        );
        fetchSessions();
      } catch (err) {
        console.error('Failed to load thread:', err);
        setError('Failed to load messages. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [fetchSessions, storeUrl]
  );

  const handleSelectCustomer = useCallback(
    (customerData) => {
      setSelectedCustomer(customerData.customer);

      const sortedSessions = customerData.sessions.sort(
        (a, b) => new Date(b.last_message_at) - new Date(a.last_message_at)
      );

      setCustomerSessions(sortedSessions);

      if (sortedSessions.length > 0) {
        const latestSession = sortedSessions[0];
        const dateKey = getISTDateKey(latestSession.last_message_at);
        setSelectedSessionDate(dateKey);
        handleSelectSession(latestSession.session_id);
      } else {
        setSelectedSessionDate('');
        setSelectedSessionId(null);
        setMessages([]);
      }
    },
    [handleSelectSession]
  );

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e, callback) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      callback();
    }
  }, []);

  // Ticket helpers
  const resetTicketForm = useCallback(() => {
    setTicketSubject('');
    setTicketIssueType(ISSUE_TYPES[0]);
    setTicketPriority('Medium');
    setTicketChannel('Website widget');
    setTicketDescription('');
    setTicketIncludeLogs(true);
  }, []);

  const openTicketModalFromCurrentSession = useCallback(() => {
    if (!selectedSessionId) return;

    const lastMessages = messages.slice(-6);
    const transcript = lastMessages
      .map((m) => {
        if (m.user_message) {
          return `Customer (${formatTimeIST(m.created_at)}): ${m.user_message}`;
        }
        if (m.bot_response) {
          return `Bot (${formatTimeIST(m.created_at)}): ${
            typeof m.bot_response === 'string'
              ? m.bot_response
              : JSON.stringify(m.bot_response)
          }`;
        }
        return null;
      })
      .filter(Boolean)
      .join('\n');

    setTicketSubject(
      `Issue with chatbot conversation (${selectedCustomer || 'Customer'})`
    );
    setTicketIssueType('Wrong / irrelevant answers');
    setTicketPriority('Medium');
    setTicketChannel('Website widget');
    setTicketDescription(
      `Describe the problem you noticed in this chat:\n\n` +
      `--- Conversation snippet (last few messages) ---\n${transcript || 'No recent messages'}`
    );
    setTicketIncludeLogs(true);
    setShowTicketModal(true);
  }, [messages, selectedCustomer, selectedSessionId]);

  const handleCreateTicket = useCallback(
    async (e) => {
      e.preventDefault();
      if (!storeUrl || !selectedSessionId) return;

      if (!ticketSubject.trim() || !ticketDescription.trim()) return;

      try {
        setCreatingTicket(true);

        await axios.post(`${API_URL}/support/tickets`, {
          store_url: storeUrl,
          subject: ticketSubject,
          issue_type: ticketIssueType,
          priority: ticketPriority,
          channel: ticketChannel,
          related_session_id: selectedSessionId,
          description: ticketDescription,
          include_logs: ticketIncludeLogs,
        });

        resetTicketForm();
        setShowTicketModal(false);
        // Optional: toast/snackbar can be added here
      } catch (err) {
        console.error('Failed to create ticket from inbox:', err);
        alert('Could not create ticket. Please try again.');
      } finally {
        setCreatingTicket(false);
      }
    },
    [
      storeUrl,
      selectedSessionId,
      ticketSubject,
      ticketIssueType,
      ticketPriority,
      ticketChannel,
      ticketDescription,
      ticketIncludeLogs,
      resetTicketForm
    ]
  );

  const handleRaiseTicketClick = useCallback(() => {
    if (!selectedSessionId) {
      alert('Please select a conversation/session first.');
      return;
    }
    openTicketModalFromCurrentSession();
  }, [selectedSessionId, openTicketModalFromCurrentSession]);

  // Date list & sessions per selected date
  const sessionDateOptions = useMemo(() => {
    const dateMap = new Map();
    customerSessions.forEach((session) => {
      const key = getISTDateKey(session.last_message_at);
      if (!dateMap.has(key)) {
        dateMap.set(key, session.last_message_at);
      }
    });

    const entries = Array.from(dateMap.entries()).sort(
      (a, b) => new Date(b[1]) - new Date(a[1])
    );

    return entries.map(([key, ts]) => ({
      key,
      label: formatDateIST(ts)
    }));
  }, [customerSessions]);

  const sessionsForSelectedDate = useMemo(() => {
    if (!selectedSessionDate) return [];
    return customerSessions
      .filter((s) => getISTDateKey(s.last_message_at) === selectedSessionDate)
      .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
  }, [customerSessions, selectedSessionDate]);

  const renderMessageContent = useCallback((msg) => {
    const elements = [];
    let productData = parseJSON(msg.message_json);

    if (!productData && msg.bot_response) {
      const parsedResponse = parseJSON(msg.bot_response);
      if (parsedResponse && parsedResponse.products) {
        productData = parsedResponse;
      }
    }

    let displayText = null;
    if (productData && productData.reply) {
      displayText = productData.reply;
    } else if (msg.bot_response) {
      const text = typeof msg.bot_response === 'string'
        ? msg.bot_response.trim()
        : '';
      const looksLikeJSON =
        text.startsWith('{') &&
        (text.includes('"products":') || text.includes('"reply":'));
      if (!looksLikeJSON) {
        displayText = text;
      }
    }

    if (displayText) {
      elements.push(
        <div key="text" className="mb-2 text-sm leading-relaxed">
          {displayText}
        </div>
      );
    }

    if (productData?.type === 'checkout' || productData?.checkoutUrl) {
      const checkoutUrl = productData.checkoutUrl;
      const cartTotal = productData.cartTotal;
      const itemCount = productData.itemCount;

      elements.push(
        <div key="checkout" className="mt-3 w-full">
          <a
            href={checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 rounded-xl border-2 border-emerald-400 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 transition-all duration-200 shadow-lg hover:shadow-xl"
            style={{ textDecoration: 'none' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-emerald-500 text-white rounded-full p-2 flex-shrink-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l-1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                  </svg>
                </div>
                <div>
                  <div className="font-bold text-emerald-900 text-sm">
                    Complete Checkout
                  </div>
                  <div className="text-xs text-emerald-700 mt-0.5">
                    {itemCount && `${itemCount} item${itemCount !== 1 ? 's' : ''}`}
                    {cartTotal && ` • Total: ₹${cartTotal}`}
                  </div>
                </div>
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-emerald-600 flex-shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </a>
        </div>
      );
    }

    const products = productData?.products;
    if (products && Array.isArray(products) && products.length > 0) {
      elements.push(
        <div key="products" className="mt-3 w-full relative">
          <div className="flex space-x-3 overflow-x-auto pb-2 custom-scrollbar-light">
            {products.map((product, idx) => (
              <ProductCard
                key={`${product.id || idx}-${idx}`}
                product={product}
              />
            ))}
          </div>
        </div>
      );
    }

    return elements.length > 0 ? (
      elements
    ) : (
      <span className="text-gray-400 text-sm italic">No content</span>
    );
  }, []);

  return (
    <div
      className="flex h-[calc(100vh-60px)] bg-[#f3f4f6] font-sans overflow-hidden w-full"
      role="main"
      aria-label="Inbox"
    >
      {/* LEFT SIDEBAR - Customers */}
      <aside
        className={`bg-white border-r border-gray-200 flex-shrink-0 flex flex-col z-10 
        transition-all duration-300 ease-in-out shadow-lg sm:shadow-none
        ${
          selectedCustomer
            ? 'max-sm:w-0 max-sm:opacity-0 max-sm:pointer-events-none w-[360px] min-w-[360px] md:w-[320px] md:min-w-[320px] lg:w-[360px]'
            : 'w-full sm:w-[360px] min-w-[360px] md:w-[320px] md:min-w-[320px] lg:w-[360px]'
        }`}
        style={{ width: selectedCustomer ? undefined : '100%', maxWidth: '360px' }}
        aria-label="Customer list"
      >
        <div className="p-5 border-b border-gray-100 bg-white flex-shrink-0">
          <h1 className="text-2xl font-bold text-gray-800">Customers</h1>
          <div className="text-sm text-gray-500 mt-1">
            {groupedCustomers.length} active
          </div>
        </div>

        <div className="flex-grow overflow-y-auto custom-scrollbar-light">
          {sessionsError && (
            <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {sessionsError}
              <button
                onClick={fetchSessions}
                className="ml-2 underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          )}

          {groupedCustomers.length === 0 && !sessionsError ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              No conversations yet
            </div>
          ) : (
            <div role="list">
              {groupedCustomers.map((customerData) => (
                <div
                  key={customerData.customer}
                  role="listitem"
                  tabIndex={0}
                  onClick={() => handleSelectCustomer(customerData)}
                  onKeyDown={(e) =>
                    handleKeyDown(e, () => handleSelectCustomer(customerData))
                  }
                  aria-label={`View conversation with ${
                    customerData.customer
                  }${
                    customerData.totalUnread > 0
                      ? `, ${customerData.totalUnread} unread messages`
                      : ''
                  }`}
                  className={`flex items-center p-4 cursor-pointer border-b border-gray-100 transition duration-200 ease-in-out gap-3
                    hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                      selectedCustomer === customerData.customer
                        ? 'bg-blue-50 border-l-4'
                        : ''
                    }`}
                  style={{
                    borderColor:
                      selectedCustomer === customerData.customer
                        ? PRIMARY_COLOR
                        : undefined
                  }}
                >
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg text-white"
                    style={{ background: PRIMARY_GRADIENT }}
                    aria-hidden="true"
                  >
                    {customerData.customer.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="font-semibold text-sm truncate text-gray-800">
                      {customerData.customer}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                      {customerData.sessions.length} session
                      {customerData.sessions.length !== 1 ? 's' : ''}
                      {customerData.totalUnread > 0 && (
                        <span
                          className="bg-red-500 text-white text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full inline-block"
                          aria-label={`${customerData.totalUnread} unread`}
                        >
                          {customerData.totalUnread}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap self-start">
                    {formatTimeOnly(customerData.latestTime)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* MAIN CHAT AREA */}
      <div
        className="flex-grow flex flex-col relative min-w-0 transition-transform duration-300 ease-in-out"
        style={{
          background:
            'radial-gradient(circle at top left, #eef2ff 0, #f3f4f6 40%, #f9fafb 100%)'
        }}
      >
        {selectedCustomer ? (
          <>
            {/* Header with Date + Time Session Selectors + Raise Ticket */}
            <header className="flex items-center justify-between p-4 px-6 bg-white border-b border-gray-200 shadow-md flex-shrink-0">
              <div className="flex items-center">
                <button
                  onClick={() => {
                    setSelectedCustomer(null);
                    setSelectedSessionId(null);
                    setSelectedSessionDate('');
                    setMessages([]);
                  }}
                  className="sm:hidden text-gray-600 hover:text-blue-700 mr-3 p-1 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Back to customer list"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                </button>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">
                    {selectedCustomer}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {messages.length} messages
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Date & Time Dropdowns */}
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                  {/* Date dropdown */}
                  <div className="flex items-center gap-1">
                    <label
                      htmlFor="session-date-selector"
                      className="text-xs text-gray-600 font-medium hidden sm:inline"
                    >
                      Date:
                    </label>
                    <select
                      id="session-date-selector"
                      value={selectedSessionDate || ''}
                      onChange={(e) => {
                        const newDateKey = e.target.value;
                        setSelectedSessionDate(newDateKey);

                        const sessionsForDate = customerSessions
                          .filter(
                            (s) =>
                              getISTDateKey(s.last_message_at) === newDateKey
                          )
                          .sort(
                            (a, b) =>
                              new Date(b.last_message_at) -
                              new Date(a.last_message_at)
                          );

                        if (sessionsForDate.length > 0) {
                          handleSelectSession(sessionsForDate[0].session_id);
                        } else {
                          setSelectedSessionId(null);
                          setMessages([]);
                        }
                      }}
                      className="p-1 border border-gray-300 rounded-md text-xs sm:text-sm bg-white cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition max-w-[140px]"
                      aria-label="Select conversation date"
                    >
                      {sessionDateOptions.length === 0 && (
                        <option value="">No dates</option>
                      )}
                      {sessionDateOptions.map((d) => (
                        <option key={d.key} value={d.key}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Time dropdown */}
                  <div className="flex items-center gap-1">
                    <label
                      htmlFor="session-time-selector"
                      className="text-xs text-gray-600 font-medium hidden sm:inline"
                    >
                      Time:
                    </label>
                    <select
                      id="session-time-selector"
                      value={selectedSessionId || ''}
                      onChange={(e) => handleSelectSession(e.target.value)}
                      disabled={
                        !selectedSessionDate ||
                        sessionsForSelectedDate.length === 0
                      }
                      className="p-1 border border-gray-300 rounded-md text-xs sm:text-sm bg-white cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition max-w-[160px]"
                      aria-label="Select conversation session time"
                    >
                      {sessionsForSelectedDate.length === 0 ? (
                        <option value="">No sessions</option>
                      ) : (
                        sessionsForSelectedDate.map((session, index) => (
                          <option
                            key={session.session_id}
                            value={session.session_id}
                          >
                            {formatTimeOnly(session.last_message_at)}
                            {index === 0 ? ' (latest)' : ''}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                {/* Raise Ticket Button */}
                <button
                  type="button"
                  onClick={handleRaiseTicketClick}
                  disabled={!selectedSessionId}
                  className="hidden sm:inline-flex items-center px-3 py-2 rounded-lg text-xs font-semibold text-white shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: PRIMARY_GRADIENT }}
                >
                  Raise ticket
                </button>
              </div>
            </header>

            {/* Messages Feed */}
            <div
              className="flex-grow overflow-y-auto p-6 space-y-4 custom-scrollbar-dark"
              role="log"
              aria-live="polite"
              aria-label="Messages"
            >
              {loading ? (
                <LoadingSkeleton />
              ) : error ? (
                <div className="flex items-center justify-center h-full">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm max-w-md">
                    {error}
                    <button
                      onClick={() =>
                        selectedSessionId && handleSelectSession(selectedSessionId)
                      }
                      className="ml-2 underline hover:no-underline"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <p className="p-4 border border-dashed border-gray-300 rounded-xl bg-white/50">
                    No messages in this conversation.
                  </p>
                </div>
              ) : (
                <>
                  {messages.map((msg, idx) => {
                    const isUserMessage = !!msg.user_message;
                    const isBotResponse =
                      !!msg.bot_response || !!msg.message_json;

                    if (!isUserMessage && !isBotResponse) return null;

                    return (
                      <React.Fragment key={msg.id || idx}>
                        {/* User Message (Customer) */}
                        {isUserMessage && (
                          <div className="flex justify-start">
                            <div className="max-w-[75%] md:max-w-md lg:max-w-lg">
                              <div
                                className="p-3 text-gray-900 rounded-[18px] rounded-bl-sm shadow-lg border"
                                style={{
                                  background: 'rgba(255, 255, 255, 0.98)',
                                  borderColor: 'rgba(148, 163, 184, 0.3)',
                                  boxShadow:
                                    '0 10px 26px rgba(15, 23, 42, 0.08)'
                                }}
                                role="article"
                                aria-label={`Message from customer at ${formatTimeOnly(
                                  msg.created_at
                                )}`}
                              >
                                <div className="text-sm leading-relaxed">
                                  {msg.user_message}
                                </div>
                                <span className="block text-[0.7rem] text-gray-500 mt-1 text-right opacity-80">
                                  {formatTimeOnly(msg.created_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Bot Response */}
                        {isBotResponse && (
                          <div className="flex justify-end">
                            <div className="max-w-[80%] md:max-w-md lg:max-w-lg">
                              <div
                                className="p-3 text-white rounded-[18px] rounded-br-sm shadow-xl"
                                style={{
                                  background: PRIMARY_GRADIENT,
                                  boxShadow:
                                    '0 14px 30px rgba(37, 99, 235, 0.35)'
                                }}
                                role="article"
                                aria-label={`Bot response at ${formatTimeOnly(
                                  msg.created_at
                                )}`}
                              >
                                {renderMessageContent(msg)}
                                <span className="block text-[0.7rem] text-white/80 mt-1 text-right opacity-80">
                                  {formatTimeOnly(msg.created_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            <footer className="p-4 bg-[#f8fafc] border-t border-gray-200 text-center text-gray-500 text-sm flex-shrink-0">
              Conversation view. Agent reply feature not yet active.
            </footer>
          </>
        ) : (
          <div
            className="flex-grow flex items-center justify-center"
            style={{
              background:
                'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
            }}
          >
            <div className="text-center p-8">
              <div className="text-5xl mb-4 text-gray-400" aria-hidden="true">
                👤
              </div>
              <p className="text-xl text-gray-700 font-semibold">
                Select a Customer
              </p>
              <p className="text-sm text-gray-400 mt-2 max-w-sm">
                Choose a customer from the sidebar to view their full
                conversation history and session details.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Ticket Modal */}
      {showTicketModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 relative">
            <button
              onClick={() => {
                setShowTicketModal(false);
                resetTicketForm();
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <span className="sr-only">Close</span>✕
            </button>

            <h2 className="text-xl font-semibold text-gray-900 mb-1">
              Raise a Support Ticket
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              This ticket will be linked to the current conversation (Session ID: {selectedSessionId}).
            </p>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Issue type
                  </label>
                  <select
                    value={ticketIssueType}
                    onChange={(e) => setTicketIssueType(e.target.value)}
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
                    value={ticketPriority}
                    onChange={(e) => setTicketPriority(e.target.value)}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Channel
                </label>
                <select
                  value={ticketChannel}
                  onChange={(e) => setTicketChannel(e.target.value)}
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
                  Describe the problem
                </label>
                <textarea
                  value={ticketDescription}
                  onChange={(e) => setTicketDescription(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  We’ve attached a snippet of this conversation below. You can add more details on top.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="inline-flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={ticketIncludeLogs}
                    onChange={(e) => setTicketIncludeLogs(e.target.checked)}
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
                      setShowTicketModal(false);
                      resetTicketForm();
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingTicket}
                    className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {creatingTicket ? 'Creating…' : 'Submit Ticket'}
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

// Loading Skeleton Component
function LoadingSkeleton() {
  return (
    <div
      className="space-y-4 animate-pulse"
      role="status"
      aria-label="Loading messages"
    >
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`flex ${
            i % 2 === 0 ? 'justify-start' : 'justify-end'
          }`}
        >
          <div className="max-w-md w-full">
            <div
              className={`p-3 rounded-lg ${
                i % 2 === 0 ? 'bg-gray-200' : 'bg-blue-200'
              }`}
            >
              <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-300 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      ))}
      <span className="sr-only">Loading messages...</span>
    </div>
  );
}

// Product Card Component - Memoized for performance
const ProductCard = React.memo(({ product }) => {
  if (!product) return null;

  let price = 'N/A';
  if (product.price) {
    price = product.price;
  } else if (product.variants?.[0]?.price) {
    price = `₹${product.variants[0].price}`;
  }

  let imgUrl = 'https://via.placeholder.com/140?text=No+Image';
  if (product.imageUrl) {
    imgUrl = product.imageUrl;
  } else if (product.images?.[0]) {
    imgUrl =
      typeof product.images[0] === 'string'
        ? product.images[0]
        : product.images[0].src;
  }

  const productUrl = product.productUrl || product.url || '#';

  return (
    <a
      href={productUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex-shrink-0 w-[140px] min-w-[140px] bg-white rounded-xl shadow-lg hover:shadow-xl transition duration-200 overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500"
      style={{ transform: 'translateY(0)', transition: 'all 0.2s ease' }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
      aria-label={`View ${product.title} - ${price}`}
    >
      <div className="w-full h-[140px] bg-gray-100 flex items-center justify-center overflow-hidden relative">
        <img
          src={imgUrl}
          alt={product.title}
          className="object-cover w-full h-full"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src =
              'https://via.placeholder.com/140?text=No+Image';
          }}
          loading="lazy"
        />
      </div>
      <div className="p-3">
        <div
          className="text-xs font-semibold text-gray-900 h-10 overflow-hidden line-clamp-2 leading-relaxed"
          title={product.title}
        >
          {product.title}
        </div>
        <div className="text-sm font-bold text-blue-600 mt-2">
          {price}
        </div>
      </div>
    </a>
  );
});

ProductCard.displayName = 'ProductCard';
