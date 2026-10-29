// Entry: the widget code registers first (the Android widget task runs this file without any screen), then the router.
// `expo` comes first: it installs the native module registry the widget modules need.
import 'expo';
import './src/widgets/register';
import 'expo-router/entry';
