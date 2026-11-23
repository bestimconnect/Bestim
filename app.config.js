// Env-gated native config (values come from .env):
// - Google Sign-In's plugin needs the iOS URL scheme (reversed iOS client ID).
// - PERSONAL_TEAM=1: a test build for a real iPhone signed with a free Apple ID (until the paid developer account
//   exists). A free ID can't sign push notifications, and must not claim the real bundle identifier (that could
//   block the App Store account from registering it), so: no push entitlement and a `.dev` identifier.
//   Google sign-in does not work in that build (its client is tied to the real identifier); email sign-in does.
//   Run `npx expo prebuild -p ios` without the flag afterwards to get the normal project back.
const { withEntitlementsPlist, withAppBuildGradle } = require('expo/config-plugins');

// Android build failed with "Duplicate class androidx.work.OneTimeWorkRequestKt": the widget library brings
// work-runtime 2.8.1, which already contains the classes of the older work-runtime-ktx 2.7.1 pulled in by another package.
const withoutWorkKtx = (config) =>
  withAppBuildGradle(config, (c) => {
    if (!c.modResults.contents.includes("module: 'work-runtime-ktx'"))
      c.modResults.contents += "\nconfigurations.all { exclude group: 'androidx.work', module: 'work-runtime-ktx' }\n";
    return c;
  });

const withoutPush = (config) =>
  withEntitlementsPlist(config, (c) => {
    delete c.modResults['aps-environment'];
    delete c.modResults['com.apple.developer.applesignin']; // a free Apple ID can't sign this either
    return c;
  });

// Home-screen widgets (src/widgets/). iOS: expo-widgets with an app group; each widget's `look` (light card / glass) is a
// setting the owner picks when editing the widget. The app group cannot be signed with a free Apple ID, so the
// PERSONAL_TEAM build leaves the widget extension out (the widget code still runs, but has nowhere to write).
// Android: react-native-android-widget, light card look only.
const look = {
  title: 'Look · الشكل',
  parameters: { look: { type: 'enum', title: 'Look · الشكل', default: 'card', values: [{ name: 'Light card · بطاقة فاتحة', value: 'card' }, { name: 'Glass · زجاجي', value: 'glass' }] } },
};
const iosWidgets = [
  { name: 'BestimNext', displayName: 'الصيانة القادمة · Next service', description: 'The next part due. أقرب قطعة تحتاج صيانة.', ios: { supportedFamilies: ['systemSmall'], configuration: look } },
  { name: 'BestimKm', displayName: 'العداد · Odometer', description: 'Your km, confirm or edit in one tap. العداد مع تأكيد أو تعديل.', ios: { supportedFamilies: ['systemSmall'], configuration: look } },
  { name: 'BestimDashboard', displayName: 'لوحة السيارة · Car dashboard', description: 'Health score and the three most urgent parts. صحة السيارة وأهم ٣ قطع.', ios: { supportedFamilies: ['systemMedium'], configuration: look } },
  { name: 'BestimQuick', displayName: 'اختصارات سريعة · Quick actions', description: 'Voice log, scan odometer, fuel, expense. سجّل بصوتك، صوّر العداد، بنزين، مصروف.', ios: { supportedFamilies: ['systemLarge'], configuration: look } },
  { name: 'BestimSpend', displayName: 'مصاريف الشهر · Month spend', description: 'This month spending. مصاريف هذا الشهر.', ios: { supportedFamilies: ['systemSmall'], configuration: look } },
  { name: 'BestimLock', displayName: 'شاشة القفل · Lock screen', description: 'Car health and next service on the lock screen. صحة السيارة والصيانة القادمة.', ios: { supportedFamilies: ['accessoryCircular', 'accessoryRectangular', 'accessoryInline'] } },
];
const androidWidgets = [
  { name: 'BestimNext', label: 'الصيانة القادمة', description: 'أقرب قطعة تحتاج صيانة', minWidth: '110dp', minHeight: '110dp', targetCellWidth: 2, targetCellHeight: 2, resizeMode: 'none', widgetCategory: 'home_screen|keyguard' },
  { name: 'BestimKm', label: 'العداد', description: 'العداد مع تأكيد أو تعديل', minWidth: '110dp', minHeight: '110dp', targetCellWidth: 2, targetCellHeight: 2, resizeMode: 'none', widgetCategory: 'home_screen|keyguard' },
  { name: 'BestimDashboard', label: 'لوحة السيارة', description: 'صحة السيارة وأهم ٣ قطع', minWidth: '250dp', minHeight: '110dp', targetCellWidth: 4, targetCellHeight: 2, resizeMode: 'none' },
  { name: 'BestimQuick', label: 'اختصارات سريعة', description: 'سجّل بصوتك، صوّر العداد، بنزين، مصروف', minWidth: '250dp', minHeight: '250dp', targetCellWidth: 4, targetCellHeight: 4, resizeMode: 'none' },
  { name: 'BestimSpend', label: 'مصاريف الشهر', description: 'مصاريف هذا الشهر', minWidth: '110dp', minHeight: '110dp', targetCellWidth: 2, targetCellHeight: 2, resizeMode: 'none' },
];

module.exports = ({ config }) => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const personal = process.env.PERSONAL_TEAM === '1';
  // First in the list = runs last, after expo-notifications has added the entitlement.
  const plugins = [...(personal ? [withoutPush] : []), withoutWorkKtx, ...config.plugins, ['react-native-android-widget', { widgets: androidWidgets }]];
  if (!personal) plugins.push(['expo-widgets', { widgets: iosWidgets }], 'expo-apple-authentication'); // Apple sign-in cannot be signed with a free Apple ID either
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
