export type SkillId =
  | 'crushing-blow'
  | 'whirlwind'
  | 'arcane-bolt'
  | 'fire-blast'
  | 'quick-stab'
  | 'eviscerate';

export type SkillSlot = 'primary' | 'secondary';
export type SkillStatKey = 'strength' | 'dexterity' | 'vitality' | 'intelligence';
export type SkillLevels = Partial<Record<SkillId, number>>;

export interface SkillDefinition {
  id: SkillId;
  name: string;
  slot: SkillSlot;
  manaCost: number;
  requiredStats: Partial<Record<SkillStatKey, number>>;
  requiresCombo?: boolean;
}

interface SkillTrainingFromItem {
  skillId: SkillId;
  tomeLevel: number;
}

const SKILL_STAT_LABELS: Record<SkillStatKey, string> = {
  strength: 'STR',
  dexterity: 'DEX',
  vitality: 'VIT',
  intelligence: 'INT',
};

const SKILL_STAT_ORDER: SkillStatKey[] = ['strength', 'dexterity', 'vitality', 'intelligence'];

export const SKILLS: Record<SkillId, SkillDefinition> = {
  'crushing-blow': {
    id: 'crushing-blow',
    name: 'Crushing Blow',
    slot: 'primary',
    manaCost: 20,
    requiredStats: { strength: 12 },
  },
  whirlwind: {
    id: 'whirlwind',
    name: 'Whirlwind',
    slot: 'secondary',
    manaCost: 35,
    requiredStats: { strength: 16, vitality: 10 },
  },
  'arcane-bolt': {
    id: 'arcane-bolt',
    name: 'Arcane Bolt',
    slot: 'primary',
    manaCost: 18,
    requiredStats: { intelligence: 12 },
  },
  'fire-blast': {
    id: 'fire-blast',
    name: 'Fire Blast',
    slot: 'secondary',
    manaCost: 32,
    requiredStats: { intelligence: 16 },
  },
  'quick-stab': {
    id: 'quick-stab',
    name: 'Quick Stab',
    slot: 'primary',
    manaCost: 16,
    requiredStats: { dexterity: 12 },
  },
  eviscerate: {
    id: 'eviscerate',
    name: 'Eviscerate',
    slot: 'secondary',
    manaCost: 24,
    requiredStats: { dexterity: 16 },
    requiresCombo: true,
  },
};

export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];

const SKILL_PRIORITY_BY_CLASS: Record<string, { primary: SkillId[]; secondary: SkillId[] }> = {
  warrior: {
    primary: ['crushing-blow', 'quick-stab', 'arcane-bolt'],
    secondary: ['whirlwind', 'eviscerate', 'fire-blast'],
  },
  caster: {
    primary: ['arcane-bolt', 'quick-stab', 'crushing-blow'],
    secondary: ['fire-blast', 'eviscerate', 'whirlwind'],
  },
  mage: {
    primary: ['arcane-bolt', 'quick-stab', 'crushing-blow'],
    secondary: ['fire-blast', 'eviscerate', 'whirlwind'],
  },
  ranger: {
    primary: ['quick-stab', 'crushing-blow', 'arcane-bolt'],
    secondary: ['eviscerate', 'whirlwind', 'fire-blast'],
  },
  rogue: {
    primary: ['quick-stab', 'crushing-blow', 'arcane-bolt'],
    secondary: ['eviscerate', 'whirlwind', 'fire-blast'],
  },
};

const normalizeSkillId = (value: unknown): SkillId | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase() as SkillId;
  return SKILLS[normalized] ? normalized : null;
};

const normalizeSkillLevel = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
};

export const getSkillRequirementSummary = (skill: SkillDefinition): string => {
  return SKILL_STAT_ORDER
    .map((key) => {
      const needed = Number(skill.requiredStats?.[key] || 0);
      if (!Number.isFinite(needed) || needed <= 0) return null;
      return `${SKILL_STAT_LABELS[key]} ${Math.floor(needed)}`;
    })
    .filter((entry): entry is string => !!entry)
    .join(', ');
};

export const doesMeetSkillRequirements = (
  skill: SkillDefinition,
  stats: Record<string, any> | null | undefined
): boolean => {
  return SKILL_STAT_ORDER.every((key) => {
    const needed = Number(skill.requiredStats?.[key] || 0);
    if (!Number.isFinite(needed) || needed <= 0) return true;
    const current = Number(stats?.[key] || 0);
    return current >= needed;
  });
};

export const readSkillLevelsFromCharacter = (value: unknown): SkillLevels => {
  if (!value || typeof value !== 'object') return {};
  const raw = value as Record<string, unknown>;
  const levels: SkillLevels = {};
  SKILL_IDS.forEach((skillId) => {
    const level = normalizeSkillLevel(raw[skillId]);
    if (level > 0) {
      levels[skillId] = level;
    }
  });
  return levels;
};

export const getSkillLevel = (levels: SkillLevels | null | undefined, skillId: SkillId): number => {
  return normalizeSkillLevel(levels?.[skillId]);
};

export const readSkillTrainingFromItem = (item: any): SkillTrainingFromItem | null => {
  if (!item || typeof item !== 'object') return null;
  const skillId = normalizeSkillId(item.teachesSkill);
  if (!skillId) return null;
  const tomeLevel = Math.max(
    1,
    normalizeSkillLevel(item.tomeLevel || item.level || item.levelRequirement || item['Level Requirement'] || 1)
  );
  return { skillId, tomeLevel };
};

const pickSkillForSlot = (
  skillLevels: SkillLevels,
  classArchetype: unknown,
  slot: SkillSlot
): SkillId | null => {
  const normalizedClass = String(classArchetype || 'warrior').toLowerCase();
  const priority = SKILL_PRIORITY_BY_CLASS[normalizedClass] || SKILL_PRIORITY_BY_CLASS.warrior;
  const ordered = priority[slot];
  let bestSkill: SkillId | null = null;
  let bestLevel = 0;

  ordered.forEach((skillId) => {
    const level = getSkillLevel(skillLevels, skillId);
    if (level <= 0) return;
    if (level > bestLevel) {
      bestSkill = skillId;
      bestLevel = level;
    }
  });

  return bestSkill;
};

export const getActiveSkillLoadout = (
  skillLevels: SkillLevels,
  classArchetype: unknown
): { primary: SkillId | null; secondary: SkillId | null } => {
  return {
    primary: pickSkillForSlot(skillLevels, classArchetype, 'primary'),
    secondary: pickSkillForSlot(skillLevels, classArchetype, 'secondary'),
  };
};
