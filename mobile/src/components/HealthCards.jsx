// Visages d'humeur (5 niveaux), partagés par Cycle, Suivre ma santé et Mon journal du jour.
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme';

/** Visages d'humeur. */
export function MoodFace({ mood, size = 44, on }) {
  const stroke = on ? colors.white : colors.bordeaux;
  const mouths = { sereine: "M15 27 Q23 33 31 27", bien: "M14 26 Q23 35 32 26", fatiguee: "M16 29 L30 29", irritable: "M16 30 Q23 26 30 30", triste: "M15 31 Q23 24 31 31" };
  const eyes =
    mood === 'fatiguee' ? ["M14 19 L19 19", "M27 19 L32 19"] : mood === 'sereine' ? ["M14 19 Q16.5 21 19 19", "M27 19 Q29.5 21 32 19"] : mood === 'irritable' ? ["M13 16 L19 19", "M33 16 L27 19"] : null;
  return (
    <Svg width={size} height={size} viewBox="0 0 46 46">
      <Circle cx="23" cy="23" r="21.5" fill={on ? colors.bordeaux : colors.white} stroke={on ? colors.bordeaux : stroke} strokeWidth={1.5} />
      {eyes ? eyes.map((d) => <Path key={d} d={d} stroke={stroke} strokeWidth={2} fill="none" strokeLinecap="round" />) : (
        <>
          <Circle cx="17" cy="19" r="2" fill={stroke} />
          <Circle cx="29" cy="19" r="2" fill={stroke} />
        </>
      )}
      <Path d={mouths[mood]} stroke={stroke} strokeWidth={2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}
