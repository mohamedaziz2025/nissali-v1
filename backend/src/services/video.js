import crypto from 'node:crypto';

// Lien de visio gratuit Jitsi Meet (sans compte ni clé d'API).
export function createJitsiLink(prefix = 'Nissali') {
  return `https://meet.jit.si/${prefix}-${crypto.randomBytes(8).toString('hex')}`;
}
