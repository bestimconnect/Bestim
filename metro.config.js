const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('glb'); // 3D car models

module.exports = withNativeWind(config, { input: './src/global.css' });
