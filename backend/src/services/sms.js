// Envoi de SMS (codes OTP). Prestataires : console (développement), Twilio, Brevo.
import { env } from '../config/env.js';

async function sendTwilio(to, body) {
  const { twilioSid, twilioToken, twilioFrom } = env.sms;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: twilioFrom, Body: body }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
}

async function sendBrevo(to, body) {
  const res = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
    method: 'POST',
    headers: { 'api-key': env.sms.brevoKey, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: env.sms.sender, recipient: to.replace('+', ''), content: body, type: 'transactional' }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
}

export async function sendSms(to, body) {
  switch (env.sms.provider) {
    case 'twilio':
      await sendTwilio(to, body);
      return { delivered: true };
    case 'brevo':
      await sendBrevo(to, body);
      return { delivered: true };
    default:
      console.log(`[sms:console] → ${to} | ${body}`);
      return { delivered: false, console: true };
  }
}
