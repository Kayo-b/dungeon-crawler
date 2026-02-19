import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ItemIcon } from '../../components/ItemIcon';
import { MerchantStockEntry } from './merchantUtils';

interface MerchantModalProps {
  visible: boolean;
  mode: 'menu' | 'trade';
  gold: number;
  merchantStock: MerchantStockEntry[];
  playerBag: any[];
  bagCapacity: number;
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
  bagCapacity,
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
                  {Array.from({ length: bagCapacity }).map((_, index) => {
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
const RETRO_FONT = Platform.OS === 'web' ? '"Press Start 2P", "Courier New", monospace' : 'monospace';

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 980,
    backgroundColor: 'rgba(0,0,0,0.84)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  panel: {
    width: '100%',
    maxWidth: 760,
    maxHeight: '92%',
    backgroundColor: '#080808',
    borderWidth: 4,
    borderColor: '#d7d7d7',
    padding: 10,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: RETRO_FONT,
  },
  goldText: {
    color: '#f0f0f0',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: RETRO_FONT,
  },
  menuActions: {
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#d7d7d7',
    paddingVertical: 8,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#262626',
    borderWidth: 2,
    borderColor: '#d7d7d7',
    paddingVertical: 8,
    alignItems: 'center',
  },
  mutedButton: {
    backgroundColor: '#1d1d1d',
    borderWidth: 2,
    borderColor: '#636363',
    paddingVertical: 8,
    alignItems: 'center',
  },
  actionText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    fontFamily: RETRO_FONT,
  },
  hintText: {
    color: '#d0d0d0',
    fontSize: 10,
    fontFamily: RETRO_FONT,
  },
  tradeColumns: {
    flexDirection: 'row',
    gap: 8,
  },
  column: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#d7d7d7',
    backgroundColor: '#121212',
    padding: 6,
    gap: 6,
  },
  columnTitle: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: RETRO_FONT,
  },
  columnScroll: {
    maxHeight: 320,
  },
  tradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#bfbfbf',
    backgroundColor: '#181818',
    padding: 6,
    marginBottom: 6,
  },
  tradeInfo: {
    flex: 1,
    gap: 1,
  },
  itemName: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: RETRO_FONT,
  },
  itemMeta: {
    color: '#cfcfcf',
    fontSize: 9,
    fontFamily: RETRO_FONT,
  },
  priceText: {
    color: '#f0f0f0',
    fontSize: 11,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
    fontFamily: RETRO_FONT,
  },
  bagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  bagCell: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderColor: '#d7d7d7',
    backgroundColor: '#181818',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bagCellEmpty: {
    opacity: 0.45,
  },
  emptyText: {
    color: '#d0d0d0',
    fontSize: 10,
    fontFamily: RETRO_FONT,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
});
