import baseData from './characters.json';

export type ArchetypeId = 'warrior' | 'caster' | 'ranger';

export interface ArchetypeDefinition {
  id: ArchetypeId;
  name: string;
  description: string;
  classLabel: string;
  specialName: string;
  preferredRange: number;
  stats: {
    health: number;
    strength: number;
    dexterity: number;
    stamina: number;
    vitality: number;
    intelligence: number;
    defense: number;
    crit: number;
    dodge: number;
  };
  weapon: {
    name: string;
    type: string;
    affixes?: string[];
    stats: {
      damage: number;
      atkSpeed: number;
      critMod: number;
    };
  };
  offhand: {
    name: string;
    type: string;
    stats: Record<string, number>;
  };
  armor: {
    name: string;
    type: string;
    stats: {
      defence: number;
    };
  };
}

export const ARCHETYPES: ArchetypeDefinition[] = [
  {
    id: 'warrior',
    name: 'Melee Warrior',
    description: 'Frontline bruiser with cleaving physical attacks.',
    classLabel: 'Warrior',
    specialName: 'Crushing Blow',
    preferredRange: 1,
    stats: {
      health: 120,
      strength: 16,
      dexterity: 9,
      stamina: 14,
      vitality: 15,
      intelligence: 4,
      defense: 4,
      crit: 0.07,
      dodge: 0.03,
    },
    weapon: {
      name: 'Iron Longsword',
      type: 'weapon',
      affixes: ['great'],
      stats: { damage: 5, atkSpeed: 0.95, critMod: 0.02 },
    },
    offhand: {
      name: 'Wooden Shield',
      type: 'offhand',
      stats: { defence: 2 },
    },
    armor: {
      name: 'Scale Chestplate',
      type: 'armor',
      stats: { defence: 4 },
    },
  },
  {
    id: 'caster',
    name: 'Magic Caster',
    description: 'Ranged spell damage with strong AoE bursts.',
    classLabel: 'Caster',
    specialName: 'Fire Blast',
    preferredRange: 3,
    stats: {
      health: 85,
      strength: 4,
      dexterity: 10,
      stamina: 9,
      vitality: 9,
      intelligence: 18,
      defense: 1,
      crit: 0.1,
      dodge: 0.04,
    },
    weapon: {
      name: 'Ashwood Staff',
      type: 'weapon',
      stats: { damage: 4, atkSpeed: 1.0, critMod: 0.05 },
    },
    offhand: {
      name: 'Focus Orb',
      type: 'offhand',
      stats: { intelligence: 2, manaRegenPerTile: 1 },
    },
    armor: {
      name: 'Mystic Robe',
      type: 'armor',
      stats: { defence: 1 },
    },
  },
  {
    id: 'ranger',
    name: 'Rogue / Dagger',
    description: 'Fast precision strikes that build and spend combo points.',
    classLabel: 'Rogue',
    specialName: 'Mutilate',
    preferredRange: 2,
    stats: {
      health: 95,
      strength: 9,
      dexterity: 17,
      stamina: 10,
      vitality: 11,
      intelligence: 6,
      defense: 2,
      crit: 0.14,
      dodge: 0.08,
    },
    weapon: {
      name: 'Twin Daggers',
      type: 'weapon',
      stats: { damage: 4, atkSpeed: 1.35, critMod: 0.06 },
    },
    offhand: {
      name: 'Throwing Knife Set',
      type: 'offhand',
      stats: { crit: 0.03 },
    },
    armor: {
      name: 'Hardened Leather',
      type: 'armor',
      stats: { defence: 2 },
    },
  },
];

export const buildCharacterFromArchetype = (archetypeId: ArchetypeId, characterName: string) => {
  const archetype = ARCHETYPES.find((entry) => entry.id === archetypeId) || ARCHETYPES[0];
  const cloned = JSON.parse(JSON.stringify(baseData));

  cloned.character.name = characterName || archetype.name;
  cloned.character.classArchetype = archetype.id;
  cloned.character.classLabel = archetype.classLabel;
  cloned.character.specialName = archetype.specialName;
  cloned.character.preferredRange = archetype.preferredRange;
  cloned.character.level = 1;
  cloned.character.experience = 0;
  cloned.character.xptolvlup = 16;
  cloned.character.unspentStatPoints = 0;
  cloned.character.stats = { ...archetype.stats };
  const startingInventory: Array<{
    ID: number;
    name: string;
    type: string;
    stats: Record<string, number>;
  }> = [
    { ID: 1, name: 'Scout Sash', type: 'belt', stats: { defence: 2, consumableSlotsBonus: 1 } },
  ];
  const startingConsumableStash: Array<{
    ID: number;
    name: string;
    type: string;
    stats: Record<string, number>;
  }> = [
    { ID: 1, name: 'Minor Healing Potion', type: 'consumable', stats: { amount: 8 } },
    { ID: 2, name: 'Minor Mana Flask', type: 'consumable', stats: { mana: 14 } },
  ];
  cloned.character.inventory = startingInventory;
  cloned.character.consumableStash = startingConsumableStash;

  cloned.character.equipment.weapon = archetype.weapon;
  cloned.character.equipment.offhand = archetype.offhand;
  cloned.character.equipment.armor = archetype.armor;

  if (!cloned.character.equipment.helmet) {
    cloned.character.equipment.helmet = { name: '', type: 'helmet', stats: {} };
  }
  if (!cloned.character.equipment.belt) {
    cloned.character.equipment.belt = { name: '', type: 'belt', stats: {} };
  }
  if (!cloned.character.equipment.boots) {
    cloned.character.equipment.boots = { name: '', type: 'boots', stats: {} };
  }
  if (!cloned.character.equipment.gloves) {
    cloned.character.equipment.gloves = { name: '', type: 'gloves', stats: {} };
  }

  return cloned;
};
