/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*'],
  theme: {
    extend: {
      colors: {
        cage: {
          green: '#16a34a',
          'green-dark': '#15803d',
          'green-bg': '#f0fdf4',
          red: '#dc2626',
          amber: '#d97706',
          dark: '#0f172a',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'sans-serif'],
        mono: ['Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
