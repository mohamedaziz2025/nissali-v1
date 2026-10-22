// 6.8 — Qibla : angle entre la position exacte (GPS) et la Kaaba, en degrés par rapport au nord vrai
// (API Aladhan, repli local adhan), avec la boussole du téléphone.
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { Button, Card, Gap, Label, Row, Screen, T } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { currentPosition, distanceKm, KAABA } from '../lib/location';
import { localQibla } from '../lib/prayerLocal';
import { colors, fonts } from '../theme';

import { tr } from '../lib/i18n';
const SIZE = 300;
const ALIGNED = 5;

const km = (n) => `${Math.round(n).toLocaleString('fr-FR')} km`;

export default function QiblaScreen() {
  const { user } = useAuth();
  const [pos, setPos] = useState(null);
  const [qibla, setQibla] = useState(user?.city?.lat != null ? localQibla(user.city.lat, user.city.lng) : null);
  const [source, setSource] = useState('ville');
  const [place, setPlace] = useState(user?.city?.name || null);
  const [heading, setHeading] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const smooth = useRef(null);
  const wasAligned = useRef(false);

  // Position exacte → qibla (calcul local immédiat, puis API Aladhan).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const p = await currentPosition({ ask: true, precise: true });
        if (cancelled) return;
        if (!p) {
          setError(tr("Direction calculée depuis ta ville enregistrée. Autorise la localisation pour une qibla à ta position exacte."));
          return;
        }
        setPos(p);
        setQibla(localQibla(p.lat, p.lng));
        setSource('gps');
        const r = await api.get(`/prayers/at?lat=${p.lat}&lng=${p.lng}`).catch(() => null);
        if (cancelled || !r) return;
        setQibla(r.qibla.direction);
        setSource(r.qibla.source === 'aladhan' ? 'aladhan' : 'gps');
        if (r.place?.name) setPlace(r.place.name);
      } catch (e) {
        if (!cancelled) setError(e.message || tr("Position indisponible"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Boussole : cap lissé (moyenne circulaire) pour éviter que l'aiguille tremble.
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    let sub;
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;
      sub = await Location.watchHeadingAsync((h) => {
        const raw = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
        const rad = (raw * Math.PI) / 180;
        const prev = smooth.current || { x: Math.cos(rad), y: Math.sin(rad) };
        const next = { x: prev.x * 0.75 + Math.cos(rad) * 0.25, y: prev.y * 0.75 + Math.sin(rad) * 0.25 };
        smooth.current = next;
        setHeading(((Math.atan2(next.y, next.x) * 180) / Math.PI + 360) % 360);
        setAccuracy(h.accuracy);
      });
    })();
    return () => sub?.remove();
  }, [attempt]);

  const rotation = heading != null ? -heading : 0;
  const delta = heading != null && qibla != null ? ((qibla - heading + 540) % 360) - 180 : null;
  const aligned = delta != null && Math.abs(delta) < ALIGNED;

  useEffect(() => {
    if (aligned && !wasAligned.current && Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    wasAligned.current = aligned;
  }, [aligned]);

  const from = pos || user?.city;
  const distance = from?.lat != null ? distanceKm(from, KAABA) : null;
  const sourceLabel = source === 'aladhan' ? tr("API Aladhan · ta position exacte") : source === 'gps' ? tr("Calcul sur le téléphone · ta position exacte") : tr("Ville enregistrée");

  return (
    <Screen back title={tr("Qibla")}>
      <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 26 }}>
        <Label color={colors.or}>{tr("Direction de la Kaaba")}</Label>
        <T variant="hero" color={colors.prune}>{qibla != null ? `${Math.round(qibla)}°` : '—'}</T>
        <T variant="muted" style={{ textAlign: 'center' }}>
          {tr("par rapport au nord ·")} {place || tr("position inconnue")}
        </T>
        <Gap h={6} />
        <View
          style={{ width: SIZE, height: SIZE }}
          accessible
          accessibilityLabel={delta != null ? (aligned ? tr("Tu es face à la qibla") : tr("Tourne de {0} degrés vers la {1}", [Math.round(Math.abs(delta)), delta > 0 ? 'droite' : 'gauche'])) : tr("Qibla à {0} degrés du nord", [Math.round(qibla || 0)])}
        >
          <Svg width={SIZE} height={SIZE}>
            <G transform={`rotate(${rotation} ${SIZE / 2} ${SIZE / 2})`}>
              <Circle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 2 - 8} fill={aligned ? '#F6EBDD' : colors.blush} stroke={aligned ? colors.or : colors.line} strokeWidth={aligned ? 4 : 2} />
              {Array.from({ length: 72 }).map((_, i) => {
                const a = (i * 5 * Math.PI) / 180;
                const r1 = SIZE / 2 - 14;
                const r2 = r1 - (i % 18 === 0 ? 14 : i % 2 === 0 ? 8 : 4);
                return <Line key={i} x1={SIZE / 2 + r1 * Math.sin(a)} y1={SIZE / 2 - r1 * Math.cos(a)} x2={SIZE / 2 + r2 * Math.sin(a)} y2={SIZE / 2 - r2 * Math.cos(a)} stroke={colors.muted} strokeWidth={i % 18 === 0 ? 2 : 1} />;
              })}
              {[
                ['N', 0],
                ['E', 90],
                ['S', 180],
                ['O', 270],
              ].map(([l, deg]) => {
                const a = (deg * Math.PI) / 180;
                const r = SIZE / 2 - 46;
                return (
                  <SvgText key={l} x={SIZE / 2 + r * Math.sin(a)} y={SIZE / 2 - r * Math.cos(a) + 7} fontSize={20} fill={l === 'N' ? colors.bordeaux : colors.prune} textAnchor="middle" fontFamily={fonts.bold}>
                    {l}
                  </SvgText>
                );
              })}
              {qibla != null ? (
                <G transform={`rotate(${qibla} ${SIZE / 2} ${SIZE / 2})`}>
                  <Path d={`M${SIZE / 2} 34 L${SIZE / 2 + 14} ${SIZE / 2} L${SIZE / 2} ${SIZE / 2 - 12} L${SIZE / 2 - 14} ${SIZE / 2} Z`} fill={colors.bordeaux} />
                  <Path d={`M${SIZE / 2 - 12} 22 h24 v18 h-24 Z`} fill={colors.prune} />
                  <Path d={`M${SIZE / 2 - 12} 27 h24`} stroke={colors.or} strokeWidth={2} />
                </G>
              ) : null}
              <Circle cx={SIZE / 2} cy={SIZE / 2} r={8} fill={colors.or} />
            </G>
            {/* Repère fixe : le haut du téléphone */}
            <Path d={`M${SIZE / 2 - 9} 2 L${SIZE / 2 + 9} 2 L${SIZE / 2} 16 Z`} fill={aligned ? colors.or : colors.prune} />
          </Svg>
        </View>
        {delta != null ? (
          <T variant="h3" style={{ textAlign: 'center' }} color={aligned ? colors.bordeaux : colors.prune}>
            {aligned ? tr("Tu es face à la qibla") : tr("Tourne de {0}° vers la {1}", [Math.round(Math.abs(delta)), delta > 0 ? 'droite' : 'gauche'])}
          </T>
        ) : (
          <T variant="muted" style={{ textAlign: 'center' }}>
            {Platform.OS === 'web' ? tr("Boussole disponible sur le téléphone. Repère le nord : la Kaaba est à l’angle indiqué.") : tr("Tiens ton téléphone à plat. La flèche bordeaux indique la Kaaba.")}
          </T>
        )}
        {accuracy != null && accuracy < 2 ? <T variant="small" style={{ textAlign: 'center' }}>{tr("Boussole peu précise : fais un mouvement en 8 avec ton téléphone pour la calibrer.")}</T> : null}
        {error ? (
          <>
            <T variant="small" style={{ textAlign: 'center' }}>{error}</T>
            <Button title={tr("Utiliser ma position")} icon="pin" small variant="soft" onPress={() => setAttempt((n) => n + 1)} />
          </>
        ) : null}
      </Card>
      <Gap />
      <Card tone="soft" style={{ gap: 8 }}>
        <Row justify="space-between">
          <T variant="small">{tr("Source")}</T>
          <T variant="medium" style={{ fontSize: 14 }}>{sourceLabel}</T>
        </Row>
        {distance != null ? (
          <Row justify="space-between">
            <T variant="small">{tr("Distance jusqu’à la Kaaba")}</T>
            <T variant="medium" style={{ fontSize: 14 }}>{km(distance)}</T>
          </Row>
        ) : null}
        {pos?.accuracy ? (
          <Row justify="space-between">
            <T variant="small">{tr("Précision de la position")}</T>
            <T variant="medium" style={{ fontSize: 14 }}>± {Math.round(pos.accuracy)} m</T>
          </Row>
        ) : null}
      </Card>
      <Gap />
      <T variant="small">{tr("Angle du grand cercle entre ta position et la Kaaba (21,4225° N, 39,8262° E), mesuré depuis le nord vrai. Éloigne-toi des objets métalliques et des appareils électriques pour plus de précision.")}</T>
    </Screen>
  );
}
