/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Editorial Luxury palette
        canvas: {
          light: '#FDFBF7',
          DEFAULT: '#FFFFFF',
          dark: '#0E0C09',
        },
        paper: {
          light: '#F5F1EA',
          DEFAULT: '#F5F1EA',
          dark: '#161310',
        },
        bone: '#F7F6F3',
        warm: {
          50: '#FBFBFA',
          100: '#F7F6F3',
          200: '#F0EFEB',
          300: '#E8E7E3',
          400: '#D4D3CF',
        },
        // Editorial ink colors
        ink: {
          50: '#F5F1EA',
          100: '#E8DFD0',
          200: '#C9B89C',
          300: '#9A8769',
          400: '#6B5D4F',
          500: '#5C4A38',
          600: '#3D2E1F',
          700: '#2A2520',
          800: '#1F1B16',
          900: '#161310',
        },
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
        // Muted pastels for semantic accents
        accent: {
          red: { bg: '#FDEBEC', text: '#9F2F2D' },
          blue: { bg: '#E1F3FE', text: '#1F6C9F' },
          green: { bg: '#EDF3EC', text: '#346538' },
          yellow: { bg: '#FBF3DB', text: '#956400' },
        },
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
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
        background: {
          light: '#FDFBF7',
          dark: '#0E0C09',
        },
        foreground: {
          light: '#1A1814',
          dark: '#F5F1EA',
        },
        muted: {
          light: '#F5F1EA',
          dark: '#161310',
        },
        'muted-foreground': {
          light: '#5C4A38',
          dark: '#9A8769',
        },
      },
      fontFamily: {
        // Editorial: Serif for display headlines
        serif: ['"Instrument Serif"', 'Newsreader', '"Playfair Display"', 'Georgia', 'serif'],
        // Clean sans for body/UI — Inter (primary) → Outfit → system fallback
        sans: ['Inter', 'Outfit', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        // Display: geometric sans for hero / headings
        display: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
        // Mono for metadata
        mono: ['"JetBrains Mono"', '"SF Mono"', '"Fira Code"', 'Menlo', 'monospace'],
      },
      borderRadius: {
        'xs': '0.25rem',
        'sm': '0.5rem',
        DEFAULT: '0.5rem',
        'md': '0.625rem',
        'lg': '0.75rem',
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
        'squircle': '2rem',
        '4xl': '2.5rem',
        '5xl': '3rem',
        'full': '9999px',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '30': '7.5rem',
        '128': '32rem',
      },
      boxShadow: {
        'soft': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
        'card': '0 2px 8px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.02)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04)',
        'ambient': '0 30px 80px -20px rgba(26, 24, 20, 0.08), 0 8px 24px -8px rgba(26, 24, 20, 0.04)',
        'ambient-lg': '0 50px 120px -30px rgba(26, 24, 20, 0.12), 0 16px 40px -12px rgba(26, 24, 20, 0.06)',
        'bezel-outer': '0 1px 2px rgba(0,0,0,0.03), 0 2px 6px rgba(0,0,0,0.04)',
        'bezel-inner': 'inset 0 1px 1px rgba(255,255,255,0.6), inset 0 -1px 0 rgba(0,0,0,0.02)',
        'glow': '0 0 20px rgba(255, 79, 0, 0.3)',
        'glow-sm': '0 0 12px rgba(255, 79, 0, 0.2)',
        'glow-lg': '0 0 40px rgba(255, 79, 0, 0.35)',
        'inner-soft': 'inset 0 2px 4px 0 rgba(0,0,0,0.04)',
        'neon-orange': '0 0 15px rgba(255, 79, 0, 0.4), 0 0 30px rgba(255, 79, 0, 0.2)',
        'neon-teal': '0 0 15px rgba(20, 184, 166, 0.4), 0 0 30px rgba(20, 184, 166, 0.2)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'hero-blob': 'radial-gradient(ellipse at 30% 20%, rgba(255,79,0,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 60%, rgba(245,158,11,0.06) 0%, transparent 60%), radial-gradient(ellipse at 50% 80%, rgba(20,184,166,0.05) 0%, transparent 50%)',
        'card-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
        'mesh-gradient': 'linear-gradient(135deg, #ff4f00 0%, #ff6f33 25%, #f59e0b 50%, #14b8a6 75%, #0d9488 100%)',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
        'slide-down': 'slideDown 0.4s ease-out forwards',
        'slide-in-right': 'slideInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-left': 'slideInLeft 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'bounce-gentle': 'bounceGentle 3s infinite',
        'zoom-in': 'zoomIn 0.5s ease-out forwards',
        'pulse-soft': 'pulseSoft 2s infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'float': 'float 4s ease-in-out infinite',
        'float-slow': 'float 6s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
        'spin-slower': 'spin 5s linear infinite',
        'wiggle': 'wiggle 1s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'blob': 'blob 7s ease-in-out infinite',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up-fade': 'slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'page-in': 'pageIn 0.4s ease-out forwards',
        'heart-pop': 'heartPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        zoomIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(255, 79, 0, 0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(255, 79, 0, 0.5)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        blob: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '25%': { transform: 'translate(20px, -30px) scale(1.05)' },
          '50%': { transform: 'translate(-10px, 20px) scale(0.95)' },
          '75%': { transform: 'translate(15px, 10px) scale(1.02)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUpFade: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pageIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        heartPop: {
          '0%': { transform: 'scale(1)' },
          '25%': { transform: 'scale(1.3)' },
          '50%': { transform: 'scale(0.9)' },
          '75%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      backdropBlur: {
        'xs': '2px',
        '4xl': '72px',
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'fluid': 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      transitionDuration: {
        '700': '700ms',
        '900': '900ms',
        '1100': '1100ms',
      },
      letterSpacing: {
        editorial: '-0.03em',
        tightest: '-0.04em',
        'ultra': '-0.05em',
      },
      lineHeight: {
        editorial: '1.05',
        relaxed: '1.7',
      },
      maxWidth: {
        editorial: '72ch',
        prose: '65ch',
      },
    },
  },
  plugins: [],
}
