import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import AdminLayout from '../components/templates/AdminLayout';
import adminService from '../services/adminService';
import { EyebrowTag } from '../components/atoms/EyebrowTag';
import { splitRevealLeft, splitRevealRight, cardReveal, staggerGrid, easeFluid } from '../lib/motion';
import {
  Loader2,
  Users,
  ChefHat,
  Carrot,
  MessageSquare,
  UserCheck,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  FileText,
  Star,
} from 'lucide-react';

interface DashboardStats {
  overview: {
    totalUsers: number;
    totalRecipes: number;
    totalIngredients: number;
    totalComments: number;
    activeUsers: number;
    hiddenRecipes: number;
  };
  recentActivities: {
    users: any[];
    recipes: any[];
  };
  popularRecipes: any[];
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminService.getDashboardStats();
      setStats(response.data);
    } catch (err: any) {
      console.error('Error fetching dashboard stats:', err);
      setError(err.response?.data?.message || 'Không thể tải dữ liệu dashboard');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) return '0';
    return num.toLocaleString('vi-VN');
  };

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (seconds < 60) return 'vài giây trước';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} ngày trước`;
    if (seconds < 2592000) return `${Math.floor(seconds / 604800)} tuần trước`;
    return `${Math.floor(seconds / 2592000)} tháng trước`;
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center space-y-3">
            <Loader2 className="w-10 h-10 animate-spin text-[#ff4f00] mx-auto" strokeWidth={1.5} />
            <p className="text-sm uppercase tracking-[0.2em] text-ink-secondary">Đang tải dữ liệu...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-[#FDEBEC] dark:bg-[#9F2F2D]/15 rounded-full ring-1 ring-[#9F2F2D]/30 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <p className="text-[#9F2F2D] mb-4 font-medium">{error}</p>
            <button onClick={fetchDashboardData} className="btn-editorial-primary">
              Thử lại
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!stats) return null;

  const statsCards = [
    {
      label: 'Tổng người dùng',
      value: formatNumber(stats.overview.totalUsers),
      icon: Users,
      trend: '+12%',
      trendUp: true,
    },
    {
      label: 'Tổng công thức',
      value: formatNumber(stats.overview.totalRecipes),
      icon: ChefHat,
      trend: '+8%',
      trendUp: true,
    },
    {
      label: 'Nguyên liệu',
      value: formatNumber(stats.overview.totalIngredients),
      icon: Carrot,
      trend: '+5%',
      trendUp: true,
    },
    {
      label: 'Bình luận',
      value: formatNumber(stats.overview.totalComments),
      icon: MessageSquare,
      trend: '+23%',
      trendUp: true,
    },
  ];

  const quickStats = [
    {
      label: 'Người dùng hoạt động',
      value: formatNumber(stats.overview.activeUsers),
      icon: UserCheck,
      accent: 'bg-[#EDF3EC] text-[#346538]',
    },
    {
      label: 'Công thức ẩn',
      value: formatNumber(stats.overview.hiddenRecipes),
      icon: Clock,
      accent: 'bg-[#FBF3DB] text-[#956400]',
    },
    {
      label: 'Tỷ lệ hoạt động',
      value: stats.overview.totalUsers > 0
        ? `${Math.round((stats.overview.activeUsers / stats.overview.totalUsers) * 100)}%`
        : '0%',
      icon: Activity,
      accent: 'bg-[#fff4ed] text-[#ff4f00]',
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-7xl">
        {/* Editorial Header */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <motion.div initial="hidden" animate="visible" variants={splitRevealLeft} className="lg:col-span-7">
            <EyebrowTag>Bảng điều khiển</EyebrowTag>
            <h1 className="mt-4 text-display text-4xl md:text-5xl text-ink-primary dark:text-paper-light text-balance">
              Tổng quan <span className="text-[#ff4f00]">hệ thống.</span>
            </h1>
            <p className="mt-4 text-ink-secondary text-pretty">
              Chào mừng đến với bảng điều khiển quản trị CookSmart.
            </p>
          </motion.div>

          <motion.div initial="hidden" animate="visible" variants={splitRevealRight} className="lg:col-span-5 lg:pb-2">
            <div className="flex items-center gap-3 flex-wrap lg:justify-end">
              <span className="chip chip-active">
                <span className="w-1.5 h-1.5 bg-[#346538] rounded-full animate-pulse" />
                Hệ thống hoạt động
              </span>
            </div>
          </motion.div>
        </div>

        {/* Stats Grid - Bento */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerGrid}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5"
        >
          {statsCards.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <motion.div key={index} custom={index} variants={cardReveal}>
                <div className="card-bezel h-full">
                  <div className="card-bezel-inner p-6">
                    <div className="flex items-start justify-between mb-6">
                      <div className="w-11 h-11 rounded-full bg-[#ff4f00]/10 ring-1 ring-[#ff4f00]/20 flex items-center justify-center">
                        <IconComponent className="h-5 w-5 text-[#ff4f00]" strokeWidth={1.5} />
                      </div>
                      {stat.trendUp ? (
                        <div className="flex items-center gap-1 text-[#346538]">
                          <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.5} />
                          <span className="text-xs font-semibold uppercase tracking-[0.15em]">{stat.trend}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[#9F2F2D]">
                          <TrendingDown className="h-3.5 w-3.5" strokeWidth={1.5} />
                          <span className="text-xs font-semibold uppercase tracking-[0.15em]">{stat.trend}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs uppercase tracking-[0.2em] text-ink-secondary font-semibold">
                      {stat.label}
                    </p>
                    <p className="text-display text-4xl text-ink-primary dark:text-paper-light mt-2">
                      {stat.value}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Recent Users */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: easeFluid, delay: 0.2 }}
            className="lg:col-span-2 card-bezel"
          >
            <div className="card-bezel-inner p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-display text-xl text-ink-primary dark:text-paper-light flex items-center gap-2.5">
                  <Users className="h-4 w-4 text-[#ff4f00]" strokeWidth={1.5} />
                  Người dùng mới
                </h2>
                <span className="text-xs uppercase tracking-[0.2em] text-ink-muted">
                  {stats.recentActivities.users.length} người dùng
                </span>
              </div>
              <div className="space-y-2">
                {stats.recentActivities.users.length > 0 ? (
                  stats.recentActivities.users.slice(0, 5).map((user: any, idx: number) => (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, ease: easeFluid, delay: idx * 0.05 }}
                      className="flex items-center gap-4 p-3 rounded-2xl ring-1 ring-transparent hover:ring-ink-200/40 dark:hover:ring-ink-700/40 hover:bg-paper-light dark:hover:bg-ink-700/30 transition-all duration-500 ease-[var(--ease-fluid)]"
                    >
                      <div className="w-11 h-11 rounded-full bg-ink-700 dark:bg-paper-light flex items-center justify-center flex-shrink-0 ring-1 ring-ink-700 dark:ring-paper-light">
                        <span className="text-paper-light dark:text-ink-700 font-semibold text-sm">
                          {user.fullName?.charAt(0)?.toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ink-primary dark:text-paper-light truncate">
                          {user.fullName || 'Người dùng'}
                        </p>
                        <p className="text-xs text-ink-muted truncate mt-0.5">
                          {user.email}
                        </p>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-ink-muted mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" strokeWidth={1.5} />
                          <span>{getTimeAgo(user.createdAt)}</span>
                        </p>
                      </div>
                      <span className={`eyebrow-tag text-[10px] flex-shrink-0 ${
                        user.status === 'active'
                          ? 'bg-[#EDF3EC] text-[#346538]'
                          : 'bg-[#FDEBEC] text-[#9F2F2D]'
                      }`}>
                        {user.status === 'active' ? 'Hoạt động' : 'Bị khóa'}
                      </span>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <Users className="h-10 w-10 text-ink-muted mx-auto mb-3" strokeWidth={1} />
                    <p className="text-sm text-ink-secondary">Chưa có người dùng mới</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: easeFluid, delay: 0.3 }}
            className="card-bezel"
          >
            <div className="card-bezel-inner p-6">
              <h2 className="text-display text-xl text-ink-primary dark:text-paper-light mb-6 flex items-center gap-2.5">
                <Activity className="h-4 w-4 text-[#ff4f00]" strokeWidth={1.5} />
                Thống kê nhanh
              </h2>
              <div className="space-y-3">
                {quickStats.map((stat, index) => {
                  const IconComponent = stat.icon;
                  return (
                    <div
                      key={index}
                      className="p-4 rounded-2xl ring-1 ring-ink-200/40 dark:ring-ink-700/40 hover:ring-[#ff4f00]/30 transition-all duration-500 ease-[var(--ease-fluid)]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-full ${stat.accent} flex items-center justify-center flex-shrink-0`}>
                            <IconComponent className="h-4 w-4" strokeWidth={1.5} />
                          </div>
                          <span className="text-sm font-medium text-ink-secondary truncate">
                            {stat.label}
                          </span>
                        </div>
                        <span className="text-display text-lg text-ink-primary dark:text-paper-light">
                          {stat.value}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Recent Recipes & Popular Recipes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: easeFluid, delay: 0.4 }}
            className="card-bezel"
          >
            <div className="card-bezel-inner p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-display text-xl text-ink-primary dark:text-paper-light flex items-center gap-2.5">
                  <FileText className="h-4 w-4 text-[#ff4f00]" strokeWidth={1.5} />
                  Công thức mới nhất
                </h2>
                <span className="text-xs uppercase tracking-[0.2em] text-ink-muted">
                  {stats.recentActivities.recipes.length} công thức
                </span>
              </div>
              <div className="space-y-2">
                {stats.recentActivities.recipes.length > 0 ? (
                  stats.recentActivities.recipes.slice(0, 5).map((recipe: any, idx: number) => (
                    <motion.div
                      key={recipe.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, ease: easeFluid, delay: idx * 0.05 }}
                      className="flex items-center gap-4 p-3 rounded-2xl ring-1 ring-transparent hover:ring-ink-200/40 dark:hover:ring-ink-700/40 hover:bg-paper-light dark:hover:bg-ink-700/30 transition-all duration-500 ease-[var(--ease-fluid)]"
                    >
                      <div className="w-11 h-11 rounded-full bg-[#346538]/15 ring-1 ring-[#346538]/30 flex items-center justify-center flex-shrink-0">
                        <ChefHat className="h-5 w-5 text-[#346538]" strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-ink-primary dark:text-paper-light truncate mb-1">
                          {recipe.recipeName}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1 text-[10px] uppercase tracking-[0.15em] text-ink-muted">
                            <Clock className="h-3 w-3" strokeWidth={1.5} />
                            <span>{getTimeAgo(recipe.createdAt)}</span>
                          </span>
                          <span className={`eyebrow-tag text-[10px] ${
                            recipe.status === 'visible'
                              ? 'bg-[#EDF3EC] text-[#346538]'
                              : recipe.status === 'pending'
                              ? 'bg-[#FBF3DB] text-[#956400]'
                              : 'bg-paper-light text-ink-secondary'
                          }`}>
                            {recipe.status === 'visible' ? 'Hiển thị' : recipe.status === 'pending' ? 'Chờ duyệt' : 'Ẩn'}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <ChefHat className="h-10 w-10 text-ink-muted mx-auto mb-3" strokeWidth={1} />
                    <p className="text-sm text-ink-secondary">Chưa có công thức nào</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: easeFluid, delay: 0.5 }}
            className="card-bezel"
          >
            <div className="card-bezel-inner p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-display text-xl text-ink-primary dark:text-paper-light flex items-center gap-2.5">
                  <Star className="h-4 w-4 text-[#ff4f00]" strokeWidth={1.5} />
                  Công thức phổ biến
                </h2>
              </div>
              <div className="space-y-2">
                {stats.popularRecipes && stats.popularRecipes.length > 0 ? (
                  stats.popularRecipes.slice(0, 5).map((recipe: any, index: number) => (
                    <motion.div
                      key={recipe.id || index}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, ease: easeFluid, delay: index * 0.05 }}
                      className="flex items-center gap-4 p-3 rounded-2xl ring-1 ring-transparent hover:ring-ink-200/40 dark:hover:ring-ink-700/40 hover:bg-paper-light dark:hover:bg-ink-700/30 transition-all duration-500 ease-[var(--ease-fluid)]"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#ff4f00] flex items-center justify-center flex-shrink-0 font-semibold text-white text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-ink-primary dark:text-paper-light truncate mb-1">
                          {recipe.recipeName || 'Công thức'}
                        </h3>
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-ink-muted">
                          <Star className="h-3 w-3 text-[#ff4f00] fill-[#ff4f00]" />
                          <span>{recipe.averageRating?.toFixed(1) || '0.0'}</span>
                          <span className="text-ink-muted">·</span>
                          <span>{recipe.ratingCount || 0} đánh giá</span>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <Star className="h-10 w-10 text-ink-muted mx-auto mb-3" strokeWidth={1} />
                    <p className="text-sm text-ink-secondary">Chưa có công thức phổ biến</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;