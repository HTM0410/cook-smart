/**
 * Motion utilities - Framer Motion variants for Editorial Luxury
 * Spring physics + fluid easing for premium feel.
 */
import type { Variants, Transition, Easing } from 'framer-motion';

export const easeFluid: Easing = [0.32, 0.72, 0, 1];

export const fluidTransition: Transition = {
  duration: 0.9,
  ease: easeFluid,
};

export const springTransition: Transition = {
  type: 'spring',
  stiffness: 100,
  damping: 20,
  mass: 1,
};

/** Subtle fade up with blur for hero/display reveals */
export const fadeUp: Variants = {
  hidden: {
    opacity: 0,
    y: 32,
    filter: 'blur(8px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: fluidTransition,
  },
};

/** Crisp fade up without blur for content blocks */
export const fadeUpCrisp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: fluidTransition,
  },
};

/** Container that staggers its children's `fadeUp` */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

/** Tighter stagger for grids */
export const staggerGrid: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
};

/** Left half of Editorial Split — slides in from left */
export const splitRevealLeft: Variants = {
  hidden: { opacity: 0, x: -40, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
    transition: fluidTransition,
  },
};

/** Right half of Editorial Split — slides in from right */
export const splitRevealRight: Variants = {
  hidden: { opacity: 0, x: 40, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
    transition: fluidTransition,
  },
};

/** Scale reveal for cards/medias */
export const scaleReveal: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: fluidTransition,
  },
};

/** Image card with light parallax rotation */
export const cardReveal: Variants = {
  hidden: { opacity: 0, y: 40, rotate: -2 },
  visible: (custom: number = 0) => ({
    opacity: 1,
    y: 0,
    rotate: 0,
    transition: {
      ...fluidTransition,
      delay: custom * 0.08,
    },
  }),
};

/** Mobile drawer link stagger */
export const drawerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: easeFluid,
      delay: i * 0.06,
    },
  }),
};

/** Viewport configuration — fires once when 30% visible */
export const viewportOnce = {
  once: true,
  amount: 0.3,
} as const;

export const viewportEarly = {
  once: true,
  amount: 0.1,
} as const;

/** Magnetic button hover effect helpers */
export const magneticHover = {
  scale: 1.02,
  transition: { duration: 0.7, ease: easeFluid },
};

export const magneticTap = {
  scale: 0.98,
};
