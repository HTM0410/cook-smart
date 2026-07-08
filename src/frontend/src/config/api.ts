// API Configuration
// Production: require VITE_API_URL to avoid accidental legacy fallbacks.
// Development: use VITE_API_URL or fallback to localhost.

import axios from 'axios';

const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (!envUrl) {
    throw new Error('Missing VITE_API_URL');
  }

  if (import.meta.env.PROD) {
    return envUrl;
  }

  return envUrl || 'http://localhost:3000';
};

// API base URL used by services (do NOT append /api here; services already use /api/... paths)
export const API_BASE_URL = getApiBaseUrl();

// Axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const reqUrl = error.config?.url || '';
      // Never trigger global redirect for the login/register endpoints themselves
      const isAuthEndpoint = reqUrl.includes('/auth/login') || reqUrl.includes('/auth/register') || reqUrl.includes('/auth/refresh-token');
      if (!isAuthEndpoint) {
        // Clear stale token
        localStorage.removeItem('token');
        localStorage.removeItem('isAdmin');
        window.dispatchEvent(new Event('auth:unauthorized'));
        // Only force redirect to /login if user is currently on a protected route
        // Avoid forcing login when user is just exploring (e.g. opening chatbot while logged out)
        const currentPath = window.location.pathname;
        const isChatEndpoint = reqUrl.includes('/chat/');
        const isPublicRoute = currentPath === '/' || currentPath.startsWith('/recipes') || currentPath.startsWith('/chat');
        // Don't redirect if user is already on an auth page
        const isAuthPage = currentPath === '/login' || currentPath === '/register';
        if (!isChatEndpoint && !isPublicRoute && !isAuthPage) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Socket.IO URL
export const SOCKET_URL = import.meta.env.VITE_WS_URL || API_BASE_URL;
