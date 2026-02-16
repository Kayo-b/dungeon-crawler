import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
            <Pressable key={`loot-item-${index}`} style={styles.lootRow} onPress={() => onLootSingle(index)}>
              <View style={styles.lootMain}>
                <ItemIcon type={item?.type || 'misc'} size={22} />
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
          <Pressable style={styles.actionMuted} onPress={onDontLoot}>
            <Text style={styles.actionText}>Don&apos;t Loot</Text>
          </Pressable>
          <Pressable style={styles.actionPrimary} onPress={onLootAll}>
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
});
