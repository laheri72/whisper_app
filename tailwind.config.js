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
        // University / Academic Deep Blue Palette
        academic: {
          50: '#F0F4F8',
          100: '#D9E2EC',
          200: '#BCCCDC',
          300: '#9FB3C8',
          400: '#829AB1',
          500: '#627D98',
          600: '#486581',
          700: '#334E68',
          800: '#243B53',
          900: '#102A43',
          950: '#0B192C',
        },
        // Royal Gold Accents
        gold: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
          amber: '#D4AF37',
        },
        // Quranic Feedback states
        match: {
          light: '#D1FAE5',
          DEFAULT: '#10B981',
          dark: '#065F46',
          bg: 'rgba(16, 185, 129, 0.15)',
        },
        mistake: {
          light: '#FEE2E2',
          DEFAULT: '#EF4444',
          dark: '#991B1B',
          bg: 'rgba(239, 68, 68, 0.15)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'sans-serif'],
        arabic: ['Amiri', 'Scheherazade New', 'serif'],
        quran: ['"Traditional Arabic"', 'Amiri', 'serif'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'gold-glow': '0 0 20px rgba(212, 175, 55, 0.35)',
        'deep-card': '0 10px 30px -5px rgba(11, 25, 44, 0.8)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'pulse-gold': 'pulseGold 2s infinite',
        'wave-bar': 'waveBar 1.2s ease-in-out infinite alternate',
      },
      keyframes: {
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(245, 158, 11, 0.4)' },
          '50%': { boxShadow: '0 0 0 12px rgba(245, 158, 11, 0)' },
        },
        waveBar: {
          '0%': { height: '15%' },
          '100%': { height: '100%' },
        }
      }
    },
  },
  plugins: [],
}
