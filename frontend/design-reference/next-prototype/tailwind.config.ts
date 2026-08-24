import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        base:      'var(--color-base)',
        surface:   'var(--color-surface)',
        'surface-2': 'var(--color-surface-2)',
        'surface-3': 'var(--color-surface-3)',
        brand:     '#197ae1',
        'brand-strong': '#1C8AFF',
        ink:       'var(--color-ink)',
        'ink-soft':'var(--color-ink-soft)',
        'ink-faint':'var(--color-ink-faint)',
        line:      'var(--color-line)',
        ai:        'var(--color-ai)',
        'ai-fill': 'var(--color-ai-fill)',
        success:   'var(--color-success-ink)',
        warning:   'var(--color-warning-ink)',
        danger:    'var(--color-danger-ink)',
        info:      'var(--color-info-ink)',
      },
      fontFamily: {
        display: ['Montserrat', 'sans-serif'],
        body:    ['Nunito Sans', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        card: 'var(--radius-card)',
        xl2:  'var(--radius-xl)',
      },
      boxShadow: {
        card:  'var(--shadow-card)',
        panel: 'var(--shadow-panel)',
      },
    },
  },
  plugins: [],
}

export default config
