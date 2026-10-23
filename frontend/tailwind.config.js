/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b1220',
        panel: '#111a2d',
        indigo: { 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5' },
      },
      boxShadow: {
        card: '0 20px 50px rgba(2, 6, 23, 0.28)',
      },
    },
  },
  plugins: [],
}
