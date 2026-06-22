import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors globally - don't log if it's auth/me endpoint
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't log 401 errors for auth/me endpoint (expected when not logged in)
    if (error?.response?.status === 401 && error?.config?.url?.includes('/api/auth/me')) {
      // Silently handle - token might be expired or invalid
      return Promise.reject(error);
    }
    return Promise.reject(error);
  }
);

export const authService = {
  async register(payload: { email: string; password: string; fullName: string }) {
    const res = await api.post('/api/auth/register', payload);
    return res.data;
  },
  async login(payload: { email: string; password: string }) {
    const res = await api.post('/api/auth/login', payload);
    return res.data;
  },
  async adminLogin(payload: { username: string; password: string }) {
    const res = await api.post('/api/auth/admin/login', payload);
    return res.data;
  },
  async me() {
    const res = await api.get('/api/auth/me');
    return res.data;
  },
  async adminMe() {
    const res = await api.get('/api/auth/admin/me');
    return res.data;
  },
  async refresh(refreshToken: string) {
    const res = await api.post('/api/auth/refresh-token', { refreshToken });
    return res.data;
  },
  async changePassword(payload: { currentPassword: string; newPassword: string; confirmPassword: string }) {
    const res = await api.put('/api/auth/change-password', payload);
    return res.data;
  },
  async logout() {
    const res = await api.post('/api/auth/logout');
    return res.data;
  },
};

export default authService;
