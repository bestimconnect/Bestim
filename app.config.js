// Env-gated native config (values come from .env):
// - Google Sign-In's plugin needs the iOS URL scheme (reversed iOS client ID).
// - Sign in with Apple is a signed capability; it needs the Apple Team ID, and without it even simulator builds fail.
module.exports = ({ config }) => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const appleTeamId = process.env.APPLE_TEAM_ID;
  const plugins = [...config.plugins];
  if (iosClientId) {
    const iosUrlScheme = `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}`;
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme }]);
  }
  const ios = appleTeamId ? { ...config.ios, usesAppleSignIn: true, appleTeamId } : config.ios;
  return { ...config, ios, plugins };
};
