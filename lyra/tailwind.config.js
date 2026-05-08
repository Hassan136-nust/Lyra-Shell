/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'lyra-dark': '#1a1a1a',
        'lyra-darker': '#0f0f0f',
        'lyra-accent': '#3b82f6',
      },
      backdropBlur: {
        'lyra': '20px',
      },
    },
  },
  plugins: [],
}
