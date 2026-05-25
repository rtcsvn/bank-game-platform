/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff1f2', 100: '#ffe4e6', 500: '#E31837', 600: '#c0102a', 700: '#9a0d22',
        }
      }
    },
  },
  plugins: [],
}
