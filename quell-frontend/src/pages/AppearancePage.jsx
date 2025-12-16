import { useState, useEffect } from "react";
import { FiCheck, FiX, FiAlertCircle } from "react-icons/fi";

export default function AppearancePage() {
  const storeUrl = sessionStorage.getItem("store_url");
  const email = sessionStorage.getItem("email");

  const [settings, setSettings] = useState({
    primary_color: "#1d306d",
    header_title: "Quell AI",
    welcome_message: "Hello there! How can I assist you today?",
    conversation_starters: [
      "Browse Products",
      "Track My Order",
      "Customer Support",
    ],
    button_bg_color: "",
    button_text_color: "#ffffff",
    button_shape: "circle",
    button_position: "right",
    logo_url: "",
    show_logo: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (storeUrl) {
      fetchAppearanceSettings();
    } else {
      setLoading(false);
    }
  }, []);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchAppearanceSettings = async () => {
    try {
      const response = await fetch(
        `http://localhost:3000/api/appearance/${encodeURIComponent(storeUrl)}`
      );
      const data = await response.json();

      console.log("Raw API response:", data);
      console.log("conversation_starters type:", typeof data.conversation_starters);
      console.log("conversation_starters value:", data.conversation_starters);

      let starters = ["Browse Products", "Track My Order", "Customer Support"];

      if (data.conversation_starters) {
        if (
          Array.isArray(data.conversation_starters) &&
          data.conversation_starters.length > 0
        ) {
          starters = data.conversation_starters;
        } else if (
          typeof data.conversation_starters === "object" &&
          !Array.isArray(data.conversation_starters)
        ) {
          const values = Object.values(data.conversation_starters);
          if (values.length > 0) {
            starters = values;
          }
        } else if (typeof data.conversation_starters === "string") {
          try {
            const parsed = JSON.parse(data.conversation_starters);
            if (Array.isArray(parsed) && parsed.length > 0) {
              starters = parsed;
            }
          } catch (e) {
            console.error("Failed to parse conversation_starters:", e);
          }
        }
      }

      setSettings({
        primary_color: data.primary_color || "#1d306d",
        header_title: data.header_title || "Quell AI",
        welcome_message:
          data.welcome_message || "Hello there! How can I assist you today?",
        conversation_starters: starters,
        button_bg_color: data.button_bg_color || "",
        button_text_color: data.button_text_color || "#ffffff",
        button_shape: data.button_shape || "circle",
        button_position: data.button_position || "right",
        logo_url: data.logo_url || "",
        show_logo:
          typeof data.show_logo === "boolean" ? data.show_logo : false,
      });
    } catch (error) {
      console.error("Error fetching appearance settings:", error);
      showNotification("error", "Failed to load appearance settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!storeUrl) {
      showNotification("error", "Store URL not found. Please login again.");
      return;
    }

    if (
      !Array.isArray(settings.conversation_starters) ||
      settings.conversation_starters.length === 0
    ) {
      showNotification(
        "error",
        "Please add at least one conversation starter button."
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        `http://localhost:3000/api/appearance/${encodeURIComponent(storeUrl)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...settings,
            conversation_starters: settings.conversation_starters,
          }),
        }
      );

      if (response.ok) {
        showNotification(
          "success",
          "✨ Appearance settings saved successfully!"
        );
      } else {
        const error = await response.json();
        showNotification(
          "error",
          error.message || "Failed to save settings. Please try again."
        );
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      showNotification("error", "Error saving settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateStarter = (index, value) => {
    const newStarters = [...settings.conversation_starters];
    newStarters[index] = value;
    setSettings((prev) => ({
      ...prev,
      conversation_starters: newStarters,
    }));
  };

  const addStarter = () => {
    if (settings.conversation_starters.length < 5) {
      setSettings((prev) => ({
        ...prev,
        conversation_starters: [...prev.conversation_starters, "New Button"],
      }));
    } else {
      showNotification("error", "Maximum 5 buttons allowed");
    }
  };

  const removeStarter = (index) => {
    if (settings.conversation_starters.length <= 1) {
      showNotification("error", "At least one button is required");
      return;
    }
    const newStarters = settings.conversation_starters.filter(
      (_, i) => i !== index
    );
    setSettings((prev) => ({
      ...prev,
      conversation_starters: newStarters,
    }));
  };

  if (!storeUrl) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-8 bg-red-50 rounded-lg">
          <FiAlertCircle className="mx-auto text-5xl text-red-500 mb-4" />
          <p className="text-red-600 font-semibold">
            No store found. Please login again.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading settings...</p>
        </div>
      </div>
    );
  }

  const previewButtonStyle = () => {
    const bg = settings.button_bg_color || settings.primary_color;
    let borderRadius = "999px";
    if (settings.button_shape === "square") borderRadius = "16px";
    else if (settings.button_shape === "rounded") borderRadius = "18px";

    return {
      backgroundColor: bg,
      color: settings.button_text_color || "#ffffff",
      borderRadius,
    };
  };

  const previewButtonPositionStyle = () => {
    const side =
      settings.button_position === "left" ? { left: "16px" } : { right: "16px" };
    return { bottom: "16px", ...side };
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg transform transition-all duration-500 ${
            notification.type === "success"
              ? "bg-green-500 text-white"
              : "bg-red-500 text-white"
          }`}
        >
          {notification.type === "success" ? (
            <FiCheck className="text-2xl" />
          ) : (
            <FiX className="text-2xl" />
          )}
          <span className="font-medium">{notification.message}</span>
        </div>
      )}

      {/* Main Container - Full Width */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-2">
            Customize Your Chatbot
          </h1>
          <p className="text-lg text-gray-600">Make it yours with colors, messages, and personality</p>
        </div>

        {/* Main Content - Full Width Grid */}
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-start" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)' }}>
          {/* Left: Settings Form */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 lg:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                Appearance Settings
              </h2>
            </div>

            {/* Primary Color */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Primary Color
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Used for header, messages, and buttons
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings.primary_color}
                  onChange={(e) =>
                    updateSetting("primary_color", e.target.value)
                  }
                  className="h-12 w-20 cursor-pointer rounded-lg border-2 border-gray-300 shadow-sm hover:shadow-md transition-shadow"
                />
                <div className="flex-1 p-3 bg-gray-50 rounded-lg flex items-center justify-between border border-gray-200">
                  <span className="text-sm font-mono text-gray-700 font-medium">
                    {settings.primary_color}
                  </span>
                  <div
                    className="w-10 h-10 rounded-lg shadow-sm border-2 border-white ring-2 ring-gray-100"
                    style={{ backgroundColor: settings.primary_color }}
                  />
                </div>
              </div>
            </div>

            {/* Header Title */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Header Title
              </label>
              <input
                type="text"
                value={settings.header_title}
                onChange={(e) =>
                  updateSetting("header_title", e.target.value)
                }
                className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none transition"
                maxLength={50}
                placeholder="e.g., Shopping Assistant"
              />
              <p className="text-xs text-gray-500">
                {settings.header_title.length}/50 characters
              </p>
            </div>

            {/* Welcome Message */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Welcome Message
              </label>
              <textarea
                rows={3}
                value={settings.welcome_message}
                onChange={(e) =>
                  updateSetting("welcome_message", e.target.value)
                }
                className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none transition resize-none"
                maxLength={200}
                placeholder="Greet your customers..."
              />
              <p className="text-xs text-gray-500">
                {settings.welcome_message.length}/200 characters
              </p>
            </div>

            {/* Conversation Starters */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <label className="block text-sm font-semibold text-gray-700">
                Quick Action Buttons ({settings.conversation_starters.length}/5)
              </label>
              <p className="text-xs text-gray-500 mb-3">
                These appear under the welcome message as tappable suggestions.
              </p>
              <div className="space-y-3">
                {settings.conversation_starters.map((btn, index) => (
                  <div
                    key={index}
                    className="flex gap-2 items-center group"
                  >
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={btn}
                        onChange={(e) =>
                          updateStarter(index, e.target.value)
                        }
                        className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition pr-10"
                        maxLength={30}
                        placeholder={`Button ${index + 1}`}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        {btn.length}/30
                      </span>
                    </div>
                    <button
                      onClick={() => removeStarter(index)}
                      className="p-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition opacity-0 group-hover:opacity-100"
                      title="Remove"
                    >
                      <FiX />
                    </button>
                  </div>
                ))}
              </div>
              {settings.conversation_starters.length < 5 && (
                <button
                  onClick={addStarter}
                  className="w-full mt-3 p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition font-medium"
                >
                  + Add Button
                </button>
              )}
            </div>

            {/* Chat Button Customization */}
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <h3 className="text-base font-semibold text-gray-800">
                Chat Button
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                Control how the floating chat launcher looks on your site.
              </p>

              {/* Button Background */}
              <div className="space-y-1">
                <span className="block text-sm font-medium text-gray-700">
                  Button Background Color
                </span>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={settings.button_bg_color || settings.primary_color}
                    onChange={(e) =>
                      updateSetting("button_bg_color", e.target.value)
                    }
                    className="h-10 w-16 cursor-pointer rounded-lg border-2 border-gray-200"
                  />
                  <input
                    type="text"
                    value={settings.button_bg_color}
                    onChange={(e) =>
                      updateSetting("button_bg_color", e.target.value)
                    }
                    placeholder="(optional, defaults to primary color)"
                    className="flex-1 p-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
                  />
                </div>
              </div>

              {/* Button Icon Color */}
              <div className="space-y-1">
                <span className="block text-sm font-medium text-gray-700">
                  Button Icon Color
                </span>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={settings.button_text_color}
                    onChange={(e) =>
                      updateSetting("button_text_color", e.target.value)
                    }
                    className="h-10 w-16 cursor-pointer rounded-lg border-2 border-gray-200"
                  />
                  <input
                    type="text"
                    value={settings.button_text_color}
                    onChange={(e) =>
                      updateSetting("button_text_color", e.target.value)
                    }
                    className="flex-1 p-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
                  />
                </div>
              </div>

              {/* Shape & Position */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <span className="block text-sm font-medium text-gray-700">
                    Button Shape
                  </span>
                  <select
                    value={settings.button_shape}
                    onChange={(e) =>
                      updateSetting("button_shape", e.target.value)
                    }
                    className="w-full mt-1 p-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
                  >
                    <option value="circle">Circle</option>
                    <option value="rounded">Rounded Square</option>
                    <option value="square">Square</option>
                  </select>
                </div>
                <div className="flex-1">
                  <span className="block text-sm font-medium text-gray-700">
                    Button Position
                  </span>
                  <select
                    value={settings.button_position}
                    onChange={(e) =>
                      updateSetting("button_position", e.target.value)
                    }
                    className="w-full mt-1 p-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
                  >
                    <option value="right">Bottom Right</option>
                    <option value="left">Bottom Left</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Header Logo */}
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <h3 className="text-base font-semibold text-gray-800">
                Header Logo
              </h3>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={settings.show_logo}
                  onChange={(e) =>
                    updateSetting("show_logo", e.target.checked)
                  }
                  className="h-4 w-4"
                />
                <span>Show logo in chat header</span>
              </label>

              <div className="space-y-1">
                <span className="block text-sm font-medium text-gray-700">
                  Logo URL
                </span>
                <input
                  type="text"
                  value={settings.logo_url}
                  onChange={(e) =>
                    updateSetting("logo_url", e.target.value)
                  }
                  disabled={!settings.show_logo}
                  placeholder="https://example.com/logo.png"
                  className={`w-full p-2 border-2 rounded-lg text-sm focus:outline-none ${
                    settings.show_logo
                      ? "border-gray-200 focus:border-blue-500"
                      : "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed"
                  }`}
                />
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-base mt-6"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  Saving...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Changes
                </span>
              )}
            </button>
          </div>

          {/* Right: Live Preview */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 lg:p-8 lg:sticky lg:top-8">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Live Preview
              </h2>
              <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">Real-time</span>
            </div>

            <div className="bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 rounded-xl p-4 sm:p-6 flex items-center justify-center min-h-[650px] relative border-2 border-dashed border-gray-300">
              {/* Chatbot Widget Preview */}
              <div className="w-full max-w-[400px] rounded-2xl shadow-2xl overflow-hidden bg-white flex flex-col border-4 border-gray-800" style={{ height: '600px' }}>
                {/* Header */}
                <div
                  className="px-5 py-4 flex items-center justify-between text-white shadow-lg"
                  style={{ backgroundColor: settings.primary_color }}
                >
                  <div className="flex items-center gap-3">
                    {settings.show_logo && settings.logo_url && (
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden shadow-lg ring-2 ring-white/20">
                        <img
                          src={settings.logo_url}
                          alt="Logo"
                          className="w-10 h-10 object-contain"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-base">
                        {settings.header_title}
                      </h3>
                    </div>
                  </div>
                  <button className="text-white/80 hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Chat area */}
                <div className="flex-1 px-5 py-5 bg-gradient-to-b from-gray-50 via-white to-gray-50 overflow-y-auto" style={{ maxHeight: '420px' }}>
                  {/* Welcome message bubble */}
                  <div className="flex items-start gap-3 mb-4">
                    
                    <div className="bg-white rounded-2xl rounded-tl-none shadow-md px-4 py-3 max-w-[85%] border border-gray-100">
                      <p className="text-sm text-gray-800 leading-relaxed">
                        {settings.welcome_message}
                      </p>
                      <p className="mt-2 text-xs text-gray-400 text-right">
                        5:48 PM
                      </p>
                    </div>
                  </div>

                  {/* Quick action buttons */}
                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    {settings.conversation_starters.map((starter, idx) => (
                      <button
                        key={idx}
                        className="text-xs font-semibold rounded-xl px-4 py-2.5 border-2 bg-white flex items-center justify-center shadow-sm hover:shadow-md transition-all hover:scale-105"
                        style={{
                          borderColor: settings.primary_color,
                          color: settings.primary_color,
                        }}
                      >
                        {starter}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input area */}
                <div className="px-5 py-4 border-t border-gray-200 bg-white">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-full border-2 border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-500 focus-within:border-indigo-400 focus-within:bg-white transition-colors">
                      Type your message...
                    </div>
                    <button
                      className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-lg hover:shadow-xl transition-all hover:scale-110"
                      style={{ backgroundColor: settings.primary_color }}
                      disabled
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Floating chat button preview */}
              <button
                className="absolute w-14 h-14 flex items-center justify-center shadow-2xl text-xl hover:scale-110 transition-transform z-10"
                style={{
                  ...previewButtonStyle(),
                  ...previewButtonPositionStyle(),
                }}
              >
                💬
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}