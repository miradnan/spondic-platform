/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
        logo: ['Anton', 'sans-serif'],
      },
      colors: {
        cream: {
          DEFAULT: '#ede8df',
          light: '#f5f2ec',
          lighter: '#faf9f6',
        },
        navy: {
          DEFAULT: '#1a2740',
          light: '#243352',
        },
        brand: {
          blue: '#2d5fa0',
          'blue-hover': '#245090',
          gold: '#c49a3c',
        },
        body: '#4a4a48',
        muted: '#7a7a78',
      },
    },
  },
  plugins: [],
};
