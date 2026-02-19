import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ItemIcon } from '../../components/ItemIcon';

interface EnemyLootModalProps {
  visible: boolean;
  lootItems: any[];
  bagCount: number;
  bagCapacity: number;
  stashCount: number;
  stashCapacity: number;
  onLootAll: () => void;
  onDontLoot: () => void;
  onLootSingle: (index: number) => void;
}

export const EnemyLootModal: React.FC<EnemyLootModalProps> = ({
  visible,
  lootItems,
  bagCount,
  bagCapacity,
  stashCount,
  stashCapacity,
  onLootAll,
  onDontLoot,
  onLootSingle,
}) => {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const interactiveRefs = useRef<Array<any>>([]);
  const tabProps = useMemo(() => (Platform.OS === 'web' ? ({ tabIndex: 0 } as any) : {}), []);
  const totalFocusTargets = lootItems.length + 2;

  const focusByIndex = (index: number) => {
    const clamped = Math.max(0, Math.min(index, totalFocusTargets - 1));
    setFocusedIndex(clamped);
    const node = interactiveRefs.current[clamped];
    if (node?.focus) {
      node.focus();
    }
  };

  useEffect(() => {
    if (!visible) return;
    setFocusedIndex(0);
    if (Platform.OS !== 'web') return;
    const timer = setTimeout(() => {
      focusByIndex(0);
    }, 0);
    return () => clearTimeout(timer);
  }, [visible, lootItems.length]);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;

      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault();
        focusByIndex((focusedIndex + 1) % Math.max(1, totalFocusTargets));
        return;
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const nextIndex = focusedIndex - 1 < 0 ? totalFocusTargets - 1 : focusedIndex - 1;
        focusByIndex(nextIndex);
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        const node = interactiveRefs.current[focusedIndex];
        if (node?.click) {
          event.preventDefault();
          node.click();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, focusedIndex, totalFocusTargets]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>
        <Text style={styles.title}>Enemy Loot</Text>
        <Text style={styles.meta}>
          Bag {bagCount}/{bagCapacity} | Stash {stashCount}/{stashCapacity}
        </Text>

        <ScrollView style={styles.scrollArea}>
          {lootItems.map((item, index) => (
            <Pressable
              key={`loot-item-${index}`}
              ref={(node) => {
                interactiveRefs.current[index] = node;
              }}
              style={[styles.lootRow, focusedIndex === index && styles.lootRowFocused]}
              onPress={() => onLootSingle(index)}
              onFocus={() => setFocusedIndex(index)}
              focusable
              {...tabProps}
            >
              <View style={styles.lootMain}>
                <ItemIcon
                  type={item?.type || 'misc'}
                  size={22}
                  itemName={item?.name}
                  itemStats={item?.stats}
                />
                <View style={styles.nameWrap}>
                  <Text style={styles.lootName}>{item?.name || 'Unknown item'}</Text>
                  <Text style={styles.lootType}>{item?.type || 'unknown'}</Text>
                </View>
              </View>
              <Text style={styles.takeText}>Take</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.actionsRow}>
          <Pressable
            ref={(node) => {
              interactiveRefs.current[lootItems.length] = node;
            }}
            style={[
              styles.actionMuted,
              focusedIndex === lootItems.length && styles.actionFocused,
            ]}
            onPress={onDontLoot}
            onFocus={() => setFocusedIndex(lootItems.length)}
            focusable
            {...tabProps}
          >
            <Text style={styles.actionText}>Don&apos;t Loot</Text>
          </Pressable>
          <Pressable
            ref={(node) => {
              interactiveRefs.current[lootItems.length + 1] = node;
            }}
            style={[
              styles.actionPrimary,
              focusedIndex === lootItems.length + 1 && styles.actionFocused,
            ]}
            onPress={onLootAll}
            onFocus={() => setFocusedIndex(lootItems.length + 1)}
            focusable
            {...tabProps}
          >
            <Text style={styles.actionText}>Loot All</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};
const RETRO_FONT = Platform.OS === 'web' ? '"Press Start 2P", "Courier New", monospace' : 'monospace';

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    backgroundColor: 'rgba(0,0,0,0.84)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  panel: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '86%',
    backgroundColor: '#080808',
    borderWidth: 4,
    borderColor: '#d7d7d7',
    padding: 12,
    gap: 8,
  },
  title: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 20,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: RETRO_FONT,
  },
  meta: {
    color: '#d0d0d0',
    fontSize: 11,
    fontFamily: RETRO_FONT,
  },
  scrollArea: {
    maxHeight: 280,
  },
  lootRow: {
    borderWidth: 2,
    borderColor: '#d7d7d7',
    backgroundColor: '#121212',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lootRowFocused: {
    borderColor: '#ffffff',
    borderWidth: 2,
    backgroundColor: '#252525',
  },
  lootMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameWrap: {
    gap: 1,
  },
  lootName: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 12,
    fontFamily: RETRO_FONT,
  },
  lootType: {
    color: '#d0d0d0',
    fontSize: 9,
    textTransform: 'uppercase',
    fontFamily: RETRO_FONT,
  },
  takeText: {
    color: '#f0f0f0',
    fontWeight: '700',
    fontSize: 11,
    textTransform: 'uppercase',
    fontFamily: RETRO_FONT,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionMuted: {
    backgroundColor: '#262626',
    borderWidth: 2,
    borderColor: '#d7d7d7',
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  actionPrimary: {
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#d7d7d7',
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  actionText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 11,
    textTransform: 'uppercase',
    fontFamily: RETRO_FONT,
  },
  actionFocused: {
    borderColor: '#ffffff',
    borderWidth: 2,
  },
});
