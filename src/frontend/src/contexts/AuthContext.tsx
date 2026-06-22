import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import authService from '../services/authService';

type User = {
  id: number;
  email: string;
  username?: string;
  fullName: string;
  avatar?: string;
  role: 'user' | 'admin';
  status: 'active' | 'banned';
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const bootstrap = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const isAdmin = localStorage.getItem('isAdmin') === 'true';
        if (isAdmin) {
          const me = await authService.adminMe();
          setUser(me.data.admin);
        } else {
          const me = await authService.me();
          setUser(me.data.user);
        }
      } catch (error: any) {
        // Nếu token không hợp lệ hoặc đã hết hạn, xóa token và không log error
        if (error?.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('isAdmin');
          setToken(null);
          setUser(null);
        }
        // Không log error để tránh spam console
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, [token]);

  const login = async (emailOrUsername: string, password: string) => {
    setLoading(true);
    try {
      let res;
      // Auto-detect: if no @, try admin login first, otherwise user login
      if (!emailOrUsername.includes('@')) {
        // Try admin login with username
        try {
          res = await authService.adminLogin({ username: emailOrUsername, password });
          const t = res.data.token as string;
          setToken(t);
          localStorage.setItem('token', t);
          localStorage.setItem('isAdmin', 'true');
          setUser(res.data.admin || res.data.user);
          return;
        } catch (adminError) {
          // If admin login fails, throw error
          throw adminError;
        }
      } else {
        // Try user login with email
        res = await authService.login({ email: emailOrUsername, password });
        const t = res.data.token as string;
        setToken(t);
        localStorage.setItem('token', t);
        localStorage.removeItem('isAdmin');
        setUser(res.data.user);
      }
    } finally {
      setLoading(false);
    }
  };

  const register = async (fullName: string, email: string, password: string) => {
    setLoading(true);
    try {
      const res = await authService.register({ fullName, email, password });
      const t = res.data.token as string;
      setToken(t);
      localStorage.setItem('token', t);
      setUser(res.data.user);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('isAdmin');
  };

  const value = useMemo(() => ({ user, token, loading, login, register, logout }), [user, token, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
