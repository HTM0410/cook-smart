/**
 * Design Tokens - Food Suggest
 * Centralized design system values for consistent UI across the application.
 *
 * Usage: Import tokens and use them in components for consistent theming.
 * All values here are also mirrored in tailwind.config.js and index.css.
 */

/* ===== Color Tokens ===== */
export const colors = {
  primary: {
    50: '#fff4ed',
    100: '#ffe5d4',
    200: '#ffc7aa',
    300: '#ffa175',
    400: '#ff6f33',
    500: '#ff4f00', // Main brand
    600: '#f03800',
    700: '#c72602',
    800: '#9e2009',
    900: '#7e1d0c',
  },
  secondary: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    200: '#99f6e4',
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#14b8a6',
    600: '#0d9488',
    700: '#0f766e',
    800: '#115e59',
    900: '#134e4a',
  },
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    500: '#22c55e',
    600: '#16a34a',
  },
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    500: '#f59e0b',
    600: '#d97706',
  },
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    500: '#ef4444',
    600: '#dc2626',
  },
  surface: {
    light: '#f8fafc',
    dark: '#020617',
  },
  text: {
    primary: '#0f172a',
    secondary: '#64748b',
    muted: '#94a3b8',
    inverse: '#f8fafc',
  },
};

/* ===== Typography ===== */
export const typography = {
  fontFamily: {
    sans: "'Outfit', 'Inter', system-ui, sans-serif",
    display: "'Outfit', sans-serif",
  },
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',      // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
    '5xl': '3rem',     // 48px
    '6xl': '3.75rem',  // 60px
    '7xl': '4.5rem',   // 72px
  },
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  lineHeight: {
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },
};

/* ===== Spacing ===== */
export const spacing = {
  0: '0',
  1: '0.25rem',  // 4px
  2: '0.5rem',   // 8px
  3: '0.75rem',  // 12px
  4: '1rem',     // 16px
  5: '1.25rem',  // 20px
  6: '1.5rem',   // 24px
  8: '2rem',     // 32px
  10: '2.5rem',  // 40px
  12: '3rem',    // 48px
  16: '4rem',    // 64px
  20: '5rem',    // 80px
  24: '6rem',    // 96px
};

/* ===== Border Radius ===== */
export const borderRadius = {
  none: '0',
  sm: '0.375rem',  // 6px
  DEFAULT: '0.5rem', // 8px
  md: '0.625rem',   // 10px
  lg: '0.75rem',    // 12px
  xl: '1rem',       // 16px
  '2xl': '1.5rem',  // 24px
  '3xl': '2rem',    // 32px
  full: '9999px',
};

/* ===== Shadows ===== */
export const shadows = {
  soft: '0 2px 8px -2px rgba(0,0,0,0.05), 0 4px 16px -4px rgba(0,0,0,0.08)',
  card: '0 4px 20px -4px rgba(0,0,0,0.06), 0 8px 32px -8px rgba(0,0,0,0.08)',
  'card-hover': '0 8px 30px -6px rgba(0,0,0,0.1), 0 16px 48px -12px rgba(0,0,0,0.12)',
  glow: '0 0 20px rgba(255, 79, 0, 0.3)',
  'glow-sm': '0 0 12px rgba(255, 79, 0, 0.2)',
  'glow-lg': '0 0 40px rgba(255, 79, 0, 0.35)',
  inner: 'inset 0 2px 4px 0 rgba(0,0,0,0.04)',
};

/* ===== Transitions ===== */
export const transitions = {
  fast: '150ms cubic-bezier(0.16, 1, 0.3, 1)',
  base: '300ms cubic-bezier(0.16, 1, 0.3, 1)',
  slow: '500ms cubic-bezier(0.16, 1, 0.3, 1)',
  bounce: '400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
};

/* ===== Breakpoints ===== */
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

/* ===== Z-Index Scale ===== */
export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modalBackdrop: 40,
  modal: 50,
  popover: 60,
  tooltip: 70,
  toast: 80,
  fab: 90,
};

/* ===== Animation Durations ===== */
export const animationDurations = {
  instant: '50ms',
  fast: '150ms',
  normal: '300ms',
  slow: '500ms',
  slower: '700ms',
  slowest: '1000ms',
};

/* ===== Component Sizes ===== */
export const sizes = {
  button: {
    sm: { height: '2.25rem', padding: '0 1rem', fontSize: '0.75rem', borderRadius: '0.5rem' },
    md: { height: '2.75rem', padding: '0 1.5rem', fontSize: '0.875rem', borderRadius: '0.75rem' },
    lg: { height: '3.5rem', padding: '0 2rem', fontSize: '1rem', borderRadius: '1rem' },
  },
  avatar: {
    sm: '2rem',
    md: '2.5rem',
    lg: '3.5rem',
    xl: '5rem',
  },
  input: {
    sm: '2.5rem',
    md: '3rem',
    lg: '3.5rem',
  },
};

/* ===== Category Icons Mapping ===== */
export const categoryIcons: Record<string, string> = {
  'món chính': '🍽️',
  'khai vị': '🥗',
  'tráng miệng': '🍰',
  'đồ uống': '🥤',
  'món chay': '🥬',
  'món nhanh': '⚡',
  'món mặn': '🍖',
  'canh': '🍲',
  'salad': '🥙',
  'bánh': '🧁',
  'kem': '🍦',
  'nước': '🧃',
};

/* ===== Difficulty Levels ===== */
export const difficultyConfig = {
  easy: {
    label: 'Dễ',
    color: 'success',
    bgColor: 'bg-green-100 dark:bg-green-900/40',
    textColor: 'text-green-700 dark:text-green-400',
  },
  medium: {
    label: 'Vừa',
    color: 'warning',
    bgColor: 'bg-amber-100 dark:bg-amber-900/40',
    textColor: 'text-amber-700 dark:text-amber-400',
  },
  hard: {
    label: 'Khó',
    color: 'error',
    bgColor: 'bg-red-100 dark:bg-red-900/40',
    textColor: 'text-red-700 dark:text-red-400',
  },
};

/* ===== Meal Types ===== */
export const mealTypes = {
  breakfast: { label: 'Bữa sáng', icon: '🌅', color: 'amber' },
  lunch: { label: 'Bữa trưa', icon: '☀️', color: 'orange' },
  dinner: { label: 'Bữa tối', icon: '🌙', color: 'indigo' },
  snack: { label: 'Bữa phụ', icon: '🍿', color: 'teal' },
};

/* ===== Default Export ===== */
const designTokens = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  transitions,
  breakpoints,
  zIndex,
  animationDurations,
  sizes,
  categoryIcons,
  difficultyConfig,
  mealTypes,
};

export default designTokens;
