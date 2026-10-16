// 14 — Photo d'article : couverture 16:9 et miniature carrée, sans déformation (cadrage « cover »),
// texte alternatif ; à défaut de photo, aplat de la couleur de l'article.
import { Image, View } from 'react-native';
import { assetUrl } from '../lib/api';
import { colors } from '../theme';

const SWATCH = { rose: colors.rose, or: colors.or, blush: colors.blush, bordeaux: colors.bordeaux };

export function ArticleImage({ article, variant = 'thumb', size = 84, radius, style }) {
  const cover = variant === 'cover';
  const box = cover ? { width: '100%', aspectRatio: 16 / 9, borderRadius: radius ?? 22 } : { width: size, height: size, borderRadius: radius ?? 16 };
  return (
    <View style={[box, { overflow: 'hidden', backgroundColor: SWATCH[article?.color] || colors.blush }, style]}>
      {article?.coverUrl ? (
        <Image source={{ uri: assetUrl(article.coverUrl) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel={article.coverAlt || article.title} accessibilityIgnoresInvertColors />
      ) : null}
    </View>
  );
}
