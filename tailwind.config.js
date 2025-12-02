/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './**/*.{js,ts,jsx,tsx}',
    '!./node_modules/**',
    '!./backend/**',
    '!./dist/**',
  ],
  theme: {
    extend: {
      // Map Punkt colors to Tailwind utilities
      colors: {
        // Oslo Brand Colors
        'oslo-blue': {
          DEFAULT: 'var(--pkt-color-brand-dark-blue-1000)',
          50: 'var(--pkt-color-brand-dark-blue-50)',
          100: 'var(--pkt-color-brand-dark-blue-100)',
          700: 'var(--pkt-color-brand-dark-blue-700)',
          1000: 'var(--pkt-color-brand-dark-blue-1000)',
        },
        'oslo-beige': {
          DEFAULT: 'var(--pkt-color-brand-beige-400)',
          100: 'var(--pkt-color-brand-beige-100)',
          200: 'var(--pkt-color-brand-beige-200)',
          300: 'var(--pkt-color-brand-beige-300)',
          400: 'var(--pkt-color-brand-beige-400)',
        },
        'oslo-green': {
          DEFAULT: 'var(--pkt-color-brand-green-700)',
          300: 'var(--pkt-color-brand-green-300)',
          500: 'var(--pkt-color-brand-green-500)',
          700: 'var(--pkt-color-brand-green-700)',
        },

        // Semantic Colors
        success: {
          DEFAULT: 'var(--pkt-color-success-500)',
          100: 'var(--pkt-color-success-100)',
          500: 'var(--pkt-color-success-500)',
          700: 'var(--pkt-color-success-700)',
        },
        warning: {
          DEFAULT: 'var(--pkt-color-warning-500)',
          100: 'var(--pkt-color-warning-100)',
          500: 'var(--pkt-color-warning-500)',
        },
        error: {
          DEFAULT: 'var(--pkt-color-error-500)',
          100: 'var(--pkt-color-error-100)',
          500: 'var(--pkt-color-error-500)',
        },
        info: {
          DEFAULT: 'var(--pkt-color-info-500)',
          100: 'var(--pkt-color-info-100)',
          500: 'var(--pkt-color-info-500)',
        },
      },

      // Typography
      fontFamily: {
        sans: ['var(--pkt-font-family-sans)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'body-sm': 'var(--pkt-font-size-body-small)',
        'body-md': 'var(--pkt-font-size-body-medium)',
        'body-lg': 'var(--pkt-font-size-body-large)',
        'heading-sm': 'var(--pkt-font-size-heading-small)',
        'heading-md': 'var(--pkt-font-size-heading-medium)',
        'heading-lg': 'var(--pkt-font-size-heading-large)',
      },

      // Spacing (extends default scale)
      spacing: {
        'pkt-01': 'var(--pkt-spacing-01)',
        'pkt-02': 'var(--pkt-spacing-02)',
        'pkt-03': 'var(--pkt-spacing-03)',
        'pkt-04': 'var(--pkt-spacing-04)',
        'pkt-05': 'var(--pkt-spacing-05)',
        'pkt-06': 'var(--pkt-spacing-06)',
        'pkt-08': 'var(--pkt-spacing-08)',
        'pkt-10': 'var(--pkt-spacing-10)',
      },

      // Border Radius
      borderRadius: {
        'pkt-sm': 'var(--pkt-border-radius-small)',
        'pkt-md': 'var(--pkt-border-radius-medium)',
        'pkt-lg': 'var(--pkt-border-radius-large)',
      },

      // Z-Index scale (coordinated with Punkt CSS and Radix UI)
      zIndex: {
        'dropdown': '1000',        // Dropdowns
        'sticky': '1020',          // Sticky headers
        'fixed': '1030',           // Fixed headers/footers
        'modal-backdrop': '1040',  // Modal overlays
        'modal': '1050',           // Modal content
        'popover': '1060',         // Popovers/tooltips
        'tooltip': '1070',         // Tooltips (highest)
      },
    },
  },
  plugins: [],
};
