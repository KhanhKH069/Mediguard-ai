/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        senior: {
          blue: '#1E40AF',
          green: '#15803D',
          red: '#B91C1C',
          amber: '#B45309',
        }
      }
    },
  },
  plugins: [],
}
