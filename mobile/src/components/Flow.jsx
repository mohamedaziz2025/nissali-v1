// Gouttes du flux : pictogramme des boutons de l'accueil et gouttes pleines du détail d'un jour (1.1, 6.4).
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export function FlowDrop({ level, color, size = 26 }) {
  const drop = (dx = 0, s = 1) => `M${12 + dx} ${3 * s + (1 - s) * 12}c0 0 ${-6 * s} ${7 * s} ${-6 * s} ${11 * s}a${6 * s} ${6 * s} 0 0 0 ${12 * s} 0c0-${4 * s}-${6 * s}-${11 * s}-${6 * s}-${11 * s}z`;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {level === 'abondant' ? (
        <>
          <Path d={drop(-4, 0.8)} stroke={color} strokeWidth={1.6} fill="none" strokeLinejoin="round" />
          <Path d={drop(4, 0.8)} stroke={color} strokeWidth={1.6} fill="none" strokeLinejoin="round" />
        </>
      ) : (
        <Path d={drop()} stroke={color} strokeWidth={1.6} fill={level === 'moyen' ? color : 'none'} strokeLinejoin="round" />
      )}
    </Svg>
  );
}

/** Sélecteur des 3 niveaux (fenêtre Flux du jour et carte de l'accueil). */

/** Mise à jour Cycle · 1.1 — gouttes de sang pleines : 1 = Léger, 2 = Moyen, 3 = Abondant. */
export const FLOW_DROPS = { leger: 1, moyen: 2, abondant: 3 };
export function BloodDrops({ count = 1, color, size = 14 }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Svg key={i} width={size} height={size * 1.25} viewBox="0 0 20 25">
          <Path d="M10 1.5C10 1.5 2 11 2 16a8 8 0 0 0 16 0c0-5-8-14.5-8-14.5z" fill={color} />
        </Svg>
      ))}
    </View>
  );
}
