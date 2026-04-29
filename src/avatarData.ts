// Avatar system — pixel art data, types, and catalog

export type SkinTone = 'skin1' | 'skin2' | 'skin3' | 'skin4' | 'skin5';
export type AvatarItemType = 'hair' | 'top' | 'bottom' | 'shoes' | 'accessory';
export type AvatarItemRarity = 'starter' | 'common' | 'rare' | 'epic';

export interface AvatarItemDef {
  id: string;
  type: AvatarItemType;
  name: string;
  rarity: AvatarItemRarity;
  color: string;
  color2?: string; // secondary (stripes, accents)
}

export interface UserAvatar {
  skinTone: SkinTone;
  hairStyle: string;
  hairColor: string;
  facialHair: string | null;
  top: string;
  bottom: string;
  shoes: string;
  accessory: string | null;
  mood: number; // 0-100; stamps increase this, decays -5/day without stamps
  inventory: string[]; // owned item ids
  lastWheelSpin?: string;   // ISO date string YYYY-MM-DD
  lastFoodStampDate?: string; // ISO date string YYYY-MM-DD
}

export const FACIAL_HAIR_STYLES: { id: string | null; name: string; emoji: string }[] = [
  { id: null,             name: 'Clean',      emoji: '😊' },
  { id: 'fh_stubble',    name: 'Stubble',    emoji: '🧔' },
  { id: 'fh_moustache',  name: 'Moustache',  emoji: '🥸' },
  { id: 'fh_goatee',     name: 'Goatee',     emoji: '🧔' },
  { id: 'fh_beard',      name: 'Beard',      emoji: '🧔' },
];

// ─── Skin & hair colour palettes ──────────────────────────────────────────────

export const SKIN_TONES: Record<SkinTone, string> = {
  skin1: '#FDDCB5',
  skin2: '#EAB887',
  skin3: '#C8855B',
  skin4: '#8B5E3C',
  skin5: '#4A2511',
};

export const HAIR_COLORS: Record<string, string> = {
  black:  '#1A1010',
  brown:  '#6B3A2A',
  blonde: '#D4A843',
  auburn: '#9B3A1A',
  silver: '#9CA3AF',
  blue:   '#3B82F6',
  pink:   '#EC4899',
  purple: '#8B5CF6',
};

// ─── Item catalog ─────────────────────────────────────────────────────────────

export const AVATAR_ITEMS: AvatarItemDef[] = [
  // Hair (starter)
  { id: 'hair_short',    type: 'hair', name: 'Short Cut',   rarity: 'starter', color: '' },
  { id: 'hair_long',     type: 'hair', name: 'Long Hair',   rarity: 'starter', color: '' },
  { id: 'hair_bald',     type: 'hair', name: 'Bald',        rarity: 'starter', color: '' },
  // Hair (common / rare)
  { id: 'hair_spiky',    type: 'hair', name: 'Spiky',       rarity: 'common',  color: '' },
  { id: 'hair_afro',     type: 'hair', name: 'Afro',        rarity: 'common',  color: '' },
  { id: 'hair_bun',      type: 'hair', name: 'Top Bun',     rarity: 'common',  color: '' },
  { id: 'hair_ponytail', type: 'hair', name: 'Ponytail',    rarity: 'common',  color: '' },
  { id: 'hair_curly',    type: 'hair', name: 'Curly',       rarity: 'rare',    color: '' },

  // Tops (starter)
  { id: 'top_plain',     type: 'top',  name: 'Plain Tee',   rarity: 'starter', color: '#4B8DC8' },
  // Tops (common)
  { id: 'top_hoodie',    type: 'top',  name: 'Hoodie',      rarity: 'common',  color: '#6B7280' },
  { id: 'top_stripes',   type: 'top',  name: 'Striped Tee', rarity: 'common',  color: '#DC2626', color2: '#FFFFFF' },
  { id: 'top_green',     type: 'top',  name: 'Green Tee',   rarity: 'common',  color: '#16A34A' },
  // Tops (rare)
  { id: 'top_jacket',    type: 'top',  name: 'Jacket',      rarity: 'rare',    color: '#1B4332' },
  { id: 'top_dress',     type: 'top',  name: 'Dress',       rarity: 'rare',    color: '#7C3AED' },
  { id: 'top_pink_dress',type: 'top',  name: 'Party Dress', rarity: 'rare',    color: '#EC4899' },
  // Tops (epic)
  { id: 'top_tuxedo',    type: 'top',  name: 'Tuxedo',      rarity: 'epic',    color: '#1E293B', color2: '#FFFFFF' },
  { id: 'top_spacesuit', type: 'top',  name: 'Space Suit',  rarity: 'epic',    color: '#374151' },

  // Bottoms (starter)
  { id: 'bottom_jeans',    type: 'bottom', name: 'Blue Jeans',   rarity: 'starter', color: '#2B4C7E' },
  // Bottoms (common / rare)
  { id: 'bottom_shorts',   type: 'bottom', name: 'Shorts',       rarity: 'common',  color: '#92400E' },
  { id: 'bottom_skirt',    type: 'bottom', name: 'Skirt',        rarity: 'common',  color: '#BE185D' },
  { id: 'bottom_leggings', type: 'bottom', name: 'Leggings',     rarity: 'common',  color: '#1C1917' },
  { id: 'bottom_cargo',    type: 'bottom', name: 'Cargo Pants',  rarity: 'rare',    color: '#4D7C0F' },

  // Shoes (starter)
  { id: 'shoes_sneakers', type: 'shoes', name: 'Sneakers',    rarity: 'starter', color: '#F9FAFB', color2: '#9CA3AF' },
  // Shoes (common / rare)
  { id: 'shoes_boots',    type: 'shoes', name: 'Boots',       rarity: 'common',  color: '#6B3A1F' },
  { id: 'shoes_slides',   type: 'shoes', name: 'Slides',      rarity: 'common',  color: '#FCD34D' },
  { id: 'shoes_heels',    type: 'shoes', name: 'Heels',       rarity: 'rare',    color: '#DB2777' },
  { id: 'shoes_hightops', type: 'shoes', name: 'High-Tops',   rarity: 'rare',    color: '#DC2626' },

  // Accessories (no starter — all earned)
  { id: 'acc_cap',        type: 'accessory', name: 'Cap',         rarity: 'common', color: '#DC2626' },
  { id: 'acc_headband',   type: 'accessory', name: 'Headband',    rarity: 'common', color: '#F472B6' },
  { id: 'acc_glasses',    type: 'accessory', name: 'Glasses',     rarity: 'rare',   color: '#1F2937' },
  { id: 'acc_sunglasses', type: 'accessory', name: 'Sunglasses',  rarity: 'rare',   color: '#000000' },
  { id: 'acc_crown',      type: 'accessory', name: 'Crown',       rarity: 'epic',   color: '#F59E0B' },
  { id: 'acc_halo',       type: 'accessory', name: 'Halo',        rarity: 'epic',   color: '#FCD34D' },
];

export const STARTER_ITEMS = AVATAR_ITEMS.filter(i => i.rarity === 'starter').map(i => i.id);

// Items awarded at total-stamp milestones (stamps earned across all stores)
export const STAMP_MILESTONE_REWARDS: [number, string][] = [
  [10,  'hair_spiky'],
  [25,  'top_hoodie'],
  [50,  'acc_cap'],
  [75,  'bottom_cargo'],
  [100, 'acc_glasses'],
  [150, 'top_jacket'],
  [200, 'acc_crown'],
];

// Daily wheel segments (8 × 45°)
export interface WheelSegment {
  label: string;
  emoji: string;
  bg: string;
  prizeType: AvatarItemType | null;
  prizeRarity: AvatarItemRarity | null;
}

export const WHEEL_SEGMENTS: WheelSegment[] = [
  { label: 'Nothing',   emoji: '😔', bg: '#E5E7EB', prizeType: null,        prizeRarity: null     },
  { label: 'Top',       emoji: '👕', bg: '#BFDBFE', prizeType: 'top',       prizeRarity: 'common' },
  { label: 'Hair',      emoji: '💇', bg: '#BBF7D0', prizeType: 'hair',      prizeRarity: 'common' },
  { label: 'Nothing',   emoji: '😔', bg: '#FEF3C7', prizeType: null,        prizeRarity: null     },
  { label: 'Shoes',     emoji: '👟', bg: '#FDE8D8', prizeType: 'shoes',     prizeRarity: 'common' },
  { label: 'Rare!',     emoji: '✨', bg: '#DDD6FE', prizeType: 'accessory', prizeRarity: 'rare'   },
  { label: 'Bottoms',   emoji: '👖', bg: '#FBCFE8', prizeType: 'bottom',    prizeRarity: 'common' },
  { label: 'Accessory', emoji: '🎩', bg: '#D1FAE5', prizeType: 'accessory', prizeRarity: 'common' },
];

// ─── Deterministic avatar from uid (fallback for users without saved avatar) ──

function hashStr(s: string): number {
  let h = 0;
  for (const c of s) { h = Math.imul(31, h) + c.charCodeAt(0) | 0; }
  return Math.abs(h);
}

function seededRng(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0x100000000; };
}

export function deriveAvatarFromUid(uid: string): UserAvatar {
  const rng = seededRng(hashStr(uid));
  const skins = Object.keys(SKIN_TONES) as SkinTone[];
  const hairCols = Object.keys(HAIR_COLORS);
  const starterHairs = AVATAR_ITEMS.filter(i => i.type === 'hair' && i.rarity === 'starter').map(i => i.id);
  return {
    skinTone:  skins[Math.floor(rng() * skins.length)],
    hairStyle: starterHairs[Math.floor(rng() * starterHairs.length)],
    hairColor: hairCols[Math.floor(rng() * hairCols.length)],
    facialHair: null,
    top: 'top_plain', bottom: 'bottom_jeans', shoes: 'shoes_sneakers',
    accessory: null, mood: 50, inventory: [...STARTER_ITEMS],
  };
}

export function randomStarterAvatar(): UserAvatar {
  const skins = Object.keys(SKIN_TONES) as SkinTone[];
  const hairCols = Object.keys(HAIR_COLORS);
  const starterHairs = AVATAR_ITEMS.filter(i => i.type === 'hair' && i.rarity === 'starter').map(i => i.id);
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  return {
    skinTone:  pick(skins),
    hairStyle: pick(starterHairs),
    hairColor: pick(hairCols),
    facialHair: null,
    top: 'top_plain', bottom: 'bottom_jeans', shoes: 'shoes_sneakers',
    accessory: null, mood: 50, inventory: [...STARTER_ITEMS],
  };
}

export const RARITY_LABEL: Record<AvatarItemRarity, string> = {
  starter: 'Starter', common: 'Common', rare: 'Rare', epic: 'Epic',
};

export const RARITY_COLOR: Record<AvatarItemRarity, string> = {
  starter: 'text-gray-400',
  common:  'text-emerald-600',
  rare:    'text-blue-600',
  epic:    'text-purple-600',
};
