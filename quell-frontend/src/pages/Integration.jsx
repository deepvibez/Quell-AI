import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppearancePage from './AppearancePage'; 
import { apiCall } from '../config/api';
import { 
  FaShopify, 
  FaWordpress, 
  FaCode, 
  FaComments, 
  FaPalette,
  FaEnvelope,
  FaFacebook,
  FaInstagram,
  FaWhatsapp,
  FaCopy,
  FaCheckCircle,
  FaExclamationCircle,
  FaShoppingCart,
  FaStore,
  FaChevronRight,
  FaChevronDown,
  FaArrowLeft,
  FaUser,
  FaExternalLinkAlt
} from 'react-icons/fa';
import { SiWoocommerce, SiPrestashop } from 'react-icons/si';

const Integration = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState(
    searchParams.get('section') || 'installation'
  );
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isInstalled, setIsInstalled] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [liveChatExpanded, setLiveChatExpanded] = useState(true);

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    const section = searchParams.get('section');
    if (section) {
      setActiveSection(section);
      if (section === 'appearance' || section === 'installation') {
        setLiveChatExpanded(true);
      }
    }
  }, [searchParams]);

  // Normalize token property names (widget_token | widgetToken | token)
  const getStoreToken = (store) => {
    if (!store || typeof store !== 'object') return '';
    return store.widget_token || store.widgetToken || store.token || '';
  };

  const fetchStores = async () => {
    try {
      setLoading(true);
      // <-- changed: call /api/stores which returns { stores: [...] }
      const data = await apiCall('/api/stores');
      // debug log (remove in production if desired)
      console.log('fetchStores response:', data);
      setStores(data.stores || []);
      setIsInstalled(!!(data.stores && data.stores.length));
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch stores:', error);
      setLoading(false);
    }
  };

  const handleSectionChange = (section) => {
    setActiveSection(section);
    setSearchParams({ section });
    setSelectedPlatform(null);
  };

  const copyToClipboard = (text, id) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error('copy failed', e);
    }
  };

  const channels = [
    { id: 'email', icon: FaEnvelope, label: 'Email', parent: null },
    { id: 'facebook', icon: FaFacebook, label: 'Facebook', parent: null },
    { id: 'instagram', icon: FaInstagram, label: 'Instagram', parent: null },
    { id: 'whatsapp', icon: FaWhatsapp, label: 'WhatsApp', parent: null },
  ];

  const liveChatSubItems = [
    { id: 'appearance', icon: FaPalette, label: 'Appearance' },
    { id: 'installation', icon: FaCode, label: 'Installation', badge: !isInstalled },
  ];

  const platforms = [
    { 
      id: 'manual',
      name: 'Manual install', 
      icon: FaCode, 
      color: '#6B7280',
      bgGradient: 'from-slate-50 to-slate-100',
      description: 'Custom HTML/JavaScript installation',
      isNative: false
    },
    { 
      id: 'shopify', 
      name: 'Shopify', 
      icon: FaShopify, 
      color: '#96BF48',
      bgGradient: 'from-green-50 to-green-100',
      description: 'Install directly from Shopify App Store',
      isNative: true
    },
  ];

  const [widgetSettings, setWidgetSettings] = useState({
    primaryColor: '#4F46E5',
    position: 'bottom-right',
    size: 'medium',
    welcomeMessage: 'Hi! How can we help you today?',
    showAvatar: true,
    borderRadius: '16',
    bubbleStyle: 'modern'
  });

  // returns embed code using the store's widget_token (normalized)
  const getEmbedCode = (store) => {
    const host = import.meta.env.VITE_WIDGET_HOST || 'https://quellai2.netlify.app';
    const token = getStoreToken(store) || 'YOUR_WIDGET_TOKEN';
    return `<script src="${host}/widget.js/${token}" async></script>`;
  };

  const renderInstallationContent = () => {
    if (selectedPlatform) {
      const platform = platforms.find(p => p.id === selectedPlatform);
      const Icon = platform.icon;

      if (platform.id === 'shopify' && stores.length > 0) {
        return (
          <div className="animate-fadeIn">
            <div className={`bg-gradient-to-br ${platform.bgGradient} rounded-2xl p-6 mb-6 shadow-sm border border-gray-200`}>
              <div className="flex items-center gap-4">
                <div className="p-4 bg-white rounded-xl shadow-sm">
                  <Icon size={40} style={{ color: platform.color }} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">{platform.name}</h2>
                  <p className="text-gray-600">Your connected stores</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 rounded-xl p-5 mb-6 flex items-start gap-4 shadow-sm">
              <div className="bg-green-500 p-2.5 rounded-lg">
                <FaCheckCircle className="text-white text-xl" />
              </div>
              <div>
                <p className="text-green-800 font-semibold text-lg">Installation Complete!</p>
                <p className="text-green-700">The chatbot is active and running on your Shopify stores</p>
              </div>
            </div>

            <div className="space-y-4">
              {stores.map((store, index) => (
                <div key={index} className="bg-white border border-gray-200 hover:border-blue-300 rounded-xl p-6 transition-all hover:shadow-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg text-gray-800 mb-3">{store.shop_domain}</h3>
                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-500">Store ID:</span>
                          <span className="font-mono bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">{store.store_id}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-green-600 font-medium">Active</span>
                          </span>
                          <span className="text-gray-400">•</span>
                          <span><strong className="text-gray-800">{store.product_count || 0}</strong> products synced</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-green-50 border border-green-200 px-4 py-2 rounded-lg">
                      <span className="text-green-700 font-semibold text-sm">Connected</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      // Manual Install or other platforms - Step by step guide
      const store = stores.length > 0 ? stores[0] : null;
      const embedCode = getEmbedCode(store);
      const token = getStoreToken(store);

      return (
        <div className="animate-fadeIn">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Installation</h2>

            {!isInstalled && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                <FaExclamationCircle className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-800 text-sm font-medium">
                  The chat code is not installed properly
                </p>
              </div>
            )}

            <div className="mb-8">
              <div className="flex items-start gap-3 mb-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Paste this code snippet just before the &lt;/body&gt; tag
                  </h3>

                  <div className="bg-white border border-gray-200 rounded-lg p-5">
                    <div className="mb-3">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Code snippet
                      </span>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-4">
                      <code className="text-sm text-gray-800 font-mono break-all">
                        {embedCode}
                      </code>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => copyToClipboard(embedCode, 'snippet')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                          copiedId === 'snippet'
                            ? 'bg-green-500 text-white'
                            : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'
                        }`}
                      >
                        <FaCopy size={14} />
                        {copiedId === 'snippet' ? 'Copied!' : 'Copy to clipboard'}
                      </button>

                      <button className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-white text-blue-600 hover:bg-blue-50 border border-blue-200 transition-all">
                        <FaEnvelope size={14} />
                        Send instructions via email
                      </button>
                    </div>

                    {/* Show token separately so seller can paste only token if they prefer */}
                    <div className="mt-4 border-t pt-4">
                      <p className="text-sm text-gray-600 mb-2">Or copy the widget token only (useful for CMS or tag managers)</p>
                      <div className="flex items-center gap-3">
                        <div className="font-mono bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">{token || 'Not generated yet'}</div>
                        <button
                          onClick={() => copyToClipboard(token, 'token')}
                          disabled={!token}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all ${
                            copiedId === 'token'
                              ? 'bg-green-500 text-white'
                              : token ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          <FaCopy size={14} />
                          {copiedId === 'token' ? 'Copied!' : 'Copy token'}
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Go to your website to check if Quell AI chat is there
                  </h3>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-600 pt-6 border-t border-gray-200">
              <span>Need more help?</span>
              <a href="#" className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1.5 transition-colors">
                Visit our Help Center
                <FaExternalLinkAlt size={12} />
              </a>
              <a href="#" className="text-blue-600 hover:text-blue-700 font-medium transition-colors">
                Chat with us
              </a>
            </div>
          </div>
      );
    }

    // Default view - platform selection
    return (
      <div className="animate-fadeIn">
        {!isInstalled && (
          <div className="bg-gradient-to-r from-red-50 to-rose-50 border-l-4 border-red-500 rounded-xl p-5 mb-8 flex items-start gap-4 shadow-sm">
            <div className="bg-red-500 p-2.5 rounded-lg">
              <FaExclamationCircle className="text-white text-xl" />
            </div>
            <div>
              <p className="text-red-800 font-semibold text-lg">The chat code is not installed properly</p>
              <p className="text-red-700">Choose a platform below to get your installation code and go live</p>
            </div>
          </div>
        )}
        
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Installation</h2>
          <p className="text-gray-600 text-lg leading-relaxed">
            It looks like you haven't installed the chatbot on your website yet. Choose your platform to get started.
          </p>
        </div>

        <div className="grid gap-3">
          {platforms.map((platform) => {
            const Icon = platform.icon;
            return (
              <button
                key={platform.id}
                onClick={() => setSelectedPlatform(platform.id)}
                className="group bg-white hover:bg-gray-50 border border-gray-200 hover:border-blue-400 hover:shadow-md rounded-xl p-5 flex items-center gap-5 transition-all duration-200"
              >
                <div 
                  className={`p-4 rounded-xl shadow-sm bg-gradient-to-br ${platform.bgGradient} border border-gray-100`}
                >
                  <Icon size={28} style={{ color: platform.color }} />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-bold text-base text-gray-800 group-hover:text-gray-900 mb-1">
                    {platform.name}
                  </h3>
                  <p className="text-sm text-gray-600">{platform.description}</p>
                </div>
                <FaChevronRight className="text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row h-auto lg:h-screen -m-8 bg-gray-50">
      <div className={`${selectedPlatform ? 'w-full lg:w-52' : 'w-full lg:w-60'} bg-white border-r border-gray-200 flex flex-col shadow-sm transition-all`}>
        <div className="p-5 flex-1 overflow-y-auto">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-2">
            CHANNELS
          </h3>
          <nav className="space-y-1">
            <div>
              <button
                onClick={() => setLiveChatExpanded(!liveChatExpanded)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all"
              >
                <FaComments size={16} className="text-gray-500" />
                <span className="flex-1 text-left">Live Chat</span>
                {liveChatExpanded ? (
                  <FaChevronDown size={14} className="text-gray-400" />
                ) : (
                  <FaChevronRight size={14} className="text-gray-400" />
                )}
              </button>
              
              {liveChatExpanded && (
                <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-2">
                  {liveChatSubItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSectionChange(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          activeSection === item.id
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <Icon size={16} />
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.badge && (
                          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {channels.map((channel) => {
              const Icon = channel.icon;
              return (
                <button
                  key={channel.id}
                  onClick={() => handleSectionChange(channel.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeSection === channel.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={16} />
                  <span className="flex-1 text-left">{channel.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-8">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-2">
              PERSONAL
            </h3>
            <nav className="space-y-1">
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all">
                <FaUser size={16} className="text-gray-500" />
                <span className="flex-1 text-left">My Profile</span>
              </button>
            </nav>
          </div>
        </div>
      </div>

      {selectedPlatform && (
        <div className="w-full lg:w-56 bg-gray-50 border-r border-gray-200 p-5 overflow-y-auto">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-4">
            Installation guides
          </h3>
          <div className="space-y-1">
            {platforms.map((platform) => {
              const Icon = platform.icon;
              const isSelected = selectedPlatform === platform.id;
              return (
                <button
                  key={platform.id}
                  onClick={() => setSelectedPlatform(platform.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-white hover:shadow-sm'
                  }`}
                >
                  <Icon size={18} style={{ color: platform.color }} />
                  <span className="flex-1 text-left">{platform.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-1 bg-white overflow-y-auto">
        {activeSection === 'installation' && (
          <div className="p-4 sm:p-6 md:p-8 lg:p-10">
            <div className="max-w-4xl mx-auto">
              {renderInstallationContent()}
            </div>
          </div>
        )}
        
        {activeSection === 'appearance' && (
          <AppearancePage />
        )}

        {activeSection === 'email' && (
          <div className="p-4 sm:p-6 md:p-8 lg:p-10 animate-fadeIn">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Email Integration</h2>
            <p className="text-gray-600 text-lg">Connect your email service to receive chat notifications.</p>
          </div>
        )}

        {activeSection === 'facebook' && (
          <div className="p-4 sm:p-6 md:p-8 lg:p-10 animate-fadeIn">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Facebook Messenger</h2>
            <p className="text-gray-600 text-lg">Integrate with Facebook Messenger to chat with customers.</p>
          </div>
        )}

        {activeSection === 'instagram' && (
          <div className="p-4 sm:p-6 md:p-8 lg:p-10 animate-fadeIn">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Instagram Direct</h2>
            <p className="text-gray-600 text-lg">Connect Instagram Direct messages to your dashboard.</p>
          </div>
        )}

        {activeSection === 'whatsapp' && (
          <div className="p-4 sm:p-6 md:p-8 lg:p-10 animate-fadeIn">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">WhatsApp Business</h2>
            <p className="text-gray-600 text-lg">Integrate WhatsApp Business API for customer support.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Integration;
