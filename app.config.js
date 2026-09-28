// Google Sign-In's native plugin needs the iOS URL scheme (reversed iOS client ID), so it's only
// added once EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is in .env. Everything else lives in app.json.
module.exports = ({ config }) => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (!iosClientId) return config;
  const iosUrlScheme = `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}`;
  return { ...config, plugins: [...config.plugins, ['@react-native-google-signin/google-signin', { iosUrlScheme }]] };
};
