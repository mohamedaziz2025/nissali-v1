// Expo Go Android n'a pas le module natif ExpoTopicSubscriptionModule importé par expo-notifications 57.
// Le stub JS évite le crash au chargement ; l'appli n'utilise pas les abonnements aux topics.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'android' && moduleName === './TopicSubscriptionModule' && context.originModulePath?.includes('expo-notifications')) {
    return { filePath: require.resolve('expo-notifications/build/TopicSubscriptionModule.js'), type: 'sourceFile' };
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
