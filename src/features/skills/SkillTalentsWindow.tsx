import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  doesMeetSkillRequirements,
  getActiveSkillLoadout,
  getSkillLevel,
  getSkillRequirementSummary,
  SKILL_IDS,
  SKILLS,
  SkillDefinition,
  SkillLevels,
} from './skillCatalog';

interface SkillTalentsWindowProps {
  visible: boolean;
  skillLevels: SkillLevels;
  classArchetype: string;
  playerStats: Record<string, any>;
  onClose: () => void;
}

const RETRO_FONT = Platform.OS === 'web' ? '"Press Start 2P", "Courier New", monospace' : 'monospace';

const sortBySlot = (slot: 'primary' | 'secondary') => {
  return SKILL_IDS.map((skillId) => SKILLS[skillId]).filter((skill) => skill.slot === slot);
};

const renderSkillLine = (skill: SkillDefinition, skillLevels: SkillLevels, playerStats: Record<string, any>) => {
  const level = getSkillLevel(skillLevels, skill.id);
  const trained = level > 0;
  const meetsStats = doesMeetSkillRequirements(skill, playerStats);
  const req = getSkillRequirementSummary(skill);

  return (
    <View key={skill.id} style={styles.skillRow}>
      <View style={styles.skillRowHead}>
        <Text style={styles.skillName}>{skill.name}</Text>
        <Text style={trained ? styles.skillLevel : styles.skillLevelLocked}>{trained ? `Lv.${level}` : 'Untrained'}</Text>
      </View>
      <Text style={styles.skillMeta}>Mana {skill.manaCost}</Text>
      <Text style={styles.skillMeta}>{req ? `Req: ${req}` : 'Req: None'}</Text>
      {!meetsStats ? <Text style={styles.skillWarn}>Stats too low</Text> : null}
      <Text style={styles.skillMeta}>
        Next upgrade: use a tome with level {Math.max(1, level + 1)}+
      </Text>
    </View>
  );
};

export const SkillTalentsWindow: React.FC<SkillTalentsWindowProps> = ({
  visible,
  skillLevels,
  classArchetype,
  playerStats,
  onClose,
}) => {
  if (!visible) return null;

  const active = getActiveSkillLoadout(skillLevels, classArchetype);
  const primarySkills = sortBySlot('primary');
  const secondarySkills = sortBySlot('secondary');

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.window}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Talent Tree</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>

        <Text style={styles.subTitle}>
          Active: {active.primary ? SKILLS[active.primary].name : 'None'} /{' '}
          {active.secondary ? SKILLS[active.secondary].name : 'None'}
        </Text>

        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={styles.columnTitle}>Primary Skills</Text>
            {primarySkills.map((skill) => renderSkillLine(skill, skillLevels, playerStats))}
          </View>
          <View style={styles.column}>
            <Text style={styles.columnTitle}>Secondary Skills</Text>
            {secondarySkills.map((skill) => renderSkillLine(skill, skillLevels, playerStats))}
          </View>
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
    zIndex: 998,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  window: {
    width: 760,
    maxWidth: '96%',
    borderWidth: 3,
    borderColor: '#d7d7d7',
    backgroundColor: '#090909',
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
    fontFamily: RETRO_FONT,
    fontSize: 14,
    textTransform: 'uppercase',
  },
  closeButton: {
    borderWidth: 1,
    borderColor: '#d7d7d7',
    backgroundColor: '#242424',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  closeButtonText: {
    color: '#ffffff',
    fontFamily: RETRO_FONT,
    fontSize: 9,
    textTransform: 'uppercase',
  },
  subTitle: {
    color: '#d8d8d8',
    fontFamily: RETRO_FONT,
    fontSize: 8,
  },
  columns: {
    flexDirection: 'row',
    gap: 8,
  },
  column: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#4d4d4d',
    backgroundColor: '#121212',
    padding: 6,
    gap: 4,
  },
  columnTitle: {
    color: '#ffffff',
    fontFamily: RETRO_FONT,
    fontSize: 9,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  skillRow: {
    borderWidth: 1,
    borderColor: '#5f5f5f',
    backgroundColor: '#1a1a1a',
    padding: 5,
    gap: 1,
  },
  skillRowHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skillName: {
    color: '#f8f8f8',
    fontFamily: RETRO_FONT,
    fontSize: 8,
    textTransform: 'uppercase',
  },
  skillLevel: {
    color: '#9be28f',
    fontFamily: RETRO_FONT,
    fontSize: 8,
  },
  skillLevelLocked: {
    color: '#b4b4b4',
    fontFamily: RETRO_FONT,
    fontSize: 8,
  },
  skillMeta: {
    color: '#d2d2d2',
    fontFamily: RETRO_FONT,
    fontSize: 7,
  },
  skillWarn: {
    color: '#ffb288',
    fontFamily: RETRO_FONT,
    fontSize: 7,
  },
});
