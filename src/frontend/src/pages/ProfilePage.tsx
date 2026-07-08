import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import profileService from '../services/profileService'
import EditProfileModal from '../components/molecules/EditProfileModal'
import SocialShare from '../components/molecules/SocialShare'
import { SkeletonCard } from '../components/molecules/SkeletonCard'
import showToast from '../utils/toast'
import {
  Heart, Star, BookOpen, Calendar, Clock,
  Edit3, ArrowUpRight, ChefHat
} from 'lucide-react'
import { EyebrowTag } from '../components/atoms/EyebrowTag'
import { ButtonEditorial } from '../components/atoms/ButtonEditorial'
import { splitRevealLeft, splitRevealRight, cardReveal, staggerGrid, viewportOnce } from '../lib/motion'

interface UserProfile {
  id: number
  email: string
  fullName?: string
  avatar?: string
  createdAt: string
  stats?: {
    favoriteCount: number
    reviewCount: number
    recipeCount: number
  }
}

const ProfilePage: React.FC = () => {
  const { userId: urlUserId } = useParams<{ userId?: string }>()
  const { user: currentUser } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [favorites, setFavorites] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'favorites' | 'reviews'>('favorites')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const userId = urlUserId || (currentUser ? currentUser.id.toString() : 'me')
  const isOwnProfile = !urlUserId || urlUserId === currentUser?.id?.toString()

  useEffect(() => {
    if (userId) {
      fetchProfile()
      fetchFavorites()
      fetchReviews()
    }
  }, [userId])

  const fetchProfile = async () => {
    try {
      const apiUserId = userId === 'me' ? 'me' : userId
      const response = await profileService.getProfile(apiUserId)
      if (response.success) setProfile(response.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể tải thông tin người dùng')
    } finally {
      setLoading(false)
    }
  }

  const fetchFavorites = async () => {
    try {
      const apiUserId = userId === 'me' ? 'me' : userId
      const response = await profileService.getFavorites(apiUserId, { page: 1, limit: 12 })
      if (response.success) setFavorites(response.data.recipes || [])
    } catch { /* ignore */ }
  }

  const fetchReviews = async () => {
    try {
      const apiUserId = userId === 'me' ? 'me' : userId
      const response = await profileService.getReviews(apiUserId, { page: 1, limit: 12 })
      if (response.success) setReviews(response.data.reviews || [])
    } catch { /* ignore */ }
  }

  const handleProfileUpdate = (updatedProfile: any) => {
    setProfile(prev => prev ? { ...prev, ...updatedProfile } : null)
    showToast.success('Cập nhật hồ sơ thành công!')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-paper-light dark:bg-ink-800 section">
        <div className="container">
          <SkeletonCard variant="profile" />
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-paper-light dark:bg-ink-800 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-display text-7xl text-ink-primary dark:text-paper-light">404</div>
          <p className="text-ink-secondary">{error || 'Không tìm thấy người dùng'}</p>
          <Link to="/" className="link-underline text-sm uppercase tracking-[0.2em] text-ink-primary dark:text-paper-light">
            Quay lại trang chủ
          </Link>
        </div>
      </div>
    )
  }

  const stats = [
    { label: 'Yêu thích', value: profile.stats?.favoriteCount || 0, icon: Heart },
    { label: 'Đánh giá', value: profile.stats?.reviewCount || 0, icon: Star },
    { label: 'Công thức', value: profile.stats?.recipeCount || 0, icon: BookOpen },
  ]

  return (
    <div className="min-h-screen bg-paper-light dark:bg-ink-800">
      {/* Editorial Header - Editorial Split */}
      <section className="section pt-32 md:pt-40">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Left - Identity */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={splitRevealLeft}
              className="lg:col-span-7 flex flex-col md:flex-row items-center md:items-end gap-8"
            >
              <div className="relative flex-shrink-0">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-squircle overflow-hidden ring-1 ring-ink-200/40 dark:ring-ink-700/40 shadow-ambient">
                  {profile.avatar ? (
                    <img src={profile.avatar} alt={profile.fullName || 'Avatar'} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-ink-700 dark:bg-paper-light flex items-center justify-center">
                      <span className="text-display text-5xl md:text-6xl text-paper-light dark:text-ink-700">
                        {(profile.fullName || profile.email).charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#346538] rounded-full ring-4 ring-paper-light dark:ring-ink-800" />
              </div>

              <div className="text-center md:text-left">
                <EyebrowTag>Hồ sơ</EyebrowTag>
                <h1 className="mt-4 text-display text-4xl md:text-5xl lg:text-6xl text-ink-primary dark:text-paper-light text-balance">
                  {profile.fullName || 'Chưa đặt tên'}
                </h1>
                <p className="mt-3 text-ink-secondary">
                  {profile.email}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-ink-muted">
                  Tham gia từ {new Date(profile.createdAt).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </motion.div>

            {/* Right - Stats + Actions */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={splitRevealRight}
              className="lg:col-span-5"
            >
              <div className="card-bezel">
                <div className="card-bezel-inner p-6 md:p-8 space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    {stats.map((stat) => (
                      <div key={stat.label} className="text-center md:text-left">
                        <p className="text-display text-3xl md:text-4xl text-ink-primary dark:text-paper-light">
                          {stat.value}
                        </p>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-ink-secondary mt-1">
                          {stat.label}
                        </p>
                      </div>
                    ))}
                  </div>

                  {isOwnProfile && (
                    <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-ink-200/40 dark:border-ink-700/40">
                      <ButtonEditorial
                        variant="ghost"
                        size="md"
                        className="flex-1 justify-between"
                        leadingIcon={<Edit3 className="w-4 h-4" strokeWidth={1.5} />}
                        onClick={() => setIsEditModalOpen(true)}
                      >
                        Chỉnh sửa
                      </ButtonEditorial>
                      <SocialShare profileUrl={`${window.location.origin}/profile/${profile.id}`} profileName={profile.fullName || profile.email} />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Tabs + Content */}
      <section className="section pb-32">
        <div className="container">
          {/* Tab list - editorial style */}
          <div className="flex items-center justify-between mb-12">
            <div className="inline-flex p-1 rounded-full bg-paper-light dark:bg-ink-700 ring-1 ring-ink-200/40 dark:ring-ink-700/40">
              {[
                { id: 'favorites', label: 'Yêu thích', icon: Heart },
                { id: 'reviews', label: 'Đánh giá', icon: Star },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`relative px-5 py-2.5 text-sm font-medium tracking-wide rounded-full transition-colors duration-700 ease-[var(--ease-fluid)] ${
                    activeTab === tab.id
                      ? 'text-ink-primary dark:text-paper-light'
                      : 'text-ink-secondary hover:text-ink-primary dark:hover:text-paper-light'
                  }`}
                >
                  {activeTab === tab.id && (
                    <motion.span
                      layoutId="profile-tab"
                      className="absolute inset-0 bg-white dark:bg-ink-800 rounded-full shadow-sm"
                      transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
                    />
                  )}
                  <span className="relative inline-flex items-center gap-2">
                    <tab.icon className="w-4 h-4" strokeWidth={1.5} />
                    {tab.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'favorites' && (
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              variants={staggerGrid}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {favorites.length === 0 ? (
                <div className="col-span-full empty-state">
                  <p className="text-display text-3xl md:text-4xl text-ink-primary dark:text-paper-light mb-4">
                    Chưa có món yêu thích.
                  </p>
                  <p className="text-ink-secondary mb-8 max-w-md text-pretty">
                    Bắt đầu khám phá và lưu lại những công thức bạn yêu thích.
                  </p>
                  <Link to="/recipes">
                    <ButtonEditorial variant="primary" size="md">
                      Khám phá công thức
                    </ButtonEditorial>
                  </Link>
                </div>
              ) : (
                favorites.map((recipe, i) => (
                  <motion.div key={recipe.id} custom={i} variants={cardReveal}>
                    <Link to={`/recipes/${recipe.id}`} className="group block h-full">
                      <article className="card-bezel h-full">
                        <div className="card-bezel-inner p-0 overflow-hidden h-full flex flex-col">
                          <div className="relative aspect-[4/3] overflow-hidden">
                            {recipe.imageUrl ? (
                              <img src={recipe.imageUrl} alt={recipe.recipeName} loading="lazy" className="h-full w-full object-cover transition-transform duration-[1100ms] ease-[var(--ease-fluid)] group-hover:scale-105" />
                            ) : (
                              <div className="h-full w-full bg-gradient-to-br from-paper-light to-ink-200 dark:from-ink-700 dark:to-ink-800 flex items-center justify-center">
                                <ChefHat className="w-12 h-12 text-ink-200" strokeWidth={1} />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-ink-700/30 to-transparent" />
                          </div>
                          <div className="p-5 flex-1 flex flex-col">
                            <h3 className="text-base font-semibold text-ink-primary dark:text-paper-light mb-3 line-clamp-1 group-hover:text-[#ff4f00] transition-colors flex-1">
                              {recipe.recipeName}
                            </h3>
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1.5 text-ink-secondary">
                                <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                                <span>{recipe.prepTime + recipe.cookTime}p</span>
                              </div>
                              <span className={`eyebrow-tag ${
                                recipe.difficulty === 'easy' ? 'bg-[#EDF3EC] text-[#346538]' :
                                recipe.difficulty === 'medium' ? 'bg-[#FBF3DB] text-[#956400]' :
                                'bg-[#FDEBEC] text-[#9F2F2D]'
                              }`}>
                                {recipe.difficulty === 'easy' ? 'Dễ' : recipe.difficulty === 'medium' ? 'Vừa' : 'Khó'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </article>
                    </Link>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'reviews' && (
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              variants={staggerGrid}
              className="space-y-4"
            >
              {reviews.length === 0 ? (
                <div className="empty-state">
                  <p className="text-display text-3xl md:text-4xl text-ink-primary dark:text-paper-light mb-4">
                    Chưa có đánh giá nào.
                  </p>
                  <p className="text-ink-secondary mb-8">
                    Hãy đánh giá những công thức bạn đã nấu.
                  </p>
                  <Link to="/recipes">
                    <ButtonEditorial variant="primary" size="md">Khám phá công thức</ButtonEditorial>
                  </Link>
                </div>
              ) : (
                reviews.map((review, i) => (
                  <motion.div key={review.id} custom={i} variants={cardReveal}>
                    <Link to={`/recipes/${review.recipe.id}`} className="group block">
                      <div className="card-bezel">
                        <div className="card-bezel-inner p-5 flex items-start gap-5">
                          <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 bg-paper-light dark:bg-ink-700">
                            {review.recipe.imageUrl ? (
                              <img src={review.recipe.imageUrl} alt={review.recipe.recipeName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ChefHat className="w-6 h-6 text-ink-200" strokeWidth={1} />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <h3 className="font-semibold text-ink-primary dark:text-paper-light line-clamp-1 group-hover:text-[#ff4f00] transition-colors">
                                {review.recipe.recipeName}
                              </h3>
                              <span className="text-xs uppercase tracking-[0.2em] text-ink-muted shrink-0">
                                {new Date(review.createdAt).toLocaleDateString('vi-VN')}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 mb-3">
                              {Array.from({ length: 5 }).map((_, j) => (
                                <Star key={j} className={`w-4 h-4 ${j < review.rating ? 'text-[#ff4f00] fill-[#ff4f00]' : 'text-ink-200'}`} strokeWidth={1.5} />
                              ))}
                            </div>
                            {review.comment && (
                              <p className="text-sm text-ink-secondary line-clamp-2 italic">"{review.comment}"</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}
        </div>
      </section>

      {profile && (
        <EditProfileModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} profile={profile} onUpdate={handleProfileUpdate} />
      )}
    </div>
  )
}

export default ProfilePage
