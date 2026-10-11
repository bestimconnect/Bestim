// Design tokens (spec §4). Single source for Tailwind classes and icon colors.
// `panel` = the dark brand surface (hero, tab bar, dark cards); `onpanel` = text on it. They stay dark/light in
// both themes. The dark theme is our own (founder decision, 2026-10-01): Figma's dark screens invert the hero,
// tab bar and cards to white, which reads as a broken light theme. Here dark surfaces stay dark, in three
// steps of depth: paper (page) < white (cards) < panel (hero, tab bar). `sheet` = the background of bottom sheets
// and modals: the page colour in light, a lifted tone in dark (the system dim is invisible over a dark page).
const palette = {
  light: {
    lime: '#D3F53D', ink: '#222E29', teal: '#08736F', paper: '#F5F7F5', white: '#FFFFFF',
    muted: '#5B6860', line: '#DEE5DF', coral: '#F96A83', blush: '#FFE5EB', sky: '#DDEBFF',
    mint: '#E4F3D9', amber: '#FFF0CE', danger: '#AC2846', panel: '#222E29', onpanel: '#F5F7F5', sheet: '#F5F7F5',
  },
  dark: {
    lime: '#D3F53D', ink: '#F2F5F3', teal: '#3ECFC0', paper: '#0E1411', white: '#171F1B',
    muted: '#93A39A', line: '#2C3A32', coral: '#FF8FA3', blush: '#3D2229', sky: '#1C2B40',
    mint: '#1E3326', amber: '#3A3115', danger: '#D9435C', panel: '#212E27', onpanel: '#F5F7F5', sheet: '#1A2520',
  },
};

module.exports = { palette };
