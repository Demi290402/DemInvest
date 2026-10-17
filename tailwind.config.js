/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Palette Core Ufficiale Master Prompt 4
        navy: {
          950: '#0A0F1D', // Sfondo ultra-profondo
          900: '#0F172A', // Deep Navy base
          850: '#141E33', // Deep Navy elevato
          800: '#1E293B', // Graphite Navy
          700: '#334155',
          600: '#475569',
        },
        graphite: {
          900: '#121824',
          850: '#1A2234',
          800: '#1E293B', // Graphite base
          700: '#334155',
          600: '#475569',
          500: '#64748B',
        },
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981', // Smart Green (#10B981)
          600: '#059669',
          700: '#0F766E', // Emerald Teal (#0F766E)
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
          teal: '#0F766E', // Emerald Teal
          smart: '#10B981', // Smart Green
        },
        mist: '#E2E8F0', // Soft Mist
        clean: '#F8FAFC', // Clean White
        // Colori Funzionali Ufficiali (Sezione 3.3 Prompt 4)
        functional: {
          positive: '#22C55E', // Positive / Rialzista
          warning: '#F59E0B',  // Warning / Attenzione
          risk: '#EF4444',     // Risk / Ribassista / Invalidazione
          insight: '#06B6D4',  // Info / Insight AI
        },
        anthracite: {
          700: '#334155',
          800: '#1E293B',
          850: '#162032',
          900: '#0F172A',
          950: '#0A0F1D',
        },
      },
      boxShadow: {
        'soft-glow': '0 0 20px -5px rgba(16, 185, 129, 0.15)',
        'cyan-glow': '0 0 20px -5px rgba(6, 182, 212, 0.2)',
        'card-elevated': '0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
}
