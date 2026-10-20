// Chiffrement des données personnelles sensibles au repos (RG-35 : notes) : AES-256-GCM, clé dérivée de
// NOTES_KEY (ou, à défaut, de JWT_SECRET). Format stocké : « v1:iv:tag:données » en base64.
import crypto from 'node:crypto';
import { env } from '../config/env.js';

const key = crypto.hkdfSync('sha256', Buffer.from(process.env.NOTES_KEY || env.jwtSecret), Buffer.from('nissali'), Buffer.from('notes-v1'), 32);
const KEY = Buffer.from(key);

export function seal(text) {
  if (text == null || text === '') return text;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const data = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

export function open(sealed) {
  if (!sealed || !String(sealed).startsWith('v1:')) return sealed || '';
  try {
    const [, iv, tag, data] = sealed.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

// 4.14 · 9.7 — justificatifs des praticiennes chiffrés au repos (fichiers) : iv (12) + tag (16) + données.
export function sealBuffer(buf) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const data = Buffer.concat([cipher.update(buf), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]);
}

export function openBuffer(buf) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
}
