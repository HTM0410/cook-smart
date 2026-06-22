// API Configuration
// In production, use VITE_API_URL or Render URL
// In development, use VITE_API_URL or fallback to localhost:3000

import axios from 'axios';

const getApiBaseUrl = (): string => {
  // In production, use VITE_API_URL or Render backend URL
  if (import.meta.env.PROD) {
    return (import.meta.env.VITE_API_URL as string) || 'https://food-suggest-s5lf.onrender.com';
  }
  
  // In development, use VITE_API_URL or localhost:3000
  return (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';
};

// Full API base path (includes /api prefix used by backend)
export const API_BASE_URL = `${getApiBaseUrl()}/api`;

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
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// Socket.IO URL - Render supports WebSocket, so enable in production
export const SOCKET_URL = import.meta.env.PROD
  ? ((import.meta.env.VITE_API_URL as string) || 'https://food-suggest-s5lf.onrender.com')
  : ((import.meta.env.VITE_API_URL as string) || 'http://localhost:3000');
