// Rendu Markdown simple pour les articles (titres, listes, citations, gras).
import { View } from 'react-native';
import { colors } from '../theme';
import { T } from './ui';

function Inline({ text, variant = 'body', color }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <T variant={variant} color={color} style={{ fontSize: 17, lineHeight: 26 }}>
      {parts.map((p, i) => (p.startsWith('**') ? <T key={i} variant="bold" style={{ fontSize: 17, lineHeight: 26 }}>{p.slice(2, -2)}</T> : p))}
    </T>
  );
}

export default function Markdown({ source }) {
  const blocks = source.split(/\n{2,}/);
  return (
    <View style={{ gap: 14 }}>
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        if (block.startsWith('## ')) return <T key={i} variant="h3" style={{ marginTop: 8 }}>{block.slice(3)}</T>;
        if (block.startsWith('> ')) {
          return (
            <View key={i} style={{ borderLeftWidth: 3, borderLeftColor: colors.or, paddingLeft: 14 }}>
              <T variant="quote">{lines.map((l) => l.replace(/^>\s?/, '')).join(' ')}</T>
            </View>
          );
        }
        if (lines.every((l) => /^(-|\d+\.)\s/.test(l))) {
          return (
            <View key={i} style={{ gap: 8 }}>
              {lines.map((l, j) => {
                const ordered = /^\d+\./.test(l);
                return (
                  <View key={j} style={{ flexDirection: 'row', gap: 10 }}>
                    <T variant="bold" color={colors.bordeaux} style={{ width: 22, fontSize: 17, lineHeight: 26 }}>{ordered ? l.match(/^\d+/)[0] + '.' : '•'}</T>
                    <View style={{ flex: 1 }}>
                      <Inline text={l.replace(/^(-|\d+\.)\s/, '')} />
                    </View>
                  </View>
                );
              })}
            </View>
          );
        }
        return <Inline key={i} text={lines.join(' ')} />;
      })}
    </View>
  );
}
