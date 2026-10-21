// Conversation façon Messenger : bulles, photos, réponses citées, réactions (appui long), « Vu », « écrit… »,
// appel si la praticienne affiche son numéro, blocage et signalement. Rafraîchissement toutes les 2,5 s.
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import { Avatar, dayLabel, hhmm, sameDay } from '../../components/Messaging';
import { Button, Field, Sheet, T, useToast } from '../../components/ui';
import { api, uploadImage } from '../../lib/api';
import { colors, fonts } from '../../theme';

import { tr } from '../../lib/i18n';
const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🤲'];
const MORE_EMOJIS = ['😍', '🥰', '😊', '🙂', '😉', '🤗', '🤭', '😇', '🥹', '😅', '🤣', '😁', '😎', '🤔', '😴', '😔', '😥', '😭', '😡', '😱', '🙏', '👏', '🙌', '💪', '👌', '✌️', '🤝', '💯', '🔥', '✨', '⭐', '🌙', '☀️', '🌸', '🌹', '💐', '🍀', '🎉', '🎁', '☕', '🍵', '💕', '💖', '💗', '💜', '🤍', '💛', '✅', '❌', '❗', '❓', '👀', '🤲🏽', '👍🏽', '🫶', '🫡'];
const POLL_MS = 2500;

function ReplyQuote({ reply, mine, otherName }) {
  if (!reply) return null;
  const who = reply.mine ? 'toi' : otherName;
  return (
    <View style={[s.quote, mine ? s.quoteMine : s.quoteOther]}>
      <Text style={[s.quoteWho, mine && { color: colors.rose }]} numberOfLines={1}>{tr("Réponse à")} {who}</Text>
      <Text style={[s.quoteText, mine && { color: '#F3D9DE' }]} numberOfLines={2}>{reply.text || (reply.hasImage ? tr("📷 Photo") : '')}</Text>
    </View>
  );
}

function Bubble({ m, first, last, otherName, maxWidth, onLongPress, onOpenImage, onReact, status }) {
  const mine = m.mine;
  const radius = 20;
  const corner = {
    borderTopLeftRadius: !mine && !first ? 6 : radius,
    borderBottomLeftRadius: !mine && !last ? 6 : radius,
    borderTopRightRadius: mine && !first ? 6 : radius,
    borderBottomRightRadius: mine && !last ? 6 : radius,
  };
  const ratio = m.image?.width && m.image?.height ? m.image.height / m.image.width : 1;
  const imgW = Math.min(maxWidth, 240);
  const grouped = Object.entries((m.reactions || []).reduce((acc, r) => ({ ...acc, [r.emoji]: (acc[r.emoji] || 0) + 1 }), {}));
  if (m.deleted) {
    return (
      <View style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
        <Pressable onLongPress={() => onLongPress(m)} delayLongPress={280} style={[s.bubble, s.deleted, corner, { maxWidth }]} accessibilityLabel={tr("Message supprimé")}>
          <Text style={s.deletedText}>🚫 {mine ? tr("Tu as retiré un message") : tr("Message supprimé")}</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: grouped.length ? 14 : 0 }}>
      <Pressable onLongPress={() => onLongPress(m)} delayLongPress={280} onPress={m.image ? () => onOpenImage(m) : undefined} accessibilityRole={m.image ? 'imagebutton' : 'text'} accessibilityLabel={`${(mine ? tr("Toi") : otherName)} : ${m.text || 'photo'}`} accessibilityHint={tr("Appui long pour réagir ou répondre")}>
        <View style={[s.bubble, mine ? s.mine : s.other, corner, { maxWidth }, m.image && !m.text && s.photoOnly, m.pending && { opacity: 0.6 }]}>
          <ReplyQuote reply={m.reply} mine={mine} otherName={otherName} />
          {m.image ? (
            m.image.local || m.image.url ? (
              <Image source={{ uri: m.image.local || m.image.url }} style={{ width: imgW, height: Math.min(imgW * ratio, 320), borderRadius: 16, backgroundColor: colors.blush }} resizeMode="cover" />
            ) : null
          ) : null}
          {m.text ? <Text style={[s.text, mine ? { color: colors.white } : { color: colors.prune }, m.image && { marginTop: 6 }]}>{m.text}</Text> : null}
        </View>
        {grouped.length ? (
          <Pressable onPress={() => onReact(m, grouped[0][0])} style={[s.reactions, mine ? { right: 8 } : { left: 8 }]} accessibilityLabel={tr("Réactions : {0}", [grouped.map(([e, n]) => `${e} ${n}`).join(', ')])}>
            {grouped.map(([e, n]) => (
              <Text key={e} style={s.reactionEmoji}>
                {e}
                {n > 1 ? <Text style={s.reactionCount}> {n}</Text> : null}
              </Text>
            ))}
          </Pressable>
        ) : null}
      </Pressable>
      {status ? <Text style={[s.status, status.seen && { color: colors.bordeaux }]}>{status.label}</Text> : null}
    </View>
  );
}

/** Statut d'un message envoyé : envoi, envoyé ✓, reçu ✓✓, vu ✓✓ (bordeaux). */
function statusOf(m, meta) {
  if (m.pending) return { label: tr("Envoi…") };
  const at = new Date(m.at);
  const time = hhmm(m.at);
  if (meta.otherReadAt && new Date(meta.otherReadAt) >= at) return { label: tr("{0} · ✓✓ Vu", [time]), seen: true };
  if (meta.otherDeliveredAt && new Date(meta.otherDeliveredAt) >= at) return { label: tr("{0} · ✓✓ Reçu", [time]) };
  return { label: tr("{0} · ✓ Envoyé", [time]) };
}

export default function Conversation() {
  const { id, as: asParam } = useLocalSearchParams();
  const as = asParam === 'pro' ? 'pro' : 'user';
  const q = as === 'pro' ? '?as=pro' : '';
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const toast = useToast();
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [meta, setMeta] = useState({ otherReadAt: null, otherDeliveredAt: null, otherTyping: false, blocked: false, blockedByMe: false });
  const [emojiFor, setEmojiFor] = useState(null); // message pour lequel on choisit un autre emoji
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState('');
  const [reply, setReply] = useState(null);
  const [menu, setMenu] = useState(null); // message ciblé par l'appui long
  const [viewer, setViewer] = useState(null);
  const [options, setOptions] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const since = useRef(null);
  const lastTyping = useRef(0);
  const inputRef = useRef(null);

  const merge = useCallback((incoming, removed = []) => {
    if (!incoming.length && !removed.length) return;
    setMessages((list) => {
      const map = new Map(list.filter((m) => !m.pending && !removed.includes(m.id)).map((m) => [m.id, m]));
      for (const m of incoming) map.set(m.id, { ...map.get(m.id), ...m });
      const pending = list.filter((m) => m.pending);
      return [...map.values(), ...pending].sort((a, b) => new Date(a.at) - new Date(b.at));
    });
  }, []);

  const applyMeta = (r) => setMeta({ otherReadAt: r.otherReadAt, otherDeliveredAt: r.otherDeliveredAt, otherTyping: r.otherTyping, blocked: r.blocked, blockedByMe: r.blockedByMe });

  // Premier chargement
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get(`/messages/conversations/${id}${q}`), api.get(`/messages/conversations/${id}/messages${q}`)])
      .then(([c, r]) => {
        if (cancelled) return;
        setConv(c);
        setMessages(r.items);
        setHasMore(r.hasMore);
        applyMeta(r);
        since.current = r.serverTime;
      })
      .catch((e) => toast(e.message, 'error'));
    return () => {
      cancelled = true;
    };
  }, [id, q, toast]);

  // Rafraîchissement : nouveaux messages, réactions, « Vu », « écrit… »
  useFocusEffect(
    useCallback(() => {
      const t = setInterval(async () => {
        if (!since.current) return;
        try {
          const r = await api.get(`/messages/conversations/${id}/messages${q}${q ? '&' : '?'}since=${encodeURIComponent(since.current)}`);
          merge(r.items, r.removed || []);
          applyMeta(r);
          since.current = r.serverTime;
        } catch {
          // hors connexion : on réessaie au prochain tour
        }
      }, POLL_MS);
      return () => clearInterval(t);
    }, [id, q, merge]),
  );

  const loadOlder = async () => {
    if (!hasMore || !messages.length) return;
    const r = await api.get(`/messages/conversations/${id}/messages${q}${q ? '&' : '?'}before=${encodeURIComponent(messages[0].at)}`).catch(() => null);
    if (!r) return;
    setHasMore(r.hasMore);
    setMessages((list) => [...r.items, ...list]);
  };

  const onChangeText = (v) => {
    setText(v);
    if (v && Date.now() - lastTyping.current > 3000) {
      lastTyping.current = Date.now();
      api.post(`/messages/conversations/${id}/typing${q}`, {}).catch(() => {});
    }
  };

  const send = async (payload) => {
    const tmp = { id: `tmp-${Date.now()}`, from: as, mine: true, text: payload.text || '', at: new Date().toISOString(), pending: true, reply: reply ? { id: reply.id, mine: reply.mine, text: reply.text, hasImage: Boolean(reply.image) } : null, image: payload.local ? { local: payload.local, width: payload.width, height: payload.height } : null, reactions: [] };
    setMessages((list) => [...list, tmp]);
    const replyTo = reply?.id;
    setReply(null);
    try {
      const saved = await api.post(`/messages/conversations/${id}/messages${q}`, { text: payload.text || '', ...(payload.photo ? { photo: payload.photo, width: payload.width, height: payload.height } : {}), ...(replyTo ? { replyTo } : {}), as });
      setMessages((list) => list.map((m) => (m.id === tmp.id ? saved : m)));
    } catch (e) {
      setMessages((list) => list.filter((m) => m.id !== tmp.id));
      toast(e.message, 'error');
    }
  };

  const sendText = () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    send({ text: t });
  };

  const pickPhoto = async (camera) => {
    const fromSheet = options === 'photo';
    setOptions(false);
    try {
      // iOS n'ouvre pas le sélecteur tant que la feuille « Envoyer une photo » se ferme : on attend la fin de l'animation.
      if (fromSheet) await new Promise((r) => setTimeout(r, Platform.OS === 'ios' ? 600 : 250));
      if (camera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return toast(tr("Autorise l’appareil photo dans les réglages du téléphone"), 'error');
      } else if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted && perm.accessPrivileges !== 'limited') return toast(tr("Autorise l’accès aux photos dans les réglages du téléphone"), 'error');
      }
      const r = await (camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync)({ mediaTypes: ['images'], quality: 0.7, allowsEditing: false, exif: false });
      if (r.canceled || !r.assets?.length) return;
      const asset = r.assets[0];
      setSending(true);
      const { photo } = await uploadImage(`/messages/conversations/${id}/photos${q}`, 'image', asset.uri, asset.mimeType);
      await send({ text: text.trim(), photo, local: asset.uri, width: Math.round(asset.width) || undefined, height: Math.round(asset.height) || undefined });
      setText('');
    } catch (e) {
      toast(e.message || tr("Envoi de la photo impossible"), 'error');
    } finally {
      setSending(false);
    }
  };

  const react = async (m, emoji) => {
    setMenu(null);
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    // Optimiste : une réaction par personne, même emoji = retirer
    setMessages((list) => list.map((x) => {
      if (x.id !== m.id) return x;
      const mineR = (x.reactions || []).find((r) => r.mine);
      const others = (x.reactions || []).filter((r) => !r.mine);
      return { ...x, reactions: mineR?.emoji === emoji ? others : [...others, { emoji, by: as, mine: true }] };
    }));
    try {
      const saved = await api.post(`/messages/conversations/${id}/messages/${m.id}/react${q}`, { emoji, as });
      merge([saved]);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const startReply = (m) => {
    setMenu(null);
    setReply(m);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const remove = (m, scope) => {
    setMenu(null);
    const go = async () => {
      if (scope === 'all') setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, deleted: true, text: '', image: null, reactions: [] } : x)));
      else setMessages((list) => list.filter((x) => x.id !== m.id));
      try {
        await api.post(`/messages/conversations/${id}/messages/${m.id}/delete${q}`, { for: scope, as });
      } catch (e) {
        toast(e.message, 'error');
      }
    };
    if (Platform.OS === 'web') return go();
    Alert.alert(scope === 'all' ? tr("Retirer pour tout le monde ?") : tr("Supprimer pour toi ?"), scope === 'all' ? tr("Le message sera supprimé de la conversation pour vous deux.") : tr("Le message disparaîtra seulement de ton côté."), [
      { text: tr("Annuler"), style: 'cancel' },
      { text: scope === 'all' ? tr("Retirer") : tr("Supprimer"), style: 'destructive', onPress: go },
    ]);
  };

  const copy = async (m) => {
    setMenu(null);
    await Clipboard.setStringAsync(m.text || '').catch(() => {});
    toast(tr("Message copié"));
  };

  const toggleBlock = async () => {
    setOptions(false);
    const go = async () => {
      try {
        const r = await api.post(`/messages/conversations/${id}/block${q}`, { blocked: !meta.blockedByMe, as });
        setMeta((x) => ({ ...x, blocked: r.blocked, blockedByMe: r.blockedByMe }));
        toast(r.blockedByMe ? tr("Conversation bloquée") : tr("Conversation débloquée"));
      } catch (e) {
        toast(e.message, 'error');
      }
    };
    if (meta.blockedByMe || Platform.OS === 'web') return go();
    Alert.alert(tr("Bloquer cette conversation ?"), tr("Plus aucun message ne pourra être envoyé, de part et d’autre."), [{ text: tr("Annuler"), style: 'cancel' }, { text: tr("Bloquer"), style: 'destructive', onPress: go }]);
  };

  const sendReport = async () => {
    try {
      await api.post(`/messages/conversations/${id}/report${q}`, { reason, as });
      setReportOpen(false);
      setReason('');
      toast(tr("Merci, notre équipe va examiner ce signalement."));
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  // Liste inversée (le plus récent en bas), avec séparateurs de jour, regroupement et « Vu ».
  const rows = useMemo(() => {
    const out = [];
    messages.forEach((m, i) => {
      const prev = messages[i - 1];
      const next = messages[i + 1];
      if (!prev || !sameDay(prev.at, m.at)) out.push({ type: 'day', id: `d-${m.id}`, at: m.at });
      const gap = (a, b) => Math.abs(new Date(a.at) - new Date(b.at)) > 5 * 60_000;
      const first = !prev || prev.from !== m.from || !sameDay(prev.at, m.at) || gap(prev, m);
      const last = !next || next.from !== m.from || !sameDay(next.at, m.at) || gap(m, next);
      out.push({ type: 'msg', id: m.id, m, first, last });
    });
    if (meta.otherTyping) out.push({ type: 'typing', id: 'typing' });
    return out.reverse();
  }, [messages, meta.otherTyping]);

  const other = conv?.other || { name: '…' };
  const maxWidth = Math.min(width * 0.74, 420);

  return (
    <KeyboardAvoidingView style={[s.screen, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/messages'))} hitSlop={12} accessibilityRole="button" accessibilityLabel={tr("Retour")} style={s.headerBtn}>
          <Icon name="chevronLeft" size={26} />
        </Pressable>
        <Pressable onPress={() => (as === 'user' && other.id ? router.push(`/praticienne/${other.id}`) : as === 'pro' && other.id ? router.push(`/fiche-cliente/${other.id}`) : null)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityRole="button">
          <Avatar person={other} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={s.headerName} numberOfLines={1}>{other.name}</Text>
            <Text style={[s.headerSub, meta.otherTyping && { color: colors.bordeaux }]} numberOfLines={1}>{meta.otherTyping ? tr("écrit…") : other.subtitle || (as === 'pro' ? tr("Cliente") : tr("Praticienne"))}</Text>
          </View>
        </Pressable>
        {other.phone ? (
          <Pressable onPress={() => Linking.openURL(`tel:${other.phone.replace(/\s/g, '')}`)} hitSlop={8} accessibilityRole="button" accessibilityLabel={tr("Appeler {0}", [other.name])} style={s.headerBtn}>
            <Icon name="phone" size={22} color={colors.bordeaux} />
          </Pressable>
        ) : null}
        <Pressable onPress={() => setOptions(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel={tr("Options de la conversation")} style={s.headerBtn}>
          <Icon name="info" size={22} color={colors.bordeaux} />
        </Pressable>
      </View>

      {!conv && !messages.length ? (
        <ActivityIndicator color={colors.bordeaux} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={rows}
          inverted
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 12 }}
          onEndReached={loadOlder}
          onEndReachedThreshold={0.3}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            <View style={s.intro}>
              <Avatar person={other} size={72} />
              <Text style={s.introName}>{other.name}</Text>
              {other.subtitle ? <T variant="small">{other.subtitle}</T> : null}
              <View style={s.notice}>
                <Icon name="lock" size={14} color={colors.muted} />
                <T variant="small" style={{ flex: 1 }}>{tr("Ne partage pas d’informations médicales sensibles par message.")}</T>
              </View>
            </View>
          }
          renderItem={({ item: r }) => {
            if (r.type === 'day') return <Text style={s.day}>{dayLabel(r.at)} · {hhmm(r.at)}</Text>;
            if (r.type === 'seen') return <Text style={s.seen}>{tr("Vu")}</Text>;
            if (r.type === 'typing')
              return (
                <View style={[s.bubble, s.other, { alignSelf: 'flex-start', paddingVertical: 12 }]} accessibilityLabel={tr("{0} écrit", [other.name])}>
                  <Text style={{ color: colors.muted, fontSize: 18, letterSpacing: 2 }}>•••</Text>
                </View>
              );
            return (
              <View style={{ marginTop: r.first ? 8 : 2 }}>
                <Bubble m={r.m} first={r.first} last={r.last} otherName={other.name} maxWidth={maxWidth} onLongPress={setMenu} onOpenImage={setViewer} onReact={react} status={r.m.mine && r.last && !r.m.deleted ? statusOf(r.m, meta) : null} />
              </View>
            );
          }}
        />
      )}

      {meta.blocked ? (
        <View style={[s.blocked, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <T variant="medium" style={{ textAlign: 'center' }}>{meta.blockedByMe ? tr("Tu as bloqué cette conversation.") : tr("Cette conversation n’est plus disponible.")}</T>
          {meta.blockedByMe ? <Button title={tr("Débloquer")} small variant="soft" onPress={toggleBlock} /> : null}
        </View>
      ) : (
        <View style={[s.composerWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {reply ? (
            <View style={s.replyBar}>
              <View style={{ flex: 1 }}>
                <Text style={s.replyWho}>{tr("Réponse à")} {reply.mine ? 'toi' : other.name}</Text>
                <Text style={s.replyText} numberOfLines={1}>{reply.text || tr("📷 Photo")}</Text>
              </View>
              <Pressable onPress={() => setReply(null)} hitSlop={10} accessibilityLabel={tr("Annuler la réponse")}>
                <Icon name="close" size={18} color={colors.muted} />
              </Pressable>
            </View>
          ) : null}
          <View style={s.composer}>
            <Pressable onPress={() => (Platform.OS === 'web' ? pickPhoto(false) : setOptions('photo'))} disabled={sending} hitSlop={6} accessibilityRole="button" accessibilityLabel={tr("Envoyer une photo")} style={s.iconBtn}>
              {sending ? <ActivityIndicator color={colors.bordeaux} size="small" /> : <Icon name="plus" size={22} color={colors.bordeaux} />}
            </Pressable>
            <TextInput ref={inputRef} value={text} onChangeText={onChangeText} placeholder={tr("Message")} placeholderTextColor="#A88C93" style={s.input} multiline maxLength={2000} accessibilityLabel={tr("Écrire un message")} />
            {text.trim() ? (
              <Pressable onPress={sendText} accessibilityRole="button" accessibilityLabel={tr("Envoyer")} style={s.send}>
                <Icon name="arrowUp" size={20} color={colors.white} strokeWidth={2.4} />
              </Pressable>
            ) : (
              <Pressable onPress={() => send({ text: '🤲' })} accessibilityRole="button" accessibilityLabel={tr("Envoyer 🤲")} style={s.iconBtn}>
                <Text style={{ fontSize: 24 }}>🤲</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Appui long : réactions et actions */}
      <Modal visible={Boolean(menu)} transparent animationType="fade" onRequestClose={() => setMenu(null)}>
        <Pressable style={s.backdrop} onPress={() => setMenu(null)}>
          {menu ? (
            <View style={s.menuCard}>
              {!menu.deleted ? (
                <View style={s.reactionBar}>
                  {REACTIONS.map((e) => {
                    const on = (menu.reactions || []).some((r) => r.mine && r.emoji === e);
                    return (
                      <Pressable key={e} onPress={() => react(menu, e)} accessibilityRole="button" accessibilityLabel={tr("Réagir {0}", [e])} style={[s.reactionBtn, on && { backgroundColor: colors.blush }]}>
                        <Text style={{ fontSize: 28 }}>{e}</Text>
                      </Pressable>
                    );
                  })}
                  <Pressable onPress={() => { const m = menu; setMenu(null); setTimeout(() => setEmojiFor(m), 250); }} accessibilityRole="button" accessibilityLabel={tr("Plus d’emojis")} style={[s.reactionBtn, { backgroundColor: colors.blush }]}>
                    <Icon name="plus" size={22} color={colors.bordeaux} />
                  </Pressable>
                </View>
              ) : null}
              <View style={s.menuActions}>
                {!menu.deleted ? <Pressable onPress={() => startReply(menu)} style={s.menuItem} accessibilityRole="button">
                  <Icon name="chevronLeft" size={18} color={colors.prune} />
                  <Text style={s.menuText}>{tr("Répondre")}</Text>
                </Pressable> : null}
                {menu.text ? (
                  <Pressable onPress={() => copy(menu)} style={s.menuItem} accessibilityRole="button">
                    <Icon name="edit" size={18} color={colors.prune} />
                    <Text style={s.menuText}>{tr("Copier")}</Text>
                  </Pressable>
                ) : null}
                {menu.mine && !menu.deleted && !menu.pending ? (
                  <Pressable onPress={() => remove(menu, 'all')} style={s.menuItem} accessibilityRole="button">
                    <Icon name="trash" size={18} color={colors.danger} />
                    <Text style={[s.menuText, { color: colors.danger }]}>{tr("Retirer pour tout le monde")}</Text>
                  </Pressable>
                ) : null}
                {!menu.pending ? (
                  <Pressable onPress={() => remove(menu, 'me')} style={[s.menuItem, { borderBottomWidth: 0 }]} accessibilityRole="button">
                    <Icon name="trash" size={18} color={colors.muted} />
                    <Text style={s.menuText}>{tr("Supprimer pour moi")}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}
        </Pressable>
      </Modal>

      {/* Photo en plein écran */}
      <Modal visible={Boolean(viewer)} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <Pressable style={s.viewer} onPress={() => setViewer(null)} accessibilityLabel={tr("Fermer la photo")}>
          {viewer ? <Image source={{ uri: viewer.image?.local || viewer.image?.url }} style={{ width, height: height * 0.8 }} resizeMode="contain" /> : null}
          <View style={[s.viewerClose, { top: insets.top + 12 }]}>
            <Icon name="close" size={26} color={colors.white} />
          </View>
        </Pressable>
      </Modal>

      <Sheet visible={Boolean(emojiFor)} onClose={() => setEmojiFor(null)} title={tr("Choisir une réaction")}>
        <View style={s.emojiGrid}>
          {[...REACTIONS, ...MORE_EMOJIS].map((e) => {
            const on = (emojiFor?.reactions || []).some((r) => r.mine && r.emoji === e);
            return (
              <Pressable key={e} onPress={() => { const m = emojiFor; setEmojiFor(null); react(m, e); }} accessibilityRole="button" accessibilityLabel={tr("Réagir {0}", [e])} style={[s.emojiCell, on && { backgroundColor: colors.blush }]}>
                <Text style={{ fontSize: 28 }}>{e}</Text>
              </Pressable>
            );
          })}
        </View>
        <T variant="small" style={{ textAlign: 'center' }}>{tr("Touche ton emoji actuel pour retirer ta réaction.")}</T>
      </Sheet>

      <Sheet visible={options === 'photo'} onClose={() => setOptions(false)} title={tr("Envoyer une photo")}>
        <Button title={tr("Prendre une photo")} icon="plus" variant="soft" onPress={() => pickPhoto(true)} />
        <Button title={tr("Choisir dans la galerie")} icon="share" variant="soft" onPress={() => pickPhoto(false)} />
        <T variant="small" style={{ textAlign: 'center' }}>{tr("Évite d’envoyer des documents médicaux par message.")}</T>
      </Sheet>

      <Sheet visible={options === true} onClose={() => setOptions(false)} title={other.name}>
        {other.phone ? <Button title={tr("Appeler · {0}", [other.phone])} icon="phone" variant="soft" onPress={() => Linking.openURL(`tel:${other.phone.replace(/\s/g, '')}`)} /> : null}
        {as === 'user' && other.id ? <Button title={tr("Voir la fiche")} variant="soft" onPress={() => { setOptions(false); router.push(`/praticienne/${other.id}`); }} /> : null}
        <Button title={meta.blockedByMe ? tr("Débloquer la conversation") : tr("Bloquer la conversation")} variant="outline" onPress={toggleBlock} />
        <Button title={tr("Signaler")} variant="outline" onPress={() => { setOptions(false); setReportOpen(true); }} />
      </Sheet>

      <Sheet visible={reportOpen} onClose={() => setReportOpen(false)} title={tr("Signaler la conversation")} footer={<Button title={tr("Envoyer le signalement")} onPress={sendReport} disabled={reason.trim().length < 3} />}>
        <T variant="small">{tr("Notre équipe examine chaque signalement. Explique en quelques mots ce qui pose problème.")}</T>
        <Field value={reason} onChangeText={setReason} multiline placeholder={tr("Motif du signalement")} />
      </Sheet>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.white },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  headerName: { fontFamily: fonts.bold, fontSize: 16.5, color: colors.prune },
  headerSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted },
  intro: { alignItems: 'center', gap: 6, paddingVertical: 24 },
  introName: { fontFamily: fonts.title, fontSize: 22, color: colors.prune, marginTop: 6 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.ivoire, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10, maxWidth: 320 },
  day: { alignSelf: 'center', fontFamily: fonts.medium, fontSize: 12, color: colors.muted, marginVertical: 12 },
  seen: { alignSelf: 'flex-end', fontFamily: fonts.body, fontSize: 11.5, color: colors.muted, marginTop: 3, marginRight: 4 },
  bubble: { paddingHorizontal: 14, paddingVertical: 9 },
  mine: { backgroundColor: colors.bordeaux },
  other: { backgroundColor: '#F1E6E8' },
  photoOnly: { padding: 3, backgroundColor: 'transparent' },
  text: { fontFamily: fonts.body, fontSize: 16, lineHeight: 21.5 },
  quote: { borderLeftWidth: 3, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 6 },
  quoteMine: { borderLeftColor: colors.rose, backgroundColor: 'rgba(255,255,255,0.12)' },
  quoteOther: { borderLeftColor: colors.bordeaux, backgroundColor: 'rgba(122,31,53,0.07)' },
  quoteWho: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.bordeaux },
  quoteText: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  reactions: { position: 'absolute', bottom: -14, flexDirection: 'row', gap: 2, backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: colors.line, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontFamily: fonts.bold, fontSize: 11, color: colors.muted },
  composerWrap: { borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 10, paddingTop: 8 },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 6, borderLeftWidth: 3, borderLeftColor: colors.bordeaux, backgroundColor: colors.ivoire, borderRadius: 10 },
  replyWho: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.bordeaux },
  replyText: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 42, maxHeight: 130, borderRadius: 22, backgroundColor: '#F4EEEF', paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontFamily: fonts.body, fontSize: 16, color: colors.prune },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.bordeaux, alignItems: 'center', justifyContent: 'center', marginBottom: 1 },
  blocked: { borderTopWidth: 1, borderTopColor: colors.line, padding: 16, gap: 10, alignItems: 'center', backgroundColor: colors.ivoire },
  backdrop: { flex: 1, backgroundColor: 'rgba(30,8,15,0.35)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  menuCard: { gap: 10, alignItems: 'center' },
  deleted: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  deletedText: { fontFamily: fonts.body, fontStyle: 'italic', fontSize: 14.5, color: colors.muted },
  status: { fontFamily: fonts.body, fontSize: 11.5, color: colors.muted, marginTop: 3, marginHorizontal: 4 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4 },
  emojiCell: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  reactionBar: { flexDirection: 'row', gap: 2, backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 6 },
  reactionBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  menuActions: { backgroundColor: colors.white, borderRadius: 18, minWidth: 220, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
  menuText: { fontFamily: fonts.medium, fontSize: 16, color: colors.prune },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  viewerClose: { position: 'absolute', right: 18, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
});
