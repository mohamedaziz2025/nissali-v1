// Inscription et connexion par code OTP envoyé par e-mail OU par SMS.
// Back-office : mot de passe + code OTP (double authentification, 8.3).
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AuditLog, Booking, User } from '../models/index.js';
import { getPractitionerFor, activePlanFor, trialInfo } from '../services/marketplace.js';
import { normalizeIdentifier, sendOtp, verifyOtp } from '../services/otp.js';
import { endSession, startSession } from '../services/session.js';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../utils/http.js';

const router = Router();

// Limite les demandes de codes et les tentatives de connexion (pas /me ni /logout).
const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Trop de tentatives, réessaie dans quelques minutes.', code: 'RATE_LIMIT' } });
router.use(['/otp', '/register', '/login', '/admin'], limiter);

const MIN_AGE = 15; // 8.2 : inscription refusée en dessous de 15 ans

const findByIdentifier = ({ channel, target }) => User.findOne(channel === 'email' ? { email: target } : { phone: target });

export async function sessionPayload(user) {
  const practitioner = await getPractitionerFor(user);
  let pro = null;
  if (practitioner) {
    const { plan, subscription } = await activePlanFor(practitioner);
    pro = {
      id: practitioner.id,
      displayName: practitioner.displayName,
      status: practitioner.status,
      specialty: practitioner.specialty,
      photoUrl: practitioner.photoUrl,
      plan: plan ? { key: plan.key, name: plan.name, features: plan.features } : null,
      subscriptionStatus: subscription?.status || null,
      trial: trialInfo(subscription, plan),
      // Demandes de rendez-vous en attente (pastille du sélecteur de compte)
      pendingBookings: await Booking.countDocuments({ practitioner: practitioner._id, status: 'en_attente', startAt: { $gte: new Date() } }),
    };
  }
  return { user: user.toPublic(), practitioner: pro };
}

export const citySchema = z.object({
  name: z.string().min(1).max(120),
  admin: z.string().max(120).optional().default(''),
  country: z.string().max(120).optional().default(''),
  countryCode: z.string().max(4).optional().default(''),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  timezone: z.string().max(64).optional().default('Europe/Paris'),
  source: z.enum(['manuel', 'gps']).optional().default('manuel'),
});

const otpRequest = z.object({
  identifier: z.string().min(3).max(120),
  purpose: z.enum(['register', 'login']),
});

// L'inscription se fait uniquement par e-mail ; le numéro de téléphone est facultatif, ajouté ensuite dans le profil.
function assertEmailSignup(id) {
  if (id.channel !== 'email') throw badRequest('L’inscription se fait avec ton adresse e-mail. Tu pourras ajouter ton numéro ensuite dans ton profil.', 'EMAIL_REQUIRED');
}

router.post('/otp', validate(otpRequest), async (req, res) => {
  const id = normalizeIdentifier(req.body.identifier);
  if (req.body.purpose === 'register') assertEmailSignup(id);
  const existing = await findByIdentifier(id);
  if (req.body.purpose === 'register' && existing) throw conflict('Un compte existe déjà avec cet identifiant. Connecte-toi.', 'ACCOUNT_EXISTS');
  if (req.body.purpose === 'login') {
    if (!existing) throw notFound('Aucun compte avec cet identifiant. Inscris-toi en quelques secondes.');
    if (existing.role === 'admin') throw forbidden('Utilise la connexion administratrice.', 'ADMIN_LOGIN_REQUIRED');
    if (existing.status === 'suspendue') throw forbidden('Ce compte est suspendu. Contacte contact@nissali.fr.', 'SUSPENDED');
  }
  res.json(await sendOtp({ ...id, purpose: req.body.purpose, user: existing }));
});

const registerSchema = z
  .object({
    identifier: z.string().min(3).max(120),
    code: z.string().regex(/^\d{6}$/, 'Le code contient 6 chiffres'),
    accountType: z.enum(['personnel', 'pro']).default('personnel'),
    firstName: z.string().trim().min(1, 'Ton prénom est obligatoire').max(60),
    age: z.number().int().min(MIN_AGE, `Nissali est accessible à partir de ${MIN_AGE} ans`).max(100).optional(),
    city: citySchema.optional(),
    situation: z.enum(['mariee', 'celibataire']).optional(),
    consents: z.object({
      terms: z.literal(true, { errorMap: () => ({ message: 'Accepte les conditions d’utilisation et la politique de confidentialité' }) }),
      health: z.boolean().default(false),
      marketingEmail: z.boolean().default(false),
      marketingSms: z.boolean().default(false),
      marketingWhatsapp: z.boolean().default(false),
    }),
  })
  .superRefine((v, ctx) => {
    // RG-05 bis : prénom, âge, ville, situation pour le compte personnel.
    if (v.accountType === 'personnel') {
      if (v.age == null) ctx.addIssue({ code: 'custom', path: ['age'], message: 'Ton âge est obligatoire' });
      if (!v.city) ctx.addIssue({ code: 'custom', path: ['city'], message: 'Ta ville est obligatoire' });
      if (!v.situation) ctx.addIssue({ code: 'custom', path: ['situation'], message: 'Ta situation est obligatoire' });
    }
  });

router.post('/register', validate(registerSchema), async (req, res) => {
  const b = req.body;
  const id = normalizeIdentifier(b.identifier);
  assertEmailSignup(id);
  if (await findByIdentifier(id)) throw conflict('Un compte existe déjà avec cet identifiant. Connecte-toi.', 'ACCOUNT_EXISTS');
  await verifyOtp({ target: id.target, purpose: 'register', code: b.code });

  const now = new Date();
  const consent = (accepted) => ({ accepted: Boolean(accepted), at: accepted ? now : undefined });
  const user = await User.create({
    firstName: b.firstName,
    birthYear: b.age != null ? now.getUTCFullYear() - b.age : undefined, // RG-05 bis
    city: b.city,
    situation: b.situation,
    ...(id.channel === 'email' ? { email: id.target, emailVerified: true } : { phone: id.target, phoneVerified: true }),
    consents: {
      terms: consent(true),
      health: consent(b.consents.health),
      marketingEmail: consent(b.consents.marketingEmail),
      marketingSms: consent(b.consents.marketingSms),
      marketingWhatsapp: consent(b.consents.marketingWhatsapp),
    },
    lastSpace: b.accountType === 'pro' ? 'pro' : 'personnel',
  });
  const token = await startSession(req, res, user);
  res.status(201).json({ ...(await sessionPayload(user)), token });
});

const loginSchema = z.object({ identifier: z.string().min(3).max(120), code: z.string().regex(/^\d{6}$/, 'Le code contient 6 chiffres') });

router.post('/login', validate(loginSchema), async (req, res) => {
  const id = normalizeIdentifier(req.body.identifier);
  const user = await findByIdentifier(id);
  if (!user) throw notFound('Aucun compte avec cet identifiant.');
  if (user.role === 'admin') throw forbidden('Utilise la connexion administratrice.', 'ADMIN_LOGIN_REQUIRED');
  if (user.status === 'suspendue') throw forbidden('Ce compte est suspendu.', 'SUSPENDED');
  await verifyOtp({ target: id.target, purpose: 'login', code: req.body.code });
  user.lastActiveAt = new Date();
  await user.save();
  const token = await startSession(req, res, user);
  res.json({ ...(await sessionPayload(user)), token });
});

// --- Mot de passe facultatif (après une première inscription par code) ------------

const passwordField = z.string().min(8, 'Le mot de passe contient au moins 8 caractères').max(128);

router.post('/password/login', validate(z.object({ identifier: z.string().min(3).max(120), password: z.string().min(1).max(128) })), async (req, res) => {
  const id = normalizeIdentifier(req.body.identifier);
  const user = await User.findOne(id.channel === 'email' ? { email: id.target } : { phone: id.target }).select('+passwordHash');
  if (user?.role === 'admin') throw forbidden('Utilise la connexion administratrice.', 'ADMIN_LOGIN_REQUIRED');
  if (user && !user.passwordHash) throw badRequest('Tu n’as pas encore de mot de passe : connecte-toi avec un code.', 'NO_PASSWORD');
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) throw unauthorized('Identifiant ou mot de passe incorrect', 'BAD_CREDENTIALS');
  if (user.status === 'suspendue') throw forbidden('Ce compte est suspendu.', 'SUSPENDED');
  user.lastActiveAt = new Date();
  await user.save();
  const token = await startSession(req, res, user);
  res.json({ ...(await sessionPayload(user)), token });
});

// Mot de passe oublié : un code est envoyé, puis le nouveau mot de passe est enregistré.
router.post('/password/forgot', validate(z.object({ identifier: z.string().min(3).max(120) })), async (req, res) => {
  const id = normalizeIdentifier(req.body.identifier);
  const user = await findByIdentifier(id);
  if (!user) throw notFound('Aucun compte avec cet identifiant.');
  if (user.role === 'admin') throw forbidden('Contacte l’équipe technique pour réinitialiser un accès administrateur.', 'ADMIN_LOGIN_REQUIRED');
  res.json(await sendOtp({ ...id, purpose: 'reset', user }));
});

router.post(
  '/password/reset',
  validate(z.object({ identifier: z.string().min(3).max(120), code: z.string().regex(/^\d{6}$/, 'Le code contient 6 chiffres'), password: passwordField })),
  async (req, res) => {
    const id = normalizeIdentifier(req.body.identifier);
    const user = await findByIdentifier(id);
    if (!user || user.role === 'admin') throw notFound('Aucun compte avec cet identifiant.');
    await verifyOtp({ target: id.target, purpose: 'reset', code: req.body.code });
    user.passwordHash = await bcrypt.hash(req.body.password, 12);
    user.passwordSet = true;
    if (id.channel === 'email') user.emailVerified = true;
    else user.phoneVerified = true;
    await user.save();
    const token = await startSession(req, res, user);
    res.json({ ...(await sessionPayload(user)), token });
  },
);

export { passwordField };

// --- Back-office : connexion par mot de passe seul -------------

const adminLoginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });

router.post('/admin/login', validate(adminLoginSchema), async (req, res) => {
  const user = await User.findOne({ email: req.body.email.toLowerCase(), role: 'admin' }).select('+passwordHash');
  if (!user?.passwordHash || !(await bcrypt.compare(req.body.password, user.passwordHash))) throw unauthorized('E-mail ou mot de passe incorrect', 'BAD_CREDENTIALS');
  if (user.status === 'suspendue') throw forbidden('Ce compte est suspendu.', 'SUSPENDED');
  await startSession(req, res, user, { days: 1 });
  await AuditLog.create({ admin: user._id, action: 'connexion_backoffice' });
  res.json(await sessionPayload(user));
});

const adminVerifySchema = z.object({ email: z.string().email(), code: z.string().regex(/^\d{6}$/) });

router.post('/admin/verify', validate(adminVerifySchema), async (req, res) => {
  const user = await User.findOne({ email: req.body.email.toLowerCase(), role: 'admin' });
  if (!user) throw unauthorized();
  await verifyOtp({ target: user.email, purpose: 'admin2fa', code: req.body.code });
  await startSession(req, res, user, { days: 1 });
  await AuditLog.create({ admin: user._id, action: 'connexion_backoffice' });
  res.json(await sessionPayload(user));
});

router.post('/logout', (req, res) => {
  endSession(req, res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  res.json(await sessionPayload(req.user));
});

export default router;
