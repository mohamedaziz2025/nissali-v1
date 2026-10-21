// Fiche praticienne et prise de rendez-vous.
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import { DayStrip, DiplomaBadge, euros, nextLabel, PractitionerAvatar, PractitionerCover, Stars, TimeGrid } from '../../components/Practitioners';
import { Button, Card, ErrorState, Field, Label, Loader, Segmented, Sheet, T, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { callPhone, openConversation } from '../../lib/contact';
import { longDate } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { colors, fonts } from '../../theme';

import { tr } from '../../lib/i18n';
const MODE = { cabinet: tr("Au cabinet"), visio: tr("En visio"), les_deux: tr("Cabinet ou visio") };

function CircleButton({ icon, label, onPress, active }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8} style={s.circle}>
      <Icon name={icon} size={20} color={colors.white} fill={active ? colors.white : 'none'} />
    </Pressable>
  );
}

function Stat({ value, label }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children, action }) {
  return (
    <View style={{ marginTop: 26, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T variant="h3">{title}</T>
        {action}
      </View>
      {children}
    </View>
  );
}

/** Fiche d'une prestation : tarif, durée, lieu, prochain créneau et description complète. */
function ServiceSheet({ service, practitioner, onClose, onBook, onContact }) {
  const [next, setNext] = useState(undefined);
  useEffect(() => {
    if (!service) return;
    setNext(undefined);
    api
      .get(`/practitioners/${practitioner.id}/slots?service=${service.id}`)
      .then((r) => {
        const d = r.days.find((x) => x.slots?.length);
        setNext(d ? { day: d.day, time: d.slots[0].time } : null);
      })
      .catch(() => setNext(null));
  }, [service, practitioner.id]);
  if (!service) return null;
  const place = service.mode === 'visio' ? 'En visio' : service.mode === 'les_deux' ? 'Au cabinet ou en visio' : 'Au cabinet';
  return (
    <Sheet visible onClose={onClose} title={service.name} footer={!practitioner.isSelf ? <Button title={tr("Réserver cette prestation")} onPress={() => onBook(service)} /> : null}>
      <View style={s.detailPrice}>
        <Text style={s.detailPriceValue}>{euros(service.price)}</Text>
        <T variant="small">{tr("Tarif indicatif")}</T>
      </View>
      <View style={s.detailRows}>
        <View style={s.detailRow}>
          <Icon name="clock" size={18} color={colors.bordeaux} />
          <T style={{ flex: 1 }}>{tr("Durée")}</T>
          <T variant="bold">{service.durationMinutes} {tr("min")}</T>
        </View>
        <View style={s.detailRow}>
          <Icon name={service.mode === 'visio' ? 'video' : 'pin'} size={18} color={colors.bordeaux} />
          <T style={{ flex: 1 }}>{tr("Lieu")}</T>
          <T variant="bold" style={{ flexShrink: 1, textAlign: 'right' }}>{place}{service.mode !== 'visio' && practitioner.city ? ` · ${practitioner.city}` : ''}</T>
        </View>
        <View style={[s.detailRow, { borderBottomWidth: 0 }]}>
          <Icon name="calendar" size={18} color={colors.bordeaux} />
          <T style={{ flex: 1 }}>{tr("Prochain créneau")}</T>
          {next === undefined ? <ActivityIndicator size="small" color={colors.bordeaux} /> : <T variant="bold" color={next ? colors.success : colors.muted}>{next ? nextLabel(next) : tr("Sur demande")}</T>}
        </View>
      </View>
      <Label>{tr("Description")}</Label>
      <T style={{ lineHeight: 24 }}>{service.description || tr("La praticienne n’a pas encore détaillé cette prestation. N’hésite pas à lui écrire pour en savoir plus.")}</T>
      {!practitioner.isSelf ? (
        <Pressable onPress={onContact} accessibilityRole="button" hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}>
          <Icon name="chat" size={18} color={colors.bordeaux} />
          <T variant="medium" color={colors.bordeaux}>{tr("Une question ? Écrire à")} {practitioner.displayName}</T>
        </Pressable>
      ) : null}
    </Sheet>
  );
}

/** Réservation en étapes : prestation → lieu → jour → heure → confirmation. */
function BookingSheet({ visible, onClose, practitioner, initialService }) {
  const toast = useToast();
  const [service, setService] = useState(null);
  const [mode, setMode] = useState('cabinet');
  const [days, setDays] = useState(null);
  const [day, setDay] = useState(null);
  const [time, setTime] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setService(initialService || (practitioner.services.length === 1 ? practitioner.services[0] : null));
    setDone(null);
    setNote('');
  }, [visible, initialService, practitioner.services]);

  useEffect(() => {
    if (!service) return;
    setDays(null);
    setDay(null);
    setTime(null);
    setMode(service.mode === 'visio' ? 'visio' : 'cabinet');
    api
      .get(`/practitioners/${practitioner.id}/slots?service=${service.id}`)
      .then((r) => {
        setDays(r.days);
        setDay(r.days[0]?.day || null);
      })
      .catch((e) => toast(e.message, 'error'));
  }, [service, practitioner.id, toast]);

  const slots = days?.find((d) => d.day === day)?.slots || [];
  const book = async () => {
    setBusy(true);
    try {
      const r = await api.post(`/practitioners/${practitioner.id}/bookings`, { serviceId: service.id, day, time, mode, note: note || undefined });
      setDone(r);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Sheet visible={visible} onClose={onClose} title={done.status === 'confirmee' ? tr("Rendez-vous confirmé") : tr("Demande envoyée")} footer={<Button title={tr("Voir mes rendez-vous")} onPress={() => { onClose(); router.push('/rendez-vous'); }} />}>
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 10 }}>
          <View style={s.successIcon}>
            <Icon name="check" size={34} color={colors.white} strokeWidth={2.6} />
          </View>
          <T variant="h3" style={{ textAlign: 'center' }}>
            {longDate(done.day)} à {done.time}
          </T>
          <T variant="muted" style={{ textAlign: 'center' }}>
            {done.status === 'confirmee' ? tr("{0} t’attend.", [practitioner.displayName]) : tr("{0} va confirmer ta demande. Tu recevras une notification.", [practitioner.displayName])}
          </T>
        </View>
      </Sheet>
    );
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={tr("Prendre rendez-vous")}
      footer={
        <Button
          title={time ? tr("Confirmer le rendez-vous") : tr("Choisis un créneau")}
          onPress={book}
          loading={busy}
          disabled={!service || !day || !time}
        />
      }
    >
      <Label>{tr("1. Prestation")}</Label>
      {practitioner.services.map((sv) => {
        const on = service?.id === sv.id;
        return (
          <Pressable key={sv.id} onPress={() => setService(sv)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[s.serviceOption, on && s.serviceOptionOn]}>
            <View style={[s.radio, on && s.radioOn]}>{on ? <View style={s.radioDot} /> : null}</View>
            <View style={{ flex: 1 }}>
              <T variant="bold">{sv.name}</T>
              <T variant="small">
                {sv.durationMinutes} {tr("min ·")} {MODE[sv.mode].toLowerCase()}
              </T>
            </View>
            <T variant="bold" color={colors.bordeaux}>
              {euros(sv.price)}
            </T>
          </Pressable>
        );
      })}
      {service ? (
        <>
          {service.mode === 'les_deux' && practitioner.supportsVideo ? (
            <>
              <Label>{tr("2. Lieu")}</Label>
              <Segmented items={[{ key: 'cabinet', label: tr("Au cabinet") }, { key: 'visio', label: tr("En visio") }]} value={mode} onChange={setMode} />
            </>
          ) : null}
          <Label>{service.mode === 'les_deux' && practitioner.supportsVideo ? tr("3. Jour") : tr("2. Jour")}</Label>
          {!days ? (
            <Loader label={tr("Recherche des créneaux…")} />
          ) : days.length ? (
            <DayStrip days={days} value={day} onChange={(d) => { setDay(d); setTime(null); }} />
          ) : (
            <T variant="muted">{tr("Aucun créneau disponible dans les prochaines semaines.")}</T>
          )}
          {days?.length ? (
            <>
              <Label>{tr("Heure")}</Label>
              <TimeGrid slots={slots} value={time} onChange={setTime} />
            </>
          ) : null}
          {time ? (
            <>
              <Field label={tr("Message pour la praticienne (facultatif)")} value={note} onChangeText={setNote} multiline />
              <Card tone="soft" style={{ gap: 4, padding: 16 }}>
                <T variant="bold">{service.name}</T>
                <T>
                  {longDate(day)} à {time} · {mode === 'visio' ? tr("en visio") : tr("au cabinet")}
                </T>
                <T variant="small">{tr("Ton prénom et tes coordonnées lui sont transmis ; aucune donnée de cycle ou de santé.")}</T>
              </Card>
            </>
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}

export default function PractitionerProfile() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { data, loading, error, reload, setData } = useApi(`/practitioners/${id}`);
  const status = useApi('/practitioners/status');
  const [booking, setBooking] = useState(false);
  const [preset, setPreset] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [contacting, setContacting] = useState(false);
  const [detail, setDetail] = useState(null);
  const toast = useToast();
  const contact = async () => {
    setContacting(true);
    try {
      await openConversation(data.id);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setContacting(false);
    }
  };

  if (loading && !data) return <View style={{ flex: 1, backgroundColor: colors.ivoire, paddingTop: insets.top + 40 }}><Loader /></View>;
  if (error && !data) return <View style={{ flex: 1, backgroundColor: colors.ivoire, padding: 20, paddingTop: insets.top + 40 }}><ErrorState error={error} onRetry={reload} /></View>;

  const label = status.data?.categories?.find((c) => c.key === data.specialty)?.label || data.specialty;
  const toggleFav = async () => {
    const fav = !data.favorite;
    setData((d) => ({ ...d, favorite: fav }));
    await (fav ? api.post(`/practitioners/${id}/favorite`) : api.delete(`/practitioners/${id}/favorite`)).catch(() => {});
  };
  const openBooking = (sv) => {
    setPreset(sv || null);
    setBooking(true);
  };
  const longText = (data.description || '').length > 220;
  const next = nextLabel(data.nextAvailable);
  const total = data.reviewsCount || 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.ivoire }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }}>
        <PractitionerCover p={data} height={400 + insets.top} radius={0} initialsSize={110}>
          <LinearGradient colors={['rgba(30,8,15,0.5)', 'transparent']} style={s.heroTopShade} />
          <View style={[s.heroBar, { paddingTop: insets.top + 8 }]}>
            <CircleButton icon="chevronLeft" label={tr("Retour")} onPress={() => (router.canGoBack() ? router.back() : router.replace('/praticiennes'))} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <CircleButton icon="share" label={tr("Partager")} onPress={() => Share.share({ message: `${data.displayName} — ${label} à ${data.city}, sur Nissali` })} />
              {!data.isSelf ? <CircleButton icon="heart" label={data.favorite ? tr("Retirer des favorites") : tr("Ajouter aux favorites")} active={data.favorite} onPress={toggleFav} /> : null}
            </View>
          </View>
          <LinearGradient colors={['transparent', 'rgba(30,8,15,0.82)']} style={s.heroShade} />
          <View style={s.heroInfo}>
            <View style={s.heroTag}>
              <Text style={s.heroTagText}>{data.specialtyLabel || label}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={s.name} numberOfLines={2}>{data.displayName}</Text>
              {data.verified ? (
                <View style={s.verified} accessibilityLabel={tr("Profil vérifié")}>
                  <Icon name="check" size={12} color={colors.white} strokeWidth={3} />
                </View>
              ) : null}
              {data.diplomaVerified ? <DiplomaBadge /> : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Stars value={data.rating} size={14} />
              <Text style={s.heroMeta}>{total ? tr("{0} · {1} avis", [data.rating.toFixed(1).replace('.', ','), total]) : tr("Nouvelle sur Nissali")}</Text>
            </View>
          </View>
        </PractitionerCover>

        <View style={s.body}>
          {!data.isSelf ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={contact} disabled={contacting} accessibilityRole="button" accessibilityLabel={tr("Envoyer un message à {0}", [data.displayName])} style={({ pressed }) => [s.action, s.actionMain, pressed && { opacity: 0.88 }]}>
                <Icon name="chat" size={20} color={colors.white} />
                <Text style={[s.actionText, { color: colors.white }]}>{contacting ? tr("Ouverture…") : tr("Message")}</Text>
              </Pressable>
              {data.phone ? (
                <Pressable onPress={() => callPhone(data.phone)} accessibilityRole="button" accessibilityLabel={tr("Appeler {0} au {1}", [data.displayName, data.phone])} style={({ pressed }) => [s.action, pressed && { opacity: 0.88 }]}>
                  <Icon name="phone" size={19} color={colors.bordeaux} />
                  <Text style={s.actionText}>{tr("Appeler")}</Text>
                </Pressable>
              ) : null}
              {data.services.length ? (
                <Pressable onPress={() => openBooking()} accessibilityRole="button" accessibilityLabel={tr("Prendre rendez-vous")} style={({ pressed }) => [s.action, s.actionMain, { flex: 1 }, pressed && { opacity: 0.88 }]}>
                  <Icon name="calendar" size={19} color={colors.white} />
                  <Text style={[s.actionText, { color: colors.white }]}>{tr("RDV")}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            <View style={s.chip}>
              <Icon name="pin" size={15} color={colors.bordeaux} />
              <Text style={s.chipText}>
                {data.city}
                {data.distanceKm != null ? tr(" · {0} km", [String(data.distanceKm).replace('.', ',')]) : ''}
              </Text>
            </View>
            {data.inPerson ? (
              <View style={s.chip}>
                <Icon name="home" size={15} color={colors.bordeaux} />
                <Text style={s.chipText}>{tr("Cabinet")}</Text>
              </View>
            ) : null}
            {data.supportsVideo ? (
              <View style={s.chip}>
                <Icon name="video" size={15} color={colors.bordeaux} />
                <Text style={s.chipText}>{tr("Visio")}</Text>
              </View>
            ) : null}
            {(data.languages || []).map((l) => (
              <View key={l} style={s.chip}>
                <Text style={s.chipText}>{l}</Text>
              </View>
            ))}
          </View>

          <View style={s.stats}>
            <Stat value={total ? data.rating.toFixed(1).replace('.', ',') : '—'} label={tr("Note")} />
            <View style={s.statSep} />
            <Stat value={total} label={tr("Avis")} />
            <View style={s.statSep} />
            <Stat value={data.minPrice != null ? euros(data.minPrice) : '—'} label={tr("Dès")} />
          </View>

          {data.isSelf ? (
            <Card tone="soft" style={{ marginTop: 16 }}>
              <T>{tr("C’est ton profil public, tel que le voient les utilisatrices.")}</T>
            </Card>
          ) : next ? (
            <Pressable onPress={() => openBooking()} accessibilityRole="button" style={s.next}>
              <View style={s.nextIcon}>
                <Icon name="calendar" size={20} color={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <T variant="small">{tr("Prochaine disponibilité")}</T>
                <T variant="bold">{next}</T>
              </View>
              <Icon name="chevronRight" size={20} color={colors.bordeaux} />
            </Pressable>
          ) : null}

          {data.description ? (
            <Section title={tr("À propos")}>
              <T style={{ lineHeight: 24 }} numberOfLines={expanded ? undefined : 5}>
                {data.description}
              </T>
              {longText ? (
                <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={8}>
                  <T variant="medium" color={colors.bordeaux}>{expanded ? tr("Réduire") : tr("Lire la suite")}</T>
                </Pressable>
              ) : null}
            </Section>
          ) : null}

          <Section title={tr("Prestations")} action={<T variant="small">{data.services.length}</T>}>
            {data.services.map((sv) => (
              <View key={sv.id} style={s.service}>
                <Pressable onPress={() => setDetail(sv)} accessibilityRole="button" accessibilityLabel={tr("{0}, voir le détail", [sv.name])} style={({ pressed }) => [{ flex: 1, gap: 6 }, pressed && { opacity: 0.7 }]}>
                  <T variant="bold" style={{ fontSize: 16.5 }}>{sv.name}</T>
                  {sv.description ? <T variant="small" numberOfLines={2}>{sv.description}</T> : null}
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <View style={s.mini}>
                      <Icon name="clock" size={13} color={colors.muted} />
                      <Text style={s.miniText}>{sv.durationMinutes} {tr("min")}</Text>
                    </View>
                    <View style={s.mini}>
                      <Icon name={sv.mode === 'visio' ? 'video' : 'pin'} size={13} color={colors.muted} />
                      <Text style={s.miniText}>{MODE[sv.mode]}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Text style={s.detailLink}>{tr("Voir le détail")}</Text>
                    <Icon name="chevronRight" size={15} color={colors.bordeaux} />
                  </View>
                </Pressable>
                <View style={{ alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
                  <Text style={s.servicePrice}>{euros(sv.price)}</Text>
                  {!data.isSelf ? (
                    <Pressable onPress={() => openBooking(sv)} accessibilityRole="button" accessibilityLabel={tr("Réserver {0}", [sv.name])} style={s.bookSmall}>
                      <Text style={s.bookSmallText}>{tr("Réserver")}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
          </Section>

          {data.disclaimer ? (
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.sable, borderRadius: 14, padding: 12, marginBottom: 12 }}>
              <Icon name="info" size={16} color={colors.orText} />
              <T style={{ flex: 1 }}>{data.disclaimer}</T>
            </View>
          ) : null}
          {data.diplomas?.length ? (
            <Section title={tr("Diplômes et certifications")}>
              {data.diplomas.map((d) => (
                <View key={d} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                  <Icon name="check" size={18} color={colors.success} strokeWidth={2.4} />
                  <T style={{ flex: 1 }}>{d}</T>
                </View>
              ))}
            </Section>
          ) : null}

          {data.address ? (
            <Section title={tr("Infos pratiques")}>
              <Pressable onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(data.address)}`)} accessibilityRole="link" style={s.service}>
                <View style={s.nextIcon}>
                  <Icon name="pin" size={20} color={colors.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <T variant="bold">{tr("Adresse du cabinet")}</T>
                  <T variant="small">{data.address}</T>
                </View>
                <Icon name="external" size={18} color={colors.bordeaux} />
              </Pressable>
            </Section>
          ) : null}

          <Section title={tr("Avis")}>
            {total ? (
              <View style={[s.service, { alignItems: 'center' }]}>
                <View style={{ alignItems: 'center', width: 90 }}>
                  <Text style={s.bigRating}>{data.rating.toFixed(1).replace('.', ',')}</Text>
                  <Stars value={data.rating} size={13} />
                  <T variant="small">{total} {tr("avis")}</T>
                </View>
                <View style={{ flex: 1, gap: 5 }}>
                  {data.ratingBreakdown.map((b) => (
                    <View key={b.stars} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={s.miniText}>{b.stars}</Text>
                      <View style={s.barTrack}>
                        <View style={[s.barFill, { width: `${(b.count / total) * 100}%` }]} />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <T variant="muted">{tr("Pas encore d’avis. Sois la première après ton rendez-vous.")}</T>
            )}
            {data.reviews.map((r) => (
              <View key={r.id} style={[s.service, { flexDirection: 'column', gap: 8 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <PractitionerAvatar p={{ displayName: r.author }} size={36} />
                  <View style={{ flex: 1 }}>
                    <T variant="bold">{r.author}</T>
                    <T variant="small">{new Date(r.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</T>
                  </View>
                  <Stars value={r.rating} size={13} />
                </View>
                {r.comment ? <T>{r.comment}</T> : null}
                {r.reply ? (
                  <View style={s.reply}>
                    <T variant="small" color={colors.bordeaux}>{tr("Réponse de")} {data.displayName}</T>
                    <T variant="small" color={colors.prune}>{r.reply}</T>
                  </View>
                ) : null}
              </View>
            ))}
          </Section>
        </View>
      </ScrollView>

      {!data.isSelf && data.services.length ? (
        <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <View style={{ flex: 1 }}>
            <T variant="small">{tr("Tarif indicatif dès")}</T>
            <Text style={s.bottomPrice}>{euros(data.minPrice)}</Text>
          </View>
          <Button title={tr("Prendre rendez-vous")} onPress={() => openBooking()} style={{ flex: 1.6 }} />
        </View>
      ) : null}
      <ServiceSheet
        service={detail}
        practitioner={data}
        onClose={() => setDetail(null)}
        onBook={(sv) => {
          setDetail(null);
          setTimeout(() => openBooking(sv), 350);
        }}
        onContact={() => {
          setDetail(null);
          contact();
        }}
      />
      <BookingSheet visible={booking} onClose={() => setBooking(false)} practitioner={data} initialService={preset} />
    </View>
  );
}

const shadow = { shadowColor: '#3E1220', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 };

const s = StyleSheet.create({
  heroTopShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 150 },
  heroShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 230 },
  heroBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  heroInfo: { position: 'absolute', left: 20, right: 20, bottom: 46, gap: 8 },
  heroTag: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  heroTagText: { fontFamily: fonts.bold, fontSize: 12, color: colors.white, letterSpacing: 1.2, textTransform: 'uppercase' },
  heroMeta: { fontFamily: fonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.9)' },
  circle: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(30,8,15,0.32)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  body: { marginTop: -28, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: colors.ivoire, paddingHorizontal: 20, paddingTop: 22 },
  name: { fontFamily: fonts.title, fontSize: 34, lineHeight: 40, color: colors.white, flexShrink: 1 },
  verified: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  action: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 52, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, ...shadow },
  actionMain: { flex: 1.3, backgroundColor: colors.bordeaux, borderColor: colors.bordeaux },
  actionText: { fontFamily: fonts.bold, fontSize: 15, color: colors.bordeaux },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: colors.line },
  chipText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.prune },
  stats: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 24, paddingVertical: 16, marginTop: 18, ...shadow },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontFamily: fonts.title, fontSize: 22, color: colors.prune },
  statLabel: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted },
  statSep: { width: 1, height: 34, backgroundColor: colors.line },
  next: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.blush, borderRadius: 22, padding: 14, marginTop: 14 },
  nextIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.bordeaux, alignItems: 'center', justifyContent: 'center' },
  service: { flexDirection: 'row', gap: 14, backgroundColor: colors.white, borderRadius: 22, padding: 16, ...shadow },
  servicePrice: { fontFamily: fonts.title, fontSize: 22, color: colors.prune },
  mini: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.ivoire, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  miniText: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  detailLink: { fontFamily: fonts.bold, fontSize: 13, color: colors.bordeaux },
  detailPrice: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  detailPriceValue: { fontFamily: fonts.title, fontSize: 32, color: colors.prune },
  detailRows: { backgroundColor: colors.white, borderRadius: 20, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.line },
  bookSmall: { backgroundColor: colors.bordeaux, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  bookSmallText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.white },
  bigRating: { fontFamily: fonts.title, fontSize: 36, color: colors.prune },
  barTrack: { flex: 1, height: 7, borderRadius: 4, backgroundColor: colors.blush, overflow: 'hidden' },
  barFill: { height: 7, borderRadius: 4, backgroundColor: colors.or },
  reply: { backgroundColor: colors.ivoire, borderRadius: 14, padding: 12, gap: 2, borderLeftWidth: 3, borderLeftColor: colors.rose },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 14, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.line, ...shadow },
  bottomPrice: { fontFamily: fonts.title, fontSize: 24, color: colors.prune },
  serviceOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.line },
  serviceOptionOn: { borderColor: colors.bordeaux },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.roseDeep, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.bordeaux },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.bordeaux },
  successIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
});
