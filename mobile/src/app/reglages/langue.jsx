// Langue de l'appli : système, français, anglais ou arabe. Le choix est enregistré sur l'appareil et vaut
// pour l'appli seule ; « Système » suit le réglage du téléphone. Changer de langue recharge l'appli
// (nécessaire pour la mise en page de droite à gauche de l'arabe).
// Les textes religieux en arabe (dhikr, invocations, versets) restent en arabe dans toutes les langues.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SettingsCard } from '../../components/Settings';
import { Gap, Screen, T } from '../../components/ui';
import { preference, setLanguage, systemLanguage, tr } from '../../lib/i18n';
import { colors, fonts } from '../../theme';

const OPTIONS = [
  { key: 'system', name: tr('Langue du système'), hint: tr('L’appli suit le réglage de ton téléphone') },
  { key: 'fr', name: 'Français', hint: tr('Textes en français') },
  { key: 'en', name: 'English', hint: tr('Textes en anglais') },
  { key: 'ar', name: 'العربية', hint: tr('Textes et appli en arabe') },
];

export default function LanguageSettings() {
  const system = systemLanguage();
  return (
    <Screen back title={tr('Langue')}>
      <SettingsCard title={tr('Langue de l’appli')}>
        {OPTIONS.map((o) => {
          const selected = o.key === preference;
          return (
            <Pressable
              key={o.key}
              onPress={() => setLanguage(o.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={o.name}
              accessibilityHint={o.hint}
              style={[s.row, selected && s.rowOn]}
            >
              <View style={s.text}>
                <Text style={[s.name, selected && s.nameOn]}>{o.name}</Text>
                <Text style={s.hint}>{o.hint}</Text>
              </View>
              {o.key === 'system' ? <Text style={s.badge}>{system.toUpperCase()}</Text> : null}
              {selected ? <Text style={s.check}>✓</Text> : null}
            </Pressable>
          );
        })}
      </SettingsCard>
      <Gap />
      <T variant="small">{tr('Les dhikr, les invocations et les versets restent en arabe, quelle que soit la langue choisie.')}</T>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 6 },
  rowOn: { backgroundColor: colors.blush, borderRadius: 14, paddingHorizontal: 10 },
  text: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.semi, fontSize: 15.5, color: colors.prune },
  nameOn: { color: colors.bordeaux },
  hint: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted },
  badge: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.8, color: colors.bordeaux, backgroundColor: colors.blush, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  check: { fontFamily: fonts.bold, fontSize: 16, color: colors.bordeaux },
});
