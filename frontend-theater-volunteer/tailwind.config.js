/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#4A90E2',
          secondary: '#7ED321',
          accent: '#F5A623',
          success: '#50C878',
          warning: '#FFA500',
          danger: '#FF6B6B',
          muted: '#F8F9FA',
          charcoal: '#2F2F38',
        },
      },
      fontFamily: {
        display: ['"DM Sans"', '"Inter"', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 12px 30px rgba(74, 144, 226, 0.12)',
        soft: '0 8px 18px rgba(0, 0, 0, 0.08)',
      },
      borderRadius: {
        xl: '1.5rem',
      },
    },
  },
  plugins: [],
}
