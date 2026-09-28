// Design tokens (spec §4). Single source for Tailwind classes and icon colors.
const palette = {
  light: {
    lime: '#D3F53D', ink: '#222E29', teal: '#08736F', paper: '#F5F7F5', white: '#FFFFFF',
    muted: '#5B6860', line: '#DEE5DF', coral: '#F96A83', blush: '#FFE5EB', sky: '#DDEBFF',
    mint: '#E4F3D9', amber: '#FFF0CE', danger: '#AC2846',
  },
  dark: {
    lime: '#D3F53D', ink: '#F5F7F5', teal: '#2EC4B6', paper: '#0D1410', white: '#1A2420',
    muted: '#8A9B91', line: '#2A3830', coral: '#FF8FA3', blush: '#3D1F28', sky: '#1A2840',
    mint: '#1A3020', amber: '#3D3010', danger: '#FF4D6A',
  },
};

module.exports = { palette };
