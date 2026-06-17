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
        // Taper Brand Colors
        navy: {
          DEFAULT: '#011745',
          mid: '#0a2d6b',
          light: '#132d5e',
        },
        'taper-blue': '#3d61a4',
        'blue-light': '#5a7fc2',
        'blue-pale': '#eef2fa',
        'blue-subtle': '#f4f6fb',
        'off-white': '#f7f8fc',
        gray: {
          50: '#f3f4f8',
          100: '#e8eaf2',
          200: '#cdd1e0',
          300: '#a4abbe',
          400: '#7b859e',
          500: '#566079',
          600: '#3b4560',
          700: '#252f4a',
          800: '#161d35',
          900: '#0b1020',
        },
      },
      fontFamily: {
        heading: ['"Plus Jakarta Sans"', 'Inter', '-apple-system', 'sans-serif'],
        body: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'card': '0 2px 12px rgba(1, 23, 69, 0.08)',
        'card-hover': '0 8px 24px rgba(1, 23, 69, 0.12)',
        'popup': '0 12px 48px rgba(1, 23, 69, 0.18)',
        'glow': '0 0 24px rgba(61, 97, 164, 0.2)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'slide-right': 'slideRight 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideRight: {
          '0%': { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      const newUtilities = {
        '.text-gradient': {
          'background': 'linear-gradient(135deg, #3d61a4 0%, #5a7fc2 100%)',
          '-webkit-background-clip': 'text',
          '-webkit-text-fill-color': 'transparent',
          'background-clip': 'text',
        },
        '.glass': {
          'background': 'rgba(255, 255, 255, 0.95)',
          'backdrop-filter': 'blur(20px)',
          'border': '1px solid rgba(255, 255, 255, 0.2)',
        },
        '.glass-dark': {
          'background': 'rgba(11, 16, 32, 0.8)',
          'backdrop-filter': 'blur(20px)',
          'border': '1px solid rgba(255, 255, 255, 0.1)',
        },
        '.truncate-2': {
          display: '-webkit-box',
          '-webkit-line-clamp': '2',
          '-webkit-box-orient': 'vertical',
          overflow: 'hidden',
        },
        '.truncate-3': {
          display: '-webkit-box',
          '-webkit-line-clamp': '3',
          '-webkit-box-orient': 'vertical',
          overflow: 'hidden',
        },
      };
      addUtilities(newUtilities);
    },
  ],
}
