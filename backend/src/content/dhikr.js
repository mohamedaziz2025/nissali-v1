// 5.7 bis — Dhikr : textes arabes, phonétique et sens en français (RG-41 : à valider par le comité religieux
// avant publication). Les six premiers sont proposés au départ ; les autres s'ajoutent avec « + Ajouter ».

export const DHIKR_CATALOG = [
  { key: 'subhanallah', arabic: 'سُبْحَانَ ٱللَّٰهِ', name: 'SubhanAllah', meaning: 'Gloire à Allah', goal: 33 },
  { key: 'alhamdulillah', arabic: 'ٱلْحَمْدُ لِلَّٰهِ', name: 'Alhamdulillah', meaning: 'Louange à Allah', goal: 33 },
  { key: 'allahuakbar', arabic: 'ٱللَّٰهُ أَكْبَرُ', name: 'Allahu akbar', meaning: 'Allah est le plus grand', goal: 33 },
  { key: 'astaghfirullah', arabic: 'أَسْتَغْفِرُ ٱللَّٰهَ', name: 'Astaghfirullah', meaning: 'Je demande pardon à Allah', goal: 100 },
  { key: 'salat_nabi', arabic: 'ٱللَّٰهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ ﷺ', name: 'Salawat', meaning: 'Ô Allah, prie sur le Prophète Muhammad ﷺ', goal: 10 },
  { key: 'tahlil', arabic: 'لَا إِلَٰهَ إِلَّا ٱللَّٰهُ', name: 'La ilaha illa Allah', meaning: 'Nulle divinité excepté Allah', goal: 100 },
  {
    key: 'tahlila',
    arabic: 'لَا إِلَٰهَ إِلَّا ٱللَّٰهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ ٱلْمُلْكُ وَلَهُ ٱلْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ',
    name: 'La ilaha illa Allahu wahdahu la sharika lah…',
    meaning: 'Nulle divinité excepté Allah, Seul, sans associé ; à Lui la royauté et la louange, et Il est capable de toute chose',
    goal: 1,
  },
  { key: 'subhanallah_wabihamdihi', arabic: 'سُبْحَانَ ٱللَّٰهِ وَبِحَمْدِهِ', name: 'SubhanAllahi wa bihamdihi', meaning: 'Gloire et louange à Allah', goal: 100 },
  { key: 'subhanallah_alazim', arabic: 'سُبْحَانَ ٱللَّٰهِ ٱلْعَظِيمِ', name: 'SubhanAllahil-‘Azim', meaning: 'Gloire à Allah, le Très-Grand', goal: 33 },
  { key: 'hawqala', arabic: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِٱللَّٰهِ', name: 'La hawla wa la quwwata illa billah', meaning: 'Il n’y a de force ni de puissance qu’en Allah', goal: 33 },
  { key: 'hasbunallah', arabic: 'حَسْبُنَا ٱللَّٰهُ وَنِعْمَ ٱلْوَكِيلُ', name: 'Hasbunallahu wa ni‘mal-wakil', meaning: 'Allah nous suffit, Il est le meilleur garant', goal: 33 },
  { key: 'istighfar_tawba', arabic: 'أَسْتَغْفِرُ ٱللَّٰهَ وَأَتُوبُ إِلَيْهِ', name: 'Astaghfirullaha wa atubu ilayh', meaning: 'Je demande pardon à Allah et je me repens à Lui', goal: 100 },
  { key: 'ya_hayyu', arabic: 'يَا حَيُّ يَا قَيُّومُ', name: 'Ya Hayyu ya Qayyum', meaning: 'Ô Vivant, ô Celui qui subsiste par Lui-même', goal: 33 },
];

export const DHIKR_BY_KEY = new Map(DHIKR_CATALOG.map((d) => [d.key, d]));
// Mise à jour Accueil (page 7) — formules par défaut du mode Temps libre, dans cet ordre.
export const DEFAULT_DHIKR = ['astaghfirullah', 'subhanallah', 'alhamdulillah', 'allahuakbar', 'tahlil', 'salat_nabi', 'subhanallah_wabihamdihi', 'hawqala'];
export const MAX_DHIKR = 20;

/** Tasbih après la prière : 33 + 33 + 33, puis la tahlila pour faire 100 (variantes à valider par le comité). */
export const TASBIH_STEPS = [
  { key: 'subhanallah', goal: 33 },
  { key: 'alhamdulillah', goal: 33 },
  { key: 'allahuakbar', goal: 33 },
  { key: 'tahlila', goal: 1 },
];

export const GOAL_CHOICES = [33, 99, 100, 1000];
