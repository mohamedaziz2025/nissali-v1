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

