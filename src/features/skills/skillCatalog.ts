export type SkillId =
  | 'crushing-blow'
  | 'whirlwind'
  | 'arcane-bolt'
  | 'fire-blast'
  | 'quick-stab'
  | 'eviscerate'
  | 'enforce-armor'
  | 'shadow-step'
  | 'power-strike'
  | 'war-shout';

export type SkillLevels = Partial<Record<SkillId, number>>;

export interface SkillDefinition {
  id: SkillId;
  name: string;
  manaCost: number;
  description: string;
  requiresCombo?: boolean;
  /** True for utility/buff skills that don't target enemies */
  isBuff?: boolean;
  /** If true, surviving targets are knocked from the front layer to the mid layer */
  hasKnockback?: boolean;
  /** If true, this skill is always available regardless of learned skill levels (e.g. test/tutorial skills) */
  alwaysAvailable?: boolean;
}

/** An offer presented to the player on level up */
export interface SkillOffer {
  skillId: SkillId;
  currentLevel: number;
  newLevel: number;
}

interface SkillTrainingFromItem {
  skillId: SkillId;
  tomeLevel: number;
}

export const SKILLS: Record<SkillId, SkillDefinition> = {
  'crushing-blow': {
    id: 'crushing-blow',
    name: 'Crushing Blow',
    manaCost: 1,
    description: 'A devastating overhead strike dealing heavy physical damage. Knocks the target to the back of the enemy formation.',
    hasKnockback: true,
  },
  whirlwind: {
    id: 'whirlwind',
    name: 'Whirlwind',
    manaCost: 1,
    description: 'Spin in a lethal arc, striking all enemies in the front. Knocks back all surviving enemies.',
    hasKnockback: true,
  },
  'arcane-bolt': {
    id: 'arcane-bolt',
    name: 'Arcane Bolt',
    manaCost: 1,
    description: 'Launch a bolt of raw arcane energy at a single target.',
  },
  'fire-blast': {
    id: 'fire-blast',
    name: 'Fire Blast',
    manaCost: 0,
    description: 'Unleash a wave of fire that scorches all enemies in the front row.',
  },
  'quick-stab': {
    id: 'quick-stab',
    name: 'Quick Stab',
    manaCost: 0,
    description: 'A swift precise strike that builds combo points for a follow-up Eviscerate.',
  },
  eviscerate: {
    id: 'eviscerate',
    name: 'Eviscerate',
    manaCost: 2,
    description: 'Spend all combo points to deal massive burst damage. Requires at least 1 combo point.',
    requiresCombo: true,
  },
  'enforce-armor': {
    id: 'enforce-armor',
    name: 'Enforce Armor',
    manaCost: 1,
    description: 'Reinforce your armor with arcane energy, creating a damage-absorbing buffer before your health.',
    isBuff: true,
  },
  'shadow-step': {
    id: 'shadow-step',
    name: 'Shadow Step',
    manaCost: 0,
    description: '[Placeholder] Dart toward the target with blinding speed, landing a swift slashing blow.',
  },
  'power-strike': {
    id: 'power-strike',
    name: 'Power Strike',
    manaCost: 2,
    description: '[Placeholder] Channel raw physical force into a single devastating strike.',
  },
  'war-shout': {
    id: 'war-shout',
    name: 'War Shout',
    manaCost: 0,
    description: 'Unleash a thunderous battle cry that sends all front-row enemies reeling back into the mid lane. No damage — pure positioning.',
    hasKnockback: true,
    alwaysAvailable: true,
  },
};

export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];

/** Starting skill for each class archetype */
export const STARTING_SKILL_BY_CLASS: Record<string, SkillId> = {
  warrior: 'crushing-blow',
  caster: 'arcane-bolt',
  ranger: 'quick-stab',
  rogue: 'quick-stab',
  mage: 'arcane-bolt',
};

const MAX_SKILL_LEVEL = 5;

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

/** Stat requirements no longer exist — always returns true */
export const doesMeetSkillRequirements = (
  _skill: SkillDefinition,
  _stats: Record<string, any> | null | undefined
): boolean => true;

/** Stat requirements no longer exist — always returns empty string */
export const getSkillRequirementSummary = (_skill: SkillDefinition): string => '';

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

/** Returns all skills the character has trained (level > 0), in catalog order.
 *  Skills flagged as `alwaysAvailable` are always included regardless of level. */
export const getAllLearnedSkills = (skillLevels: SkillLevels | null | undefined): SkillDefinition[] => {
  return SKILL_IDS
    .filter((skillId) => getSkillLevel(skillLevels, skillId) > 0 || SKILLS[skillId].alwaysAvailable)
    .map((skillId) => SKILLS[skillId]);
};

/**
 * Generates up to `count` random skill upgrade options for a level-up event.
 * Excludes skills that are already at max level.
 */
export const getLevelUpSkillOptions = (
  skillLevels: SkillLevels | null | undefined,
  count: number = 3
): SkillOffer[] => {
  const eligible: SkillOffer[] = SKILL_IDS
    .filter((skillId) => !SKILLS[skillId].alwaysAvailable)
    .map((skillId) => {
      const currentLevel = getSkillLevel(skillLevels, skillId);
      return { skillId, currentLevel, newLevel: currentLevel + 1 };
    })
    .filter((offer) => offer.newLevel <= MAX_SKILL_LEVEL);

  // Fisher-Yates shuffle then slice
  const arr = [...eligible];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
};

/** Legacy: returns the two "best" learned skills for Q/E default slots */
export const getActiveSkillLoadout = (
  skillLevels: SkillLevels,
  _classArchetype: unknown
): { primary: SkillId | null; secondary: SkillId | null } => {
  const learned = getAllLearnedSkills(skillLevels);
  return {
    primary: learned[0]?.id ?? null,
    secondary: learned[1]?.id ?? null,
  };
};
