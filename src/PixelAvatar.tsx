import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, ChevronRight, Dices } from 'lucide-react';
import {
  SKIN_TONES, HAIR_COLORS, AVATAR_ITEMS, WHEEL_SEGMENTS, FACIAL_HAIR_STYLES,
  STARTER_ITEMS, RARITY_LABEL, RARITY_COLOR,
  deriveAvatarFromUid,
  type UserAvatar, type SkinTone, type AvatarItemType, type AvatarItemDef,
} from './avatarData';
import { cn } from './lib/utils';

// ─── Pixel renderer helpers ───────────────────────────────────────────────────

type CR = { x: number; y: number; w: number; h: number; c: string };
const px = (x: number, y: number, w: number, h: number, c: string): CR => ({ x, y, w, h, c });

// Grid: 16 × 22  (viewBox "0 0 16 22")
// y=0-1  → hair overflow area
// y=2-9  → head
// y=10   → neck
// y=11-15→ torso / arms
// y=16   → hands
// y=17-19→ legs
// y=20-21→ shoes

function hairPixels(style: string, color: string): CR[] {
  const p = (x: number, y: number, w: number, h: number) => px(x, y, w, h, color);
  switch (style) {
    case 'hair_long':
      return [p(3, 0, 10, 3), p(2, 2, 2, 9), p(12, 2, 2, 9)];
    case 'hair_spiky':
      return [
        p(3, 1, 10, 2),
        p(3, 0, 1, 2), p(5, 0, 1, 3), p(7, 0, 1, 2),
        p(9, 0, 1, 2), p(11, 0, 1, 3), p(12, 0, 1, 2),
        p(2, 2, 2, 2), p(12, 2, 2, 2),
      ];
    case 'hair_afro':
      return [p(0, 0, 16, 4), p(0, 2, 3, 7), p(13, 2, 3, 7)];
    case 'hair_bun':
      return [
        p(5, 0, 6, 3),
        p(3, 2, 3, 2), p(10, 2, 3, 2),
        p(2, 3, 2, 2), p(12, 3, 2, 2),
      ];
    case 'hair_ponytail':
      return [p(3, 0, 10, 3), p(2, 2, 2, 3), p(12, 2, 3, 10)];
    case 'hair_curly':
      return [
        p(3, 0, 10, 3),
        p(2, 2, 2, 6), p(12, 2, 2, 6),
        p(2, 8, 2, 2), p(12, 8, 2, 2),
      ];
    case 'hair_bald':
      return [];
    default: // hair_short
      return [p(3, 0, 10, 3), p(2, 2, 2, 3), p(12, 2, 2, 3)];
  }
}

function accessoryPixels(id: string, color: string): CR[] {
  const p = (x: number, y: number, w: number, h: number, c = color) => px(x, y, w, h, c);
  switch (id) {
    case 'acc_cap':
      return [p(3, 0, 10, 2), p(1, 2, 14, 1)];
    case 'acc_glasses':
      return [
        // left lens
        p(3, 4, 5, 1), p(3, 5, 1, 2), p(7, 5, 1, 2), p(3, 6, 5, 1),
        // bridge
        p(7, 5, 2, 1),
        // right lens
        p(8, 4, 5, 1), p(8, 5, 1, 2), p(12, 5, 1, 2), p(8, 6, 5, 1),
      ];
    case 'acc_sunglasses':
      return [
        p(3, 5, 5, 2), p(7, 6, 2, 1), p(8, 5, 5, 2),
      ];
    case 'acc_headband':
      return [p(3, 2, 10, 1)];
    case 'acc_crown':
      return [
        p(3, 1, 10, 2),
        p(3, 0, 1, 2), p(5, 0, 2, 3), p(8, 0, 1, 2), p(10, 0, 2, 3), p(12, 0, 1, 2),
        // gem
        p(7, 1, 2, 1, '#E11D48'),
      ];
    case 'acc_halo':
      return [
        p(4, 0, 8, 1), p(3, 1, 2, 1), p(11, 1, 2, 1),
        p(7, 1, 2, 1, '#FEF9C3'), // shimmer
      ];
    default:
      return [];
  }
}

function facePixels(skin: string, hairColor: string, mood: number): CR[] {
  const pixels: CR[] = [];
  const dark = '#1A1010';
  const white = '#FFFFFF';
  const pink = '#FFB6C1';

  const sadMood   = mood < 30;
  const happyMood = mood >= 60;
  const grinMood  = mood >= 85;

  // eyebrows — inward shift when sad
  const browLx = sadMood ? 5 : 4;
  const browRx = sadMood ? 8 : 9;
  pixels.push(px(browLx, 4, 3, 1, hairColor), px(browRx, 4, 3, 1, hairColor));

  // eye whites
  pixels.push(px(4, 5, 3, 2, white), px(9, 5, 3, 2, white));
  if (happyMood || grinMood) {
    pixels.push(px(4, 5, 3, 1, skin), px(9, 5, 3, 1, skin)); // squint
  }
  const pupilCol = grinMood ? '#F59E0B' : dark;
  pixels.push(px(5, 6, 1, 1, pupilCol), px(10, 6, 1, 1, pupilCol));

  // cheeks
  if (happyMood || grinMood) {
    pixels.push(px(3, 7, 2, 1, pink), px(11, 7, 2, 1, pink));
  }

  // mouth — narrowed to 4 px wide so it reads as a mouth, not a moustache
  if (grinMood) {
    pixels.push(
      px(4, 7, 8, 1, dark),
      px(4, 8, 2, 1, dark), px(10, 8, 2, 1, dark),
      px(6, 8, 4, 1, white),
    );
  } else if (happyMood) {
    pixels.push(px(5, 7, 1, 1, dark), px(10, 7, 1, 1, dark), px(6, 8, 4, 1, dark));
  } else if (sadMood) {
    pixels.push(px(6, 7, 4, 1, dark), px(5, 8, 1, 1, dark), px(10, 8, 1, 1, dark));
  } else {
    pixels.push(px(6, 8, 4, 1, dark)); // neutral: narrow flat line
  }

  return pixels;
}

function facialHairPixels(style: string | null, color: string): CR[] {
  if (!style) return [];
  const p = (x: number, y: number, w: number, h: number) => px(x, y, w, h, color);
  switch (style) {
    case 'fh_stubble':
      return [p(5, 9, 1, 1), p(7, 9, 1, 1), p(9, 9, 1, 1), p(11, 9, 1, 1)];
    case 'fh_moustache':
      return [p(5, 7, 3, 1), p(8, 7, 3, 1)];
    case 'fh_goatee':
      return [p(6, 9, 4, 1)];
    case 'fh_beard':
      return [p(5, 7, 3, 1), p(8, 7, 3, 1), p(3, 8, 2, 1), p(11, 8, 2, 1), p(3, 9, 10, 1)];
    default:
      return [];
  }
}

// ─── PixelAvatar SVG component ────────────────────────────────────────────────

export interface PixelAvatarProps {
  config?: UserAvatar | null;
  uid?: string;
  size?: number;
  /** 'head' crops to face. 'full' shows whole body. 'tall' shows body with extended legs. */
  view?: 'head' | 'full' | 'tall';
  className?: string;
}

export function PixelAvatar({
  config,
  uid = 'x',
  size = 48,
  view = 'head',
  className,
}: PixelAvatarProps) {
  const av = config ?? deriveAvatarFromUid(uid);
  const skin = SKIN_TONES[av.skinTone] ?? SKIN_TONES.skin2;
  const hairCol = HAIR_COLORS[av.hairColor] ?? HAIR_COLORS.brown;
  const topDef = AVATAR_ITEMS.find(i => i.id === av.top);
  const botDef = AVATAR_ITEMS.find(i => i.id === av.bottom);
  const shoDef = AVATAR_ITEMS.find(i => i.id === av.shoes);
  const accDef = av.accessory ? AVATAR_ITEMS.find(i => i.id === av.accessory) : null;

  const topC  = topDef?.color  ?? '#4B8DC8';
  const topC2 = topDef?.color2;
  const botC  = botDef?.color  ?? '#2B4C7E';
  const shoC  = shoDef?.color  ?? '#F9FAFB';
  const shoC2 = shoDef?.color2;

  // Grid: 16 × 24 (full) or 16 × 30 (tall)
  // y=0-1 hair overflow · y=2-9 head · y=10 neck
  // y=11-17 torso+arms · y=18 hands · y=19-21 legs · y=22-23 shoes (full)
  // tall: legs y=19-26 · shoes y=27-29
  const tall  = view === 'tall';
  const legH  = tall ? 8 : 3;
  const shoeY = tall ? 27 : 22;
  const shoeH = tall ? 3 : 2;

  const pixels: CR[] = [];

  // ── Shoes ──
  pixels.push(px(2, shoeY, 6, shoeH, shoC), px(8, shoeY, 6, shoeH, shoC));
  if (shoC2) pixels.push(px(2, shoeY, 6, 1, shoC2), px(8, shoeY, 6, 1, shoC2));
  pixels.push(px(7, shoeY, 1, 1, '#FFFFFF3A'), px(13, shoeY, 1, 1, '#FFFFFF3A'));

  // ── Legs / Bottom ──
  if (av.bottom === 'bottom_skirt') {
    pixels.push(px(2, 19, 12, legH, botC));
  } else {
    pixels.push(px(3, 19, 4, legH, botC), px(9, 19, 4, legH, botC));
  }

  // ── Torso + Arms ──
  pixels.push(px(2, 11, 12, 7, topC), px(0, 11, 3, 7, topC), px(13, 11, 3, 7, topC));
  if (topC2) {
    [11, 13, 15, 17].forEach(y =>
      pixels.push(px(0, y, 3, 1, topC2), px(2, y, 12, 1, topC2), px(13, y, 3, 1, topC2))
    );
  }
  if (av.top === 'top_tuxedo') {
    pixels.push(px(6, 11, 4, 7, '#FFFFFF'), px(7, 11, 2, 7, topC));
  }

  // ── Hands ──
  pixels.push(px(0, 18, 3, 1, skin), px(13, 18, 3, 1, skin));

  // ── Neck ──
  pixels.push(px(6, 10, 4, 1, skin));

  // ── Head ──
  pixels.push(px(3, 2, 10, 8, skin), px(2, 4, 1, 3, skin), px(13, 4, 1, 3, skin));

  // ── Face ──
  facePixels(skin, hairCol, av.mood).forEach(p => pixels.push(p));

  // ── Facial hair ──
  facialHairPixels(av.facialHair ?? null, hairCol).forEach(p => pixels.push(p));

  // ── Hair ──
  hairPixels(av.hairStyle, hairCol).forEach(p => pixels.push(p));

  // ── Accessory ──
  if (accDef) accessoryPixels(accDef.id, accDef.color).forEach(p => pixels.push(p));

  const vb = view === 'head' ? '1 0 14 12' : tall ? '0 0 16 30' : '0 0 16 24';
  const h  = view === 'head' ? size : tall ? Math.round(size * 30 / 16) : Math.round(size * 24 / 16);

  return (
    <svg
      viewBox={vb}
      width={size}
      height={h}
      style={{ imageRendering: 'pixelated', display: 'block' }}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {pixels.map((p, i) => (
        <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill={p.c} />
      ))}
    </svg>
  );
}

// ─── Avatar Customiser Modal ───────────────────────────────────────────────────

type Tab = 'skin' | 'hair' | 'top' | 'bottom' | 'shoes' | 'accessory';
const TABS: { id: Tab; label: string }[] = [
  { id: 'skin',      label: 'Skin' },
  { id: 'hair',      label: 'Hair' },
  { id: 'top',       label: 'Tops' },
  { id: 'bottom',    label: 'Bottoms' },
  { id: 'shoes',     label: 'Shoes' },
  { id: 'accessory', label: 'Access.' },
];

// ensure draft always has facialHair even on old saved avatars
function normaliseDraft(av: UserAvatar): UserAvatar {
  return { facialHair: null, ...av };
}

interface AvatarCustomiserModalProps {
  avatar: UserAvatar;
  onSave: (updated: UserAvatar) => void;
  onClose: () => void;
}

export function AvatarCustomiserModal({ avatar, onSave, onClose }: AvatarCustomiserModalProps) {
  const [draft, setDraft] = useState<UserAvatar>(normaliseDraft(avatar));
  const [tab, setTab] = useState<Tab>('skin');

  const equip = (field: keyof UserAvatar, value: string | null) =>
    setDraft(d => ({ ...d, [field]: value }));

  const items = AVATAR_ITEMS.filter(i => i.type === tab);
  const owned = (id: string) => draft.inventory.includes(id);

  const ItemBtn = ({ item }: { item: AvatarItemDef; key?: React.Key }) => {
    const isOwned = owned(item.id) || item.rarity === 'starter';
    // 'hair' items map to the 'hairStyle' field on UserAvatar
    const field: keyof UserAvatar =
      item.type === 'hair' ? 'hairStyle' :
      item.type === 'accessory' ? 'accessory' :
      item.type as keyof UserAvatar;
    const equipped =
      field === 'accessory'
        ? draft.accessory === item.id
        : (draft as Record<string, unknown>)[field] === item.id;

    return (
      <button
        onClick={() => {
          if (!isOwned) return;
          if (field === 'accessory') {
            equip('accessory', equipped ? null : item.id);
          } else {
            equip(field, item.id);
          }
        }}
        className={cn(
          'flex flex-col items-center gap-1 p-2 rounded-2xl border-2 transition-all',
          equipped
            ? 'border-brand-gold bg-brand-gold/10'
            : isOwned
              ? 'border-transparent bg-white hover:border-brand-navy/20'
              : 'border-transparent bg-white/50 opacity-50',
        )}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: item.color || '#E5E7EB' }}
        >
          {!isOwned && <Lock size={12} className="text-white drop-shadow" />}
          {isOwned && item.color2 && (
            <div className="w-4 h-4 rounded" style={{ background: item.color2 }} />
          )}
        </div>
        <span className="text-[9px] font-bold text-brand-navy leading-none text-center">{item.name}</span>
        <span className={cn('text-[8px] font-bold', RARITY_COLOR[item.rarity])}>
          {RARITY_LABEL[item.rarity]}
        </span>
      </button>
    );
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-brand-bg"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 280 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-3">
        <button onClick={onClose} className="p-2 rounded-2xl bg-white border border-brand-navy/10">
          <X size={18} className="text-brand-navy" />
        </button>
        <h2 className="font-display text-xl font-bold text-brand-navy">Customise Avatar</h2>
        <button
          onClick={() => onSave(draft)}
          className="px-4 py-2 rounded-2xl bg-brand-navy text-white font-bold text-sm"
        >
          Save
        </button>
      </div>

      {/* Avatar preview */}
      <div className="flex flex-col items-center py-4">
        <div className="bg-gradient-to-b from-indigo-100 to-purple-50 rounded-[2rem] p-4 shadow-inner">
          <PixelAvatar config={draft} size={72} view="tall" />
        </div>
        <p className="text-xs text-brand-navy/40 mt-2 font-bold">
          Mood {Math.round(draft.mood)}% {draft.mood < 30 ? '😔' : draft.mood < 60 ? '😐' : draft.mood < 85 ? '😊' : '🤩'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 px-4 pb-2 overflow-x-auto scrollbar-hide">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
              tab === t.id
                ? 'bg-brand-navy text-white'
                : 'bg-white text-brand-navy/50 border border-brand-navy/10',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Skin tab */}
      {tab === 'skin' && (
        <div className="px-4 pt-2 flex-1 overflow-y-auto">
          <p className="text-xs font-bold text-brand-navy/40 mb-3 uppercase tracking-widest">Skin Tone</p>
          <div className="grid grid-cols-5 gap-3 mb-6">
            {(Object.entries(SKIN_TONES) as [SkinTone, string][]).map(([key, color]) => (
              <button
                key={key}
                onClick={() => equip('skinTone', key)}
                className={cn(
                  'w-12 h-12 rounded-2xl border-4 transition-all mx-auto',
                  draft.skinTone === key ? 'border-brand-gold scale-110' : 'border-transparent',
                )}
                style={{ background: color }}
              />
            ))}
          </div>
          <p className="text-xs font-bold text-brand-navy/40 mb-3 uppercase tracking-widest">Hair Colour</p>
          <div className="grid grid-cols-4 gap-3">
            {Object.entries(HAIR_COLORS).map(([key, color]) => (
              <button
                key={key}
                onClick={() => equip('hairColor', key)}
                className={cn(
                  'flex flex-col items-center gap-1 p-2 rounded-2xl border-2 transition-all',
                  draft.hairColor === key ? 'border-brand-gold' : 'border-transparent bg-white',
                )}
              >
                <div className="w-8 h-8 rounded-full" style={{ background: color }} />
                <span className="text-[9px] font-bold capitalize text-brand-navy/60">{key}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Item grid tabs */}
      {tab !== 'skin' && (
        <div className="px-4 pt-2 flex-1 overflow-y-auto">
          {/* Facial hair section inside the Hair tab */}
          {tab === 'hair' && (
            <div className="mb-4">
              <p className="text-xs font-bold text-brand-navy/40 mb-2 uppercase tracking-widest">Facial Hair</p>
              <div className="flex gap-2 flex-wrap">
                {FACIAL_HAIR_STYLES.map(fh => (
                  <button
                    key={String(fh.id)}
                    onClick={() => equip('facialHair', fh.id)}
                    className={cn(
                      'flex flex-col items-center gap-1 px-3 py-2 rounded-2xl border-2 transition-all',
                      draft.facialHair === fh.id
                        ? 'border-brand-gold bg-brand-gold/10'
                        : 'border-transparent bg-white',
                    )}
                  >
                    <span className="text-lg leading-none">{fh.emoji}</span>
                    <span className="text-[9px] font-bold text-brand-navy">{fh.name}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs font-bold text-brand-navy/40 mt-4 mb-2 uppercase tracking-widest">Hairstyle</p>
            </div>
          )}
          {items.length === 0 && tab !== 'hair' && (
            <p className="text-sm text-brand-navy/40 text-center mt-6">No items in this category yet.</p>
          )}
          <div className="grid grid-cols-4 gap-2">
            {tab === 'accessory' && (
              <button
                onClick={() => equip('accessory', null)}
                className={cn(
                  'flex flex-col items-center gap-1 p-2 rounded-2xl border-2 transition-all',
                  draft.accessory === null
                    ? 'border-brand-gold bg-brand-gold/10'
                    : 'border-transparent bg-white',
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-brand-navy/5 flex items-center justify-center">
                  <span className="text-xs">✕</span>
                </div>
                <span className="text-[9px] font-bold text-brand-navy leading-none">None</span>
                <span className="text-[8px] text-brand-navy/30">—</span>
              </button>
            )}
            {items.map(item => <ItemBtn key={item.id} item={item} />)}
          </div>
          <div className="h-6" />
        </div>
      )}
    </motion.div>
  );
}

// ─── Avatar View Modal ────────────────────────────────────────────────────────

export function AvatarViewModal({ avatar, uid, onCustomise, onClose }: {
  avatar: UserAvatar | null | undefined;
  uid: string;
  onCustomise: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[300] flex flex-col items-center justify-end bg-black/50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className="bg-brand-bg w-full max-w-md rounded-t-[2.5rem] px-8 pt-8 pb-28 flex flex-col items-center gap-5"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
      >
        <div className="w-10 h-1 rounded-full bg-brand-navy/10 mb-1" />
        <div className="bg-gradient-to-b from-indigo-100 to-purple-50 rounded-[2rem] p-6 shadow-inner">
          <PixelAvatar config={avatar ?? undefined} uid={uid} size={96} view="tall" />
        </div>
        <button
          onClick={onCustomise}
          className="w-full py-3 rounded-2xl bg-brand-navy text-white font-bold text-sm active:scale-95 transition-all"
        >
          Customise Avatar
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Daily Wheel Modal ─────────────────────────────────────────────────────────

interface DailyWheelModalProps {
  /** Current avatar inventory */
  inventory: string[];
  lastSpin?: string; // ISO date YYYY-MM-DD
  onClose: () => void;
  onWin: (itemId: string) => void;
}

export function DailyWheelModal({ inventory, lastSpin, onClose, onWin }: DailyWheelModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const alreadySpun = lastSpin === today;

  const wheelRef = useRef<HTMLDivElement>(null);
  const [currentRotation, setCurrentRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ item: AvatarItemDef | null; label: string } | null>(null);
  const [showResult, setShowResult] = useState(false);

  const SEGMENT_DEG = 360 / WHEEL_SEGMENTS.length; // 45°

  const handleSpin = () => {
    if (spinning || alreadySpun || showResult) return;

    // Pick a random winning segment
    const segIdx = Math.floor(Math.random() * WHEEL_SEGMENTS.length);
    const seg = WHEEL_SEGMENTS[segIdx];

    // Spin 5 full turns + land with segIdx at top
    // Pointer is at top (0°). Segment 0 starts at top.
    // To land segment segIdx at top: wheel must rotate by (360 - segIdx * SEGMENT_DEG) from 0
    const landAngle = ((8 - segIdx) % 8) * SEGMENT_DEG + SEGMENT_DEG / 2;
    const extra = currentRotation % 360;
    const delta = ((landAngle - extra) + 360) % 360 || 360;
    const totalSpin = 5 * 360 + delta;
    const newRotation = currentRotation + totalSpin;

    setCurrentRotation(newRotation);
    setSpinning(true);

    // Apply CSS transition directly on the DOM element
    if (wheelRef.current) {
      wheelRef.current.style.transition = 'transform 3.6s cubic-bezier(0.17, 0.67, 0.08, 0.99)';
      wheelRef.current.style.transform = `rotate(${newRotation}deg)`;
    }

    setTimeout(() => {
      setSpinning(false);

      let wonItem: AvatarItemDef | null = null;
      if (seg.prizeType && seg.prizeRarity) {
        const pool = AVATAR_ITEMS.filter(
          i =>
            i.type === seg.prizeType &&
            i.rarity === seg.prizeRarity &&
            !inventory.includes(i.id) &&
            i.rarity !== 'starter',
        );
        // If all items of that type are already owned, pick any owned one as bonus
        const fallback = AVATAR_ITEMS.filter(
          i => i.type === seg.prizeType && i.rarity === seg.prizeRarity && i.rarity !== 'starter',
        );
        const chosen = pool.length > 0 ? pool : fallback;
        if (chosen.length > 0) {
          wonItem = chosen[Math.floor(Math.random() * chosen.length)];
        }
      }

      setResult({ item: wonItem, label: seg.label });
      setShowResult(true);
      if (wonItem) onWin(wonItem.id);
    }, 3700);
  };

  // Build conic-gradient string for the wheel
  const conicGradient = WHEEL_SEGMENTS.map((seg, i) => {
    const start = i * SEGMENT_DEG;
    const end = (i + 1) * SEGMENT_DEG;
    return `${seg.bg} ${start}deg ${end}deg`;
  }).join(', ');

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black/60 flex flex-col items-center justify-center p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className="bg-white rounded-[2.5rem] p-6 w-full max-w-sm shadow-2xl"
        initial={{ scale: 0.85, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.85, y: 40 }}
        transition={{ type: 'spring', damping: 22 }}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-display text-xl font-bold text-brand-navy">Daily Spin</h2>
          <button onClick={onClose} className="p-2 rounded-xl bg-brand-navy/5">
            <X size={16} className="text-brand-navy" />
          </button>
        </div>

        {/* Wheel */}
        <div className="relative flex items-center justify-center mb-5">
          {/* Pointer at top */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 z-10"
            style={{ top: '-8px', width: 0, height: 0,
              borderLeft: '10px solid transparent',
              borderRight: '10px solid transparent',
              borderTop: '18px solid #1e3a5f',
            }}
          />
          {/* Wheel circle */}
          <div
            ref={wheelRef}
            className="w-52 h-52 rounded-full border-4 border-white shadow-xl"
            style={{
              background: `conic-gradient(${conicGradient})`,
              transform: `rotate(${currentRotation}deg)`,
            }}
          >
            {/* Segment labels */}
            {WHEEL_SEGMENTS.map((seg, i) => {
              const angle = i * SEGMENT_DEG + SEGMENT_DEG / 2;
              const rad = (angle - 90) * (Math.PI / 180);
              const r = 70;
              const x = 104 + r * Math.cos(rad);
              const y = 104 + r * Math.sin(rad);
              return (
                <div
                  key={i}
                  className="absolute text-[10px] font-bold text-brand-navy/70 leading-none text-center pointer-events-none"
                  style={{
                    left: x,
                    top: y,
                    transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                    width: 36,
                  }}
                >
                  <div>{seg.emoji}</div>
                  <div className="text-[8px] mt-0.5">{seg.label}</div>
                </div>
              );
            })}
          </div>
          {/* Center circle */}
          <div className="absolute w-8 h-8 bg-white rounded-full border-4 border-brand-navy/20 shadow z-10" />
        </div>

        {/* Result */}
        <AnimatePresence>
          {showResult && result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center bg-brand-bg rounded-2xl p-4 mb-4"
            >
              {result.item ? (
                <>
                  <p className="text-2xl mb-1">🎉</p>
                  <p className="font-bold text-brand-navy">You won:</p>
                  <p className="text-brand-gold font-bold text-lg">{result.item.name}</p>
                  <div
                    className="w-10 h-10 rounded-xl mx-auto mt-2"
                    style={{ background: result.item.color || '#E5E7EB' }}
                  />
                </>
              ) : (
                <>
                  <p className="text-2xl mb-1">😔</p>
                  <p className="font-bold text-brand-navy/60">Better luck tomorrow!</p>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {alreadySpun && !showResult && (
          <div className="text-center text-brand-navy/50 text-sm mb-4">
            You already spun today. Come back tomorrow!
          </div>
        )}

        <button
          onClick={handleSpin}
          disabled={spinning || alreadySpun || showResult}
          className={cn(
            'w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all',
            spinning || alreadySpun || showResult
              ? 'bg-brand-navy/10 text-brand-navy/40'
              : 'bg-brand-gold text-white active:scale-95',
          )}
        >
          <Dices size={16} />
          {spinning ? 'Spinning…' : alreadySpun ? 'Come back tomorrow' : showResult ? 'Done!' : 'Spin!'}
        </button>
      </motion.div>
    </motion.div>
  );
}
