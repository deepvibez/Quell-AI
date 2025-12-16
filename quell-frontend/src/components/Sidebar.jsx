import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  MdDashboard,
  MdIntegrationInstructions,
  MdInbox,
  MdPeople,
  MdAnalytics,
  MdSettings,
  MdMenu,
  MdChevronLeft
} from 'react-icons/md';
import { FaUserCircle } from 'react-icons/fa';
import { apiCall } from '../config/api';

const Sidebar = ({ isOpen, onClose, isCollapsed, setIsCollapsed }) => {
  const [user, setUser] = useState(null);
  const location = useLocation();
  
  const [internalCollapsed, setInternalCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    return saved ? JSON.parse(saved) : false;
  });
  
  const collapsed = isCollapsed !== undefined ? isCollapsed : internalCollapsed;
  
  const handleToggleCollapse = () => {
    const newState = !collapsed;
    if (setIsCollapsed) {
      setIsCollapsed(newState);
    } else {
      setInternalCollapsed(newState);
    }
    localStorage.setItem('sidebar_collapsed', JSON.stringify(newState));
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('quell_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const data = await apiCall('/api/auth/me');
      setUser(data.user);
      localStorage.setItem('quell_user', JSON.stringify(data.user));
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    }
  };

  const menuItems = [
    { icon: MdDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: MdIntegrationInstructions, label: 'Integration', path: '/integration' },
    { icon: MdInbox, label: 'Inbox', path: '/inbox' },
    { icon: MdPeople, label: 'Tickets', path: '/customers' },
    { icon: MdAnalytics, label: 'Analytics', path: '/analytics' },
    { icon: MdSettings, label: 'Settings', path: '/settings' }
  ];

  return (
    <>
      <aside 
        className={`${
          collapsed ? 'w-20' : 'w-64'
        } h-screen bg-gray-900 text-white transition-all duration-300 flex flex-col fixed left-0 top-0 shadow-xl z-40 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div 
          className={`transition-all duration-300 overflow-hidden ${
            collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
          }`}
        >
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent whitespace-nowrap">
            Quell AI
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-800 transition-colors"
              title="Close menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <button
            onClick={handleToggleCollapse}
            className="hidden lg:block p-2 rounded-lg hover:bg-gray-800 transition-colors"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <MdMenu size={24} /> : <MdChevronLeft size={24} />}
          </button>
        </div>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto scrollbar-hide">
        <style jsx>{`
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>
        
        <ul className="space-y-2 px-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 relative group ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                  title={collapsed ? item.label : ''}
                >
                  <Icon size={24} className="min-w-[24px]" />
                  
                  {!collapsed && (
                    <>
                      <span className="font-medium">{item.label}</span>
                      {item.badge && (
                        <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}

                  {collapsed && (
                    <div className="absolute left-full ml-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                      {item.label}
                      {item.badge && (
                        <span className="ml-2 bg-red-500 px-2 py-0.5 rounded-full text-xs">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-gray-700 p-4">
        <Link
          to="/profile"
          className="flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-gray-800 transition-colors group relative"
          title={collapsed ? 'Profile' : ''}
        >
          <FaUserCircle size={32} className="text-gray-400 min-w-[32px]" />
          
          {!collapsed && user && (
            <div className="flex-1">
              <p className="font-medium text-sm">{user.name}</p>
              <p className="text-xs text-gray-400">{user.email}</p>
            </div>
          )}

          {collapsed && (
            <div className="absolute left-full ml-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
              Profile
            </div>
          )}
        </Link>
      </div>
    </aside>
    </>
  );
};

export default Sidebar;
