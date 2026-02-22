/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Public Sans', 'sans-serif'],
        heading: ['Manrope', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      colors: {
        border: '#E2E8F0',
        input: '#E2E8F0',
        ring: '#0F3D3E',
        background: '#FFFFFF',
        foreground: '#020617',
        primary: {
          DEFAULT: '#0F3D3E',
          foreground: '#FFFFFF'
        },
        secondary: {
          DEFAULT: '#F1F5F9',
          foreground: '#0F172A'
        },
        accent: {
          DEFAULT: '#F97316',
          foreground: '#FFFFFF'
        },
        muted: {
          DEFAULT: '#F8FAFC',
          foreground: '#64748B'
        },
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#020617'
        },
        destructive: {
          DEFAULT: '#EF4444',
          foreground: '#FFFFFF'
        }
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.25rem'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
}
