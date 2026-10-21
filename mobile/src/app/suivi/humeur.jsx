// Mise à jour Cycle · 6.10 — Humeur : répartition par humeur sur la période (barres, « Le plus souvent : … »),
// « Mes derniers jours » avec visage ; feuille : 5 visages à choisir.
import { useState } from 'react';
import { Text, View } from 'react-native';
import { MoodFace } from '../../components/HealthCards';
import { moodSummary, MoodBars, rangeDays } from '../../components/HealthCharts';
import { detailStyles as d, HealthDetailScreen, LastDays, SummaryCard } from '../../components/HealthDetail';
import { MoodSheet } from '../../components/HealthEditSheets';
import { useHealthRange } from '../../lib/healthRange';
import { colors, fonts, MOODS } from '../../theme';

import { tr } from '../../lib/i18n';
const LABEL = Object.fromEntries(MOODS.map((m) => [m.key, m.label]));

export default function MoodDetail() {
  const [period, setPeriod] = useState('semaine');
  const [edit, setEdit] = useState(null);
  const h = useHealthRange(period);
  const days = h.today ? rangeDays(h.today, period) : [];
  const mood = (day) => h.byDay.get(day)?.mood || null;
  const counts = {};
  for (const day of days) if (mood(day)) counts[mood(day)] = (counts[mood(day)] || 0) + 1;
  const summary = moodSummary(counts);

  return (
    <HealthDetailScreen title={tr("Humeur")} onAdd={() => setEdit(h.today)} period={period} onPeriod={setPeriod} loading={h.loading} error={h.error} onRetry={h.reload} onRefresh={h.reload}>
      <SummaryCard>
        <Text style={d.label}>{summary || tr("Aucune humeur notée sur cette période")}</Text>
        <MoodBars counts={counts} faces />
      </SummaryCard>
      {h.today ? (
        <LastDays
          title={tr("Mes derniers jours")}
          today={h.today}
          onPress={setEdit}
          render={(day) =>
            mood(day) ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <MoodFace mood={mood(day)} size={18} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.bordeaux }}>{LABEL[mood(day)]}</Text>
              </View>
            ) : (
              <Text style={d.empty}>{tr("Ajouter")}</Text>
            )
          }
        />
      ) : null}
      <MoodSheet visible={Boolean(edit)} day={edit} value={edit ? mood(edit) : null} onClose={() => setEdit(null)} onSaved={h.reload} />
    </HealthDetailScreen>
  );
}
