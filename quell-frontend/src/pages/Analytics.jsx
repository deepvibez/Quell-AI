import React, { useEffect, useState } from "react";
import ConversationAnalytics from "../components/analytics/ConversationAnalytics";
import SalesAnalytics from "../components/analytics/SalesAnalytics"; 
import CustomerBehaviorAnalytics from "../components/analytics/CustomerBehaviorAnalytics";
import AIInsightsAnalytics from "../components/analytics/AIInsightsAnalytics"; 
import PerformanceAnalytics from "../components/analytics/PerformanceAnalytics";

const SECTIONS = [
  { id: "conversational", label: "Conversational" },
  { id: "sales", label: "Sales" },
  { id: "behaviour", label: "Customer Insights" },
  { id: "ai-insights", label: "AI Insights" },
  { id: "performance", label: "Performance and responses" },
];

const PlaceholderPanel = ({ title, description }) => (
  <div className="w-full h-full p-6 lg:p-8 flex flex-col gap-4">
    <div className="flex items-start gap-3">
      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-600 text-lg font-semibold">
        📊
      </div>
      <div>
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-600 mt-1">{description}</p>
      </div>
    </div>
    <div className="mt-4 rounded-xl border-2 border-dashed border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100 p-8 lg:p-12 text-center">
      <div className="max-w-md mx-auto">
        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-sm text-gray-600 font-medium">
          This section is not wired up yet. You can add charts and KPIs here later.
        </p>
      </div>
    </div>
  </div>
);

const AnalyticsPage = () => {
  const [storeUrl, setStoreUrl] = useState("");
  const [activeSection, setActiveSection] = useState("conversational");

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const value = sessionStorage.getItem("store_url");
        setStoreUrl(value || "");
      }
    } catch {
      setStoreUrl("");
    }
  }, []);

  const renderContent = () => {
    switch (activeSection) {
      case "conversational":
        return <ConversationAnalytics storeUrl={storeUrl} />;
      case "sales":
        return <SalesAnalytics storeUrl={storeUrl} />;
      case "behaviour":
        return <CustomerBehaviorAnalytics storeUrl={storeUrl} />;
      case "ai-insights": 
        return <AIInsightsAnalytics storeUrl={storeUrl} />;
      case "performance":
        return <PerformanceAnalytics storeUrl={storeUrl} />;
      default:
        return null;
    }
  };

  return (
    <div className="w-full">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Analytics</h1>
        <p className="text-gray-600">Track and analyze your chatbot performance</p>
      </div>

      {/* Main Analytics Container */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="flex flex-col lg:flex-row">
          {/* Analytics Sidebar - Vertical Tabs */}
          <aside className="w-full lg:w-56 xl:w-64 bg-gradient-to-b from-gray-50 to-white border-b lg:border-b-0 lg:border-r border-gray-200 flex flex-row lg:flex-col gap-2 p-3 lg:p-4 overflow-x-auto lg:overflow-x-visible">
            {SECTIONS.map((section) => {
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`whitespace-nowrap lg:w-full text-left rounded-lg lg:rounded-xl px-4 py-2.5 lg:py-3 text-sm font-medium transition-all duration-200 relative
                    ${
                      isActive
                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md lg:shadow-lg transform lg:scale-105"
                        : "bg-white text-gray-700 border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                    }`}
                >
                  {section.label}
                  {isActive && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 hidden lg:block">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </aside>

          {/* Content Panel */}
          <section className="flex-1 bg-gray-50 min-h-[600px]">
            {renderContent()}
          </section>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
