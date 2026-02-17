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

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  panel: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '86%',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    gap: 8,
  },
  title: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 22,
  },
  meta: {
    color: '#94a3b8',
    fontSize: 12,
  },
  scrollArea: {
    maxHeight: 280,
  },
  lootRow: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    backgroundColor: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lootRowFocused: {
    borderColor: '#93c5fd',
    borderWidth: 2,
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
    color: '#f8fafc',
    fontWeight: '600',
    fontSize: 13,
  },
  lootType: {
    color: '#94a3b8',
    fontSize: 10,
  },
  takeText: {
    color: '#22c55e',
    fontWeight: '700',
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionMuted: {
    backgroundColor: '#475569',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  actionPrimary: {
    backgroundColor: '#1d4ed8',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  actionText: {
    color: '#f8fafc',
    fontWeight: '600',
    fontSize: 12,
  },
  actionFocused: {
    borderColor: '#bfdbfe',
    borderWidth: 2,
  },
});
