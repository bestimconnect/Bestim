const { palette } = require('./src/lib/palette');

// Type scale = the Figma text styles (design-v2/design-system-plugin TYPE / TYPE_AR). `*-ar` keys are the Arabic line
// heights (Tajawal sits taller); components/ui/Text picks them. Old names (display, title, label, number…) stay for callers.
const t = (size, lh, ls) => [`${size}px`, ls ? { lineHeight: `${lh}px`, letterSpacing: `${ls}px` } : { lineHeight: `${lh}px` }];

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
        'num-xl': t(54, 56, -2.2), 'num-l': t(44, 46, -1.8), 'num-m': t(28, 30, -1.1),
        'title-l': t(28, 34, -0.6), 'title-l-ar': t(28, 36),
        'title-m': t(21, 28), 'title-m-ar': t(21, 30),
        heading: t(19, 26), 'heading-ar': t(19, 28),
        body: t(15, 24), 'body-ar': t(15, 26),
        'body-sm': t(13.5, 20), 'body-sm-ar': t(13.5, 22),
        caption: t(12.5, 18), 'caption-ar': t(12.5, 20),
        tag: t(11.5, 16, 0.2), 'tag-ar': t(11.5, 16),
        // legacy names, now on the v2 scale
        display: t(28, 34, -0.6), 'display-ar': t(28, 36),
        title: t(28, 34, -0.6), 'title-ar': t(28, 36),
        label: t(15, 24), 'label-ar': t(15, 26),
        number: t(36, 44, -1.4),
        'small-number': t(24, 32, -0.9),
      },
      borderRadius: { field: 14, item: 18, metric: 20, nav: 28, screen: 32, input: 18, row: 22, tile: 24, sheet: 36 },
    },
  },
  plugins: [],
};
