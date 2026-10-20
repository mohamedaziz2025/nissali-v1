// 3.1 / RG-01 — Connexion Google : le plugin natif exige l'URL scheme iOS (identifiant client iOS inversé).
// Il n'est ajouté que si l'identifiant client iOS Google est fourni (EAS : variable d'environnement), pour ne
// pas bloquer les builds tant que le projet Google Cloud n'est pas configuré.
module.exports = ({ config }) => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (!iosClientId) return config;
  const iosUrlScheme = `com.googleusercontent.apps.${iosClientId.replace(/\.apps\.googleusercontent\.com$/, '')}`;
  return { ...config, plugins: [...config.plugins, ['@react-native-google-signin/google-signin', { iosUrlScheme }]] };
};
