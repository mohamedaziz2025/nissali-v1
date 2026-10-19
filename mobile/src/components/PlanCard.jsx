import { View } from 'react-native';
import { colors } from '../theme';
import { price } from '../lib/format';
import Icon from './Icon';
import { Card, Label, Row, T } from './ui';

/** Carte d'une formule d'abonnement praticienne. */
export default function PlanCard({ plan, billing, selected, onPress, current }) {
  const amount = billing === 'annuel' ? plan.priceYearly : plan.priceMonthly;
  return (
    <Card onPress={onPress} tone={selected ? 'hero' : 'white'} style={{ gap: 8, marginBottom: 12, borderWidth: 2, borderColor: selected ? colors.bordeaux : colors.line }}>
      <Row justify="space-between">
        <T variant="h3" color={selected ? colors.white : colors.prune}>{plan.name}</T>
        <T variant="h3" color={selected ? colors.white : colors.bordeaux}>
          {price(amount)}
          {amount ? <T variant="small" color={selected ? colors.rose : colors.muted}>{billing === 'annuel' ? ' / an' : ' / mois'}</T> : null}
        </T>
      </Row>
      {plan.tagline ? <T variant="small" color={selected ? colors.rose : colors.muted}>{plan.tagline}</T> : null}
      {(plan.highlights || []).map((h) => (
        <Row key={h} gap={8} align="flex-start">
          <Icon name="check" size={18} color={selected ? colors.rose : colors.success} strokeWidth={2.2} />
          <T color={selected ? colors.white : colors.prune} style={{ flex: 1 }}>{h}</T>
        </Row>
      ))}
      {current ? <Label color={selected ? colors.rose : colors.or}>Formule actuelle</Label> : null}
    </Card>
  );
}


/** Essai gratuit de l'espace pro : durée et fonctionnalités réglées par l'équipe dans le back-office. */
export function TrialCard({ trial, selected = true, onPress, active }) {
  const days = trial.trialDays;
  const on = selected;
  return (
    <Card onPress={onPress} tone={on ? 'hero' : 'white'} style={{ gap: 10, marginBottom: 12, borderWidth: 2, borderColor: on ? colors.bordeaux : colors.line }}>
      <Row gap={12}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: on ? 'rgba(255,255,255,0.16)' : colors.blush, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="sparkle" size={22} color={on ? colors.white : colors.bordeaux} />
        </View>
        <View style={{ flex: 1 }}>
          <T variant="h3" color={on ? colors.white : colors.prune}>{active ? 'Tu es en essai gratuit' : trial.name}</T>
          <T variant="small" color={on ? colors.rose : colors.muted}>{days ? `${days} jours offerts` : 'Offert'} · sans carte bancaire, sans engagement</T>
        </View>
      </Row>
      <T variant="small" color={on ? colors.rose : colors.muted}>Fonctionnalités incluses pendant l’essai :</T>
      {(trial.included || []).map((h) => (
        <Row key={h} gap={8} align="flex-start">
          <Icon name="check" size={18} color={on ? colors.rose : colors.success} strokeWidth={2.2} />
          <T color={on ? colors.white : colors.prune} style={{ flex: 1 }}>{h}</T>
        </Row>
      ))}
    </Card>
  );
}
