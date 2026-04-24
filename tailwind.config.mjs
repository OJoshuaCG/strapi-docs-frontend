/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        brand: {
          50: 'var(--color-brand-50)',
          500: 'var(--color-brand-500)',
          900: 'var(--color-brand-900)',
        },
      },
      transitionDuration: {
        DEFAULT: 'var(--transition-duration)',
      },
      borderRadius: {
        DEFAULT: 'var(--border-radius)',
        code: 'var(--code-border-radius)',
      },
    },
  },
  plugins: [],
};
