import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../config/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    conversations: 0,
    activeChatbots: 0,
    responseRate: 0,
    ordersPlaced: 0,
    totalRevenue: '0.00',
    conversationsTrend: 0,
    responseRateTrend: 0,
    ordersTrend: 0
  });
  const [userInfo, setUserInfo] = useState(null);
  const [hourlyUsage, setHourlyUsage] = useState([]);
  const [salesData, setSalesData] = useState(null);
  const [currency, setCurrency] = useState('USD');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // 1) Get current user + stores
      const me = await apiCall('/api/auth/me');
      setUserInfo(me.user || null);

      const storeUrl =
        me.stores?.[0]?.shop_domain ||
        (typeof window !== 'undefined'
          ? sessionStorage.getItem('store_url')
          : '') ||
        '';

      const activeChatbots = me.stores?.length || 0;

      if (!storeUrl) {
        // No store yet – still show activeChatbots + welcome state
        setStats(prev => ({
          ...prev,
          activeChatbots
        }));
        return;
      }

      // 2) Build same params as analytics pages (last 30 days)
      const DAYS_RANGE = 30;
      const today = new Date();
      const sinceDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      sinceDate.setDate(sinceDate.getDate() - DAYS_RANGE);
      const since = sinceDate.toISOString().slice(0, 10);

      const convParams = new URLSearchParams({
        store_url: storeUrl,
        days: String(DAYS_RANGE)
      });

      const sharedParams = new URLSearchParams({
        store_url: storeUrl,
        since
      });

      // 3) Hit the same live endpoints as the analytics pages
      const [convRes, salesRes, perfRes] = await Promise.allSettled([
        fetch(
          `http://localhost:3000/analytics/conversations?${convParams.toString()}`
        ),
        fetch(
          `http://localhost:3000/analytics/sales?${sharedParams.toString()}`
        ),
        fetch(
          `http://localhost:3000/analytics/performance?${sharedParams.toString()}`
        )
      ]);

      let conversations = 0;
      let hourlyData = [];
      let responseRate = 0;
      let ordersPlaced = 0;
      let totalRevenue = 0;
      let salesSummary = null;
      let detectedCurrency = 'USD';

      // ---- Conversations analytics ----
      if (convRes.status === 'fulfilled') {
        const res = convRes.value;
        if (res.ok) {
          const json = await res.json();

          conversations = json.total_conversations || 0;

          const rawHourly = json.hourly_usage || [];
          hourlyData = rawHourly.map(d => ({
            hour:
              typeof d.hour === 'string'
                ? d.hour.slice(11, 16) // "YYYY-MM-DD HH:00" -> "HH:00"
                : d.hour,
            conversations: Number(d.cnt ?? d.conversations ?? 0)
          }));
        } else {
          console.error(
            'Conversations analytics failed:',
            await res.text().catch(() => 'error')
          );
        }
      }

      // ---- Sales analytics ----
      if (salesRes.status === 'fulfilled') {
        const res = salesRes.value;
        if (res.ok) {
          const json = await res.json();

          const shopify = json.shopify || {};
          ordersPlaced = shopify.total_orders || 0;
          totalRevenue = shopify.total_revenue || 0;
          const aov =
            shopify.average_order_value ||
            (ordersPlaced > 0 ? totalRevenue / ordersPlaced : 0);

          detectedCurrency = shopify.currency || 'USD';

          salesSummary = {
            ai_assisted_conversions: json.ai_assisted_conversions || 0,
            add_to_cart_events: json.add_to_cart_events || 0,
            average_order_value: aov,
            total_orders: ordersPlaced,
            currency: detectedCurrency
          };
        } else {
          console.error(
            'Sales analytics failed:',
            await res.text().catch(() => 'error')
          );
        }
      }

      // ---- Performance analytics (for response rate) ----
      if (perfRes.status === 'fulfilled') {
        const res = perfRes.value;
        if (res.ok) {
          const json = await res.json();
          // PerformanceAnalytics uses json.overview.response_rate
          responseRate = json.overview?.response_rate || 0;
        } else {
          console.error(
            'Performance analytics failed:',
            await res.text().catch(() => 'error')
          );
        }
      }

      // 4) Push into state – UI stays exactly the same
      setHourlyUsage(hourlyData);

      if (salesSummary) {
        setSalesData(salesSummary);
        setCurrency(detectedCurrency);
      }

      setStats(prev => ({
        ...prev,
        activeChatbots,
        conversations,
        responseRate,
        ordersPlaced,
        totalRevenue: totalRevenue.toFixed(2),
        // You can later compute real trends; 0 hides the pill
        conversationsTrend: 0,
        responseRateTrend: 0,
        ordersTrend: 0
      }));
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    const symbols = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      INR: '₹',
      CAD: 'C$',
      AUD: 'A$'
    };
    const symbol = symbols[currency] || currency + ' ';
    return `${symbol}${parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const TrendIndicator = ({ value }) => {
    if (!value || value === 0) return null;
    const isPositive = value > 0;
    
    return (
      <div className={`flex items-center ${isPositive ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'} px-2 py-1 rounded-full text-xs font-semibold`}>
        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
          {isPositive ? (
            <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" />
          ) : (
            <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" />
          )}
        </svg>
        {Math.abs(value)}%
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
        {userInfo && (
          <p className="text-gray-600 text-lg">Welcome back, <span className="font-semibold text-indigo-600">{userInfo.name}</span>! 👋</p>
        )}
      </div>

      {/* Empty State for New Sellers */}
      {stats.activeChatbots === 0 && (
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-8 rounded-xl shadow-lg text-white mb-6">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="mb-4 md:mb-0">
              <h2 className="text-2xl font-bold mb-3">Welcome to Quell AI! 🚀</h2>
              <p className="mb-2 text-indigo-100">Get started by connecting your first Shopify store</p>
              <p className="text-sm text-indigo-200">Enable AI-powered conversations for your customers</p>
            </div>
            <button 
              onClick={() => navigate('/integration?section=installation')}
              className="bg-white text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-indigo-50 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              Connect Store →
            </button>
          </div>
        </div>
      )}
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl shadow-lg border border-blue-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-500 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <TrendIndicator value={stats.conversationsTrend} />
          </div>
          <h3 className="text-gray-600 text-sm font-medium mb-1">Total Conversations</h3>
          <p className="text-3xl font-bold text-gray-900">
            {stats.conversations.toLocaleString()}
          </p>
          <div className="mt-3">
            <div className="w-full bg-blue-200 rounded-full h-1.5">
              <div 
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min((stats.conversations / 1000) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl shadow-lg border border-green-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <TrendIndicator value={stats.ordersTrend} />
          </div>
          <h3 className="text-gray-600 text-sm font-medium mb-1">Total Revenue</h3>
          <p className="text-3xl font-bold text-gray-900">
            {formatCurrency(stats.totalRevenue)}
          </p>
          {salesData && (
            <p className="text-xs text-gray-500 mt-2">
              AOV: {formatCurrency(salesData.average_order_value)}
            </p>
          )}
        </div>
        
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl shadow-lg border border-purple-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-500 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <TrendIndicator value={stats.responseRateTrend} />
          </div>
          <h3 className="text-gray-600 text-sm font-medium mb-1">Conversion Rate</h3>
          <p className="text-3xl font-bold text-gray-900">
            {stats.responseRate}%
          </p>
          <div className="mt-3">
            <div className="w-full bg-purple-200 rounded-full h-1.5">
              <div 
                className="bg-purple-500 h-1.5 rounded-full transition-all duration-500" 
                style={{ width: `${stats.responseRate}%` }}
              />
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-xl shadow-lg border border-orange-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-500 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <TrendIndicator value={stats.ordersTrend} />
          </div>
          <h3 className="text-gray-600 text-sm font-medium mb-1">Orders Placed</h3>
          <p className="text-3xl font-bold text-gray-900">
            {stats.ordersPlaced.toLocaleString()}
          </p>
          {salesData && (
            <p className="text-xs text-orange-600 mt-2 font-medium">
              {salesData.ai_assisted_conversions || 0} AI-assisted
            </p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button 
          onClick={() => navigate('/integration?section=appearance')}
          className="bg-white p-6 rounded-xl border-2 border-dashed border-gray-300 hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left group"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-indigo-100 group-hover:bg-indigo-200 rounded-lg transition-colors">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Customize Chatbot</h3>
              <p className="text-sm text-gray-600">Appearance & settings</p>
            </div>
          </div>
        </button>

        <button 
          onClick={() => navigate('/inbox')}
          className="bg-white p-6 rounded-xl border-2 border-dashed border-gray-300 hover:border-green-500 hover:bg-green-50 transition-all text-left group"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-green-100 group-hover:bg-green-200 rounded-lg transition-colors">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">View Inbox</h3>
              <p className="text-sm text-gray-600">Check customer messages</p>
            </div>
          </div>
        </button>

        <button 
          onClick={() => navigate('/analytics')}
          className="bg-white p-6 rounded-xl border-2 border-dashed border-gray-300 hover:border-purple-500 hover:bg-purple-50 transition-all text-left group"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-purple-100 group-hover:bg-purple-200 rounded-lg transition-colors">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Analytics Report</h3>
              <p className="text-sm text-gray-600">View detailed insights</p>
            </div>
          </div>
        </button>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Usage Graph */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Hourly Usage</h2>
              <p className="text-sm text-gray-500 mt-1">Conversations in the last 24 hours</p>
            </div>
            <button 
              onClick={() => navigate('/analytics')}
              className="text-indigo-600 hover:text-indigo-700 text-sm font-medium transition-colors"
            >
              View Details →
            </button>
          </div>
          
          {hourlyUsage.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyUsage}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="hour" 
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Bar 
                    dataKey="conversations" 
                    fill="#4f46e5" 
                    radius={[8, 8, 0, 0]}
                    name="Conversations"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2z" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium mb-1">No data available</p>
              <p className="text-sm text-gray-500">Hourly usage stats will appear here</p>
            </div>
          )}
        </div>

        {/* Conversation Insights */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Insights</h2>
          
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Total Revenue</span>
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(stats.totalRevenue)}
              </p>
              <p className="text-xs text-gray-600 mt-1">From {stats.ordersPlaced} orders</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">AI Conversions</span>
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {salesData?.ai_assisted_conversions || 0}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {salesData && salesData.total_orders > 0 
                  ? `${Math.round((salesData.ai_assisted_conversions / salesData.total_orders) * 100)}% of orders`
                  : 'No orders yet'
                }
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Add to Cart</span>
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {salesData?.add_to_cart_events || 0}
              </p>
              <p className="text-xs text-gray-600 mt-1">Total events</p>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Avg Order Value</span>
                <span className="text-lg">💰</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {salesData ? formatCurrency(salesData.average_order_value) : formatCurrency('0')}
              </p>
              <p className="text-xs text-gray-600 mt-1">Per order</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
