export type PlayerStats = Record<string, any>;
export type PlayerEquipment = Record<string, any>;
export type ClassArchetype = 'warrior' | 'caster' | 'ranger';

const clamp = (value: number, min: number, max: number) => {
  return Math.max(min, Math.min(max, value));
};

const readNum = (value: unknown, fallback: number = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const roundTo = (value: number, decimals: number = 2): number => {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
};

export interface DerivedPlayerStats {
  playerDmg: number;
  attackRating: number;
  defenceRating: number;
  atkSpeed: number;
  critChance: number;
  dodgeChance: number;
  maxHealth: number;
  maxMana: number;
  maxStamina: number;
  maxEnergy: number;
}

interface ClassProgressionProfile {
  levelUpHp: number;
  levelUpMana: number;
  levelUpStamina: number;
  vitalityHp: number;
  energyMana: number;
  vitalityStamina: number;
  baseHealth: number;
  baseMana: number;
}

const CLASS_PROGRESSION: Record<ClassArchetype, ClassProgressionProfile> = {
  warrior: {
    levelUpHp: 2,
    levelUpMana: 1.5,
    levelUpStamina: 1,
    vitalityHp: 3,
    energyMana: 1.5,
    vitalityStamina: 1,
    baseHealth: 75,
    baseMana: 26,
  },
  caster: {
    levelUpHp: 1,
    levelUpMana: 2,
    levelUpStamina: 1,
    vitalityHp: 2,
    energyMana: 2,
    vitalityStamina: 1,
    baseHealth: 67,
    baseMana: 38,
  },
  ranger: {
    levelUpHp: 2,
    levelUpMana: 1.5,
    levelUpStamina: 1.25,
    vitalityHp: 3,
    energyMana: 1.75,
    vitalityStamina: 1.25,
    baseHealth: 62,
    baseMana: 27.5,
  },
};

export const getClassArchetype = (value: unknown): ClassArchetype => {
  if (value === 'mage') return 'caster';
  if (value === 'rogue') return 'ranger';
  if (value === 'caster' || value === 'ranger') return value;
  return 'warrior';
};

export const getClassProgressionProfile = (classArchetype: unknown): ClassProgressionProfile => {
  return CLASS_PROGRESSION[getClassArchetype(classArchetype)];
};

interface DerivedStatsOptions {
  classArchetype?: unknown;
  level?: number;
}

export const getWeaponStats = (equipment: PlayerEquipment): Record<string, any> => {
  if (!equipment || typeof equipment !== 'object') return {};
  const weapon = equipment.weapon;
  if (!weapon || typeof weapon !== 'object') return {};
  if (!weapon.stats || typeof weapon.stats !== 'object') return {};
  return weapon.stats as Record<string, any>;
};

export const getEquipmentDefence = (equipment: PlayerEquipment): number => {
  if (!equipment || typeof equipment !== 'object') return 0;

  const armorDef = readNum(equipment.armor?.stats?.defence);
  const ringDef = readNum(equipment.ring?.stats?.defence);
  const offhandDef = readNum(equipment.offhand?.stats?.defence);
  const bootsDef = readNum(equipment.boots?.stats?.defence);
  const helmetDef = readNum(equipment.helmet?.stats?.defence);

  return Math.max(0, armorDef + ringDef + offhandDef + bootsDef + helmetDef);
};

export const computeDerivedPlayerStats = (
  stats: PlayerStats,
  equipment: PlayerEquipment,
  options: DerivedStatsOptions = {},
): DerivedPlayerStats => {
  const safeStats = stats && typeof stats === 'object' ? stats : {};
  const classProfile = getClassProgressionProfile(options.classArchetype);
  const level = Math.max(1, Math.floor(readNum(options.level, 1)));
  const levelUpsCompleted = Math.max(0, level - 1);

  const strength = readNum(safeStats.strength);
  const dexterity = readNum(safeStats.dexterity);
  const vitality = readNum(safeStats.vitality);
  const energyPoints = readNum(safeStats.intelligence);
  const baseStamina = readNum(safeStats.stamina);

  const weaponStats = getWeaponStats(equipment);
  const weaponDamage = Math.max(1, readNum(weaponStats.damage, 1));
  const weaponAtkSpeed = Math.max(0.25, readNum(weaponStats.atkSpeed, 1));
  const weaponCritMod = readNum(weaponStats.critMod, 0);

  const playerDmg = Math.max(1, Math.floor(weaponDamage + (strength / 10) * 3));
  const atkSpeed = Math.max(0.25, roundTo(weaponAtkSpeed + dexterity * 0.01, 2));
  const attackRating = Math.max(1, Math.floor((atkSpeed + dexterity) * 2));

  const totalEquipmentDefence = getEquipmentDefence(equipment);
  const defenceRating = Math.max(1, Math.floor(totalEquipmentDefence * (1 + dexterity * 0.1)));

  const baseCrit = readNum(safeStats.crit, 0);
  const critFromDex = dexterity * 0.0015;
  const critFromInt = energyPoints * 0.0005;
  const critChance = clamp(baseCrit + weaponCritMod + critFromDex + critFromInt, 0, 0.85);

  const baseDodge = readNum(safeStats.dodge, 0);
  const dodgeFromDex = dexterity * 0.0012;
  const dodgeChance = clamp(baseDodge + dodgeFromDex, 0, 0.75);

  const maxHealth = Math.max(
    1,
    Math.floor(
      classProfile.baseHealth +
        vitality * classProfile.vitalityHp +
        levelUpsCompleted * classProfile.levelUpHp
    )
  );
  const maxMana = Math.max(
    1,
    Math.floor(
      classProfile.baseMana +
        energyPoints * classProfile.energyMana +
        levelUpsCompleted * classProfile.levelUpMana
    )
  );
  const maxStamina = Math.max(
    0,
    roundTo(
      baseStamina +
        vitality * classProfile.vitalityStamina +
        levelUpsCompleted * classProfile.levelUpStamina,
      2
    )
  );
  const maxEnergy = Math.max(60, Math.floor(60 + dexterity * 1.5));

  return {
    playerDmg,
    attackRating,
    defenceRating,
    atkSpeed,
    critChance,
    dodgeChance,
    maxHealth,
    maxMana,
    maxStamina,
    maxEnergy,
  };
};
