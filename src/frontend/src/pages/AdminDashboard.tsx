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
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  FileText,
  Star
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
      console.log('📊 Dashboard data:', response.data);
      setStats(response.data);
    } catch (err: any) {
      console.error('❌ Error fetching dashboard stats:', err);
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
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Đang tải dữ liệu dashboard...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <p className="text-red-600 dark:text-red-400 mb-4 font-medium">{error}</p>
            <button
              onClick={fetchDashboardData}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
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
      color: 'blue',
      bgGradient: 'from-blue-500 to-blue-600',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      trend: '+12%',
      trendUp: true
    },
    { 
      label: 'Tổng công thức', 
      value: formatNumber(stats.overview.totalRecipes), 
      icon: ChefHat, 
      color: 'green',
      bgGradient: 'from-green-500 to-green-600',
      iconBg: 'bg-green-100 dark:bg-green-900/30',
      iconColor: 'text-green-600 dark:text-green-400',
      trend: '+8%',
      trendUp: true
    },
    { 
      label: 'Nguyên liệu', 
      value: formatNumber(stats.overview.totalIngredients), 
      icon: Carrot, 
      color: 'orange',
      bgGradient: 'from-orange-500 to-orange-600',
      iconBg: 'bg-orange-100 dark:bg-orange-900/30',
      iconColor: 'text-orange-600 dark:text-orange-400',
      trend: '+5%',
      trendUp: true
    },
    { 
      label: 'Bình luận', 
      value: formatNumber(stats.overview.totalComments), 
      icon: MessageSquare, 
      color: 'purple',
      bgGradient: 'from-purple-500 to-purple-600',
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
      iconColor: 'text-purple-600 dark:text-purple-400',
      trend: '+23%',
      trendUp: true
    },
  ];

  const quickStats = [
    {
      label: 'Người dùng hoạt động',
      value: formatNumber(stats.overview.activeUsers),
      icon: UserCheck,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20'
    },
    {
      label: 'Công thức ẩn',
      value: formatNumber(stats.overview.hiddenRecipes),
      icon: Clock,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20'
    },
    {
      label: 'Tỷ lệ hoạt động',
      value: stats.overview.totalUsers > 0 
        ? `${Math.round((stats.overview.activeUsers / stats.overview.totalUsers) * 100)}%`
        : '0%',
      icon: Activity,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20'
    }
  ];

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Tổng quan hệ thống
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Chào mừng đến với bảng điều khiển quản trị CookSmart
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statsCards.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div
                key={index}
                className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden"
              >
                {/* Gradient Background */}
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.bgGradient} opacity-10 rounded-full -mr-16 -mt-16 group-hover:opacity-20 transition-opacity`} />
                
                <div className="relative p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`${stat.iconBg} p-3 rounded-xl`}>
                      <IconComponent className={`h-6 w-6 ${stat.iconColor}`} />
                    </div>
                    {stat.trendUp ? (
                      <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
                        <TrendingUp className="h-4 w-4" />
                        <span className="text-xs font-medium">{stat.trend}</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1 text-red-600 dark:text-red-400">
                        <TrendingDown className="h-4 w-4" />
                        <span className="text-xs font-medium">{stat.trend}</span>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                      {stat.label}
                    </p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                      {stat.value}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Users */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <span>Người dùng mới</span>
              </h2>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {stats.recentActivities.users.length} người dùng
              </span>
            </div>
            <div className="space-y-3">
              {stats.recentActivities.users.length > 0 ? (
                stats.recentActivities.users.slice(0, 5).map((user: any) => (
                  <div 
                    key={user.id} 
                    className="flex items-center space-x-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border border-gray-100 dark:border-gray-700"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                      <span className="text-white font-semibold text-lg">
                        {user.fullName?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {user.fullName || 'Người dùng'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                        {user.email}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{getTimeAgo(user.createdAt)}</span>
                      </p>
                    </div>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full flex-shrink-0 ${
                      user.status === 'active' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {user.status === 'active' ? 'Hoạt động' : 'Bị khóa'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Chưa có người dùng mới</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center space-x-2">
              <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span>Thống kê nhanh</span>
            </h2>
            <div className="space-y-4">
              {quickStats.map((stat, index) => {
                const IconComponent = stat.icon;
                return (
                  <div 
                    key={index}
                    className={`${stat.bgColor} p-4 rounded-xl border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-colors`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`${stat.color} bg-white dark:bg-gray-800 p-2 rounded-lg`}>
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {stat.label}
                        </span>
                      </div>
                      <span className={`text-lg font-bold ${stat.color}`}>
                        {stat.value}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent Recipes & Popular Recipes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Recipes */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
                <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span>Công thức mới nhất</span>
              </h2>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {stats.recentActivities.recipes.length} công thức
              </span>
            </div>
            <div className="space-y-3">
              {stats.recentActivities.recipes.length > 0 ? (
                stats.recentActivities.recipes.slice(0, 5).map((recipe: any) => (
                  <div 
                    key={recipe.id} 
                    className="flex items-center space-x-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border border-gray-100 dark:border-gray-700"
                  >
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                      <ChefHat className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate mb-1">
                        {recipe.recipeName}
                      </h3>
                      <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>{getTimeAgo(recipe.createdAt)}</span>
                        </span>
                        <span className={`px-2 py-1 rounded-full font-medium ${
                          recipe.status === 'visible' 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                            : recipe.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {recipe.status === 'visible' ? 'Hiển thị' : recipe.status === 'pending' ? 'Chờ duyệt' : 'Ẩn'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <ChefHat className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Chưa có công thức nào</p>
                </div>
              )}
            </div>
          </div>

          {/* Popular Recipes */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
                <Star className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
                <span>Công thức phổ biến</span>
              </h2>
            </div>
            <div className="space-y-3">
              {stats.popularRecipes && stats.popularRecipes.length > 0 ? (
                stats.popularRecipes.slice(0, 5).map((recipe: any, index: number) => (
                  <div 
                    key={recipe.id || index} 
                    className="flex items-center space-x-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border border-gray-100 dark:border-gray-700"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-lg font-bold text-white">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate mb-1">
                        {recipe.recipeName || 'Công thức'}
                      </h3>
                      <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                        <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                        <span>{recipe.averageRating?.toFixed(1) || '0.0'}</span>
                        <span className="text-gray-400">•</span>
                        <span>{recipe.ratingCount || 0} đánh giá</span>
                      </div>
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <Star className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Chưa có công thức phổ biến</p>
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
