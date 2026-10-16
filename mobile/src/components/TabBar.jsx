import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import Icon from './Icon';

/** Barre de navigation du bas (5 onglets, 3.1) — onglet actif en bordeaux. */
export default function TabBar({ state, descriptors, navigation, icons }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 10) }]} accessibilityRole="tablist">
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        if (!icons[route.name]) return null; // écran secondaire (ex. disponibilités)
        const focused = state.index === index;
        const color = focused ? colors.bordeaux : colors.muted;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <Pressable key={route.key} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={options.title} style={s.item}>
            <Icon name={icons[route.name]} size={28} color={color} strokeWidth={focused ? 2 : 1.7} />
            <Text style={[s.label, { color, fontFamily: focused ? fonts.bold : fonts.body }]} numberOfLines={1}>
              {options.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 },
  item: { flex: 1, alignItems: 'center', gap: 4, minHeight: 52, justifyContent: 'center' },
  label: { fontSize: 12.5 },
});
