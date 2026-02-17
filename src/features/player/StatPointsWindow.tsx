import { useEffect, useMemo, useRef, useState } from 'react';
import { ImageBackground, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  computeDerivedPlayerStats,
  getClassArchetype,
  getClassProgressionProfile,
  PlayerEquipment,
  PlayerStats,
} from './playerStats';

type AllocatableStatKey = 'strength' | 'dexterity' | 'vitality' | 'intelligence';

type StatAllocationMap = Record<AllocatableStatKey, number>;

interface StatPointsWindowProps {
  visible: boolean;
  classArchetype: string;
  level: number;
  experience: number;
  nextLevelXp: number;
  stats: PlayerStats;
  equipment: PlayerEquipment;
  unspentStatPoints: number;
  onClose: () => void;
  onApplyAllocations: (allocations: StatAllocationMap) => Promise<void> | void;
}

interface StatMeta {
  key: AllocatableStatKey;
  label: string;
  summary: string;
}

const STAT_META: StatMeta[] = [
  {
    key: 'strength',
    label: 'Strength',
    summary: 'Boosts weapon damage',
  },
  {
    key: 'dexterity',
    label: 'Dexterity',
    summary: 'Boosts speed and precision',
  },
  {
    key: 'vitality',
    label: 'Vitality',
    summary: 'Boosts life and stamina',
  },
  {
    key: 'intelligence',
    label: 'Energy',
    summary: 'Boosts mana resources',
  },
];

const EMPTY_ALLOCATIONS: StatAllocationMap = {
  strength: 0,
  dexterity: 0,
  vitality: 0,
  intelligence: 0,
};

const readStat = (stats: PlayerStats, key: AllocatableStatKey): number => {
  const value = stats?.[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

const formatDelta = (next: number, current: number, asPercent: boolean = false) => {
  const delta = next - current;
  if (Math.abs(delta) < 0.00001) return '';
  if (asPercent) {
    return ` (+${(delta * 100).toFixed(2)}%)`;
  }
  const rounded = Number.isInteger(delta) ? delta.toString() : delta.toFixed(2);
  return ` (+${rounded})`;
};

const formatRuleValue = (value: number) => {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2).replace(/\.?0+$/, '');
};

const getStatDetail = (key: AllocatableStatKey, classProfile: ReturnType<typeof getClassProgressionProfile>) => {
  if (key === 'strength') {
    return 'Improves melee scaling and heavy-skill damage.';
  }
  if (key === 'dexterity') {
    return 'Per point: +1% atk speed, +0.15% crit, +0.12% dodge, and higher attack rating.';
  }
  if (key === 'vitality') {
    return `Per point: +${formatRuleValue(classProfile.vitalityHp)} HP and +${formatRuleValue(classProfile.vitalityStamina)} Stamina.`;
  }
  return `Per point: +${formatRuleValue(classProfile.energyMana)} Mana (stored as Intelligence).`;
};

export const StatPointsWindow: React.FC<StatPointsWindowProps> = ({
  visible,
  classArchetype,
  level,
  experience,
  nextLevelXp,
  stats,
  equipment,
  unspentStatPoints,
  onClose,
  onApplyAllocations,
}) => {
  const [allocations, setAllocations] = useState<StatAllocationMap>(EMPTY_ALLOCATIONS);
  const [focusedControlIndex, setFocusedControlIndex] = useState(0);
  const interactiveRefs = useRef<Array<any>>([]);
  const tabProps = useMemo(() => (Platform.OS === 'web' ? ({ tabIndex: 0 } as any) : {}), []);

  useEffect(() => {
    if (!visible) return;
    setAllocations(EMPTY_ALLOCATIONS);
    setFocusedControlIndex(0);
  }, [visible, unspentStatPoints, stats]);

  const spentPoints = useMemo(() => {
    return Object.values(allocations).reduce((sum, value) => sum + value, 0);
  }, [allocations]);

  const classId = getClassArchetype(classArchetype);
  const classProfile = useMemo(() => getClassProgressionProfile(classId), [classId]);
  const classLabel = classId === 'caster' ? 'Mage' : classId === 'ranger' ? 'Rogue' : 'Warrior';
  const xpToLevel = Math.max(1, nextLevelXp);
  const xpIntoLevel = ((experience % xpToLevel) + xpToLevel) % xpToLevel;
  const xpPct = Math.max(0, Math.min(1, xpIntoLevel / xpToLevel));
  const targetPct = Math.max(0, Math.min(1, experience / xpToLevel));

  const remainingPoints = Math.max(0, unspentStatPoints - spentPoints);

  const draftStats = useMemo(() => {
    const merged = { ...(stats || {}) } as Record<string, any>;
    (Object.keys(allocations) as AllocatableStatKey[]).forEach((key) => {
      merged[key] = readStat(merged, key) + allocations[key];
    });
    return merged;
  }, [allocations, stats]);

  const baseDerived = useMemo(() => {
    return computeDerivedPlayerStats(stats || {}, equipment || {}, { classArchetype, level });
  }, [stats, equipment, classArchetype, level]);

  const draftDerived = useMemo(() => {
    return computeDerivedPlayerStats(draftStats || {}, equipment || {}, { classArchetype, level });
  }, [draftStats, equipment, classArchetype, level]);

  const addPoint = (key: AllocatableStatKey) => {
    if (remainingPoints <= 0) return;
    setAllocations((prev) => ({ ...prev, [key]: prev[key] + 1 }));
  };

  const removePoint = (key: AllocatableStatKey) => {
    setAllocations((prev) => ({ ...prev, [key]: Math.max(0, prev[key] - 1) }));
  };

  const handleApply = async () => {
    if (spentPoints <= 0) return;
    await onApplyAllocations(allocations);
    setAllocations(EMPTY_ALLOCATIONS);
  };

  const totalFocusTargets = 1 + STAT_META.length * 2 + 2;

  const getMinusButtonIndex = (statIndex: number) => 1 + statIndex * 2;
  const getPlusButtonIndex = (statIndex: number) => 1 + statIndex * 2 + 1;
  const resetButtonIndex = totalFocusTargets - 2;
  const applyButtonIndex = totalFocusTargets - 1;

  const focusByIndex = (index: number) => {
    const clamped = Math.max(0, Math.min(index, totalFocusTargets - 1));
    setFocusedControlIndex(clamped);
    const node = interactiveRefs.current[clamped];
    if (node?.focus) {
      node.focus();
    }
  };

  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const timer = setTimeout(() => focusByIndex(0), 0);
    return () => clearTimeout(timer);
  }, [visible]);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;

      if (event.key === 'Escape' || event.key.toLowerCase() === 'c') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault();
        focusByIndex((focusedControlIndex + 1) % Math.max(1, totalFocusTargets));
        return;
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const nextIndex = focusedControlIndex - 1 < 0 ? totalFocusTargets - 1 : focusedControlIndex - 1;
        focusByIndex(nextIndex);
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        const node = interactiveRefs.current[focusedControlIndex];
        if (node?.click) {
          event.preventDefault();
          node.click();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, focusedControlIndex, totalFocusTargets, onClose]);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>
        <View style={styles.headerRow}>
          <Text style={styles.panelTitle}>Skill Points</Text>
          <Pressable
            ref={(node) => {
              interactiveRefs.current[0] = node;
            }}
            style={[styles.closeButton, focusedControlIndex === 0 && styles.focusedButton]}
            onPress={onClose}
            onFocus={() => setFocusedControlIndex(0)}
            focusable
            {...tabProps}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>

        <View style={styles.profileRow}>
          <ImageBackground source={require('../../resources/portrait.png')} style={styles.profilePortrait} />
          <View style={styles.profileInfo}>
            <Text style={styles.profileTitle}>{classLabel} Profile</Text>
            <Text style={styles.profileMeta}>Level {level}</Text>
            <View style={styles.xpBarTrack}>
              <View style={[styles.xpBarFill, { width: `${xpPct * 100}%` }]} />
            </View>
            <Text style={styles.profileMeta}>
              XP {xpIntoLevel}/{xpToLevel}
            </Text>
            <View style={styles.xpBarTrack}>
              <View style={[styles.xpTargetFill, { width: `${targetPct * 100}%` }]} />
            </View>
            <Text style={styles.profileMeta}>
              Total XP {experience}/{xpToLevel}
            </Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Level</Text>
            <Text style={styles.summaryValue}>{level}</Text>
          </View>
          <View style={styles.summaryCardWide}>
            <Text style={styles.summaryLabel}>Experience</Text>
            <Text style={styles.summaryValue}>{experience}</Text>
          </View>
          <View style={styles.summaryCardWide}>
            <Text style={styles.summaryLabel}>Next Level</Text>
            <Text style={styles.summaryValue}>{nextLevelXp}</Text>
          </View>
        </View>

        <Text style={styles.pointsText}>Stat Points Remaining: {remainingPoints}</Text>
        <View style={styles.rulesPanel}>
          <Text style={styles.rulesTitle}>{classLabel} Passive Leveling</Text>
          <Text style={styles.rulesLine}>
            Per level: +{formatRuleValue(classProfile.levelUpHp)} HP, +{formatRuleValue(classProfile.levelUpMana)} Mana, +{formatRuleValue(classProfile.levelUpStamina)} Stamina
          </Text>
          <Text style={styles.rulesLine}>
            Vitality point: +{formatRuleValue(classProfile.vitalityHp)} HP and +{formatRuleValue(classProfile.vitalityStamina)} Stamina
          </Text>
          <Text style={styles.rulesLine}>
            Energy point (Intelligence): +{formatRuleValue(classProfile.energyMana)} Mana
          </Text>
        </View>

        <ScrollView style={styles.scrollRegion}>
          {STAT_META.map((meta, index) => {
            const baseValue = readStat(stats || {}, meta.key);
            const pending = allocations[meta.key];
            const draftValue = baseValue + pending;

            return (
              <View key={meta.key} style={styles.statRow}>
                <View style={styles.statInfoCol}>
                  <Text style={styles.statLabel}>{meta.label}</Text>
                  <Text style={styles.statSummary}>{meta.summary}</Text>
                  <Text style={styles.statDetail}>{getStatDetail(meta.key, classProfile)}</Text>
                </View>

                <View style={styles.statControlCol}>
                  <Text style={styles.statValue}>
                    {draftValue}
                    {pending > 0 ? <Text style={styles.pendingValue}> (+{pending})</Text> : null}
                  </Text>
                  <View style={styles.buttonsRow}>
                    <Pressable
                      ref={(node) => {
                        interactiveRefs.current[getMinusButtonIndex(index)] = node;
                      }}
                      style={[
                        styles.actionButton,
                        pending <= 0 && styles.actionButtonDisabled,
                        focusedControlIndex === getMinusButtonIndex(index) && styles.focusedButton,
                      ]}
                      onPress={() => removePoint(meta.key)}
                      onFocus={() => setFocusedControlIndex(getMinusButtonIndex(index))}
                      disabled={pending <= 0}
                      focusable
                      {...tabProps}
                    >
                      <Text style={styles.actionButtonText}>-</Text>
                    </Pressable>
                    <Pressable
                      ref={(node) => {
                        interactiveRefs.current[getPlusButtonIndex(index)] = node;
                      }}
                      style={[
                        styles.actionButton,
                        remainingPoints <= 0 && styles.actionButtonDisabled,
                        focusedControlIndex === getPlusButtonIndex(index) && styles.focusedButton,
                      ]}
                      onPress={() => addPoint(meta.key)}
                      onFocus={() => setFocusedControlIndex(getPlusButtonIndex(index))}
                      disabled={remainingPoints <= 0}
                      focusable
                      {...tabProps}
                    >
                      <Text style={styles.actionButtonText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}

          <View style={styles.derivedPanel}>
            <Text style={styles.derivedTitle}>Derived Combat Stats</Text>
            <View style={styles.derivedRow}>
              <Text style={styles.derivedLabel}>Damage</Text>
              <Text style={styles.derivedValue}>
                {baseDerived.playerDmg} {'->'} {draftDerived.playerDmg}
                {formatDelta(draftDerived.playerDmg, baseDerived.playerDmg)}
              </Text>
            </View>
            <View style={styles.derivedRow}>
              <Text style={styles.derivedLabel}>Attack Speed</Text>
              <Text style={styles.derivedValue}>
                {baseDerived.atkSpeed.toFixed(2)} {'->'} {draftDerived.atkSpeed.toFixed(2)}
                {formatDelta(draftDerived.atkSpeed, baseDerived.atkSpeed)}
              </Text>
            </View>
            <View style={styles.derivedRow}>
              <Text style={styles.derivedLabel}>Attack Rating</Text>
              <Text style={styles.derivedValue}>
                {baseDerived.attackRating} {'->'} {draftDerived.attackRating}
                {formatDelta(draftDerived.attackRating, baseDerived.attackRating)}
              </Text>
            </View>
            <View style={styles.derivedRow}>
              <Text style={styles.derivedLabel}>Defense</Text>
              <Text style={styles.derivedValue}>
                {baseDerived.defenceRating} {'->'} {draftDerived.defenceRating}
                {formatDelta(draftDerived.defenceRating, baseDerived.defenceRating)}
              </Text>
            </View>
            <View style={styles.derivedRow}>
              <Text style={styles.derivedLabel}>Crit Chance</Text>
              <Text style={styles.derivedValue}>
                {formatPercent(baseDerived.critChance)} {'->'} {formatPercent(draftDerived.critChance)}
                {formatDelta(draftDerived.critChance, baseDerived.critChance, true)}
              </Text>
            </View>
            <View style={styles.derivedRow}>
              <Text style={styles.derivedLabel}>Dodge Chance</Text>
              <Text style={styles.derivedValue}>
                {formatPercent(baseDerived.dodgeChance)} {'->'} {formatPercent(draftDerived.dodgeChance)}
                {formatDelta(draftDerived.dodgeChance, baseDerived.dodgeChance, true)}
              </Text>
            </View>
            <View style={styles.derivedRow}>
              <Text style={styles.derivedLabel}>Max Life</Text>
              <Text style={styles.derivedValue}>
                {baseDerived.maxHealth} {'->'} {draftDerived.maxHealth}
                {formatDelta(draftDerived.maxHealth, baseDerived.maxHealth)}
              </Text>
            </View>
            <View style={styles.derivedRow}>
              <Text style={styles.derivedLabel}>Max Mana</Text>
              <Text style={styles.derivedValue}>
                {baseDerived.maxMana} {'->'} {draftDerived.maxMana}
                {formatDelta(draftDerived.maxMana, baseDerived.maxMana)}
              </Text>
            </View>
            <View style={styles.derivedRow}>
              <Text style={styles.derivedLabel}>Max Stamina</Text>
              <Text style={styles.derivedValue}>
                {baseDerived.maxStamina.toFixed(2)} {'->'} {draftDerived.maxStamina.toFixed(2)}
                {formatDelta(draftDerived.maxStamina, baseDerived.maxStamina)}
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footerRow}>
          <Pressable
            ref={(node) => {
              interactiveRefs.current[resetButtonIndex] = node;
            }}
            style={[styles.resetButton, focusedControlIndex === resetButtonIndex && styles.focusedButton]}
            onPress={() => setAllocations(EMPTY_ALLOCATIONS)}
            onFocus={() => setFocusedControlIndex(resetButtonIndex)}
            focusable
            {...tabProps}
          >
            <Text style={styles.resetButtonText}>Reset Draft</Text>
          </Pressable>
          <Pressable
            ref={(node) => {
              interactiveRefs.current[applyButtonIndex] = node;
            }}
            style={[
              styles.applyButton,
              spentPoints <= 0 && styles.applyButtonDisabled,
              focusedControlIndex === applyButtonIndex && styles.focusedButton,
            ]}
            onPress={handleApply}
            onFocus={() => setFocusedControlIndex(applyButtonIndex)}
            disabled={spentPoints <= 0}
            focusable
            {...tabProps}
          >
            <Text style={styles.applyButtonText}>Apply {spentPoints > 0 ? `(${spentPoints})` : ''}</Text>
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
    zIndex: 900,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  panel: {
    width: '100%',
    maxWidth: 760,
    maxHeight: '95%',
    borderWidth: 2,
    borderColor: '#696157',
    borderRadius: 10,
    backgroundColor: '#1b1a17',
    padding: 12,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  panelTitle: {
    color: '#f8ede0',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  closeButton: {
    backgroundColor: '#38332b',
    borderWidth: 1,
    borderColor: '#857e72',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  closeButtonText: {
    color: '#f5f5f4',
    fontWeight: '600',
    fontSize: 12,
  },
  focusedButton: {
    borderColor: '#93c5fd',
    borderWidth: 2,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#675f55',
    borderRadius: 6,
    backgroundColor: '#10100f',
    padding: 8,
  },
  profilePortrait: {
    width: 72,
    height: 72,
    borderRadius: 6,
    overflow: 'hidden',
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  profileTitle: {
    color: '#f8ede0',
    fontSize: 15,
    fontWeight: '700',
  },
  profileMeta: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  xpBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#334155',
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: '#2563eb',
  },
  xpTargetFill: {
    height: '100%',
    backgroundColor: '#0ea5e9',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#675f55',
    borderRadius: 6,
    backgroundColor: '#0f0f0e',
    paddingVertical: 8,
    alignItems: 'center',
  },
  summaryCardWide: {
    flex: 2,
    borderWidth: 1,
    borderColor: '#675f55',
    borderRadius: 6,
    backgroundColor: '#0f0f0e',
    paddingVertical: 8,
    alignItems: 'center',
  },
  summaryLabel: {
    color: '#b9a993',
    fontSize: 11,
    fontWeight: '600',
  },
  summaryValue: {
    color: '#f8ede0',
    fontSize: 22,
    fontWeight: '700',
  },
  pointsText: {
    color: '#fca5a5',
    fontSize: 16,
    fontWeight: '700',
  },
  rulesPanel: {
    borderWidth: 1,
    borderColor: '#72685a',
    borderRadius: 6,
    backgroundColor: '#0f0f0f',
    padding: 8,
    marginBottom: 2,
  },
  rulesTitle: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 4,
  },
  rulesLine: {
    color: '#d6ccc2',
    fontSize: 11,
    marginBottom: 2,
  },
  scrollRegion: {
    maxHeight: 430,
  },
  statRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#6c665d',
    borderRadius: 6,
    backgroundColor: '#121212',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  statInfoCol: {
    flex: 1,
    paddingRight: 8,
  },
  statLabel: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
  },
  statSummary: {
    color: '#d6ccc2',
    fontSize: 12,
    marginTop: 2,
  },
  statDetail: {
    color: '#a8a29e',
    fontSize: 11,
    marginTop: 2,
  },
  statControlCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 180,
  },
  statValue: {
    color: '#e2e8f0',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
  },
  pendingValue: {
    color: '#22c55e',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#a31b1b',
    borderColor: '#f87171',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  derivedPanel: {
    borderWidth: 1,
    borderColor: '#72685a',
    borderRadius: 6,
    backgroundColor: '#0f0f0f',
    padding: 8,
    marginBottom: 6,
  },
  derivedTitle: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 6,
  },
  derivedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
    gap: 8,
  },
  derivedLabel: {
    color: '#d6d3d1',
    fontSize: 12,
  },
  derivedValue: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  resetButton: {
    flex: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#6b7280',
    backgroundColor: '#374151',
    paddingVertical: 9,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#f8fafc',
    fontWeight: '600',
    fontSize: 12,
  },
  applyButton: {
    flex: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#991b1b',
    paddingVertical: 9,
    alignItems: 'center',
  },
  applyButtonDisabled: {
    opacity: 0.4,
  },
  applyButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
});
