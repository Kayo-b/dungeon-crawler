import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SKILLS, SkillOffer, getSkillLevel, SkillLevels } from './skillCatalog';

interface LevelUpSkillModalProps {
  visible: boolean;
  offers: SkillOffer[];
  skillLevels: SkillLevels;
  onSelectSkill: (offer: SkillOffer) => void;
}

const RETRO_FONT = Platform.OS === 'web' ? '"Press Start 2P", "Courier New", monospace' : 'monospace';

export const LevelUpSkillModal: React.FC<LevelUpSkillModalProps> = ({
  visible,
  offers,
  skillLevels,
  onSelectSkill,
}) => {
  if (!visible || offers.length === 0) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.window}>
        <Text style={styles.title}>LEVEL UP!</Text>
        <Text style={styles.subtitle}>Choose a skill scroll to learn</Text>

        <View style={styles.offerRow}>
          {offers.map((offer) => {
            const skill = SKILLS[offer.skillId];
            const isNew = offer.currentLevel === 0;
            const currentLevel = getSkillLevel(skillLevels, offer.skillId);

            return (
              <Pressable
                key={offer.skillId}
                style={({ pressed }) => [styles.offerCard, pressed && styles.offerCardPressed]}
                onPress={() => onSelectSkill(offer)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.skillName}>{skill.name}</Text>
                  <Text style={[styles.skillBadge, isNew ? styles.badgeNew : styles.badgeUpgrade]}>
                    {isNew ? 'NEW' : `Lv.${currentLevel}→${offer.newLevel}`}
                  </Text>
                </View>
                <Text style={styles.skillDesc}>{skill.description}</Text>
                <Text style={styles.skillMana}>Mana: {skill.manaCost}</Text>
                {skill.isBuff && <Text style={styles.skillTag}>BUFF</Text>}
                {skill.requiresCombo && <Text style={styles.skillTag}>COMBO</Text>}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
  },
  window: {
    width: 820,
    maxWidth: '96%',
    borderWidth: 3,
    borderColor: '#d4aa40',
    backgroundColor: '#0a0a0a',
    padding: 14,
    gap: 12,
    alignItems: 'center',
  },
  title: {
    color: '#d4aa40',
    fontFamily: RETRO_FONT,
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  subtitle: {
    color: '#aaaaaa',
    fontFamily: RETRO_FONT,
    fontSize: 8,
    textTransform: 'uppercase',
  },
  offerRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  offerCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#444444',
    backgroundColor: '#141414',
    padding: 10,
    gap: 6,
    cursor: 'pointer',
  } as any,
  offerCardPressed: {
    borderColor: '#d4aa40',
    backgroundColor: '#1e1a08',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
  },
  skillName: {
    color: '#f8f8f8',
    fontFamily: RETRO_FONT,
    fontSize: 8,
    textTransform: 'uppercase',
    flex: 1,
  },
  skillBadge: {
    fontFamily: RETRO_FONT,
    fontSize: 7,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  badgeNew: {
    color: '#5eff8a',
    borderWidth: 1,
    borderColor: '#5eff8a',
  },
  badgeUpgrade: {
    color: '#60a5fa',
    borderWidth: 1,
    borderColor: '#60a5fa',
  },
  skillDesc: {
    color: '#b0b0b0',
    fontFamily: RETRO_FONT,
    fontSize: 7,
    lineHeight: 12,
  },
  skillMana: {
    color: '#7ab8f5',
    fontFamily: RETRO_FONT,
    fontSize: 7,
  },
  skillTag: {
    color: '#ffb288',
    fontFamily: RETRO_FONT,
    fontSize: 7,
    borderWidth: 1,
    borderColor: '#ffb288',
    paddingHorizontal: 3,
    alignSelf: 'flex-start',
  },
});
