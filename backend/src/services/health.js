// Conseil santé du jour : phase du cycle + météo et qualité de l'air (API Open-Meteo, gratuites).
import { PHASES } from '../content/phases.js';

const cache = new Map();

async function cached(key, ttl, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.data;
  const data = await loader();
  if (cache.size > 5000) cache.clear();
  cache.set(key, { at: Date.now(), data });
  return data;
}

export async function getWeather(lat, lng) {
  const key = `w:${Number(lat).toFixed(2)},${Number(lng).toFixed(2)}`;
  return cached(key, 60 * 60_000, async () => {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lng,
      timezone: 'auto',
      forecast_days: '1',
      current: 'temperature_2m,relative_humidity_2m',
      daily: 'temperature_2m_max,temperature_2m_min,uv_index_max',
    });
    const airParams = new URLSearchParams({
      latitude: lat,
      longitude: lng,
      timezone: 'auto',
      current: 'european_aqi,grass_pollen,birch_pollen,ragweed_pollen',
    });
    const [w, a] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: AbortSignal.timeout(6000) }).then((r) => r.json()),
      fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${airParams}`, { signal: AbortSignal.timeout(6000) })
        .then((r) => r.json())
        .catch(() => null),
    ]);
    const pollen = a?.current ? Math.max(a.current.grass_pollen || 0, a.current.birch_pollen || 0, a.current.ragweed_pollen || 0) : null;
    return {
      temperature: w.current?.temperature_2m ?? null,
      humidity: w.current?.relative_humidity_2m ?? null,
      max: w.daily?.temperature_2m_max?.[0] ?? null,
      min: w.daily?.temperature_2m_min?.[0] ?? null,
      uv: w.daily?.uv_index_max?.[0] ?? null,
      aqi: a?.current?.european_aqi ?? null,
      pollen,
    };
  });
}

/** Construit des conseils sans diagnostic, adaptés à la phase, à la météo et au jeûne. */
export function buildHealthTips({ phase, weather, ramadan, pregnant }) {
  const tips = [];
  if (pregnant) tips.push({ icon: 'baby', text: 'Bois régulièrement, repose-toi et note tes questions pour ta prochaine consultation.' });
  else if (phase && PHASES[phase]) tips.push({ icon: 'phase', text: PHASES[phase].tips[new Date().getUTCDate() % PHASES[phase].tips.length] });

  if (weather) {
    if (weather.max != null && weather.max >= 28) {
      tips.push({ icon: 'sun', text: ramadan ? `Il fera ${Math.round(weather.max)}° : hydrate-toi bien entre l’iftar et le suhur.` : `Il fera ${Math.round(weather.max)}° : pense à boire régulièrement.` });
    } else if (weather.min != null && weather.min <= 2) {
      tips.push({ icon: 'cold', text: `Il fera ${Math.round(weather.min)}° ce matin : couvre-toi bien, une bouillotte peut aussi soulager les crampes.` });
    }
    if (weather.uv != null && weather.uv >= 6) tips.push({ icon: 'uv', text: `Indice UV élevé (${Math.round(weather.uv)}) : protège ta peau si tu sors en milieu de journée.` });
    if (weather.aqi != null && weather.aqi > 60) tips.push({ icon: 'air', text: 'Qualité de l’air médiocre aujourd’hui : évite l’effort intense en extérieur.' });
    if (weather.pollen != null && weather.pollen > 50) tips.push({ icon: 'pollen', text: 'Pollens en hausse : pense à aérer tôt le matin si tu es sensible.' });
  }
  return tips;
}
