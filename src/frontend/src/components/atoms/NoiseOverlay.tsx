import { memo } from 'react';

/**
 * Fixed full-screen SVG noise overlay for paper/film grain texture.
 * Apply once at the top of the layout — never on scrolling containers.
 */
export const NoiseOverlay = memo(() => {
  return <div className="noise-overlay" aria-hidden />;
});

NoiseOverlay.displayName = 'NoiseOverlay';
