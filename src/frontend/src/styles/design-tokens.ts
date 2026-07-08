/**
 * Design Tokens - Food Suggest (Editorial Luxury)
 * Centralized design system values for consistent UI across the application.
 */

export const colors = {
  // Editorial ink scale
  ink: {
    50: '#F5F1EA',
    100: '#E8DFD0',
    200: '#C9B89C',
    300: '#9A8769',
    400: '#6B5D4F',
    500: '#5C4A38',
    600: '#3D2E1F',
    700: '#1A1814',
    800: '#13110D',
    900: '#0E0C09',
  },
  // Sage accent
  sage: {
    50: '#F4F6F1',
    100: '#E2E8DB',
    200: '#C5D2B8',
    300: '#A8BB95',
    400: '#95a583',
    500: '#7a8b6f',
    600: '#5E6E54',
    700: '#42513A',
  },
  primary: {
    50: '#fff4ed',
    100: '#ffe5d4',
    200: '#ffc7aa',
    300: '#ffa175',
    400: '#ff6f33',
    500: '#ff4f00',
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
  canvas: {
    light: '#FDFBF7',
    dark: '#0E0C09',
  },
  paper: {
    light: '#F5F1EA',
    dark: '#161310',
  },
  text: {
    primary: '#1A1814',
    secondary: '#5C4A38',
    muted: '#8B7A66',
    inverse: '#F5F1EA',
  },
};

export const typography = {
  fontFamily: {
    sans: "'Geist', 'Outfit', system-ui, sans-serif",
    display: "'Geist', 'Outfit', sans-serif",
    serif: "'Instrument Serif', 'Newsreader', 'Georgia', serif",
    mono: "'Geist Mono', 'JetBrains Mono', 'SF Mono', monospace",
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem',
    '6xl': '3.75rem',
    '7xl': '4.5rem',
    '8xl': '6rem',
    '9xl': '7.5rem',
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
    tight: 1.05,
    snug: 1.25,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },
  letterSpacing: {
    tightest: '-0.04em',
    editorial: '-0.03em',
    normal: '0',
    wide: '0.05em',
    wider: '0.2em',
  },
};

export const spacing = {
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
};

export const borderRadius = {
  none: '0',
  sm: '0.375rem',
  DEFAULT: '0.5rem',
  md: '0.625rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.5rem',
  '3xl': '2rem',
  squircle: '2rem',
  '4xl': '2.5rem',
  full: '9999px',
};

export const shadows = {
  soft: '0 2px 8px -2px rgba(0,0,0,0.05), 0 4px 16px -4px rgba(0,0,0,0.08)',
  card: '0 4px 20px -4px rgba(0,0,0,0.06), 0 8px 32px -8px rgba(0,0,0,0.08)',
  'card-hover': '0 8px 30px -6px rgba(0,0,0,0.1), 0 16px 48px -12px rgba(0,0,0,0.12)',
  ambient: '0 30px 80px -20px rgba(26, 24, 20, 0.08), 0 8px 24px -8px rgba(26, 24, 20, 0.04)',
  'ambient-lg': '0 50px 120px -30px rgba(26, 24, 20, 0.12), 0 16px 40px -12px rgba(26, 24, 20, 0.06)',
  'bezel-outer': '0 1px 2px rgba(0,0,0,0.03), 0 2px 6px rgba(0,0,0,0.04)',
  'bezel-inner': 'inset 0 1px 1px rgba(255,255,255,0.6), inset 0 -1px 0 rgba(0,0,0,0.02)',
  glow: '0 0 20px rgba(255, 79, 0, 0.3)',
  'glow-sm': '0 0 12px rgba(255, 79, 0, 0.2)',
  'glow-lg': '0 0 40px rgba(255, 79, 0, 0.35)',
  inner: 'inset 0 2px 4px 0 rgba(0,0,0,0.04)',
};

export const transitions = {
  fast: '150ms cubic-bezier(0.32, 0.72, 0, 1)',
  base: '300ms cubic-bezier(0.32, 0.72, 0, 1)',
  slow: '500ms cubic-bezier(0.32, 0.72, 0, 1)',
  fluid: '700ms cubic-bezier(0.32, 0.72, 0, 1)',
  bounce: '400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
};

// Editorial Luxury: Fluid easing curve used everywhere
export const easeFluid = [0.32, 0.72, 0, 1] as const;

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

export const zIndex = {
  base: 0,
  noise: 40,
  sticky: 50,
  dropdown: 60,
  fixed: 70,
  modalBackdrop: 80,
  modal: 90,
  popover: 100,
  tooltip: 110,
  toast: 120,
  fab: 130,
};

export const animationDurations = {
  instant: '50ms',
  fast: '150ms',
  normal: '300ms',
  slow: '500ms',
  slower: '700ms',
  slowest: '1000ms',
};

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

export const mealTypes = {
  breakfast: { label: 'Bữa sáng', icon: '🌅', color: 'amber' },
  lunch: { label: 'Bữa trưa', icon: '☀️', color: 'orange' },
  dinner: { label: 'Bữa tối', icon: '🌙', color: 'indigo' },
  snack: { label: 'Bữa phụ', icon: '🍿', color: 'teal' },
};

const designTokens = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  transitions,
  easeFluid,
  breakpoints,
  zIndex,
  animationDurations,
  sizes,
  categoryIcons,
  difficultyConfig,
  mealTypes,
};

export default designTokens;
