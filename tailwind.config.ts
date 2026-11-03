/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#000000',
        'core-cyan': '#00f0ff',
        'core-white': '#e8e8e8',
        'data-blue': '#1a3a5c',
        'data-dim': '#0a0f1a',
        'chrome-highlight': '#c0c8d4',
      },
      fontFamily: {
        sans: ['"Inter Variable"', '"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'monospace'],
      },
      fontSize: {
        'hero': ['clamp(3rem, 8vw, 9rem)', { lineHeight: '0.9', letterSpacing: '-0.04em', fontWeight: '800' }],
        'section': ['clamp(2rem, 5vw, 5rem)', { lineHeight: '1.0', letterSpacing: '-0.03em', fontWeight: '700' }],
        'micro': ['0.625rem', { lineHeight: '1.4', letterSpacing: '0.08em' }],
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
