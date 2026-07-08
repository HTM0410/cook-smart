import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import AdminLayout from '../components/templates/AdminLayout';
import adminService from '../services/adminService';
import { EyebrowTag } from '../components/atoms/EyebrowTag';
import { splitRevealLeft, splitRevealRight, cardReveal, easeFluid } from '../lib/motion';
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

  const getStatusText = (status: string) => status === 'active' ? 'Hoạt động' : 'Bị khóa';
  const getRoleText = (role: string) => role === 'admin' ? 'Quản trị viên' : 'Người dùng';

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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <motion.div initial="hidden" animate="visible" variants={splitRevealLeft} className="lg:col-span-7">
            <EyebrowTag>Quản trị</EyebrowTag>
            <h1 className="mt-4 text-display text-4xl md:text-5xl text-ink-primary dark:text-paper-light text-balance">
              Người dùng.
            </h1>
            <p className="mt-4 text-ink-secondary text-pretty">
              Tổng số: <span className="font-semibold text-ink-primary dark:text-paper-light">{total}</span> người dùng
            </p>
          </motion.div>
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeFluid }}
          className="card-bezel"
        >
          <div className="card-bezel-inner p-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative md:col-span-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-secondary pointer-events-none" strokeWidth={1.5} />
                <input
                  type="text"
                  placeholder="Tìm tên hoặc email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="input-bezel-inner h-11 pl-11 pr-4 text-sm w-full"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-11 px-4 text-sm rounded-2xl ring-1 ring-ink-200/40 dark:ring-ink-700/40 bg-paper-light dark:bg-ink-700 text-ink-primary dark:text-paper-light focus:outline-none focus:ring-2 focus:ring-[#ff4f00] transition-all duration-500 ease-[var(--ease-fluid)] cursor-pointer"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="active">Hoạt động</option>
                <option value="banned">Bị khóa</option>
              </select>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-11 px-4 text-sm rounded-2xl ring-1 ring-ink-200/40 dark:ring-ink-700/40 bg-paper-light dark:bg-ink-700 text-ink-primary dark:text-paper-light focus:outline-none focus:ring-2 focus:ring-[#ff4f00] transition-all duration-500 ease-[var(--ease-fluid)] cursor-pointer"
              >
                <option value="">Tất cả vai trò</option>
                <option value="user">Người dùng</option>
                <option value="admin">Quản trị viên</option>
              </select>
              <button onClick={handleSearch} className="btn-editorial-primary w-full justify-center">
                <Search className="w-4 h-4" strokeWidth={1.5} />
                Tìm kiếm
              </button>
            </div>
          </div>
        </motion.div>

        {loading ? (
          <div className="card-bezel">
            <div className="card-bezel-inner p-12 flex items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-[#ff4f00]" strokeWidth={1.5} />
              <span className="text-sm uppercase tracking-[0.2em] text-ink-secondary">Đang tải...</span>
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="card-bezel">
            <div className="card-bezel-inner p-12 text-center">
              <p className="text-ink-secondary">Không tìm thấy người dùng nào</p>
            </div>
          </div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: easeFluid }}
              className="card-bezel"
            >
              <div className="card-bezel-inner p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-paper-light dark:bg-ink-700/40 border-b border-ink-200/40 dark:border-ink-700/40">
                      <tr>
                        {['Người dùng', 'Email', 'Vai trò', 'Trạng thái', 'Tham gia', 'Thao tác'].map((h) => (
                          <th key={h} className="px-6 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-ink-secondary">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-200/40 dark:divide-ink-700/40">
                      {users.map((user, idx) => (
                        <motion.tr
                          key={user.id}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, ease: easeFluid, delay: idx * 0.04 }}
                          className="hover:bg-paper-light dark:hover:bg-ink-700/30 transition-colors duration-500 ease-[var(--ease-fluid)]"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-ink-700 dark:bg-paper-light flex items-center justify-center flex-shrink-0 ring-1 ring-ink-700 dark:ring-paper-light">
                                <span className="text-paper-light dark:text-ink-700 font-semibold text-sm">
                                  {user.fullName?.charAt(0) || 'U'}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-ink-primary dark:text-paper-light truncate">
                                  {user.fullName}
                                </p>
                                <p className="text-[10px] uppercase tracking-[0.15em] text-ink-muted mt-0.5">
                                  ID: {user.id}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-ink-secondary truncate max-w-[200px]">
                            {user.email}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`eyebrow-tag text-[10px] ${
                              user.role === 'admin'
                                ? 'bg-[#E5EDF6] text-[#3D5A80]'
                                : 'bg-paper-light text-ink-secondary'
                            }`}>
                              {getRoleText(user.role)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`eyebrow-tag text-[10px] ${
                              user.status === 'active'
                                ? 'bg-[#EDF3EC] text-[#346538]'
                                : 'bg-[#FDEBEC] text-[#9F2F2D]'
                            }`}>
                              {getStatusText(user.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-ink-secondary">
                            {getTimeAgo(user.createdAt)}
                          </td>
                          <td className="px-6 py-4">
                            {user.status === 'active' ? (
                              <button
                                onClick={() => handleStatusChange(user.id, 'banned', user.fullName)}
                                disabled={user.role === 'admin'}
                                className="w-9 h-9 rounded-full ring-1 ring-ink-200/40 dark:ring-ink-700/40 flex items-center justify-center text-[#9F2F2D] hover:bg-[#FDEBEC] dark:hover:bg-[#9F2F2D]/15 hover:ring-[#9F2F2D]/30 transition-all duration-500 ease-[var(--ease-fluid)] disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Khóa tài khoản"
                              >
                                <Lock className="w-4 h-4" strokeWidth={1.5} />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStatusChange(user.id, 'active', user.fullName)}
                                className="w-9 h-9 rounded-full ring-1 ring-ink-200/40 dark:ring-ink-700/40 flex items-center justify-center text-[#346538] hover:bg-[#EDF3EC] dark:hover:bg-[#346538]/15 hover:ring-[#346538]/30 transition-all duration-500 ease-[var(--ease-fluid)]"
                                title="Mở khóa tài khoản"
                              >
                                <Unlock className="w-4 h-4" strokeWidth={1.5} />
                              </button>
                            )}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>

            {/* Pagination */}
            <motion.div
              variants={cardReveal}
              initial="hidden"
              animate="visible"
              className="card-bezel"
            >
              <div className="card-bezel-inner p-4 flex items-center justify-between flex-wrap gap-3">
                <p className="text-sm text-ink-secondary">
                  Hiển thị <span className="font-semibold text-ink-primary dark:text-paper-light">{(page - 1) * limit + 1}</span> đến{' '}
                  <span className="font-semibold text-ink-primary dark:text-paper-light">{Math.min(page * limit, total)}</span> trong tổng số{' '}
                  <span className="font-semibold text-ink-primary dark:text-paper-light">{total}</span> kết quả
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-10 px-4 rounded-full text-sm font-medium ring-1 ring-ink-200/40 dark:ring-ink-700/40 text-ink-primary dark:text-paper-light disabled:opacity-30 disabled:cursor-not-allowed hover:ring-ink-primary/30 transition-all duration-500 ease-[var(--ease-fluid)] flex items-center gap-2"
                  >
                    <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
                    Trước
                  </button>
                  <span className="px-4 text-xs uppercase tracking-[0.2em] text-ink-secondary">
                    Trang {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page * limit >= total}
                    className="h-10 px-4 rounded-full text-sm font-medium ring-1 ring-ink-200/40 dark:ring-ink-700/40 text-ink-primary dark:text-paper-light disabled:opacity-30 disabled:cursor-not-allowed hover:ring-ink-primary/30 transition-all duration-500 ease-[var(--ease-fluid)] flex items-center gap-2"
                  >
                    Sau <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminUsers;