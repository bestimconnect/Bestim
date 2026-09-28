const { palette } = require('./src/lib/palette');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Values live in src/lib/palette.js; the active theme is injected as CSS vars in _layout.tsx.
      colors: Object.fromEntries(Object.keys(palette.light).map((k) => [k, `var(--${k})`])),
      // px strings: a unitless Tailwind lineHeight is a multiplier, not pixels.
      fontSize: {
        display: ['36px', { lineHeight: '46px' }],
        title: ['28px', { lineHeight: '38px' }],
        heading: ['20px', { lineHeight: '28px' }],
        body: ['16px', { lineHeight: '24px' }],
        label: ['16px', { lineHeight: '24px' }],
        caption: ['13px', { lineHeight: '20px' }],
        number: ['36px', { lineHeight: '44px' }],
        'small-number': ['24px', { lineHeight: '32px' }],
      },
      borderRadius: { field: 14, item: 18, metric: 20, nav: 28, screen: 32 },
    },
  },
  plugins: [],
};
