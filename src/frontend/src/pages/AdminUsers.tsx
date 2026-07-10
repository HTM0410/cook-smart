import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/templates/AdminLayout';
import adminService from '../services/adminService';
import { Loader2, Lock, Unlock, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface User {
  id: number;
  fullName: string;
  email: string;
  status: 'active' | 'banned';
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
}

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, roleFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await adminService.getUsers({
        page,
        limit,
        search: searchTerm,
        status: statusFilter || undefined,
        role: roleFilter || undefined,
      });
      setUsers(response.data.users);
      setTotal(response.data.pagination.total);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchUsers();
  };

  const handleStatusChange = async (userId: number, newStatus: 'active' | 'banned', userName: string) => {
    const action = newStatus === 'banned' ? 'khóa' : 'mở khóa';
    if (!confirm(`Bạn có chắc muốn ${action} tài khoản "${userName}"?`)) return;

    try {
      await adminService.updateUserStatus(userId, newStatus);
      fetchUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('Có lỗi xảy ra khi cập nhật trạng thái');
    }
  };

  const getStatusText = (status: string) => (status === 'active' ? 'Hoạt động' : 'Bị khóa');
  const getRoleText = (role: string) => (role === 'admin' ? 'Quản trị viên' : 'Người dùng');

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const days = Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Hôm nay';
    if (days === 1) return 'Hôm qua';
    if (days < 7) return `${days} ngày trước`;
    if (days < 30) return `${Math.floor(days / 7)} tuần trước`;
    if (days < 365) return `${Math.floor(days / 30)} tháng trước`;
    return `${Math.floor(days / 365)} năm trước`;
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="admin-page-header">
          <h1 className="admin-page-title">Người dùng</h1>
          <p className="admin-page-subtitle">
            Quản lý tài khoản và quyền truy cập — tổng cộng{' '}
            <span className="font-semibold" style={{ color: 'var(--admin-text)' }}>
              {total}
            </span>{' '}
            người dùng.
          </p>
        </div>

        {/* Filters */}
        <div className="admin-card">
          <div className="admin-card-body">
            <div className="admin-toolbar">
              <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
                <Search
                  className="w-4 h-4"
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--admin-text-muted)',
                    pointerEvents: 'none',
                  }}
                  strokeWidth={2}
                />
                <input
                  type="text"
                  placeholder="Tìm tên hoặc email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  style={{ width: '100%', paddingLeft: 36 }}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="active">Hoạt động</option>
                <option value="banned">Bị khóa</option>
              </select>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="">Tất cả vai trò</option>
                <option value="user">Người dùng</option>
                <option value="admin">Quản trị viên</option>
              </select>
              <button onClick={handleSearch}>
                <Search className="w-4 h-4" strokeWidth={2} />
                Tìm kiếm
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="admin-card">
            <div className="admin-loading">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--admin-accent)' }} strokeWidth={2} />
              <span>Đang tải...</span>
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="admin-card">
            <div className="admin-empty">Không tìm thấy người dùng nào</div>
          </div>
        ) : (
          <>
            <div className="admin-card">
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Người dùng</th>
                      <th>Email</th>
                      <th>Vai trò</th>
                      <th>Trạng thái</th>
                      <th>Tham gia</th>
                      <th className="text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="admin-avatar admin-avatar-success">
                              {user.fullName?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <div className="min-w-0">
                              <p
                                className="text-sm font-semibold truncate"
                                style={{ color: 'var(--admin-text)' }}
                              >
                                {user.fullName}
                              </p>
                              <p
                                className="text-xs"
                                style={{ color: 'var(--admin-text-muted)' }}
                              >
                                ID: {user.id}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td
                          className="text-sm"
                          style={{ color: 'var(--admin-text-secondary)', maxWidth: 240 }}
                        >
                          <span className="truncate block" title={user.email}>
                            {user.email}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`admin-badge ${
                              user.role === 'admin' ? 'admin-badge-info' : 'admin-badge-neutral'
                            }`}
                          >
                            {getRoleText(user.role)}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`admin-badge ${
                              user.status === 'active' ? 'admin-badge-success' : 'admin-badge-danger'
                            }`}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{
                                background:
                                  user.status === 'active' ? 'var(--admin-success)' : 'var(--admin-danger)',
                              }}
                            />
                            {getStatusText(user.status)}
                          </span>
                        </td>
                        <td className="text-sm" style={{ color: 'var(--admin-text-secondary)' }}>
                          {getTimeAgo(user.createdAt)}
                        </td>
                        <td className="text-right">
                          {user.status === 'active' ? (
                            <button
                              onClick={() => handleStatusChange(user.id, 'banned', user.fullName)}
                              disabled={user.role === 'admin'}
                              className="admin-action admin-action-danger"
                              title="Khóa tài khoản"
                              style={user.role === 'admin' ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}
                            >
                              <Lock className="w-4 h-4" strokeWidth={2} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStatusChange(user.id, 'active', user.fullName)}
                              className="admin-action admin-action-success"
                              title="Mở khóa tài khoản"
                            >
                              <Unlock className="w-4 h-4" strokeWidth={2} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="admin-pagination">
              <span>
                Hiển thị <strong style={{ color: 'var(--admin-text)' }}>{(page - 1) * limit + 1}</strong>–
                <strong style={{ color: 'var(--admin-text)' }}>{Math.min(page * limit, total)}</strong> trong tổng số{' '}
                <strong style={{ color: 'var(--admin-text)' }}>{total}</strong> kết quả
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4" strokeWidth={2} />
                  Trước
                </button>
                <span style={{ color: 'var(--admin-text-secondary)' }}>
                  Trang {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * limit >= total}
                >
                  Sau
                  <ChevronRight className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminUsers;