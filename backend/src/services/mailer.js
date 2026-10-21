import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;
if (env.smtp.host) {
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465, // 465 : SSL/TLS direct (OVH ssl0.ovh.net)
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
}

// Logo joint à l'e-mail (image intégrée « cid ») : affiché même quand les images distantes sont bloquées.
const LOGO = { filename: 'nissali.png', path: fileURLToPath(new URL('../content/mail-logo.png', import.meta.url)), cid: 'logo@nissali' };
const FONT = `'DM Sans',Helvetica,Arial,sans-serif`;
const SERIF = `'Poppins',Helvetica,Arial,sans-serif`;
const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Même identité que l'appli et l'espace pro : fond ivoire, carte blanche arrondie, titres Poppins SemiBold, bordeaux.
const layout = (title, body, preheader = '') => {
  const site = env.appUrl.startsWith('https://') ? env.appUrl.replace(/\/$/, '') : '';
  const links = site
    ? `<a href="${site}/support" style="color:#7A1F35;text-decoration:underline">Aide</a> · <a href="${site}/privacy" style="color:#7A1F35;text-decoration:underline">Confidentialité</a> · `
    : '';
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<title>${escape(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Poppins:wght@600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#FCF8F6;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#FCF8F6">${escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FCF8F6"><tr><td align="center" style="padding:32px 16px 40px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px">
<tr><td style="padding:0 6px 22px"><img src="cid:${LOGO.cid}" width="157" height="48" alt="Nissali" style="display:block;border:0;outline:none"></td></tr>
<tr><td style="background:#FFFFFF;border:1px solid #EFE3E5;border-radius:24px;padding:32px 28px;font-family:${FONT};font-size:15px;line-height:1.6;color:#2F1219">
<h1 style="font-family:${SERIF};font-weight:600;font-size:25px;line-height:1.25;color:#3E1220;margin:0 0 14px">${escape(title)}</h1>
${body}
</td></tr>
<tr><td style="padding:24px 6px 0;font-family:${FONT};font-size:12.5px;line-height:1.6;color:#9C8288">
<div style="font-family:${SERIF};font-size:15px;color:#7A1F35;margin-bottom:6px">Ton cycle, ta foi, ta santé. Au même endroit.</div>
Tu reçois cet e-mail car une action a été demandée sur ton compte Nissali.<br>
${links}<a href="mailto:contact@nissali.fr" style="color:#7A1F35;text-decoration:underline">contact@nissali.fr</a>
</td></tr>
</table></td></tr></table>
</body></html>`;
};

// État de la connexion SMTP (affiché dans les logs au démarrage, revérifié régulièrement).
let ready = false;
export const mailerReady = () => ready;

/** Vérifie la connexion SMTP (authentification, sans envoyer de message). */
export async function verifyMailer() {
  if (!transporter) {
    console.log('[mail] pas de SMTP configuré : e-mails affichés dans la console');
    return false;
  }
  try {
    await transporter.verify();
    if (!ready) console.log(`[mail] SMTP prêt (${env.smtp.host}, ${env.smtp.user})`);
    ready = true;
  } catch (err) {
    if (ready || !verifyMailer.warned) console.error('[mail] connexion SMTP impossible :', err.message.split('\n')[0]);
    verifyMailer.warned = true;
    ready = false;
  }
  return ready;
}

export function watchMailer(intervalMs = 10 * 60_000) {
  verifyMailer();
  if (transporter) setInterval(verifyMailer, intervalMs).unref();
}

/**
 * Envoie un e-mail. `strict` : l'échec est remonté (codes de vérification) ; sinon il est seulement
 * journalisé (notifications), pour ne jamais bloquer l'action qui l'a déclenché.
 */
export async function sendMail({ to, subject, title, html, text, preheader, strict = false, attachments = [] }) {
  // Pas d'envoi réel vers les comptes de démonstration (adresses inexistantes → rebonds).
  if (!transporter || env.demoIdentifiers.test(to)) {
    if (!transporter && env.isProd && strict) throw new Error('SMTP non configuré');
    console.log(`[mail:console] → ${to} | ${subject}\n${text || ''}`);
    return { delivered: false, console: true };
  }
  try {
    const info = await transporter.sendMail({ from: env.smtp.from, to, subject, text, html: layout(title || subject, html, preheader), attachments: [LOGO, ...attachments] });
    ready = true;
    console.log(`[mail] envoyé à ${to} (${info.accepted?.length ? 'accepté' : 'refusé'})`);
    if (strict && !info.accepted?.length) throw new Error('adresse refusée par le serveur');
    return { delivered: Boolean(info.accepted?.length) };
  } catch (err) {
    console.error(`[mail] échec vers ${to} :`, err.message.split('\n')[0]);
    if (strict) throw err;
    return { delivered: false, error: err.message };
  }
}

const OTP_INTRO = {
  register: 'Bienvenue sur Nissali ! Voici ton code pour créer ton compte.',
  login: 'Voici ton code pour te connecter à Nissali.',
  reset: 'Voici ton code pour choisir un nouveau mot de passe.',
  change: 'Voici ton code pour confirmer cette adresse e-mail sur ton compte Nissali.',
  admin2fa: 'Voici ton code de connexion au back-office Nissali.',
  link: 'Voici ton code pour rattacher ton profil praticienne à ton compte Nissali (bascule entre espace personnel et espace pro).',
};

export function otpEmail(code, purpose) {
  const intro = OTP_INTRO[purpose] || 'Voici ton code de vérification Nissali.';
  const outro = 'Il expire dans 10 minutes. Ne le partage avec personne : l’équipe Nissali ne te le demandera jamais. Si tu n’es pas à l’origine de cette demande, ignore simplement cet e-mail.';
  return {
    subject: `${code} est ton code Nissali`,
    title: purpose === 'register' ? 'Bienvenue sur Nissali' : 'Ton code de vérification',
    preheader: `Ton code : ${code} — il expire dans 10 minutes.`,
    text: `${intro}\n\nCode : ${code}\n\n${outro}\n\nNissali — contact@nissali.fr`,
    html: `<p style="margin:0 0 22px">${intro}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="background:#F7E8EA;border-radius:18px;padding:20px 12px">
<div style="font-family:${FONT};font-size:11.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#76565E;margin-bottom:6px">Ton code</div>
<div style="font-family:${FONT};font-size:36px;font-weight:700;letter-spacing:10px;color:#7A1F35;padding-left:10px">${code}</div>
</td></tr></table>
<p style="margin:22px 0 0;color:#76565E;font-size:13.5px;line-height:1.6">${outro}</p>`,
  };
}
