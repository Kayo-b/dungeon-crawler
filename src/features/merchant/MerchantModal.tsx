import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ItemIcon } from '../../components/ItemIcon';
import { BAG_CAPACITY } from '../inventory/inventoryUtils';
import { MerchantStockEntry } from './merchantUtils';

interface MerchantModalProps {
  visible: boolean;
  mode: 'menu' | 'trade';
  gold: number;
  merchantStock: MerchantStockEntry[];
  playerBag: any[];
  onClose: () => void;
  onTalk: () => void;
  onTrade: () => void;
  onBuy: (index: number) => void;
  onSell: (bagIndex: number) => void;
}

const hasCtrlKey = (event: any): boolean => {
  const native = event?.nativeEvent || event;
  return !!(native?.ctrlKey || native?.metaKey);
};

export const MerchantModal: React.FC<MerchantModalProps> = ({
  visible,
  mode,
  gold,
  merchantStock,
  playerBag,
  onClose,
  onTalk,
  onTrade,
  onBuy,
  onSell,
}) => {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Merchant</Text>
          <Text style={styles.goldText}>Gold: {gold}</Text>
        </View>

        {mode === 'menu' ? (
          <View style={styles.menuActions}>
            <Pressable style={styles.primaryButton} onPress={onTrade}>
              <Text style={styles.actionText}>Trade</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={onTalk}
            >
              <Text style={styles.actionText}>Talk</Text>
            </Pressable>
            <Pressable style={styles.mutedButton} onPress={onClose}>
              <Text style={styles.actionText}>Leave</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.hintText}>
              {Platform.OS === 'web'
                ? 'Ctrl + Left Click: buy from merchant / sell from your bag'
                : 'Tap item to buy or sell'}
            </Text>
            <View style={styles.tradeColumns}>
              <View style={styles.column}>
                <Text style={styles.columnTitle}>Merchant Stock</Text>
                <ScrollView style={styles.columnScroll}>
                  {merchantStock.length <= 0 ? (
                    <Text style={styles.emptyText}>Sold out.</Text>
                  ) : (
                    merchantStock.map((entry, index) => (
                      <Pressable
                        key={entry.id}
                        style={styles.tradeRow}
                        onPress={(event: any) => {
                          if (Platform.OS === 'web' && !hasCtrlKey(event)) return;
                          onBuy(index);
                        }}
                      >
                        <ItemIcon
                          type={entry.item?.type || 'unknown'}
                          size={20}
                          itemName={entry.item?.name}
                          itemStats={entry.item?.stats}
                        />
                        <View style={styles.tradeInfo}>
                          <Text numberOfLines={1} style={styles.itemName}>{entry.item?.name || 'Unknown item'}</Text>
                          <Text style={styles.itemMeta}>
                            {entry.item?.rarity || 'common'} | Q{entry.item?.quality || 1} | Req {entry.item?.levelRequirement || 1}
                          </Text>
                          <Text style={styles.itemMeta}>Stock: {entry.stock}</Text>
                        </View>
                        <Text style={styles.priceText}>{entry.buyPrice}</Text>
                      </Pressable>
                    ))
                  )}
                </ScrollView>
              </View>

              <View style={styles.column}>
                <Text style={styles.columnTitle}>Your Bag</Text>
                <View style={styles.bagGrid}>
                  {Array.from({ length: BAG_CAPACITY }).map((_, index) => {
                    const item = playerBag[index];
                    return (
                      <Pressable
                        key={`merchant-bag-${index}`}
                        style={[styles.bagCell, !item && styles.bagCellEmpty]}
                        onPress={(event: any) => {
                          if (!item) return;
                          if (Platform.OS === 'web' && !hasCtrlKey(event)) return;
                          onSell(index);
                        }}
                      >
                        {item ? (
                          <ItemIcon
                            type={item.type}
                            size={18}
                            itemName={item.name}
                            itemStats={item.stats}
                          />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={styles.footerActions}>
              <Pressable style={styles.secondaryButton} onPress={onTalk}>
                <Text style={styles.actionText}>Talk</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={onClose}>
                <Text style={styles.actionText}>Leave</Text>
              </Pressable>
            </View>
          </>
        )}
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
    zIndex: 980,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  panel: {
    width: '100%',
    maxWidth: 760,
    maxHeight: '92%',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 10,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '700',
  },
  goldText: {
    color: '#facc15',
    fontSize: 13,
    fontWeight: '700',
  },
  menuActions: {
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#1d4ed8',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#475569',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  mutedButton: {
    backgroundColor: '#334155',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
  },
  hintText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  tradeColumns: {
    flexDirection: 'row',
    gap: 8,
  },
  column: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    backgroundColor: '#111827',
    padding: 6,
    gap: 6,
  },
  columnTitle: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
  },
  columnScroll: {
    maxHeight: 320,
  },
  tradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    backgroundColor: '#0b1220',
    padding: 6,
    marginBottom: 6,
  },
  tradeInfo: {
    flex: 1,
    gap: 1,
  },
  itemName: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
  },
  itemMeta: {
    color: '#94a3b8',
    fontSize: 10,
  },
  priceText: {
    color: '#facc15',
    fontSize: 12,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
  bagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  bagCell: {
    width: 28,
    height: 28,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bagCellEmpty: {
    opacity: 0.45,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
});
