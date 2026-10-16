// Service OTP : codes à 6 chiffres envoyés par e-mail ou par SMS.
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { Verification } from '../models/index.js';
import { badRequest, HttpError } from '../utils/http.js';
import { mailerReady, otpEmail, sendMail } from './mailer.js';
import { sendSms } from './sms.js';

const CODE_TTL_MS = 10 * 60_000;
const RESEND_DELAY_MS = 45_000;
const MAX_PER_HOUR = 6;
const MAX_ATTEMPTS = 5;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** E-mail ou numéro de téléphone → { channel, target } normalisé (E.164 pour les numéros). */
export function normalizeIdentifier(raw) {
  const value = String(raw || '').trim();
  if (value.includes('@')) {
    const email = value.toLowerCase();
    if (!EMAIL_RE.test(email)) throw badRequest('Adresse e-mail invalide', 'INVALID_EMAIL');
    return { channel: 'email', target: email };
  }
  let digits = value.replace(/[\s.\-()]/g, '');
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  else if (digits.startsWith('0')) digits = `+${env.defaultCountryCode}${digits.slice(1)}`;
  else if (!digits.startsWith('+')) digits = `+${digits}`;
  if (!/^\+\d{8,15}$/.test(digits)) throw badRequest('Numéro de téléphone invalide', 'INVALID_PHONE');
  return { channel: 'sms', target: digits };
}

const hash = (target, code) => crypto.createHmac('sha256', env.jwtSecret).update(`${target}:${code}`).digest('hex');

/** Le code est-il renvoyé à l'appli ? (voir DEV_EXPOSE_CODES dans config/env.js) */
export function shouldExposeCode(target, channel) {
  if (env.exposeDevCodes === 'true') return true;
  if (env.exposeDevCodes === 'false') return false;
  if (env.demoIdentifiers.test(target)) return true;
  if (channel === 'email') return !mailerReady();
  return env.sms.provider === 'console';
}

export async function sendOtp({ target, channel, purpose, user }) {
  const recent = await Verification.find({ target, createdAt: { $gte: new Date(Date.now() - 3600_000) } }).sort({ createdAt: -1 });
  if (recent[0] && Date.now() - recent[0].createdAt.getTime() < RESEND_DELAY_MS) {
    throw new HttpError(429, 'Patiente quelques secondes avant de demander un nouveau code', 'OTP_TOO_SOON');
  }
  if (recent.length >= MAX_PER_HOUR) throw new HttpError(429, 'Trop de codes demandés. Réessaie dans une heure.', 'OTP_LIMIT');

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await Verification.deleteMany({ target, purpose });
  await Verification.create({ target, channel, purpose, user: user?._id, codeHash: hash(target, code), expiresAt: new Date(Date.now() + CODE_TTL_MS) });

  const expose = shouldExposeCode(target, channel);
  try {
    if (channel === 'email') {
      await sendMail({ to: target, ...otpEmail(code, purpose) });
    } else if (!env.demoIdentifiers.test(target)) {
      await sendSms(target, `Nissali : ton code est ${code}. Il expire dans 10 minutes. Ne le partage avec personne.`);
    }
  } catch (err) {
    console.error(`[otp] envoi impossible (${channel}) :`, err.message);
    await Verification.deleteMany({ target, purpose });
    throw new HttpError(502, channel === 'email' ? 'Impossible d’envoyer l’e-mail pour le moment. Réessaie dans un instant.' : 'Impossible d’envoyer le SMS pour le moment. Essaie avec ton adresse e-mail.', 'OTP_DELIVERY_FAILED');
  }
  if (expose) console.log(`[otp] ${purpose} ${target} → ${code}`);
  return { sent: true, channel, target: mask(target, channel), ...(expose ? { devCode: code } : {}) };
}

export async function verifyOtp({ target, purpose, code }) {
  const entry = await Verification.findOne({ target, purpose, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
  if (!entry) throw badRequest('Code expiré ou introuvable. Demande un nouveau code.', 'OTP_EXPIRED');
  if (entry.attempts >= MAX_ATTEMPTS) throw badRequest('Trop de tentatives. Demande un nouveau code.', 'OTP_LOCKED');
  const expected = Buffer.from(entry.codeHash, 'hex');
  const given = Buffer.from(hash(target, String(code || '').trim()), 'hex');
  if (!crypto.timingSafeEqual(expected, given)) {
    entry.attempts += 1;
    await entry.save();
    throw badRequest('Code incorrect', 'OTP_INVALID', { attemptsLeft: MAX_ATTEMPTS - entry.attempts });
  }
  await entry.deleteOne();
  return true;
}

export function mask(target, channel) {
  if (channel === 'email') {
    const [name, domain] = target.split('@');
    return `${name.slice(0, 2)}${'•'.repeat(Math.max(1, name.length - 2))}@${domain}`;
  }
  return `${target.slice(0, 4)} ••• ${target.slice(-2)}`;
}
