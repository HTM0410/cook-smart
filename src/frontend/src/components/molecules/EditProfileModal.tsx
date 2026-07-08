import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Lock, User as UserIcon, Upload, Eye, EyeOff, Check } from 'lucide-react';
import profileService from '../../services/profileService';
import showToast from '../../utils/toast';
import { EyebrowTag } from '../atoms/EyebrowTag';
import { ButtonEditorial } from '../atoms/ButtonEditorial';
import { splitRevealLeft, splitRevealRight, viewportOnce } from '../../lib/motion';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: {
    id: number;
    email: string;
    fullName?: string;
    avatar?: string;
  };
  onUpdate: (updatedProfile: any) => void;
}

type TabKey = 'profile' | 'avatar' | 'password';

const TABS: Array<{ id: TabKey; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }> = [
  { id: 'profile', label: 'Thông tin', icon: UserIcon },
  { id: 'avatar', label: 'Ảnh đại diện', icon: Camera },
  { id: 'password', label: 'Mật khẩu', icon: Lock },
];

const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onUpdate
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('profile');
  const [formData, setFormData] = useState({ fullName: profile.fullName || '' });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState({ current: false, next: false, confirm: false });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const passwordRequirements = [
    { label: 'Ít nhất 6 ký tự', met: passwordData.newPassword.length >= 6 },
    { label: 'Có chữ cái', met: /[A-Za-z]/.test(passwordData.newPassword) },
    { label: 'Có số', met: /\d/.test(passwordData.newPassword) },
  ];
  const passwordStrength = passwordRequirements.filter(r => r.met).length;

  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await profileService.updateProfile(formData);
      if (response.success) {
        onUpdate(response.data);
        showToast.success('Cập nhật thông tin thành công!');
        onClose();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Mật khẩu mới không khớp');
      return;
    }
    if (passwordStrength < 3) {
      setError('Mật khẩu chưa đủ mạnh');
      return;
    }
    setLoading(true);
    try {
      const response = await profileService.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      if (response.success) {
        showToast.success('Đổi mật khẩu thành công!');
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        onClose();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra khi đổi mật khẩu');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Chỉ được upload file hình ảnh');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Kích thước file không được vượt quá 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setAvatarPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setLoading(true);
    setError(null);
    try {
      const response = await profileService.uploadAvatar(file);
      if (response.success) {
        onUpdate({ avatar: response.data.avatar });
        setAvatarPreview(response.data.avatar);
        showToast.success('Cập nhật ảnh đại diện thành công!');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra khi upload ảnh');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
        className="fixed inset-0 z-[100] bg-ink-700/80 backdrop-blur-3xl flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial="hidden"
          animate="visible"
          variants={splitRevealLeft}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto card-bezel"
        >
          <div className="card-bezel-inner p-6 md:p-10">
            <div className="flex items-start justify-between gap-6 mb-8">
              <motion.div variants={splitRevealRight} className="space-y-2">
                <EyebrowTag>Cài đặt tài khoản</EyebrowTag>
                <h2 className="text-display text-3xl md:text-4xl text-ink-primary dark:text-paper-light text-balance">
                  Cập nhật hồ sơ.
                </h2>
              </motion.div>
              <button
                onClick={onClose}
                aria-label="Đóng"
                className="w-10 h-10 rounded-full flex items-center justify-center text-ink-secondary hover:text-ink-primary dark:hover:text-paper-light hover:bg-paper-light dark:hover:bg-ink-700 transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>

            {/* Tab switcher with layoutId active dot */}
            <div className="relative inline-flex p-1 rounded-full bg-paper-light dark:bg-ink-700 ring-1 ring-ink-200/40 dark:ring-ink-700/40 mb-8 w-full">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setError(null); }}
                  className={`relative flex-1 px-4 py-2.5 text-sm font-medium tracking-wide rounded-full transition-colors duration-700 ease-[var(--ease-fluid)] inline-flex items-center justify-center gap-2 ${
                    activeTab === tab.id
                      ? 'text-ink-primary dark:text-paper-light'
                      : 'text-ink-secondary hover:text-ink-primary dark:hover:text-paper-light'
                  }`}
                >
                  {activeTab === tab.id && (
                    <motion.span
                      layoutId="edit-profile-tab"
                      className="absolute inset-0 bg-white dark:bg-ink-800 rounded-full shadow-sm"
                      transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
                    />
                  )}
                  <tab.icon className="relative w-4 h-4" strokeWidth={1.5} />
                  <span className="relative whitespace-nowrap">{tab.label}</span>
                </button>
              ))}
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-bezel mb-6"
              >
                <div className="card-bezel-inner p-4 bg-[#FDEBEC] dark:bg-[#9F2F2D]/15 text-[#9F2F2D] dark:text-[#FDEBEC] text-sm font-medium">
                  {error}
                </div>
              </motion.div>
            )}

            <AnimatePresence mode="wait">
              {activeTab === 'profile' && (
                <motion.form
                  key="profile"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                  onSubmit={handleSubmitProfile}
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <label className="block text-xs uppercase tracking-[0.2em] text-ink-secondary font-medium">Họ và tên</label>
                    <div className="input-bezel">
                      <input
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ fullName: e.target.value })}
                        className="input-bezel-inner h-12 text-base"
                        placeholder="Nguyễn Văn A"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs uppercase tracking-[0.2em] text-ink-secondary font-medium">Email</label>
                    <div className="input-bezel opacity-60">
                      <input
                        type="email"
                        value={profile.email}
                        disabled
                        className="input-bezel-inner h-12 text-base cursor-not-allowed"
                      />
                    </div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-ink-muted">Email không thể thay đổi</p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <ButtonEditorial variant="ghost" size="md" className="flex-1 justify-between" type="button" onClick={onClose}>
                      Hủy
                    </ButtonEditorial>
                    <ButtonEditorial size="md" className="flex-1 justify-between" type="submit" disabled={loading}>
                      {loading ? 'Đang cập nhật...' : 'Lưu thay đổi'}
                    </ButtonEditorial>
                  </div>
                </motion.form>
              )}

              {activeTab === 'avatar' && (
                <motion.div
                  key="avatar"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                  className="flex flex-col items-center py-4"
                >
                  <div className="card-bezel p-2 mb-6">
                    <div className="w-36 h-36 rounded-squircle overflow-hidden bg-gradient-to-br from-paper-light to-ink-200 dark:from-ink-700 dark:to-ink-800 flex items-center justify-center">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-display text-6xl text-ink-300 dark:text-ink-200">
                          {(profile.fullName || profile.email).charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                  <ButtonEditorial
                    size="md"
                    className="justify-between"
                    leadingIcon={<Upload className="w-4 h-4" strokeWidth={1.5} />}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                  >
                    {loading ? 'Đang upload...' : 'Chọn ảnh mới'}
                  </ButtonEditorial>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-ink-muted mt-6 text-center">
                    JPG, PNG, GIF · Tối đa 5MB
                  </p>
                </motion.div>
              )}

              {activeTab === 'password' && (
                <motion.form
                  key="password"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                  onSubmit={handleSubmitPassword}
                  className="space-y-5"
                >
                  {(['current', 'next', 'confirm'] as const).map((field) => (
                    <div key={field} className="space-y-2">
                      <label className="block text-xs uppercase tracking-[0.2em] text-ink-secondary font-medium">
                        {field === 'current' ? 'Mật khẩu hiện tại' : field === 'next' ? 'Mật khẩu mới' : 'Xác nhận mật khẩu mới'}
                      </label>
                      <div className="input-bezel">
                        <div className="relative">
                          <input
                            type={showPwd[field] ? 'text' : 'password'}
                            value={
                              field === 'current' ? passwordData.currentPassword :
                              field === 'next' ? passwordData.newPassword :
                              passwordData.confirmPassword
                            }
                            onChange={(e) => setPasswordData({
                              ...passwordData,
                              [field === 'current' ? 'currentPassword' : field === 'next' ? 'newPassword' : 'confirmPassword']: e.target.value
                            })}
                            className="input-bezel-inner h-12 pr-12 text-base"
                            autoComplete={field === 'current' ? 'current-password' : 'new-password'}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPwd({ ...showPwd, [field]: !showPwd[field] })}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-ink-secondary hover:text-ink-primary hover:bg-paper-light dark:hover:bg-ink-700 transition-colors"
                            aria-label={showPwd[field] ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                          >
                            {showPwd[field] ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                          </button>
                        </div>
                      </div>
                      {field === 'next' && passwordData.newPassword.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <div className="flex gap-1.5">
                            {[1, 2, 3].map((level) => (
                              <div
                                key={level}
                                className={`h-1 flex-1 rounded-full transition-all duration-700 ease-[var(--ease-fluid)] ${
                                  passwordStrength >= level
                                    ? passwordStrength === 1 ? 'bg-[#9F2F2D]' : passwordStrength === 2 ? 'bg-[#956400]' : 'bg-[#346538]'
                                    : 'bg-ink-200/40 dark:bg-ink-700/40'
                                }`}
                              />
                            ))}
                          </div>
                          <div className="space-y-1">
                            {passwordRequirements.map((req, i) => (
                              <div key={i} className={`flex items-center gap-2 text-[11px] font-medium tracking-wide ${req.met ? 'text-[#346538]' : 'text-ink-muted'}`}>
                                <Check className="w-3 h-3" strokeWidth={2} />
                                {req.label}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="flex gap-3 pt-2">
                    <ButtonEditorial variant="ghost" size="md" className="flex-1 justify-between" type="button" onClick={onClose}>
                      Hủy
                    </ButtonEditorial>
                    <ButtonEditorial size="md" className="flex-1 justify-between" type="submit" disabled={loading}>
                      {loading ? 'Đang đổi...' : 'Đổi mật khẩu'}
                    </ButtonEditorial>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EditProfileModal;