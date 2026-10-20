// 4.14 — Devenir praticienne dans l'appli (RG-50 : un seul compte, le profil pro s'ajoute au compte perso).
// Parcours « Configurer mon profil praticienne » en 4 écrans (métier/lieux/ville, présentation et tarif,
// justificatifs, aperçu et envoi), brouillon repris dans l'appli et sur le site ; « Mon espace praticienne »
// (visible / en pause, chiffres) ; suppression du profil praticienne seul (9.4).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Category, Conversation, Message, Practitioner, Service, User } from '../models/index.js';
import { bestCity } from '../services/geo.js';
import { mask } from '../services/otp.js';
import { activePlanFor, getPractitionerFor, specialtyLabelOf } from '../services/marketplace.js';
import { attachCheckout, signupPlan, subscribe } from './pro.js';
import { sendMail } from '../services/mailer.js';
import { notify } from '../services/notifications.js';
import { purgePractitioner } from '../services/purge.js';
import { openBuffer, sealBuffer } from '../services/secretBox.js';
import { badRequest, conflict, notFound } from '../utils/http.js';
import { sessionPayload } from './auth.js';

const router = Router();
router.use(requireAuth);

const DOC_KINDS = ['identity', 'diploma', 'rcPro'];
const docDir = path.join(path.resolve(env.privateDir), 'pro-docs');
fs.mkdirSync(docDir, { recursive: true });
const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^(application\/pdf|image\/(jpeg|png))$/.test(file.mimetype)),
});
const photoDir = path.resolve(env.uploadDir);
const photoUpload = multer({
  storage: multer.diskStorage({ destination: photoDir, filename: (_req, file, cb) => cb(null, `${crypto.randomBytes(12).toString('hex')}${path.extname(file.originalname).toLowerCase() || '.jpg'}`) }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype)),
});

const draftOf = (user) => ({ step: 1, data: {}, documents: {}, ...(user.proDraft || {}) });
const docMeta = (d) => (d ? { name: d.name, size: d.size, uploadedAt: d.uploadedAt } : null);

/** Nom affiché imposé : prénom + initiale du nom (9.6). */
const displayNameOf = (firstName, lastName) => `${String(firstName || '').trim()} ${String(lastName || '').trim().charAt(0).toUpperCase()}${lastName ? '.' : ''}`.trim();

/** Équipe : notification interne + e-mail pour un dossier à vérifier ou à revérifier. */
async function notifyTeam(p, detail, subject = 'Nouvelle praticienne à vérifier') {
  const admins = await User.find({ role: 'admin' }).lean();
  for (const a of admins) {
    await notify(a._id, { key: `pro-dossier-${p.id}-${Date.now()}`, type: 'pro', title: 'Nissali', body: subject, detail, link: '/admin/praticiennes' }, { sendPush: false }).catch(() => {});
    if (a.email) await sendMail({ to: a.email, subject, html: `<p>${detail}</p>`, text: detail }).catch(() => {});
  }
}

router.get('/', async (req, res) => {
  const [p, categories] = await Promise.all([getPractitionerFor(req.user), Category.find({ active: true }).sort({ order: 1 }).lean()]);
  const draft = draftOf(req.user);
  res.json({
    practitioner: p ? { id: p.id, status: p.status, visible: p.visible !== false, displayName: p.displayName } : null,
    draft: { step: draft.step, data: draft.data, later: Boolean(draft.later), documents: Object.fromEntries(DOC_KINDS.map((k) => [k, docMeta(draft.documents?.[k])])) },
    categories: categories.map((c) => ({ key: c.key, label: c.label, requiresRpps: c.requiresRpps, requiresSterile: c.requiresSterile, disclaimer: c.disclaimer })),
    firstName: req.user.firstName,
    city: req.user.city?.name || '',
    phone: req.user.phone || '',
  });
});

// Brouillon enregistré à chaque écran ; « Plus tard » marque le profil « à compléter ».
router.put(
  '/draft',
  validate(z.object({ step: z.number().int().min(1).max(4), data: z.record(z.any()).optional(), later: z.boolean().optional() })),
  async (req, res) => {
    if (await getPractitionerFor(req.user)) throw conflict('Tu as déjà un profil praticienne');
    const draft = draftOf(req.user);
    const data = { ...draft.data, ...(req.body.data || {}) };
    if (JSON.stringify(data).length > 20_000) throw badRequest('Brouillon trop volumineux');
    req.user.proDraft = { ...draft, step: Math.max(draft.step || 1, req.body.step), data, later: req.body.later ?? draft.later, updatedAt: new Date() };
    req.user.markModified('proDraft');
    await req.user.save();
    res.json({ ok: true, step: req.user.proDraft.step });
  },
);

// 9.7 — justificatifs (PDF/JPG/PNG, 10 Mo max), chiffrés au repos, vus seulement par l'équipe.
router.post('/documents/:kind', docUpload.single('file'), async (req, res) => {
  if (!DOC_KINDS.includes(req.params.kind)) throw notFound();
  if (!req.file) throw badRequest('Fichier PDF, JPG ou PNG attendu (10 Mo max)');
  const storedName = `${crypto.randomBytes(16).toString('hex')}.bin`;
  await fs.promises.writeFile(path.join(docDir, storedName), sealBuffer(req.file.buffer));
  const meta = { storedName, name: req.file.originalname.slice(0, 120), mime: req.file.mimetype, size: req.file.size, uploadedAt: new Date() };
  const p = await getPractitionerFor(req.user);
  const previous = p ? p.documents?.[req.params.kind] : req.user.proDraft?.documents?.[req.params.kind];
  if (previous?.storedName) fs.rm(path.join(docDir, previous.storedName), { force: true }, () => {});
  if (p) {
    p.set(`documents.${req.params.kind}`, meta);
    if (req.params.kind === 'diploma') p.diplomaVerified = false; // badge « Diplômée » retiré jusqu'à la revérification
    // 8.2 — un justificatif remplacé après validation repasse en vérification ; le diplôme ne fait
    // que perdre le badge, le reste de la fiche reste en ligne.
    if (p.status === 'validee' && req.params.kind !== 'diploma') {
      p.status = 'en_attente';
      p.rejectionReason = undefined;
      await notifyTeam(p, `Un justificatif (${req.params.kind}) a été remplacé après validation.`);
    }
    await p.save();
  } else {
    const draft = draftOf(req.user);
    req.user.proDraft = { ...draft, documents: { ...(draft.documents || {}), [req.params.kind]: meta } };
    req.user.markModified('proDraft');
    await req.user.save();
  }
  res.status(201).json({ kind: req.params.kind, ...docMeta(meta) });
});

router.post('/photo', photoUpload.single('photo'), async (req, res) => {
  if (!req.file) throw badRequest('Image JPEG, PNG ou WebP attendue');
  const url = `/uploads/${req.file.filename}`;
  const p = await getPractitionerFor(req.user);
  if (p) {
    p.photoUrl = url;
    await p.save();
  } else {
    const draft = draftOf(req.user);
    req.user.proDraft = { ...draft, data: { ...draft.data, photoUrl: url } };
    req.user.markModified('proDraft');
    await req.user.save();
  }
  res.status(201).json({ photoUrl: url });
});

const submitSchema = z
  .object({
    specialty: z.string().min(1),
    otherSpecialty: z.string().trim().max(40).optional(),
    places: z.object({ visio: z.boolean(), domicile: z.boolean(), cabinet: z.boolean() }),
    address: z.string().trim().max(200).optional(),
    city: z.string().trim().min(1, 'Ta ville est obligatoire').max(80),
    lastName: z.string().trim().min(1, 'Ton nom est obligatoire (seule l’initiale est affichée)').max(60),
    // 9.6 (appli) ; sur le site (4.12), présentation et tarif se complètent ensuite dans Mon profil (8.2).
    description: z.string().trim().max(600).optional(),
    service: z.object({ name: z.string().trim().min(2).max(100), durationMinutes: z.number().int().min(10).max(480), price: z.number().min(0).max(10000) }).optional(),
    showPhone: z.boolean().default(false),
    phone: z.string().trim().max(30).optional(),
    rpps: z.string().trim().optional(),
    sterile: z.boolean().optional(),
    photoUrl: z.string().max(200).optional(),
    charter: z.boolean().optional(),
    // 4.12 — site Nissali Pro : activité puis justificatifs ; formule choisie à l'inscription.
    via: z.enum(['app', 'web']).default('app'),
    plan: z.string().optional(),
    billing: z.enum(['mensuel', 'annuel']).default('mensuel'),
  })
  .superRefine((b, ctx) => {
    if (b.via !== 'app') return;
    if (!b.charter) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['charter'], message: 'Accepte la charte des praticiennes' });
    if ((b.description || '').length < 50) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['description'], message: 'Présentation : 50 caractères minimum' });
    if (!b.service) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['service'], message: 'Indique au moins une prestation' });
  });

// 9.8 / 4.12 — « Envoyer pour vérification » : le dossier part dans Back-office › Praticiennes (vérification sous 48 h).
router.post('/submit', async (req, res) => {
  if (await getPractitionerFor(req.user)) throw conflict('Tu as déjà un profil praticienne');
  const draft = draftOf(req.user);
  const parsed = submitSchema.safeParse({ ...draft.data, ...(req.body || {}) });
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message || 'Profil incomplet');
  const b = parsed.data;
  const cat = await Category.findOne({ key: b.specialty, active: true }).lean();
  if (!cat) throw badRequest('Métier inconnu');
  if (b.specialty === 'autre' && !(b.otherSpecialty && b.otherSpecialty.length >= 3)) throw badRequest('Précise ton métier (3 à 40 caractères)');
  if (!b.places.visio && !b.places.domicile && !b.places.cabinet) throw badRequest('Choisis au moins un lieu');
  if (b.places.cabinet && !b.address) throw badRequest('Indique l’adresse de ton cabinet (seule la ville est affichée)');
  if (cat.requiresRpps && !/^\d{11}$/.test(b.rpps || '')) throw badRequest('Numéro RPPS obligatoire (11 chiffres)');
  if (cat.requiresSterile && !b.sterile) throw badRequest('Coche l’engagement sur le matériel stérile et les contre-indications');
  if (!draft.documents?.identity?.storedName) throw badRequest('La pièce d’identité est obligatoire');

  const p = await Practitioner.create({
    user: req.user._id,
    displayName: displayNameOf(req.user.firstName, b.lastName),
    specialty: b.specialty,
    categories: [b.specialty],
    otherSpecialty: b.specialty === 'autre' ? b.otherSpecialty : '',
    description: b.description || '',
    photoUrl: b.photoUrl || undefined,
    location: { city: b.city, address: b.places.cabinet ? b.address : '' },
    phone: b.phone || req.user.phone || '',
    showPhone: Boolean(b.showPhone && (b.phone || req.user.phone)),
    professionalId: cat.requiresRpps ? b.rpps : '',
    sterileCommitment: Boolean(b.sterile),
    inPerson: b.places.cabinet,
    atHome: b.places.domicile,
    supportsVideo: b.places.visio,
    documents: draft.documents,
    timezone: req.user.city?.timezone || 'Europe/Paris',
  });
  const place = await bestCity(b.city).catch(() => null);
  if (place) {
    p.location.lat = place.lat;
    p.location.lng = place.lng;
    p.location.region = place.admin || '';
    await p.save();
  }
  if (b.service) await Service.create({ practitioner: p._id, name: b.service.name, durationMinutes: b.service.durationMinutes, price: b.service.price, mode: b.places.visio && !b.places.cabinet ? 'visio' : b.places.visio ? 'les_deux' : 'cabinet' });
  // Formule de départ : essai gratuit par défaut, formule choisie sur le site (4.12 étape 1).
  let subscription = null;
  let checkoutUrl = null;
  try {
    const startPlan = await signupPlan(b.plan, b.billing);
    if (startPlan) {
      subscription = await subscribe(p, startPlan.key, b.billing);
      checkoutUrl = await attachCheckout(p, subscription, req.user);
    }
  } catch (err) {
    console.warn('[pro-profile] formule de départ :', err.message);
  }
  if (b.via === 'web') req.user.lastSpace = 'pro';
  req.user.proDraft = undefined;
  await req.user.save();

  await notifyTeam(p, `${p.displayName} (${cat.label}${b.specialty === 'autre' ? ` : ${b.otherSpecialty}` : ''}, ${b.city}) attend sa vérification.`);
  // 4.12 étape 4 / 9.9 — e-mail « dossier bien reçu » envoyé à la praticienne.
  if (req.user.email) {
    await sendMail({
      to: req.user.email,
      subject: 'Ton dossier praticienne est bien reçu',
      html: `<p>Bonjour ${req.user.firstName || ''},</p><p>Ton dossier praticienne a bien été transmis à l’équipe Nissali. La pièce d’identité est vérifiée sous 48 h : tu recevras un e-mail et une notification au résultat.</p><p>À très vite,<br>L’équipe Nissali</p>`,
      text: 'Ton dossier praticienne est bien reçu : vérification sous 48 h.',
    }).catch(() => {});
  }
  res.status(201).json({ ...(await sessionPayload(req.user)), subscription, checkoutUrl });
});

// 9.3 — Mon espace praticienne : statut, visible / en pause, chiffres du mois.
router.get('/space', async (req, res) => {
  const p = await getPractitionerFor(req.user);
  if (!p) throw notFound('Pas de profil praticienne');
  const month = new Date().toISOString().slice(0, 7);
  const [cat, convs, { plan, subscription }] = await Promise.all([Category.findOne({ key: p.specialty }).lean(), Conversation.find({ practitioner: p._id }).select('unreadPro').lean(), activePlanFor(p)]);
  res.json({
    id: p.id,
    displayName: p.displayName,
    photoUrl: p.photoUrl,
    specialtyLabel: specialtyLabelOf(p, cat),
    otherPending: p.specialty === 'autre' && !p.otherValidated,
    status: p.status,
    rejectionReason: p.rejectionReason || null,
    visible: p.visible !== false,
    diplomaVerified: Boolean(p.diplomaVerified),
    documents: Object.fromEntries(DOC_KINDS.map((k) => [k, docMeta(p.documents?.[k])])),
    stats: { views: p.viewsMonth?.month === month ? p.viewsMonth.count : 0, unread: convs.reduce((n, c) => n + (c.unreadPro || 0), 0), rating: p.rating, reviews: p.reviewsCount },
    plan: plan ? { name: plan.name, trial: Boolean(subscription?.trial), endsAt: subscription?.endsAt || null } : null,
    email: req.user.email ? mask(req.user.email, 'email') : null,
  });
});

router.patch('/visibility', validate(z.object({ visible: z.boolean() })), async (req, res) => {
  const p = await getPractitionerFor(req.user);
  if (!p) throw notFound('Pas de profil praticienne');
  p.visible = req.body.visible;
  await p.save();
  res.json({ visible: p.visible });
});

// 9.4 — Supprimer mon profil praticienne : le compte perso reste intact ; retirée de l'annuaire tout de suite.
// 9.4 — « Télécharger mes messages avant » : toutes les conversations du profil pro, envoyées en fichier texte par e-mail.
router.post('/messages/export/email', async (req, res) => {
  const p = await getPractitionerFor(req.user);
  if (!p) throw notFound('Pas de profil praticienne');
  if (!req.user.email) throw badRequest('Ajoute une adresse e-mail à ton compte pour recevoir tes messages', 'NO_EMAIL');
  const convs = await Conversation.find({ practitioner: p._id }).populate('user', 'firstName').sort({ updatedAt: -1 }).lean();
  const when = (d) => new Date(d).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' });
  const blocks = [];
  for (const c of convs) {
    const msgs = await Message.find({ conversation: c._id, deletedForAll: { $ne: true }, hiddenFor: { $ne: 'pro' } }).sort({ createdAt: 1 }).lean();
    if (!msgs.length) continue;
    const client = c.user?.firstName || 'Utilisatrice';
    const lines = msgs.map((m) => `[${when(m.createdAt)}] ${m.from === 'pro' ? 'Moi' : client} : ${m.text || (m.image?.storedName ? '(photo)' : '')}`);
    blocks.push(`=== Conversation avec ${client} ===\n${lines.join('\n')}`);
  }
  if (!blocks.length) throw badRequest('Tu n’as aucun message à télécharger.', 'NO_MESSAGES');
  const name = `nissali-messages-${new Date().toISOString().slice(0, 10)}.txt`;
  await sendMail({
    to: req.user.email,
    subject: 'Tes messages Nissali',
    title: 'Tes messages de praticienne',
    preheader: 'Le fichier de tes conversations est joint à cet e-mail.',
    html: `<p>Salam ${String(req.user.firstName || '').replace(/[<>&"']/g, '')},</p><p>Tu trouveras en pièce jointe toutes les conversations de ton espace praticienne.</p>`,
    text: 'Le fichier de tes conversations Nissali est joint à cet e-mail.',
    attachments: [{ filename: name, content: blocks.join('\n\n'), contentType: 'text/plain; charset=utf-8' }],
  });
  res.json({ ok: true, to: mask(req.user.email, 'email') });
});

router.delete('/', async (req, res) => {
  const p = await getPractitionerFor(req.user);
  if (!p) throw notFound('Pas de profil praticienne');
  await purgePractitioner(p);
  req.user.lastSpace = 'personnel';
  await req.user.save();
  res.json(await sessionPayload(req.user));
});

// Back-office : lecture d'un justificatif (déchiffré), réservée à l'équipe.
router.get('/admin/:id/documents/:kind', requireRole('admin'), async (req, res) => {
  if (!DOC_KINDS.includes(req.params.kind)) throw notFound();
  const p = await Practitioner.findById(req.params.id).lean();
  const d = p?.documents?.[req.params.kind];
  if (!d?.storedName) throw notFound('Document introuvable');
  const buf = openBuffer(await fs.promises.readFile(path.join(docDir, d.storedName)));
  res.setHeader('Content-Type', d.mime);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(d.name)}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(buf);
});

export default router;
