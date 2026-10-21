// Prestations : nom, durée, prix, cabinet / visio (quota selon la formule).
import { useState } from 'react';
import { SpaceSwitch } from '../../components/ProBits';
import { Button, Card, Chips, ErrorState, Field, Gap, Label, Loader, Row, Screen, Sheet, Stepper, T, Toggle, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { price } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { colors } from '../../theme';

import { tr } from '../../lib/i18n';
const MODES = [
  { key: 'cabinet', label: tr("Cabinet") },
  { key: 'visio', label: tr("Visio") },
  { key: 'les_deux', label: tr("Les deux") },
];
const EMPTY = { name: '', description: '', price: 50, durationMinutes: 45, mode: 'cabinet', active: true };

export default function Services() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi('/pro/services');
  const me = useApi('/pro/me');
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  if (loading && !data) return <Screen title={tr("Prestations")}><Loader /></Screen>;
  if (error && !data) return <Screen title={tr("Prestations")}><ErrorState error={error} onRetry={reload} /></Screen>;
  const max = me.data?.plan?.features?.maxServices;

  const save = async () => {
    setBusy(true);
    try {
      const body = { name: edit.name.trim(), description: edit.description, price: Number(edit.price), durationMinutes: edit.durationMinutes, mode: edit.mode, active: edit.active };
      if (edit._id) await api.patch(`/pro/services/${edit._id}`, body);
      else await api.post('/pro/services', body);
      setEdit(null);
      toast(tr("Prestation enregistrée"));
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    try {
      const r = await api.delete(`/pro/services/${edit._id}`);
      toast(r.archived ? tr("Prestation désactivée (rendez-vous en cours)") : tr("Prestation supprimée"));
      setEdit(null);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <Screen title={tr("Prestations")} right={<SpaceSwitch />} onRefresh={reload}>
      <T variant="muted">{max ? tr("Ta formule permet {0} prestation{1} active{2}.", [max, max > 1 ? 's' : '', max > 1 ? 's' : '']) : tr("Prestations illimitées avec ta formule.")}</T>
      <Gap />
      {data.map((s) => (
        <Card key={s._id} onPress={() => setEdit({ ...s, price: String(s.price) })} style={{ marginBottom: 12, gap: 4, opacity: s.active ? 1 : 0.55 }}>
          <Row justify="space-between">
            <T variant="bold" style={{ flex: 1 }}>{s.name}</T>
            <T variant="h3">{price(s.price)}</T>
          </Row>
          <T variant="small">
            {s.durationMinutes} {tr("min ·")} {MODES.find((m) => m.key === s.mode)?.label}
            {s.active ? '' : tr(" · désactivée")}
          </T>
        </Card>
      ))}
      {!data.length ? <T variant="muted">{tr("Ajoute ta première prestation pour recevoir des rendez-vous.")}</T> : null}
      <Gap />
      <Button title={tr("Ajouter une prestation")} icon="plus" onPress={() => setEdit({ ...EMPTY, price: String(EMPTY.price) })} />
      <Sheet visible={Boolean(edit)} onClose={() => setEdit(null)} title={edit?._id ? tr("Modifier la prestation") : tr("Nouvelle prestation")} footer={<Button title={tr("Enregistrer")} onPress={save} loading={busy} disabled={!edit?.name?.trim()} />}>
        {edit ? (
          <>
            <Field label={tr("Nom")} value={edit.name} onChangeText={(v) => setEdit((e) => ({ ...e, name: v }))} placeholder={tr("Séance de suivi")} />
            <Field label={tr("Description")} value={edit.description} onChangeText={(v) => setEdit((e) => ({ ...e, description: v }))} multiline />
            <Field label={tr("Prix (€)")} value={edit.price} onChangeText={(v) => setEdit((e) => ({ ...e, price: v.replace(/[^\d.]/g, '') }))} keyboardType="decimal-pad" />
            <Stepper label={tr("Durée")} value={edit.durationMinutes} onChange={(v) => setEdit((e) => ({ ...e, durationMinutes: v }))} min={15} max={240} step={15} suffix=" min" />
            <Label>{tr("Lieu")}</Label>
            <Chips items={MODES} value={edit.mode} onChange={(v) => setEdit((e) => ({ ...e, mode: v }))} />
            {!me.data?.plan?.features?.video ? <T variant="small" color={colors.muted}>{tr("La visio est incluse dans les formules Essentiel et Premium.")}</T> : null}
            <Toggle label={tr("Active")} value={edit.active} onChange={(v) => setEdit((e) => ({ ...e, active: v }))} />
            {edit._id ? <Button title={tr("Supprimer")} variant="danger" small icon="trash" onPress={remove} /> : null}
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
