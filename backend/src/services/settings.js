// Paramètres modifiables depuis le back-office (7.2, 6.8, 6.10), avec historique.
import { Setting, SettingHistory } from '../models/index.js';

export const SETTING_DEFINITIONS = {
  // 7.2 — Paramètres religieux (référence malikite, à valider par le comité)
  maxPeriodDaysFirst: { group: 'religieux', label: 'Durée maximale des règles (premières règles), en jours', type: 'number', default: 15, min: 1, max: 30 },
  habitPlusDays: { group: 'religieux', label: 'Durée maximale avec une habitude installée : habitude + N jours', type: 'number', default: 3, min: 0, max: 15 },
  minPurityDays: { group: 'religieux', label: 'Pureté minimale entre deux règles, en jours', type: 'number', default: 15, min: 0, max: 30 },
  maxNifasDays: { group: 'religieux', label: 'Durée maximale du nifas, en jours', type: 'number', default: 60, min: 1, max: 90 },
  purificationMarginMinutes: { group: 'religieux', label: 'Temps du ghusl et d’une partie de la prière (RG-19), en minutes', type: 'number', default: 15, min: 0, max: 90 },
  endSigns: { group: 'religieux', label: 'Signes de fin des règles', type: 'text', default: 'Sécheresse complète ou pertes blanches.' },
  // 4.13 · 8.6 — prières à accomplir après les règles (RG-19) et textes affichés dans l'appli.
  purificationRuleText: {
    group: 'religieux',
    label: 'Règle des prières à accomplir après les règles (RG-19)',
    type: 'text',
    default: 'Avis retenu par notre comité : purification avant le coucher du soleil, avec le temps du ghusl et d’une partie de la prière → Dhuhr et Asr ; avant l’aube → Maghrib et Isha.',
  },
  committeeText: { group: 'religieux', label: 'Mention « Avis retenu par notre comité »', type: 'text', default: 'Les règles présentées sont l’avis retenu par notre comité.' },
  doubtText: { group: 'religieux', label: 'Mention « En cas de doute… »', type: 'text', default: 'En cas de doute, rapproche-toi d’une personne de science.' },
  istihadaInfo: {
    group: 'religieux',
    label: 'Information istihada (au-delà des durées maximales)',
    type: 'text',
    default: 'Au-delà de la durée maximale, il peut s’agir d’istihada : selon l’avis retenu par notre comité, la prière et le jeûne reprennent. En cas de doute, rapproche-toi d’une personne de science.',
  },
  fidyaInfo: {
    group: 'religieux',
    label: 'Information fidya (retard de rattrapage)',
    type: 'text',
    default: 'Selon l’avis retenu par notre comité, celle qui retarde le rattrapage de ses jours sans excuse jusqu’au Ramadan suivant nourrit une personne dans le besoin pour chaque jour, en plus du rattrapage. Cette information ne remplace pas l’avis d’une personne de science.',
  },
  miscarriageInfo: {
    group: 'religieux',
    label: 'Information après une fausse couche',
    type: 'text',
    default: 'Nous pensons fort à toi. Selon l’avis retenu par notre comité, si la grossesse avait atteint un stade où la forme humaine est visible, les saignements qui suivent sont un nifas ; sinon, ils sont considérés comme des règles ou de l’istihada. Prends soin de toi et, en cas de doute, rapproche-toi d’une personne de science.',
  },
  dhikrDuringPeriod: { group: 'religieux', label: 'Texte du rappel de dhikr pendant les règles', type: 'text', default: 'Un moment pour le dhikr : SubhanAllah, Alhamdulillah, Allahu akbar.' },
  adhkarMorningText: { group: 'religieux', label: 'Rappel des adhkar du matin (après Fajr)', type: 'text', default: 'C’est le moment des adhkar du matin. « SubhanAllahi wa bihamdihi », cent fois (Muslim).' },
  adhkarEveningText: { group: 'religieux', label: 'Rappel des adhkar du soir (après Asr)', type: 'text', default: 'C’est le moment des adhkar du soir, avant le Maghrib.' },
  jumuaText: { group: 'religieux', label: 'Rappel du vendredi matin', type: 'text', default: 'Jumu’a moubaraka. Pense à lire ou écouter la sourate Al-Kahf et à multiplier les prières sur le Prophète ﷺ.' },
  jumuaLastHourText: { group: 'religieux', label: 'Rappel de la dernière heure du vendredi', type: 'text', default: 'Dernière heure du vendredi : un moment où les invocations sont exaucées. Fais tes du’a.' },

  // 6.8 — Horaires de prière
  prayerMethod: { group: 'prieres', label: 'Méthode de calcul (angles Fajr / Isha)', type: 'select', default: 'MWL', options: ['MWL', 'UOIF', 'ISNA', 'EGYPT', 'MAKKAH'] },
  highLatitudeRule: { group: 'prieres', label: 'Règle des hautes latitudes', type: 'select', default: 'SEVENTH', options: ['SEVENTH', 'MIDDLE', 'ANGLE'] },

  // 6.10 — Calendrier hégirien
  hijriAdjustment: { group: 'calendrier', label: 'Ajustement du calendrier hégirien (Ramadan, fêtes)', type: 'select', default: 0, options: [-1, 0, 1] },
  excludeDhulHijja13: { group: 'calendrier', label: 'Exclure le 13 Dhou al-hijja des jours blancs', type: 'boolean', default: true },

  // 6.4 / 6.7 — Calculs
  lutealLength: { group: 'calculs', label: 'Phase lutéale utilisée pour l’ovulation, en jours', type: 'number', default: 14, min: 10, max: 16 },
  termRule: { group: 'calculs', label: 'Règle du terme de grossesse', type: 'select', default: 'fr', options: ['fr', 'naegele'] },

  // Application
  // 5.12 — Fréquence des notifications : plafonds hebdomadaires des conseils et actualités (RG-36).
  notifCapModeree: { group: 'notifications', label: 'Conseils et actualités par semaine, niveau « Modérée »', type: 'number', default: 3, min: 0, max: 14 },
  // RG-17 — mots sensibles : un envoi qui en contient est bloqué (titre et texte des notifications de l'équipe).
  sensitiveWords: { group: 'notifications', label: 'Mots sensibles interdits dans les notifications (séparés par des virgules)', type: 'text', default: 'règles, menstruation, menstruelle, saignement, sang, ovulation, fertile, fertilité, enceinte, grossesse, contraception, pilule, sexe, sexuel, gynécologue, fausse couche, istihada, nifas' },
  notifCapElevee: { group: 'notifications', label: 'Conseils et actualités par semaine, niveau « Élevée »', type: 'number', default: 5, min: 0, max: 14 },
  practitionersMode: { group: 'application', label: 'Onglet Praticiennes (annuaire et réservation)', type: 'select', default: 'auto', options: ['auto', 'ouvert', 'ferme'] },
  contactEmail: { group: 'application', label: 'E-mail de contact des professionnelles', type: 'text', default: 'contact@nissali.fr' },
};

export const SETTING_DEFAULTS = Object.fromEntries(Object.entries(SETTING_DEFINITIONS).map(([k, d]) => [k, d.default]));

let cache = null;
let cacheAt = 0;

export async function getSettings() {
  if (cache && Date.now() - cacheAt < 30_000) return cache;
  const rows = await Setting.find().lean();
  cache = { ...SETTING_DEFAULTS, ...Object.fromEntries(rows.filter((r) => r.key in SETTING_DEFINITIONS).map((r) => [r.key, r.value])) };
  cacheAt = Date.now();
  return cache;
}

export function coerceSetting(key, value) {
  const def = SETTING_DEFINITIONS[key];
  if (!def) return { error: `Paramètre inconnu : ${key}` };
  if (def.type === 'number') {
    const n = Number(value);
    if (!Number.isFinite(n) || n < def.min || n > def.max) return { error: `${def.label} : valeur entre ${def.min} et ${def.max}` };
    return { value: n };
  }
  if (def.type === 'boolean') return { value: value === true || value === 'true' };
  if (def.type === 'select') {
    const match = def.options.find((o) => String(o) === String(value));
    if (match === undefined) return { error: `${def.label} : valeur non autorisée` };
    return { value: match };
  }
  return { value: String(value ?? '').slice(0, 3000) };
}

export async function updateSettings(changes, admin) {
  const current = await getSettings();
  const errors = [];
  const applied = {};
  for (const [key, raw] of Object.entries(changes)) {
    const { value, error } = coerceSetting(key, raw);
    if (error) {
      errors.push(error);
      continue;
    }
    if (current[key] === value) continue;
    await Setting.updateOne({ key }, { $set: { value, updatedBy: admin?._id } }, { upsert: true });
    await SettingHistory.create({ key, oldValue: current[key], newValue: value, by: admin?._id, byName: admin?.firstName || admin?.email });
    applied[key] = value;
  }
  cache = null;
  return { applied, errors };
}

export function invalidateSettings() {
  cache = null;
}

/** 4.13 · 8.6 — retour arrière : rétablit l'ancienne valeur d'un changement de l'historique. */
export async function revertSetting(historyId, admin) {
  const h = await SettingHistory.findById(historyId).lean();
  if (!h) return { errors: ['Changement introuvable'], applied: {} };
  return updateSettings({ [h.key]: h.oldValue ?? SETTING_DEFAULTS[h.key] }, admin);
}
