import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;
if (env.smtp.host) {
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
}

const layout = (title, body) => `<!doctype html><html><body style="margin:0;background:#FCF8F6;font-family:Helvetica,Arial,sans-serif;color:#3E1220">
<div style="max-width:480px;margin:0 auto;padding:32px 24px">
<div style="font-family:Georgia,serif;font-size:28px;color:#7A1F35;margin-bottom:24px">Nissali</div>
<div style="background:#fff;border-radius:24px;padding:28px">
<h1 style="font-family:Georgia,serif;font-weight:400;font-size:22px;margin:0 0 12px">${title}</h1>${body}</div>
<p style="font-size:12px;color:#8a6a72;margin-top:24px">Ton cycle, ta foi, ta santé. Au même endroit.<br>Tu reçois cet e-mail car une action a été demandée sur ton compte Nissali.</p>
</div></body></html>`;

// État de la connexion SMTP : tant qu'elle échoue, les e-mails partent dans la console
// et les codes OTP restent affichés dans l'appli (voir otp.js), au lieu de bloquer l'inscription.
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

/** Revérifie régulièrement : l'envoi réel reprend dès que le compte SMTP est débloqué. */
export function watchMailer(intervalMs = 10 * 60_000) {
  verifyMailer();
  if (transporter) setInterval(verifyMailer, intervalMs).unref();
}

export async function sendMail({ to, subject, title, html, text }) {
  // Pas d'envoi réel vers les comptes de démonstration (adresses inexistantes → rebonds).
  if (!transporter || !ready || env.demoIdentifiers.test(to)) {
    console.log(`[mail:console] → ${to} | ${subject}\n${text || ''}`);
    return { delivered: false, console: true };
  }
  const info = await transporter.sendMail({ from: env.smtp.from, to, subject, text, html: layout(title || subject, html) });
  console.log(`[mail] envoyé à ${to} (${info.accepted?.length ? 'accepté' : 'refusé'})`);
  return { delivered: Boolean(info.accepted?.length) };
}

export function otpEmail(code, purpose) {
  const intro =
    purpose === 'admin2fa'
      ? 'Voici ton code de connexion au back-office Nissali.'
      : purpose === 'link'
        ? 'Voici ton code pour rattacher ton profil praticienne à ton compte Nissali (bascule entre espace personnel et espace pro).'
        : 'Voici ton code de vérification Nissali.';
  return {
    subject: `${code} — ton code Nissali`,
    title: 'Ton code de vérification',
    text: `${intro}\nCode : ${code}\nIl expire dans 10 minutes. Si tu n'es pas à l'origine de cette demande, ignore cet e-mail.`,
    html: `<p>${intro}</p><p style="font-size:34px;letter-spacing:8px;font-weight:700;color:#7A1F35;margin:20px 0">${code}</p><p style="color:#8a6a72">Il expire dans 10 minutes. Si tu n'es pas à l'origine de cette demande, ignore cet e-mail.</p>`,
  };
}
