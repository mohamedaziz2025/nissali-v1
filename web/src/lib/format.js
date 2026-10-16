const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export const parseDay = (day) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
};
export const toDay = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const addDays = (day, n) => {
  const d = parseDay(day);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const longDate = (day) => {
  if (!day) return '—';
  const d = parseDay(day.slice(0, 10));
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
export const shortDate = (day) => {
  if (!day) return '—';
  const d = parseDay(day.slice(0, 10));
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
export const dateTime = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
export const euros = (n) => `${Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`;
export const monthLabel = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return `${MONTHS_SHORT[mo - 1]} ${String(y).slice(2)}`;
};
export const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export const BOOKING_STATUS = {
  en_attente: ['En attente', 'warning'],
  confirmee: ['Confirmé', 'success'],
  refusee: ['Refusé', 'neutral'],
  annulee: ['Annulé', 'neutral'],
  terminee: ['Terminé', ''],
  absente: ['Absente', 'danger'],
};
export const PRACTITIONER_STATUS = {
  en_attente: ['En attente', 'warning'],
  validee: ['Validée', 'success'],
  refusee: ['Refusée', 'danger'],
  suspendue: ['Suspendue', 'neutral'],
};
export const SUB_STATUS = {
  en_attente: ['Paiement attendu', 'warning'],
  active: ['Active', 'success'],
  expiree: ['Expirée', 'neutral'],
  annulee: ['Annulée', 'neutral'],
};
