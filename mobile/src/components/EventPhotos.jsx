// Photos d'un événement : grille (2 colonnes, la première en grand) avec visionneuse plein écran,
// et éditeur de galerie (ajout de plusieurs photos, retrait) pour la proposition d'un événement.
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { assetUrl, uploadImage } from '../lib/api';
import { shrinkImage } from '../lib/image';
import { colors, fonts } from '../theme';
import Icon from './Icon';
import { T, useToast } from './ui';

import { tr } from '../lib/i18n';
export const MAX_PHOTOS = 12;

/** Grille de photos : 1 photo pleine largeur, sinon la première en grand puis 2 par ligne. */
export function PhotoGrid({ photos = [], title }) {
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState(null);
  if (!photos.length) return null;
  const w = Math.min(width, 640) - 40;
  const gap = 8;
  const half = (w - gap) / 2;
  return (
    <View style={{ gap: 10 }}>
      <T variant="h3">{tr("Photos ·")} {photos.length}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
        {photos.map((url, i) => {
          const big = i === 0;
          return (
            <Pressable key={url + i} onPress={() => setOpen(i)} accessibilityRole="imagebutton" accessibilityLabel={tr("Photo {0} sur {1}{2}", [i + 1, photos.length, title ? `, ${title}` : ''])} style={{ width: big ? w : half, height: big ? w * 0.56 : half, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.blush }}>
              <Image source={{ uri: assetUrl(url) }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
            </Pressable>
          );
        })}
      </View>
      <Viewer photos={photos} index={open} onClose={() => setOpen(null)} />
    </View>
  );
}

function Viewer({ photos, index, onClose }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(0);
  const ref = useRef(null);
  if (index == null) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.viewer}>
        <ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: index * width, y: 0 }}
          onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
          onLayout={() => { setCurrent(index); ref.current?.scrollTo?.({ x: index * width, animated: false }); }}
        >
          {photos.map((url, i) => (
            <View key={url + i} style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={{ uri: assetUrl(url) }} style={{ width, height: height * 0.8 }} resizeMode="contain" accessibilityIgnoresInvertColors />
            </View>
          ))}
        </ScrollView>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={tr("Fermer")} hitSlop={12} style={[s.close, { top: insets.top + 12 }]}>
          <Icon name="close" size={22} color={colors.white} />
        </Pressable>
        <Text style={[s.count, { bottom: insets.bottom + 20 }]}>{current + 1} / {photos.length}</Text>
      </View>
    </Modal>
  );
}

/** Éditeur de la galerie dans « Proposer un événement ». */
export function PhotoEditor({ photos, onChange }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const left = MAX_PHOTOS - photos.length;
  const add = async () => {
    if (Platform.OS === 'web') return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: left, quality: 0.7 });
    if (r.canceled) return;
    setBusy(true);
    const urls = [];
    try {
      for (const a of r.assets.slice(0, left)) {
        const img = a.width && a.width <= 1600 && a.fileSize && a.fileSize < 900_000 ? { uri: a.uri, mimeType: a.mimeType } : await shrinkImage(a.uri);
        urls.push((await uploadImage('/events/image', 'image', img.uri, img.mimeType)).url);
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      onChange([...photos, ...urls]);
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 8 }}>
      <T variant="fieldLabel">{tr("Photos de l’événement (")}{photos.length}/{MAX_PHOTOS})</T>
      <View style={s.edit}>
        {photos.map((url, i) => (
          <View key={url + i} style={s.thumb}>
            <Image source={{ uri: assetUrl(url) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <Pressable onPress={() => onChange(photos.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={tr("Retirer la photo {0}", [i + 1])} hitSlop={6} style={s.remove}>
              <Icon name="close" size={14} color={colors.white} strokeWidth={2.6} />
            </Pressable>
          </View>
        ))}
        {left > 0 ? (
          <Pressable onPress={add} disabled={busy || Platform.OS === 'web'} accessibilityRole="button" accessibilityLabel={tr("Ajouter des photos")} style={[s.thumb, s.add]}>
            <Icon name="plus" size={24} color={colors.bordeaux} />
            <Text style={s.addText}>{busy ? tr("Envoi…") : Platform.OS === 'web' ? tr("Sur le téléphone") : tr("Ajouter")}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  viewer: { flex: 1, backgroundColor: 'rgba(20,6,12,0.96)' },
  close: { position: 'absolute', right: 16, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  count: { position: 'absolute', alignSelf: 'center', fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  edit: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: '31%', aspectRatio: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.blush },
  add: { alignItems: 'center', justifyContent: 'center', gap: 2, borderWidth: 1.5, borderColor: colors.rose, borderStyle: 'dashed' },
  addText: { fontFamily: fonts.bold, fontSize: 12, color: colors.bordeaux },
  remove: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(30,8,15,0.65)', alignItems: 'center', justifyContent: 'center' },
});
