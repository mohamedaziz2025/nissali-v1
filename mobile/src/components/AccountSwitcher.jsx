// Sélecteur de compte : passer de l'espace personnel à l'espace pro (et inversement)
// depuis l'avatar, avec les demandes de rendez-vous en attente.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { colors, fonts } from '../theme';
import Icon from './Icon';
import { Label, Sheet, T } from './ui';

import { tr } from '../lib/i18n';
function SpaceRow({ icon, title, subtitle, active, badge, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }} style={({ pressed }) => [s.space, active && s.spaceActive, pressed && { opacity: 0.8 }]}>
      <View style={[s.spaceIcon, active && { backgroundColor: colors.bordeaux }]}>
        <Icon name={icon} size={22} color={active ? colors.white : colors.bordeaux} />
      </View>
      <View style={{ flex: 1 }}>
        <T variant="bold">{title}</T>
        <T variant="small">{subtitle}</T>
      </View>
      {badge ? (
        <View style={s.badge}>
          <Text style={s.badgeText}>{badge}</Text>
        </View>
      ) : null}
      {active ? <Icon name="check" size={22} color={colors.bordeaux} strokeWidth={2.4} /> : null}
    </Pressable>
  );
}

function MenuRow({ icon, label, onPress, danger }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.menu, pressed && { opacity: 0.7 }]}>
      <Icon name={icon} size={20} color={danger ? colors.danger : colors.prune} />
      <T variant="medium" color={danger ? colors.danger : colors.prune} style={{ flex: 1 }}>
        {label}
      </T>
    </Pressable>
  );
}

export function AccountSheet({ visible, onClose }) {
  const { user, practitioner, switchSpace, signOut } = useAuth();
  const current = user?.lastSpace === 'pro' && practitioner ? 'pro' : 'personnel';
  const go = (fn) => {
    onClose();
    setTimeout(fn, 180);
  };
  const choose = (space) => go(() => space !== current && switchSpace(space));
  return (
    <Sheet visible={visible} onClose={onClose} title={tr("Mon compte")}>
      <View style={s.who}>
        <View style={s.avatarLg}>
          <Text style={s.avatarText}>{(user?.firstName || '?')[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <T variant="h3">{user?.firstName}</T>
          <T variant="small">{user?.email || user?.phone}</T>
        </View>
      </View>
      <Label>{tr("Mes espaces")}</Label>
      <SpaceRow icon="heart" title={tr("Espace personnel")} subtitle={tr("Cycle, prières, jeûnes, santé")} active={current === 'personnel'} onPress={() => choose('personnel')} />
      {practitioner ? (
        <SpaceRow
          icon="briefcase"
          title={tr("Espace pro")}
          subtitle={`${practitioner.displayName} · ${(practitioner.status === 'validee' ? `formule ${(practitioner.plan?.name || tr("Découverte"))}` : tr("en cours de validation"))}`}
          active={current === 'pro'}
          badge={practitioner.pendingBookings || null}
          onPress={() => choose('pro')}
        />
      ) : (
        <SpaceRow icon="briefcase" title={tr("Devenir praticienne")} subtitle={tr("Crée ton espace pro avec le même compte")} onPress={() => go(() => router.push('/devenir-praticienne'))} />
      )}
      <View style={{ height: 6 }} />
      {current === 'personnel' ? <MenuRow icon="settings" label={tr("Profil et réglages")} onPress={() => go(() => router.push('/profil'))} /> : <MenuRow icon="user" label={tr("Profil professionnel")} onPress={() => go(() => router.push('/pro/profil'))} />}
      <MenuRow icon="lock" label={tr("Connexion et sécurité")} onPress={() => go(() => router.push('/securite'))} />
      <MenuRow icon="logout" label={tr("Me déconnecter")} danger onPress={() => go(signOut)} />
    </Sheet>
  );
}

/** Bouton avatar qui ouvre le sélecteur ; pastille si des demandes attendent dans l'espace pro. */
export default function AccountButton({ size = 48, showPro }) {
  const { user, practitioner, refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const pending = practitioner?.pendingBookings || 0;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr("Mon compte{0}{1}", [(practitioner ? tr(", changer d’espace") : ''), (pending ? tr(", {0} demande(s) en attente", [pending]) : '')])}
        onPress={() => {
          setOpen(true);
          refresh();
        }}
        style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }, showPro && { borderWidth: 2, borderColor: colors.or }]}
      >
        <Text style={s.avatarText}>{(user?.firstName || '?')[0].toUpperCase()}</Text>
        {pending ? (
          <View style={s.dot}>
            <Text style={s.dotText}>{pending > 9 ? '9+' : pending}</Text>
          </View>
        ) : practitioner && !showPro ? (
          <View style={s.proTag}>
            <Text style={s.proTagText}>{tr("PRO")}</Text>
          </View>
        ) : null}
      </Pressable>
      <AccountSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const s = StyleSheet.create({
  avatar: { backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.bold, fontSize: 20, color: colors.bordeaux },
  avatarLg: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  dot: { position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.bordeaux, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.ivoire },
  dotText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10.5 },
  proTag: { position: 'absolute', bottom: -4, alignSelf: 'center', backgroundColor: colors.prune, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  proTagText: { color: colors.white, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.8 },
  space: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.line },
  spaceActive: { borderColor: colors.bordeaux },
  spaceIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  badge: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 8, backgroundColor: colors.or, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.white, fontFamily: fonts.bold, fontSize: 13 },
  menu: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 50, paddingHorizontal: 4 },
});
