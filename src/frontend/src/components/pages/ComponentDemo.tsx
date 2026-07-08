import React, { useState } from 'react';
import { motion } from 'framer-motion';
import FavoriteButton from '../atoms/FavoriteButton';
import StarRating from '../atoms/StarRating';
import { EyebrowTag } from '../atoms/EyebrowTag';
import { ButtonEditorial } from '../atoms/ButtonEditorial';
import { easeFluid, splitRevealLeft, staggerGrid, cardReveal, viewportOnce } from '../../lib/motion';

const Section = ({ title, description, children, accent }: { title: string; description?: string; children: React.ReactNode; accent?: string }) => (
  <motion.section
    initial="hidden"
    whileInView="visible"
    viewport={viewportOnce}
    variants={cardReveal}
    className="card-bezel mb-10"
  >
    <div className="card-bezel-inner p-8 md:p-10">
      <div className="flex items-center gap-3 mb-6">
        <span className="eyebrow-tag text-[#ff4f00]">Demo</span>
        {accent && <span className="eyebrow-tag">{accent}</span>}
      </div>
      <h2 className="text-display text-2xl md:text-3xl text-ink-primary dark:text-paper-light text-balance">
        {title}
      </h2>
      {description && (
        <p className="mt-3 text-sm text-ink-secondary text-pretty max-w-2xl">{description}</p>
      )}
      <div className="mt-8">{children}</div>
    </div>
  </motion.section>
);

const ComponentDemo: React.FC = () => {
  const [favoriteCount, setFavoriteCount] = useState(47);
  const [isFavorited, setIsFavorited] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [averageRating, setAverageRating] = useState(4.2);
  const [ratingCount, setRatingCount] = useState(128);

  const handleFavoriteChange = (favorited: boolean, count: number) => {
    setIsFavorited(favorited);
    setFavoriteCount(count);
  };

  const handleRatingChange = (rating: number, average: number, count: number) => {
    setUserRating(rating);
    setAverageRating(average);
    setRatingCount(count);
  };

  return (
    <div className="min-h-screen bg-paper-light dark:bg-ink-800 pt-32 pb-24 px-6 noise-overlay">
      <div className="container max-w-5xl">
        {/* Editorial Header */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={splitRevealLeft}
          className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-16 items-end"
        >
          <div className="lg:col-span-7">
            <EyebrowTag>UI Components</EyebrowTag>
            <h1 className="mt-6 text-display text-5xl md:text-6xl lg:text-7xl text-ink-primary dark:text-paper-light text-balance">
              Thư viện
              <br />
              <span className="text-ink-muted">thành phần.</span>
            </h1>
            <p className="mt-6 text-lg text-ink-secondary max-w-xl text-pretty">
              Các nguyên tử & phân tử có thể tái sử dụng trong toàn bộ sản phẩm,
              được thiết kế theo hệ Editorial Luxury.
            </p>
          </div>
        </motion.div>

        <Section title="Favorite Button" description="Heart micro-animated với socket sync." accent="Atoms">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={staggerGrid}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {(['sm', 'md', 'lg'] as const).map(size => (
              <motion.div key={size} variants={cardReveal} className="text-center">
                <h3 className="eyebrow-tag mb-6 inline-block">{size.toUpperCase()}</h3>
                <div className="flex justify-center">
                  <FavoriteButton
                    recipeId={1}
                    initialFavoriteCount={favoriteCount}
                    initialIsFavorited={isFavorited}
                    userId={999}
                    size={size}
                    showTooltip={true}
                    onFavoriteChange={handleFavoriteChange}
                  />
                </div>
              </motion.div>
            ))}
          </motion.div>
          <div className="mt-6 eyebrow-tag text-ink-muted">
            {isFavorited ? 'Đã yêu thích' : 'Chưa yêu thích'} · {favoriteCount} lượt
          </div>
        </Section>

        <Section title="Star Rating" description="Real-time interactive rating với half-stars." accent="Atoms">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={staggerGrid}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {(['sm', 'md', 'lg'] as const).map(size => (
              <motion.div key={size} variants={cardReveal} className="text-center">
                <h3 className="eyebrow-tag mb-6 inline-block">{size.toUpperCase()}</h3>
                <div className="flex justify-center">
                  <StarRating
                    rating={averageRating}
                    count={ratingCount}
                    size={size}
                    interactive={true}
                    showCount={true}
                    onChange={(rating) => handleRatingChange(rating, averageRating, ratingCount)}
                  />
                </div>
              </motion.div>
            ))}
          </motion.div>
          <div className="mt-6 eyebrow-tag text-ink-muted">
            Trung bình {averageRating.toFixed(1)} · {ratingCount} đánh giá
          </div>
        </Section>

        {/* Interactive Demo */}
        <Section title="Live interaction" description="Xem cả hai component hoạt động cùng nhau." accent="Showcase">
          <div className="flex flex-col items-center gap-8 py-6">
            <div className="text-center">
              <p className="eyebrow-tag inline-block mb-2">Recipe sample</p>
              <h3 className="text-display text-2xl text-ink-primary dark:text-paper-light">
                Phở Bò Hà Nội
              </h3>
            </div>
            <div className="flex items-center justify-center gap-10 flex-wrap">
              <FavoriteButton
                recipeId={1}
                initialFavoriteCount={favoriteCount}
                initialIsFavorited={isFavorited}
                userId={999}
                size="lg"
                showTooltip={true}
                onFavoriteChange={handleFavoriteChange}
              />
              <StarRating
                rating={averageRating}
                count={ratingCount}
                size="lg"
                interactive={true}
                showCount={true}
                onChange={(rating) => handleRatingChange(rating, averageRating, ratingCount)}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-3xl pt-6">
              <div className="card-bezel">
                <div className="card-bezel-inner p-4 text-center">
                  <p className="eyebrow-tag text-ink-muted mb-1">User</p>
                  <p className="text-display text-2xl text-ink-primary dark:text-paper-light">{userRating.toFixed(1)}</p>
                </div>
              </div>
              <div className="card-bezel">
                <div className="card-bezel-inner p-4 text-center">
                  <p className="eyebrow-tag text-ink-muted mb-1">Average</p>
                  <p className="text-display text-2xl text-ink-primary dark:text-paper-light">{averageRating.toFixed(1)}</p>
                </div>
              </div>
              <div className="card-bezel">
                <div className="card-bezel-inner p-4 text-center">
                  <p className="eyebrow-tag text-ink-muted mb-1">Count</p>
                  <p className="text-display text-2xl text-ink-primary dark:text-paper-light">{ratingCount}</p>
                </div>
              </div>
              <div className="card-bezel">
                <div className="card-bezel-inner p-4 text-center">
                  <p className="eyebrow-tag text-ink-muted mb-1">Likes</p>
                  <p className="text-display text-2xl text-ink-primary dark:text-paper-light">{favoriteCount}</p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.7, ease: easeFluid }}
          className="text-center pt-6"
        >
          <ButtonEditorial variant="ghost" size="md">
            Xem tất cả components →
          </ButtonEditorial>
        </motion.div>
      </div>
    </div>
  );
};

export default ComponentDemo;
