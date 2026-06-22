import React from 'react'

interface SkeletonCardProps {
  variant?: 'recipe' | 'profile' | 'list' | 'detail'
  className?: string
  count?: number
}

const SkeletonCardSingle: React.FC<SkeletonCardProps> = ({ variant = 'recipe', className = '' }) => {
  if (variant === 'recipe') {
    return (
      <div className={`card overflow-hidden ${className}`}>
        <div className="aspect-[4/3] skeleton" />
        <div className="p-5 space-y-3">
          <div className="skeleton-title w-3/4" />
          <div className="skeleton-text w-full" />
          <div className="skeleton-text w-2/3" />
          <div className="flex items-center gap-3 pt-2">
            <div className="skeleton w-16 h-4 rounded" />
            <div className="skeleton w-20 h-4 rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'list') {
    return (
      <div className={`flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 ${className}`}>
        <div className="w-16 h-16 rounded-xl skeleton flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="skeleton-title w-1/2" />
          <div className="skeleton-text w-3/4" />
        </div>
        <div className="skeleton w-20 h-8 rounded-xl" />
      </div>
    )
  }

  if (variant === 'detail') {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="w-full h-64 skeleton rounded-2xl" />
        <div className="space-y-3">
          <div className="skeleton-title w-2/3" />
          <div className="skeleton-text w-full" />
          <div className="skeleton-text w-4/5" />
          <div className="skeleton-text w-3/5" />
        </div>
      </div>
    )
  }

  return (
    <div className={`card p-6 ${className}`}>
      <div className="space-y-3">
        <div className="skeleton-avatar w-16 h-16 rounded-full" />
        <div className="skeleton-title w-1/2" />
        <div className="skeleton-text w-full" />
        <div className="skeleton-text w-3/4" />
      </div>
    </div>
  )
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ variant = 'recipe', className = '', count = 1 }) => {
  if (count === 1) {
    return <SkeletonCardSingle variant={variant} className={className} />
  }
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCardSingle key={i} variant={variant} className={className} />
      ))}
    </>
  )
}

export const SkeletonGrid: React.FC<{ count?: number; variant?: 'recipe' | 'list' | 'detail'; className?: string }> = ({
  count = 6,
  variant = 'recipe',
  className = ''
}) => {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} variant={variant} />
      ))}
    </div>
  )
}

export default SkeletonCard
