const { palette } = require('./src/lib/palette');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Values live in src/lib/palette.js; the active theme is injected as CSS vars in _layout.tsx.
      colors: Object.fromEntries(Object.keys(palette.light).map((k) => [k, `var(--${k})`])),
      fontSize: {
        display: [36, { lineHeight: 46 }],
        title: [28, { lineHeight: 38 }],
        heading: [20, { lineHeight: 28 }],
        body: [16, { lineHeight: 24 }],
        label: [16, { lineHeight: 24 }],
        caption: [13, { lineHeight: 20 }],
        number: [36, { lineHeight: 44 }],
        'small-number': [24, { lineHeight: 32 }],
      },
      borderRadius: { field: 14, item: 18, metric: 20, nav: 28, screen: 32 },
    },
  },
  plugins: [],
};
