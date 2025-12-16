// API Base URL - update with your backend URL
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

console.log('🔍 API_URL:', API_URL);
console.log('🔍 All env vars:', import.meta.env);

// Helper function to make authenticated API calls
export async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem('quell_token');
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);
    
    // Handle 401 Unauthorized - token expired or invalid
    if (response.status === 401) {
      console.warn('⚠️ Unauthorized - clearing session');
      logout();
      window.location.href = '/login';
      throw new Error('Session expired. Please login again.');
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || data.error || 'Request failed');
    }
    
    return data;
    
  } catch (error) {
    console.error('❌ API Error:', error.message);
    throw error;
  }
}

// Auth helpers
export function isAuthenticated() {
  return !!localStorage.getItem('quell_token');
}

export function logout() {
  localStorage.removeItem('quell_token');
  localStorage.removeItem('quell_user');
}

export default apiCall;
