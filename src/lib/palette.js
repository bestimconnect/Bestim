// Design tokens, v2 (decisions Q133; source: design-v2/reference-ar-light/v2-all-flows.html `.phone` vars).
// Single source for Tailwind classes and icon colors. Flat look: grey canvas (`paper`), soft tiles (`white` = the v2 card),
// floating nav pill (`nav`), lime voice button. The dark theme is our own (founder, 2026-10-01).
// Old names stay so untouched screens render: white = card, muted = sub, line = hair, teal = the green accent (g),
// danger/coral = bad, mint/amber/blush = the ok/soon/late tints, sky = the violet tint. `panel`/`onpanel` = the dark brand
// surface and its text (both themes). `btn`/`onbtn` = primary button (dark green + lime label in light, lime in dark).
// v2 design-system names (Figma variables, design-v2/design-system-plugin): gl = Brand/Green soft, onlime = Brand/On lime,
// avatar = Avatar, cat2 = Category/2 (Category/1 = ok, Category/3 = violet). See docs/design-system-audit.md.
// Tints are the v2 rgba tints flattened over the card colour (hex, so nothing breaks when a screen adds alpha).
const palette = {
  light: {
    lime: '#D3F53D', ink: '#171B19', teal: '#4C9A4A', paper: '#EBEBE8', white: '#FFFFFF',
    muted: '#7A837E', line: '#E7E8E6', coral: '#D6455F', blush: '#F6E2E4', sky: '#E7E6F5',
    mint: '#E3EDE1', amber: '#F7EDDB', danger: '#D6455F', panel: '#222E29', onpanel: '#F5F7F5', sheet: '#F1F1F0',
    ok: '#4C9A4A', soon: '#E0A23A', late: '#D6455F', okTint: '#E3EDE1', soonTint: '#F7EDDB', lateTint: '#F6E2E4',
    tick: '#DCDFDC', nav: '#FFFFFF', btn: '#222E29', onbtn: '#D3F53D', violet: '#6C63D6',
    gl: '#9BC796', onlime: '#171B19', avatar: '#2C3A33', cat2: '#E0A23A',
  },
  dark: {
    lime: '#D3F53D', ink: '#EEF2EF', teal: '#D3F53D', paper: '#0F1412', white: '#1A211E',
    muted: '#8B9690', line: '#252D29', coral: '#FF6B86', blush: '#322324', sky: '#282C38',
    mint: '#313B1F', amber: '#37321F', danger: '#FF6B86', panel: '#1D2421', onpanel: '#F5F7F5', sheet: '#1D2421',
    ok: '#D3F53D', soon: '#F0B44C', late: '#FF6B86', okTint: '#313B1F', soonTint: '#37321F', lateTint: '#322324',
    tick: '#2A322E', nav: '#1D2421', btn: '#D3F53D', onbtn: '#16201B', violet: '#8F88F0',
    gl: '#B7D93A', onlime: '#171B19', avatar: '#2C3A33', cat2: '#E0A23A',
  },
};

module.exports = { palette };
