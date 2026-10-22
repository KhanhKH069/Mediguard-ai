/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Be Vietnam Pro"', '"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Outfit"', '"Be Vietnam Pro"', 'sans-serif'],
      },
      colors: {
        senior: {
          blue: '#1E40AF',
          green: '#15803D',
          red: '#B91C1C',
          amber: '#B45309',
        }
      },
      boxShadow: {
        'glow-blue': '0 0 25px -3px rgba(37, 99, 235, 0.45)',
        'glow-cyan': '0 0 25px -3px rgba(6, 182, 212, 0.55)',
        'glow-emerald': '0 0 25px -3px rgba(16, 185, 129, 0.45)',
        'glow-amber': '0 0 25px -3px rgba(245, 158, 11, 0.45)',
        'glow-rose': '0 0 25px -3px rgba(244, 63, 94, 0.45)',
        'glow-purple': '0 0 25px -3px rgba(168, 85, 247, 0.45)',
        'tactile': '0 8px 0 rgba(0,0,0,0.18)',
        'tactile-pressed': '0 2px 0 rgba(0,0,0,0.18)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'laser-scan': 'laserScan 2.5s ease-in-out infinite',
        'equalizer': 'equalize 1.2s ease-in-out infinite alternate',
      },
      keyframes: {
        laserScan: {
          '0%, 100%': { transform: 'translateY(0%)', opacity: '0.9' },
          '50%': { transform: 'translateY(180px)', opacity: '1' },
        },
        equalize: {
          '0%': { height: '15%' },
          '100%': { height: '100%' }
        }
      }
    },
  },
  plugins: [],
}
