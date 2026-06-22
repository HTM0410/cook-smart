import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import profileService from '../services/profileService'
import EditProfileModal from '../components/molecules/EditProfileModal'
import SocialShare from '../components/molecules/SocialShare'
import Button from '../components/atoms/Button'
import { SkeletonCard } from '../components/molecules/SkeletonCard'
import showToast from '../utils/toast'
import {
  Heart, Star, BookOpen, Calendar, Clock, Settings,
  User, ChevronRight, ChefHat, Edit3
} from 'lucide-react'

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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="bg-gradient-to-br from-primary-600 to-amber-500 h-52" />
        <div className="container -mt-24">
          <div className="max-w-4xl mx-auto">
            <SkeletonCard variant="profile" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-3xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4 text-5xl animate-float">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{error || 'Không tìm thấy người dùng'}</h2>
          <Link to="/" className="btn btn-primary mt-4">Quay lại trang chủ</Link>
        </div>
      </div>
    )
  }

  const stats = [
    { label: 'Yêu thích', value: profile.stats?.favoriteCount || 0, icon: Heart, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
    { label: 'Đánh giá', value: profile.stats?.reviewCount || 0, icon: Star, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
    { label: 'Công thức', value: profile.stats?.recipeCount || 0, icon: BookOpen, color: 'text-primary-500', bg: 'bg-primary-50 dark:bg-primary-900/20' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Cover */}
      <div className="relative h-48 md:h-56 bg-gradient-to-br from-primary-600 via-primary-500 to-amber-500">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      </div>

      <div className="container">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
          <div className="relative -mt-16 mb-8">
            <div className="card p-6 md:p-8">
              <div className="flex flex-col md:flex-row items-center md:items-end gap-5">
                {/* Avatar */}
                <div className="relative">
                  <div className="w-28 h-28 md:w-32 md:h-32 rounded-3xl overflow-hidden border-4 border-white dark:border-gray-800 shadow-xl bg-white">
                    {profile.avatar ? (
                      <img src={profile.avatar} alt={profile.fullName || 'Avatar'} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary-500 to-amber-500 flex items-center justify-center">
                        <span className="text-4xl md:text-5xl font-extrabold text-white">
                          {(profile.fullName || profile.email).charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Online indicator */}
                  <div className="absolute bottom-2 right-2 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 shadow-md" />
                </div>

                {/* Info */}
                <div className="flex-1 text-center md:text-left">
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-3 mb-3">
                    <div>
                      <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white">
                        {profile.fullName || 'Chưa đặt tên'}
                      </h1>
                      <p className="text-muted-foreground text-sm">{profile.email}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Tham gia từ {new Date(profile.createdAt).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-center md:justify-start gap-6">
                    {stats.map((stat) => (
                      <div key={stat.label} className="text-center">
                        <div className={`text-2xl font-extrabold text-gray-900 dark:text-white`}>{stat.value}</div>
                        <div className="text-xs font-medium text-gray-400">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                {isOwnProfile && (
                  <div className="flex items-center gap-2">
                    <SocialShare profileUrl={`${window.location.origin}/profile/${profile.id}`} profileName={profile.fullName || profile.email} />
                    <Button variant="secondary" size="sm" onClick={() => setIsEditModalOpen(true)}>
                      <Edit3 className="w-4 h-4" />
                      Cập nhật
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="tab-list mb-6 max-w-md">
            <button
              onClick={() => setActiveTab('favorites')}
              className={`tab-item ${activeTab === 'favorites' ? 'tab-item-active' : ''}`}
            >
              <Heart className="w-4 h-4 inline mr-1.5" />
              Yêu thích
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`tab-item ${activeTab === 'reviews' ? 'tab-item-active' : ''}`}
            >
              <Star className="w-4 h-4 inline mr-1.5" />
              Đánh giá
            </button>
          </div>

          {/* Content */}
          {activeTab === 'favorites' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pb-8">
              {favorites.length === 0 ? (
                <div className="col-span-full">
                  <div className="card p-12 text-center">
                    <div className="w-20 h-20 rounded-3xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4 text-4xl animate-float">❤️</div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Chưa có công thức yêu thích</h3>
                    <p className="text-muted-foreground text-sm mb-6">Bắt đầu khám phá và lưu lại những công thức bạn thích.</p>
                    <Link to="/recipes" className="btn btn-primary">
                      Khám phá công thức
                    </Link>
                  </div>
                </div>
              ) : (
                favorites.map((recipe) => (
                  <Link key={recipe.id} to={`/recipes/${recipe.id}`} className="group">
                    <div className="card overflow-hidden hover:shadow-xl hover:shadow-primary-500/10 transition-all duration-300 hover:-translate-y-1">
                      <div className="relative aspect-[4/3] overflow-hidden">
                        {recipe.imageUrl ? (
                          <img src={recipe.imageUrl} alt={recipe.recipeName} loading="lazy" className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700" />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 flex items-center justify-center text-4xl">🍳</div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="p-4">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1 line-clamp-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                          {recipe.recipeName}
                        </h3>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{recipe.prepTime + recipe.cookTime}p</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            recipe.difficulty === 'easy' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                            recipe.difficulty === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
                            'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                          }`}>
                            {recipe.difficulty === 'easy' ? 'Dễ' : recipe.difficulty === 'medium' ? 'Vừa' : 'Khó'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-4 pb-8">
              {reviews.length === 0 ? (
                <div className="card p-12 text-center">
                  <div className="w-20 h-20 rounded-3xl bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center mx-auto mb-4 text-4xl animate-float">⭐</div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Chưa có đánh giá nào</h3>
                  <p className="text-muted-foreground text-sm mb-6">Hãy đánh giá những công thức bạn đã nấu.</p>
                  <Link to="/recipes" className="btn btn-primary">Khám phá công thức</Link>
                </div>
              ) : (
                reviews.map((review) => (
                  <Link key={review.id} to={`/recipes/${review.recipe.id}`} className="group block">
                    <div className="card p-5 hover:shadow-md transition-all">
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-800">
                          {review.recipe.imageUrl ? (
                            <img src={review.recipe.imageUrl} alt={review.recipe.recipeName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">🍳</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h3 className="font-bold text-gray-900 dark:text-white text-sm line-clamp-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                              {review.recipe.recipeName}
                            </h3>
                            <span className="text-xs text-gray-400 shrink-0">
                              {new Date(review.createdAt).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mb-2">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                            ))}
                          </div>
                          {review.comment && (
                            <p className="text-xs text-muted-foreground line-clamp-2">"{review.comment}"</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {profile && (
        <EditProfileModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} profile={profile} onUpdate={handleProfileUpdate} />
      )}
    </div>
  )
}

export default ProfilePage
