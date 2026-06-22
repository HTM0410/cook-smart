import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const profileService = {
  async getProfile(userId: string | number) {
    const res = await api.get(`/api/profile/${userId}`);
    return res.data;
  },

  async getCurrentUserProfile() {
    const res = await api.get('/api/profile/me');
    return res.data;
  },

  async getFavorites(userId: string | number, params?: { page?: number; limit?: number }) {
    const res = await api.get(`/api/profile/${userId}/favorites`, { params });
    return res.data;
  },

  async getActivity(userId: string | number, params?: { page?: number; limit?: number }) {
    const res = await api.get(`/api/profile/${userId}/activity`, { params });
    return res.data;
  },

  async getReviews(userId: string | number, params?: { page?: number; limit?: number }) {
    const res = await api.get(`/api/profile/${userId}/reviews`, { params });
    return res.data;
  },

  async updateProfile(data: { fullName?: string; avatar?: string }) {
    const res = await api.put('/api/profile/me', data);
    return res.data;
  },

  async changePassword(data: { currentPassword: string; newPassword: string }) {
    const res = await api.put('/api/profile/password', data);
    return res.data;
  },
};

export default profileService;
