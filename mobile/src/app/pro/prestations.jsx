// Prestations : nom, durée, prix, cabinet / visio (quota selon la formule).
import { useState } from 'react';
import { SpaceSwitch } from '../../components/ProBits';
import { Button, Card, Chips, ErrorState, Field, Gap, Label, Loader, Row, Screen, Sheet, Stepper, T, Toggle, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { price } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { colors } from '../../theme';

const MODES = [
  { key: 'cabinet', label: 'Cabinet' },
  { key: 'visio', label: 'Visio' },
  { key: 'les_deux', label: 'Les deux' },
];
const EMPTY = { name: '', description: '', price: 50, durationMinutes: 45, mode: 'cabinet', active: true };

export default function Services() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi('/pro/services');
  const me = useApi('/pro/me');
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  if (loading && !data) return <Screen title="Prestations"><Loader /></Screen>;
  if (error && !data) return <Screen title="Prestations"><ErrorState error={error} onRetry={reload} /></Screen>;
  const max = me.data?.plan?.features?.maxServices;

  const save = async () => {
    setBusy(true);
    try {
      const body = { name: edit.name.trim(), description: edit.description, price: Number(edit.price), durationMinutes: edit.durationMinutes, mode: edit.mode, active: edit.active };
      if (edit._id) await api.patch(`/pro/services/${edit._id}`, body);
      else await api.post('/pro/services', body);
      setEdit(null);
      toast('Prestation enregistrée');
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
      toast(r.archived ? 'Prestation désactivée (rendez-vous en cours)' : 'Prestation supprimée');
      setEdit(null);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <Screen title="Prestations" right={<SpaceSwitch />} onRefresh={reload}>
      <T variant="muted">{max ? `Ta formule permet ${max} prestation${max > 1 ? 's' : ''} active${max > 1 ? 's' : ''}.` : 'Prestations illimitées avec ta formule.'}</T>
      <Gap />
      {data.map((s) => (
        <Card key={s._id} onPress={() => setEdit({ ...s, price: String(s.price) })} style={{ marginBottom: 12, gap: 4, opacity: s.active ? 1 : 0.55 }}>
          <Row justify="space-between">
            <T variant="bold" style={{ flex: 1 }}>{s.name}</T>
            <T variant="h3">{price(s.price)}</T>
          </Row>
          <T variant="small">
            {s.durationMinutes} min · {MODES.find((m) => m.key === s.mode)?.label}
            {s.active ? '' : ' · désactivée'}
          </T>
        </Card>
      ))}
      {!data.length ? <T variant="muted">Ajoute ta première prestation pour recevoir des rendez-vous.</T> : null}
      <Gap />
      <Button title="Ajouter une prestation" icon="plus" onPress={() => setEdit({ ...EMPTY, price: String(EMPTY.price) })} />
      <Sheet visible={Boolean(edit)} onClose={() => setEdit(null)} title={edit?._id ? 'Modifier la prestation' : 'Nouvelle prestation'} footer={<Button title="Enregistrer" onPress={save} loading={busy} disabled={!edit?.name?.trim()} />}>
        {edit ? (
          <>
            <Field label="Nom" value={edit.name} onChangeText={(v) => setEdit((e) => ({ ...e, name: v }))} placeholder="Séance de suivi" />
            <Field label="Description" value={edit.description} onChangeText={(v) => setEdit((e) => ({ ...e, description: v }))} multiline />
            <Field label="Prix (€)" value={edit.price} onChangeText={(v) => setEdit((e) => ({ ...e, price: v.replace(/[^\d.]/g, '') }))} keyboardType="decimal-pad" />
            <Stepper label="Durée" value={edit.durationMinutes} onChange={(v) => setEdit((e) => ({ ...e, durationMinutes: v }))} min={15} max={240} step={15} suffix=" min" />
            <Label>Lieu</Label>
            <Chips items={MODES} value={edit.mode} onChange={(v) => setEdit((e) => ({ ...e, mode: v }))} />
            {!me.data?.plan?.features?.video ? <T variant="small" color={colors.muted}>La visio est incluse dans les formules Essentiel et Premium.</T> : null}
            <Toggle label="Active" value={edit.active} onChange={(v) => setEdit((e) => ({ ...e, active: v }))} />
            {edit._id ? <Button title="Supprimer" variant="danger" small icon="trash" onPress={remove} /> : null}
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
