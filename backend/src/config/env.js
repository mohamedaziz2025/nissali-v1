const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

if (isProd && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET est obligatoire en production');
}

export const env = {
  nodeEnv,
  isProd,
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nissali',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  corsOrigins: (process.env.CORS_ORIGINS || process.env.APP_URL || 'http://localhost:3000').split(',').map((s) => s.trim()),
  // Codes OTP renvoyés dans la réponse de l'API (tests) :
  //   true  → toujours ; false → jamais ;
  //   auto  → seulement si le code ne peut pas être livré (pas de SMTP / pas de fournisseur SMS)
  //           ou pour les comptes de démonstration (DEMO_IDENTIFIERS).
  exposeDevCodes: ['true', 'false', 'auto'].includes(process.env.DEV_EXPOSE_CODES) ? process.env.DEV_EXPOSE_CODES : isProd ? 'auto' : 'true',
  demoIdentifiers: new RegExp(process.env.DEMO_IDENTIFIERS || '@nissali\\.app$|^\\+3360000000\\d$', 'i'),
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || 'Nissali <no-reply@nissali.app>',
  },
  // Envoi des codes OTP par SMS : console (dev), twilio ou brevo.
  sms: {
    provider: process.env.SMS_PROVIDER || 'console',
    sender: process.env.SMS_SENDER || 'Nissali',
    twilioSid: process.env.TWILIO_ACCOUNT_SID,
    twilioToken: process.env.TWILIO_AUTH_TOKEN,
    twilioFrom: process.env.TWILIO_FROM,
    brevoKey: process.env.BREVO_API_KEY,
  },
  defaultCountryCode: process.env.DEFAULT_COUNTRY_CODE || '33',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  // Documents des fiches clientes : jamais servis publiquement, seulement via l'API authentifiée.
  privateDir: process.env.PRIVATE_DIR || 'private',
  publicApiUrl: process.env.PUBLIC_API_URL || '',
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT || 'mailto:nissali@gmail.com',
  },
  aladhanBase: process.env.ALADHAN_BASE_URL || 'https://api.aladhan.com/v1',
  enableJobs: process.env.ENABLE_JOBS !== 'false',
  // Cookie « secure » : uniquement servi en HTTPS. À désactiver tant que le serveur est en HTTP (IP sans certificat).
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProd,
};
