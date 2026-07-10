import React, { useEffect, useState } from 'react';
import AdminLayout from '../components/templates/AdminLayout';
import adminService from '../services/adminService';
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
        <div className="admin-loading">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--admin-accent)' }} strokeWidth={2} />
          <span>Đang tải dữ liệu...</span>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="admin-loading">
          <div className="admin-alert admin-alert-danger" style={{ maxWidth: 480 }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button
            onClick={fetchDashboardData}
            style={{
              padding: '8px 16px',
              background: 'var(--admin-accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--admin-radius-sm)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Thử lại
          </button>
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
      iconBg: 'rgba(59, 130, 246, 0.12)',
      iconColor: 'var(--admin-info)',
    },
    {
      label: 'Tổng công thức',
      value: formatNumber(stats.overview.totalRecipes),
      icon: ChefHat,
      trend: '+8%',
      trendUp: true,
      iconBg: 'rgba(249, 115, 22, 0.12)',
      iconColor: 'var(--admin-accent)',
    },
    {
      label: 'Nguyên liệu',
      value: formatNumber(stats.overview.totalIngredients),
      icon: Carrot,
      trend: '+5%',
      trendUp: true,
      iconBg: 'rgba(34, 197, 94, 0.12)',
      iconColor: 'var(--admin-success)',
    },
    {
      label: 'Bình luận',
      value: formatNumber(stats.overview.totalComments),
      icon: MessageSquare,
      trend: '+23%',
      trendUp: true,
      iconBg: 'rgba(168, 85, 247, 0.12)',
      iconColor: '#7C3AED',
    },
  ];

  const quickStats = [
    {
      label: 'Người dùng hoạt động',
      value: formatNumber(stats.overview.activeUsers),
      icon: UserCheck,
      badge: 'success' as const,
    },
    {
      label: 'Công thức ẩn',
      value: formatNumber(stats.overview.hiddenRecipes),
      icon: Clock,
      badge: 'warning' as const,
    },
    {
      label: 'Tỷ lệ hoạt động',
      value:
        stats.overview.totalUsers > 0
          ? `${Math.round((stats.overview.activeUsers / stats.overview.totalUsers) * 100)}%`
          : '0%',
      icon: Activity,
      badge: 'info' as const,
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl">
        {/* Page header */}
        <div className="admin-page-header">
          <h1 className="admin-page-title">Tổng quan hệ thống</h1>
          <p className="admin-page-subtitle">
            Chào mừng đến với bảng điều khiển quản trị CookSmart — theo dõi số liệu và hoạt động gần đây.
          </p>
          <div className="mt-2">
            <span className="admin-badge admin-badge-success">
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: 'var(--admin-success)' }}
              />
              Hệ thống hoạt động bình thường
            </span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statsCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="admin-stat">
                <div className="flex items-start justify-between gap-3">
                  <span className="admin-stat-label">{stat.label}</span>
                  <span className="admin-stat-icon" style={{ background: stat.iconBg, color: stat.iconColor, width: 36, height: 36 }}>
                    <Icon className="w-4 h-4" strokeWidth={2} />
                  </span>
                </div>
                <span className="admin-stat-value">{stat.value}</span>
                <div className="admin-stat-meta">
                  <span
                    className="inline-flex items-center gap-1 font-semibold text-xs"
                    style={{ color: stat.trendUp ? 'var(--admin-success)' : 'var(--admin-danger)' }}
                  >
                    {stat.trendUp ? (
                      <TrendingUp className="w-3.5 h-3.5" strokeWidth={2} />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5" strokeWidth={2} />
                    )}
                    {stat.trend}
                  </span>
                  <span style={{ color: 'var(--admin-text-muted)' }}>so với tháng trước</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent Users */}
          <div className="admin-card lg:col-span-2">
            <div className="admin-card-header">
              <h2 className="admin-card-title">
                <Users className="w-4 h-4" style={{ color: 'var(--admin-accent)' }} strokeWidth={2} />
                Người dùng mới
              </h2>
              <span className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
                {stats.recentActivities.users.length} người dùng
              </span>
            </div>
            <div className="admin-card-body">
              {stats.recentActivities.users.length > 0 ? (
                <ul className="space-y-1">
                  {stats.recentActivities.users.slice(0, 5).map((user: any) => (
                    <li
                      key={user.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors"
                      style={{ background: 'transparent' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--admin-surface-alt)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div className="admin-avatar admin-avatar-success">
                        {user.fullName?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--admin-text)' }}>
                          {user.fullName || 'Người dùng'}
                        </p>
                        <p className="text-xs truncate" style={{ color: 'var(--admin-text-muted)' }}>
                          {user.email}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span
                          className={`admin-badge ${
                            user.status === 'active' ? 'admin-badge-success' : 'admin-badge-danger'
                          }`}
                        >
                          {user.status === 'active' ? 'Hoạt động' : 'Bị khóa'}
                        </span>
                        <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--admin-text-muted)' }}>
                          <Clock className="w-3 h-3" strokeWidth={2} />
                          {getTimeAgo(user.createdAt)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="admin-empty">
                  <Users className="w-8 h-8" style={{ color: 'var(--admin-text-muted)' }} strokeWidth={1.5} />
                  <span>Chưa có người dùng mới</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="admin-card">
            <div className="admin-card-header">
              <h2 className="admin-card-title">
                <Activity className="w-4 h-4" style={{ color: 'var(--admin-accent)' }} strokeWidth={2} />
                Thống kê nhanh
              </h2>
            </div>
            <div className="admin-card-body space-y-2">
              {quickStats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-md border"
                    style={{ borderColor: 'var(--admin-border)' }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`admin-avatar ${
                          stat.badge === 'success'
                            ? 'admin-avatar-success'
                            : stat.badge === 'warning'
                            ? 'admin-avatar-warning'
                            : ''
                        }`}
                        style={{
                          background:
                            stat.badge === 'info'
                              ? 'var(--admin-info-bg)'
                              : stat.badge === 'success'
                              ? 'var(--admin-success-bg)'
                              : 'var(--admin-warning-bg)',
                          color:
                            stat.badge === 'info'
                              ? 'var(--admin-info)'
                              : stat.badge === 'success'
                              ? 'var(--admin-success)'
                              : 'var(--admin-warning)',
                          width: 32,
                          height: 32,
                        }}
                      >
                        <Icon className="w-4 h-4" strokeWidth={2} />
                      </span>
                      <span className="text-sm font-medium" style={{ color: 'var(--admin-text-secondary)' }}>
                        {stat.label}
                      </span>
                    </div>
                    <span className="text-base font-bold tabular-nums" style={{ color: 'var(--admin-text)' }}>
                      {stat.value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent Recipes & Popular Recipes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="admin-card">
            <div className="admin-card-header">
              <h2 className="admin-card-title">
                <FileText className="w-4 h-4" style={{ color: 'var(--admin-accent)' }} strokeWidth={2} />
                Công thức mới nhất
              </h2>
              <span className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
                {stats.recentActivities.recipes.length} công thức
              </span>
            </div>
            <div className="admin-card-body">
              {stats.recentActivities.recipes.length > 0 ? (
                <ul className="space-y-1">
                  {stats.recentActivities.recipes.slice(0, 5).map((recipe: any) => (
                    <li
                      key={recipe.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors"
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--admin-surface-alt)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div className="admin-avatar" style={{ background: 'rgba(249, 115, 22, 0.12)', color: 'var(--admin-accent)' }}>
                        <ChefHat className="w-4 h-4" strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--admin-text)' }}>
                          {recipe.recipeName}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--admin-text-muted)' }}>
                            <Clock className="w-3 h-3" strokeWidth={2} />
                            {getTimeAgo(recipe.createdAt)}
                          </span>
                          <span
                            className={`admin-badge ${
                              recipe.status === 'visible'
                                ? 'admin-badge-success'
                                : recipe.status === 'pending'
                                ? 'admin-badge-warning'
                                : 'admin-badge-neutral'
                            }`}
                          >
                            {recipe.status === 'visible'
                              ? 'Hiển thị'
                              : recipe.status === 'pending'
                              ? 'Chờ duyệt'
                              : 'Ẩn'}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="admin-empty">
                  <ChefHat className="w-8 h-8" style={{ color: 'var(--admin-text-muted)' }} strokeWidth={1.5} />
                  <span>Chưa có công thức nào</span>
                </div>
              )}
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-header">
              <h2 className="admin-card-title">
                <Star className="w-4 h-4" style={{ color: 'var(--admin-accent)' }} strokeWidth={2} />
                Công thức phổ biến
              </h2>
            </div>
            <div className="admin-card-body">
              {stats.popularRecipes && stats.popularRecipes.length > 0 ? (
                <ul className="space-y-1">
                  {stats.popularRecipes.slice(0, 5).map((recipe: any, index: number) => (
                    <li
                      key={recipe.id || index}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors"
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--admin-surface-alt)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div
                        className="admin-avatar"
                        style={{
                          background: 'var(--admin-accent)',
                          color: '#fff',
                          fontSize: 13,
                          width: 32,
                          height: 32,
                        }}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--admin-text)' }}>
                          {recipe.recipeName || 'Công thức'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs" style={{ color: 'var(--admin-text-muted)' }}>
                          <Star className="w-3 h-3" style={{ color: '#F59E0B', fill: '#F59E0B' }} />
                          <span className="font-semibold tabular-nums" style={{ color: 'var(--admin-text-secondary)' }}>
                            {recipe.averageRating?.toFixed(1) || '0.0'}
                          </span>
                          <span>·</span>
                          <span>{recipe.ratingCount || 0} đánh giá</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="admin-empty">
                  <Star className="w-8 h-8" style={{ color: 'var(--admin-text-muted)' }} strokeWidth={1.5} />
                  <span>Chưa có công thức phổ biến</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;