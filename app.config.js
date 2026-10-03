// Env-gated native config (values come from .env):
// - Google Sign-In's plugin needs the iOS URL scheme (reversed iOS client ID).
// - PERSONAL_TEAM=1: a test build for a real iPhone signed with a free Apple ID (until the paid developer account
//   exists). A free ID can't sign push notifications, and must not claim the real bundle identifier (that could
//   block the App Store account from registering it), so: no push entitlement and a `.dev` identifier.
//   Google sign-in does not work in that build (its client is tied to the real identifier); email sign-in does.
//   Run `npx expo prebuild -p ios` without the flag afterwards to get the normal project back.
const { withEntitlementsPlist } = require('expo/config-plugins');

const withoutPush = (config) =>
  withEntitlementsPlist(config, (c) => {
    delete c.modResults['aps-environment'];
    return c;
  });

module.exports = ({ config }) => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const personal = process.env.PERSONAL_TEAM === '1';
  // First in the list = runs last, after expo-notifications has added the entitlement.
  const plugins = [...(personal ? [withoutPush] : []), ...config.plugins];
  if (iosClientId) {
    const iosUrlScheme = `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}`;
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme }]);
  }
  return {
    ...config,
    ios: personal ? { ...config.ios, bundleIdentifier: `${config.ios.bundleIdentifier}.dev` } : config.ios,
    plugins,
  };
};
