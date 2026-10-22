// 5.7 — Page Horaires de prière (inspirée de Mawaqit) : « Ma ville » ou « Ma mosquée », recherche d'une
// mosquée ou d'une ville, « Ma position », mosquées autour classées par distance, horaires du jour, Jumu'a, Qibla.
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AdhanSoundSheet } from '../components/AdhanSound';
import { CityPicker } from '../components/forms';
import Icon from '../components/Icon';
import { Button, Card, Field, Gap, Row, Screen, Segmented, Sheet, T, Toggle, useToast } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useDhikrData } from '../lib/dhikr';
import { countdown, longDate } from '../lib/format';
import { jumuaOf } from '../lib/jumua';
import { currentPosition, syncLocation } from '../lib/location';
import { colors, fonts, PRAYER_LABELS, PRAYERS } from '../theme';

import { tr } from '../lib/i18n';
function MosqueRow({ m, selected, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={`${m.name}, ${m.city}${m.distanceKm != null ? tr(", {0} kilomètres", [m.distanceKm]) : ''}`} style={({ pressed }) => [s.mosque, selected && s.mosqueOn, pressed && { opacity: 0.8 }]}>
      <View style={[s.mosqueIcon, selected && { backgroundColor: colors.bordeaux }]}>
        <Icon name="home" size={18} color={selected ? colors.white : colors.or} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.mosqueName} numberOfLines={1}>{m.name}</Text>
        <Text style={s.mosqueMeta} numberOfLines={1}>
          {[m.city, m.distanceKm != null ? `${String(m.distanceKm).replace('.', ',')} km` : null].filter(Boolean).join(' · ')}
          {m.partner ? tr(" · horaires publiés") : ''}
        </Text>
      </View>
      {selected ? (
        <View style={s.check}>
          <Icon name="check" size={14} color={colors.white} strokeWidth={3} />
        </View>
      ) : (
        <Icon name="chevronRight" size={18} color={colors.muted} />
      )}
    </Pressable>
  );
}

const ROWS = [
  { key: 'fajr', icon: 'sunrise' },
  { key: 'dhuhr', icon: 'sun' },
  { key: 'asr', icon: 'sun' },
  { key: 'maghrib', icon: 'sunset' },
  { key: 'isha', icon: 'moon' },
];

/** Illustration au trait fin : arches et coupole (carte « Prochaine prière »). */
function Arches() {
  const stroke = 'rgba(233,185,193,0.5)';
  return (
    <Svg width={150} height={130} viewBox="0 0 150 130" style={s.arches} pointerEvents="none">
      <Path d="M30 130V74a28 28 0 0 1 56 0v56" stroke={stroke} strokeWidth={1.6} fill="none" />
      <Path d="M42 130V80a16 16 0 0 1 32 0v50" stroke={stroke} strokeWidth={1.2} fill="none" />
      <Path d="M38 50a20 20 0 0 1 40 0" stroke={stroke} strokeWidth={1.6} fill="none" />
      <Path d="M58 30v-8M55 22h6" stroke={stroke} strokeWidth={1.4} />
      <Path d="M96 130V92a14 14 0 0 1 28 0v38" stroke={stroke} strokeWidth={1.4} fill="none" />
      <Path d="M134 130V36M130 36h8l-4-10z" stroke={stroke} strokeWidth={1.4} fill="none" />
      <Path d="M8 130V98a10 10 0 0 1 20 0v32" stroke={stroke} strokeWidth={1.2} fill="none" />
      <Path d="M0 130h150" stroke={stroke} strokeWidth={1.2} />
    </Svg>
  );
}

function BottomButton({ icon, label, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.bottomBtn, pressed && { opacity: 0.85 }]}>
      <Icon name={icon} size={20} color={colors.bordeaux} />
      <Text style={s.bottomText}>{label}</Text>
    </Pressable>
  );
}

export default function PrayerTimes() {
  const { user, setSession } = useAuth();
  const toast = useToast();
  const scrollRef = useRef(null);
  const source = user?.prayerSource || { mode: 'ville' };
  const [choosing, setChoosing] = useState(source.mode === 'mosquee' && !source.mosque);
  const [mode, setMode] = useState(source.mode === 'mosquee' ? 'mosquee' : 'ville');
  const [today, setToday] = useState(null);
  const [nearby, setNearby] = useState(null);
  const [results, setResults] = useState(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [reminders, setReminders] = useState(false);
  const [prayerSheet, setPrayerSheet] = useState(null); // réglage du rappel d'une prière
  const dhikr = useDhikrData();
  const [adhanSound, setAdhanSound] = useState(false);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(i);
  }, []);

  const loadToday = useCallback(() => api.get('/prayers').then(setToday).catch(() => {}), []);
  useEffect(() => {
    loadToday();
  }, [loadToday, user?.prayerSource?.mosque, user?.prayerSource?.mode, user?.city?.lat, user?.prayerSettings?.adjustments]);

  const loadNearby = useCallback(async (usePosition = false) => {
    setBusy(true);
    try {
      const p = usePosition ? await currentPosition({ ask: true }) : pos;
      if (usePosition && !p) toast(tr("Autorise la localisation pour trouver les mosquées autour de toi"), 'error');
      if (p) setPos(p);
      setNearby(await api.get(`/mosques/nearby${p ? `?lat=${p.lat}&lng=${p.lng}` : ''}`));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }, [pos, toast]);

  useEffect(() => {
    if (choosing && mode === 'mosquee' && !nearby) loadNearby(false);
  }, [choosing, mode, nearby, loadNearby]);

  // Recherche d'une mosquée ou d'une ville
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      return undefined;
    }
    const t = setTimeout(() => {
      api
        .get(`/mosques/search?q=${encodeURIComponent(q.trim())}${pos ? `&lat=${pos.lat}&lng=${pos.lng}` : ''}`)
        .then(setResults)
        .catch(() => setResults({ items: [] }));
    }, 350);
    return () => clearTimeout(t);
  }, [q, pos]);

  const close = () => {
    setChoosing(false);
    setQ('');
    scrollRef.current?.scrollTo?.({ y: 0, animated: false });
  };
  const open = () => {
    setMode(source.mode === 'mosquee' ? 'mosquee' : 'ville');
    setChoosing(true);
    scrollRef.current?.scrollTo?.({ y: 0, animated: false });
  };

  const chooseMosque = async (m) => {
    setBusy(true);
    try {
      const session = await api.put('/me/prayer-source', m.id ? { mode: 'mosquee', mosqueId: m.id } : { mode: 'mosquee', osm: { osmId: m.osmId, name: m.name, address: m.address, city: m.city, lat: m.lat, lng: m.lng } });
      await setSession(session);
      close();
      toast(tr("Horaires de {0}", [m.name]));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const chooseCity = async (city) => {
    setBusy(true);
    try {
      let session = await api.put('/me/prayer-source', { mode: 'ville' });
      if (city) session = await api.patch('/me', { city: { ...city, source: city.source || 'manuel' }, prayerSettings: { followLocation: city.source === 'gps' } });
      await setSession(session);
      close();
      toast(tr("Horaires calculés pour {0}", [(session.user.city?.name || tr("ta ville"))]));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const useMyPosition = async () => {
    setBusy(true);
    try {
      let session = await api.put('/me/prayer-source', { mode: 'ville' });
      await setSession(session);
      session = await syncLocation(session.user, { ask: true, force: true });
      if (session) {
        await setSession(session);
        close();
        toast(tr("Horaires à ta position : {0}", [session.user.city?.name]));
      } else toast(tr("Position indisponible"), 'error');
    } finally {
      setBusy(false);
    }
  };

  const patchSettings = async (prayerSettings, message) => {
    try {
      await setSession(await api.patch('/me', { prayerSettings }));
      toast(message);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const selectedId = source.mode === 'mosquee' ? source.mosque : null;
  const list = results?.items || nearby?.items || [];
  const meta = today?.source;
  const t = today?.timings;
  const jumua = jumuaOf(meta);
  const nextJ = today?.jumuaNext || (jumua ? { ...jumua, estimated: false, mosque: meta?.label } : null);
  const isMosque = meta?.mode === 'mosquee';
  const placeName = isMosque ? meta.label : today?.city?.name || user?.city?.name || tr("Ma ville");
  const placeHint = isMosque ? [meta.city, meta.fallback ? 'horaires calculés à son adresse' : meta.partner ? 'horaires publiés par la mosquée' : 'horaires calculés à son adresse'].filter(Boolean).join(' · ') : user?.city?.source === 'gps' ? tr("Ma position · horaires calculés") : tr("Ma ville · horaires calculés");
  const nextKey = t?.instants ? PRAYERS.find((p) => new Date(t.instants[p]).getTime() > now) : null;
  const heroKey = nextKey || 'fajr';
  const notifOn = user?.prayerSettings?.notifications !== false;
  const adhanMode = user?.prayerSettings?.adhan === false ? 'notification' : user?.prayerSettings?.adhanMode || 'adhan';

  // --- Choix de la source : ville ou mosquée (masqué une fois le choix fait) -----------------------
  if (choosing) {
    return (
      <Screen back title={tr("Mes horaires")} subtitle={tr("Choisis d’où viennent tes horaires")} scrollRef={scrollRef} right={source.mode !== 'mosquee' || selectedId ? <Pressable onPress={close} hitSlop={10} accessibilityRole="button"><Text style={s.link}>{tr("Annuler")}</Text></Pressable> : null}>
        <Segmented
          items={[
            { key: 'ville', label: tr("Ma ville") },
            { key: 'mosquee', label: tr("Ma mosquée") },
          ]}
          value={mode}
          onChange={setMode}
        />
        <Gap />

        {mode === 'mosquee' ? (
          <>
            <Field value={q} onChangeText={setQ} placeholder={tr("Rechercher une mosquée ou une ville")} icon="search" autoCorrect={false} returnKeyType="search" />
            <Gap h={14} />
            <Row justify="space-between" style={{ marginBottom: 10 }}>
              <Text style={s.section}>{results ? (results.city ? tr("Autour de {0}", [results.city.name]) : tr("Résultats")) : tr("Autour de toi")}</Text>
              <Pressable onPress={() => loadNearby(true)} hitSlop={8} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="locate" size={16} color={colors.bordeaux} />
                <Text style={s.link}>{tr("Ma position")}</Text>
              </Pressable>
            </Row>
            {busy && !list.length ? <ActivityIndicator color={colors.bordeaux} style={{ marginVertical: 20 }} /> : null}
            {list.map((m) => (
              <MosqueRow key={m.id || m.osmId} m={m} selected={Boolean(selectedId) && (m.id === selectedId || (meta?.mosqueId && m.id === meta.mosqueId))} onPress={() => chooseMosque(m)} />
            ))}
            {!busy && (results || nearby) && !list.length ? <T variant="muted" style={{ textAlign: 'center', marginVertical: 12 }}>{tr("Aucune mosquée trouvée. Essaie avec le nom de ta ville.")}</T> : null}
            <T variant="small" style={{ marginTop: 6 }}>{tr("Mosquées partenaires : horaires publiés par la mosquée. Autres mosquées : horaires calculés à leur adresse, le temps qu’elles rejoignent Nissali.")}</T>
          </>
        ) : (
          <>
            <Card style={{ gap: 12 }}>
              <Row gap={10}>
                <Icon name="pin" size={18} color={colors.or} />
                <View style={{ flex: 1 }}>
                  <T variant="bold">{user?.city?.name || tr("Paris")}</T>
                  <T variant="small">{user?.city?.source === 'gps' ? tr("Ta position actuelle (GPS)") : tr("Ville enregistrée")}</T>
                </View>
              </Row>
              {source.mode === 'mosquee' ? <Button title={tr("Horaires de {0}", [(user?.city?.name || tr("ma ville"))])} onPress={() => chooseCity(null)} loading={busy} /> : null}
              <Pressable onPress={useMyPosition} disabled={busy} accessibilityRole="button" style={s.positionBtn}>
                {busy ? <ActivityIndicator color={colors.bordeaux} /> : <Icon name="locate" size={18} color={colors.bordeaux} />}
                <Text style={s.positionText}>{tr("Utiliser ma position")}</Text>
              </Pressable>
            </Card>
            <Gap h={12} />
            <CityPicker label={tr("Ou choisis une ville")} value={null} onChange={(c) => chooseCity(c)} />
            <T variant="small" style={{ marginTop: 8 }}>{tr("Horaires calculés pour ta ville (API Aladhan, méthode choisie par le comité), ajustables de quelques minutes dans ton profil.")}</T>
          </>
        )}
      </Screen>
    );
  }

  // --- Affichage : source choisie, prochaine prière, horaires du jour -----------------------------
  return (
    <Screen back title={tr("Horaires de prière")} scrollRef={scrollRef} onRefresh={loadToday}>
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`${placeName}. Changer de ville ou de mosquée`} style={({ pressed }) => [s.place, pressed && { opacity: 0.85 }]}>
        <View style={s.placeIcon}>
          <Icon name={isMosque ? 'home' : 'pin'} size={18} color={colors.bordeaux} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.placeName} numberOfLines={2}>{placeName}</Text>
          <Text style={s.placeHint} numberOfLines={2}>{placeHint}</Text>
        </View>
        <Icon name="chevronRight" size={20} color={colors.bordeaux} />
      </Pressable>

      {!t ? (
        <ActivityIndicator color={colors.bordeaux} style={{ marginTop: 40 }} />
      ) : (
        <>
          <LinearGradient colors={[colors.bordeaux, colors.prune]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
            <Arches />
            <Text style={s.heroLabel}>{tr("PROCHAINE PRIÈRE")}</Text>
            <Text style={s.heroName}>{PRAYER_LABELS[heroKey]}</Text>
            <Text style={s.heroTime}>{t[heroKey]}</Text>
            <Text style={s.heroIn}>{nextKey ? tr("Dans {0}", [countdown(t.instants[nextKey], now).replace(/^(\d+)\s+min$/, (_, m) => `${m}\u00A0minute${m > 1 ? 's' : ''}`)]) : tr("Demain matin")}</Text>
            {jumua?.today ? <Text style={s.heroJumua}>{tr("Aujourd’hui · Jumu’a à")} {jumua.times.join(' et ')}</Text> : null}
            <Pressable
              onPress={() => patchSettings({ notifications: !notifOn }, notifOn ? tr("Rappels de prière désactivés") : tr("Rappels de prière activés"))}
              accessibilityRole="switch"
              accessibilityState={{ checked: notifOn }}
              style={s.heroPill}
            >
              <Icon name="bell" size={15} color={colors.white} fill={notifOn ? colors.white : 'none'} />
              <Text style={s.heroPillText}>{notifOn ? tr("Rappel activé") : tr("Rappel désactivé")}</Text>
            </Pressable>
          </LinearGradient>

          <View style={s.list}>
            {ROWS.map((r, i) => {
              const on = r.key === nextKey;
              const sep = i > 0 && !on && ROWS[i - 1].key !== nextKey;
              return (
                <View key={r.key}>
                  {sep ? <View style={s.sep} /> : null}
                  <Pressable onPress={() => setPrayerSheet(r.key)} accessibilityRole="button" accessibilityLabel={tr("{0} à {1}{2}. Régler le rappel", [PRAYER_LABELS[r.key], t[r.key], (on ? tr(", prochaine prière") : '')])} style={({ pressed }) => [s.row, on && s.rowOn, pressed && { opacity: 0.85 }]}>
                    <View style={[s.rowIcon, on && { backgroundColor: colors.white }]}>
                      <Icon name={r.icon} size={20} color={on ? colors.bordeaux : colors.or} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.rowName, on && { color: colors.bordeaux, fontFamily: fonts.bold }]}>{PRAYER_LABELS[r.key]}</Text>
                      {r.key === 'fajr' ? <Text style={s.rowHint}>{tr("Lever du soleil")} {t.sunrise}</Text> : null}
                    </View>
                    {notifOn && user?.prayerSettings?.notifyPrayers?.[r.key] === false ? <Icon name="bellOff" size={15} color={colors.muted} /> : null}
                    <Text style={[s.rowTime, on && { color: colors.bordeaux }]}>{t[r.key]}</Text>
                    <Icon name="chevronRight" size={18} color={on ? colors.bordeaux : colors.muted} />
                  </Pressable>
                </View>
              );
            })}
          </View>

          <T variant="small" style={{ marginTop: 10, textAlign: 'center' }}>
            {isMosque && !meta.fallback ? tr("Horaires publiés par la mosquée.") : meta?.fallback ? tr("Horaires de la mosquée indisponibles aujourd’hui : calculés à son adresse.") : today.method || ''}
          </T>

          {/* 5.7 bis — Dhikr : total du jour, tasbih après la prière */}
          <Pressable onPress={() => router.push('/dhikr')} accessibilityRole="button" accessibilityLabel={tr("Dhikr")} style={({ pressed }) => [s.dhikr, pressed && { opacity: 0.85 }]}>
            <View style={s.dhikrIcon}>
              <Icon name="beads" size={20} color={colors.white} strokeWidth={1.7} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.dhikrTitle}>{tr("Dhikr")}</Text>
              <Text style={s.rowHint}>
                {Object.values(dhikr.counts || {}).reduce((n, c) => n + c, 0)} {tr("aujourd’hui · Tasbih après la prière")}
              </Text>
            </View>
            <Icon name="chevronRight" size={18} color={colors.muted} />
          </Pressable>

          {/* Prochaine Jumu'a, en bas, juste avant Qibla et Mes rappels */}
          {nextJ ? (
            <View style={[s.jumua, nextJ.today && s.jumuaToday]} accessibilityLabel={tr("Prochaine Jumu’a {0} à {1}{2}", [(nextJ.today ? tr("aujourd’hui") : longDate(nextJ.day)), nextJ.times.join(' et '), (nextJ.estimated ? tr(", heure de Dhuhr") : '')])}>
              <View style={[s.jumuaIcon, nextJ.today && { backgroundColor: colors.bordeaux }]}>
                <Icon name="home" size={20} color={nextJ.today ? colors.white : colors.or} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.jumuaLabel}>{nextJ.today ? tr("JUMU’A · AUJOURD’HUI") : tr("PROCHAINE JUMU’A · {0}", [longDate(nextJ.day).toUpperCase()])}</Text>
                <Text style={s.rowHint} numberOfLines={3}>
                  {nextJ.estimated
                    ? nextJ.mosque
                      ? tr("{0} · heure non communiquée : heure de Dhuhr", [nextJ.mosque])
                      : tr("Heure de Dhuhr · à confirmer auprès de ta mosquée")
                    : nextJ.mosque}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.jumuaTime, nextJ.today && { color: colors.bordeaux }]}>{nextJ.estimated ? `≈ ${nextJ.times[0]}` : nextJ.times[0]}</Text>
                {nextJ.times[1] ? <Text style={s.rowHint}>{tr("2ᵉ Jumu’a")} {nextJ.times[1]}</Text> : null}
              </View>
            </View>
          ) : null}

          <Row gap={12} style={{ marginTop: 18 }}>
            <BottomButton icon="compass" label={tr("Qibla{0}", [today.qibla?.direction != null ? ` · ${Math.round(today.qibla.direction)}°` : ''])} onPress={() => router.push('/qibla')} />
            <BottomButton icon="bell" label={tr("Mes rappels")} onPress={() => setReminders(true)} />
          </Row>
        </>
      )}

      <Sheet visible={reminders} onClose={() => setReminders(false)} title={tr("Mes rappels de prière")}>
        <Toggle label={tr("Notification à l’heure de chaque prière")} value={notifOn} onChange={(v) => patchSettings({ notifications: v }, v ? tr("Rappels de prière activés") : tr("Rappels de prière désactivés"))} />
        {/* 07 — son de l'adhan : réglage distinct, il ne réactive pas des rappels désactivés */}
        <Pressable
          onPress={() => {
            setReminders(false);
            setTimeout(() => setAdhanSound(true), 350);
          }}
          accessibilityRole="button"
          style={s.soundRow}
        >
          <Icon name="volume" size={18} color={colors.bordeaux} />
          <Text style={s.soundText}>{tr("Son de l’adhan")}</Text>
          <Text style={s.soundState}>{adhanMode === 'adhan' ? tr("Activé") : tr("Désactivé")}</Text>
          <Icon name="chevronRight" size={16} color={colors.muted} />
        </Pressable>
        <Pressable
          onPress={() => {
            setReminders(false);
            router.push('/profil');
          }}
          accessibilityRole="link"
          style={{ paddingVertical: 8 }}
        >
          <T variant="medium" color={colors.bordeaux}>{tr("Voix de l’adhan, ajustements et adhkar → Profil")}</T>
        </Pressable>
      </Sheet>
      <AdhanSoundSheet visible={adhanSound} onClose={() => setAdhanSound(false)} />
      <Sheet visible={Boolean(prayerSheet)} onClose={() => setPrayerSheet(null)} title={prayerSheet ? `${PRAYER_LABELS[prayerSheet]} · ${t?.[prayerSheet] || ''}` : ''}>
        {prayerSheet ? (
          <>
            {!notifOn ? <T variant="muted">{tr("Tes rappels de prière sont désactivés. Active-les dans « Mes rappels » pour régler chaque prière.")}</T> : null}
            <Toggle
              label={tr("Rappel à l’heure de {0}", [PRAYER_LABELS[prayerSheet]])}
              hint={tr("Notification à l’heure de la prière (sauf pendant les règles)")}
              value={notifOn && user?.prayerSettings?.notifyPrayers?.[prayerSheet] !== false}
              onChange={(v) => patchSettings({ ...(v && !notifOn ? { notifications: true } : {}), notifyPrayers: { [prayerSheet]: v } }, v ? tr("Rappel de {0} activé", [PRAYER_LABELS[prayerSheet]]) : tr("Rappel de {0} désactivé", [PRAYER_LABELS[prayerSheet]]))}
            />
            {adhanMode === 'adhan' ? (
              <Toggle
                label={tr("Adhan pour {0}", [PRAYER_LABELS[prayerSheet]])}
                hint={tr("Appel à la prière avec la notification")}
                value={user?.prayerSettings?.adhanPrayers?.[prayerSheet] !== false}
                onChange={(v) => patchSettings({ adhanPrayers: { [prayerSheet]: v } }, v ? tr("Adhan activé pour {0}", [PRAYER_LABELS[prayerSheet]]) : tr("Adhan désactivé pour {0}", [PRAYER_LABELS[prayerSheet]]))}
              />
            ) : null}
            <Button title={tr("Son de l’adhan et voix")} variant="soft" small onPress={() => { setPrayerSheet(null); setTimeout(() => setAdhanSound(true), 350); }} />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  section: { fontFamily: fonts.bold, fontSize: 14, color: colors.prune },
  link: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.bordeaux },
  mosque: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 18, padding: 12, marginBottom: 8, borderWidth: 1.5, borderColor: 'transparent' },
  mosqueOn: { borderColor: colors.bordeaux },
  mosqueIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F6EBDD', alignItems: 'center', justifyContent: 'center' },
  mosqueName: { fontFamily: fonts.bold, fontSize: 15, color: colors.prune },
  mosqueMeta: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 1 },
  check: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.bordeaux, alignItems: 'center', justifyContent: 'center' },
  positionBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 46, borderRadius: 999, backgroundColor: colors.blush },
  positionText: { fontFamily: fonts.bold, fontSize: 15, color: colors.bordeaux },
  place: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, marginBottom: 16 },
  placeIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  placeName: { fontFamily: fonts.bold, fontSize: 16.5, color: colors.prune },
  placeHint: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 1 },
  hero: { borderRadius: 28, padding: 22, paddingBottom: 20, overflow: 'hidden', minHeight: 200 },
  arches: { position: 'absolute', right: 6, bottom: 0 },
  heroLabel: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.6, color: colors.rose },
  heroName: { fontFamily: fonts.title, fontSize: 30, color: colors.white, marginTop: 6 },
  heroTime: { fontFamily: fonts.display, fontSize: 54, lineHeight: 62, color: colors.white },
  heroIn: { fontFamily: fonts.medium, fontSize: 15, color: colors.rose },
  soundRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, borderRadius: 16, backgroundColor: colors.white, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line },
  soundText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.prune },
  soundState: { fontFamily: fonts.body, fontSize: 13.5, color: colors.muted },
  dhikr: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 22, padding: 14, marginTop: 16, borderWidth: 1, borderColor: colors.line },
  dhikrIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bordeaux, alignItems: 'center', justifyContent: 'center' },
  dhikrTitle: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.prune },
  heroJumua: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.white, marginTop: 6 },
  heroPill: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', marginTop: 14, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  heroPillText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.white },
  list: { backgroundColor: colors.white, borderRadius: 24, paddingHorizontal: 8, paddingVertical: 6, marginTop: 16, borderWidth: 1, borderColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingVertical: 12, borderRadius: 18 },
  rowOn: { backgroundColor: colors.blush },
  sep: { height: 1, backgroundColor: colors.line, marginLeft: 62, marginRight: 10 },
  rowIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.ivoire, alignItems: 'center', justifyContent: 'center' },
  rowName: { fontFamily: fonts.medium, fontSize: 16.5, color: colors.prune },
  rowHint: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 1 },
  rowTime: { fontFamily: fonts.display, fontSize: 20, color: colors.prune, marginRight: 2 },
  jumua: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 14, marginTop: 16, borderWidth: 1, borderColor: colors.line },
  jumuaToday: { backgroundColor: colors.blush, borderColor: colors.rose },
  jumuaIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F6EBDD', alignItems: 'center', justifyContent: 'center' },
  jumuaLabel: { fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 1, color: colors.or },
  jumuaTime: { fontFamily: fonts.display, fontSize: 24, color: colors.prune },
  bottomBtn: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 54, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.rose },
  bottomText: { fontFamily: fonts.bold, fontSize: 15, color: colors.bordeaux },
});
