/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { PixelAvatar, AvatarCustomiserModal, AvatarViewModal, DailyWheelModal } from './PixelAvatar';
import {
  type UserAvatar,
  AVATAR_ITEMS, STAMP_MILESTONE_REWARDS,
  randomStarterAvatar, deriveAvatarFromUid,
} from './avatarData';
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  applyActionCode,
  User as FirebaseUser
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  query,
  where,
  updateDoc,
  increment,
  deleteDoc,
  serverTimestamp,
  getDocs,
  getDocsFromServer,
  addDoc,
  orderBy,
  limit,
  collectionGroup,
  arrayUnion,
  arrayRemove,
  startAfter,
  Timestamp
} from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db } from './firebase';
const storage = getStorage();
import { cn } from './lib/utils';
import {
  Sparkles,
  User as UserIcon,
  Store,
  LogOut,
  Plus,
  CheckCircle2,
  Gift,
  ChevronRight,
  ChevronLeft,
  Search,
  MapPin,
  Star,
  Wallet,
  LayoutDashboard,
  QrCode,
  Bell,
  Filter,
  Map as MapIcon,
  Settings,
  X,
  Archive,
  Clock,
  TrendingUp,
  Users,
  Calendar,
  MessageSquare,
  Heart,
  Send,
  Trophy,
  Compass,
  MessageCircle,
  Zap,
  Flame,
  UserPlus,
  UserCheck,
  ArrowLeft,
  MoreVertical,
  Trash2,
  BarChart2,
  Image,
  Flag,
  ChevronDown,
  Palette,
  Building2,
  Edit3,
  Save,
  CreditCard,
  Phone,
  Hash,
  FileText,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  RefreshCw,
  Award,
  Utensils,
  Scissors,
  Dumbbell,
  Car,
  ShoppingBag,
  Wifi,
  Smartphone,
  Tag,
  Package,
  Pencil,
  Stamp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';

// --- Types ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // We don't throw here to avoid crashing the whole app, but we log it clearly
  return errInfo;
}

type UserRole = 'consumer' | 'vendor';
type Category = 'Food' | 'Beauty' | 'Barber' | 'Gym' | 'Parking' | 'Retail';

const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  Food: Utensils,
  Beauty: Sparkles,
  Barber: Scissors,
  Gym: Dumbbell,
  Parking: Car,
  Retail: ShoppingBag,
};

function StoreCategoryIcon({ category, size = 12, className }: { category?: string; size?: number; className?: string }) {
  const Icon = category ? CATEGORY_ICON_MAP[category] : null;
  if (!Icon) return null;
  return <Icon size={size} className={className} />;
}

// ─── Default gender-specific SVG avatars (no external URL, no data cost) ────
const AVATAR_SVGS: Record<string, string> = {
  Male: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#1e3a5f"/><circle cx="50" cy="36" r="19" fill="#7da5c8"/><rect x="28" y="57" width="44" height="6" rx="3" fill="#5a8aaa"/><path d="M14 100 Q14 66 50 66 Q86 66 86 100Z" fill="#7da5c8"/></svg>`,
  Female: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#1e3a5f"/><ellipse cx="50" cy="34" rx="17" ry="20" fill="#e8a8bf"/><path d="M33 22 Q33 8 50 8 Q67 8 67 22" fill="#c47899"/><path d="M14 100 Q14 66 50 66 Q86 66 86 100Z" fill="#e8a8bf"/></svg>`,
  'Non-binary': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#1e3a5f"/><circle cx="50" cy="36" r="19" fill="#a08fc4"/><path d="M14 100 Q14 66 50 66 Q86 66 86 100Z" fill="#a08fc4"/></svg>`,
  default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#1e3a5f"/><circle cx="50" cy="36" r="19" fill="#8fafc4"/><path d="M14 100 Q14 66 50 66 Q86 66 86 100Z" fill="#8fafc4"/></svg>`,
};

function CountdownTimer({ endsAt }: { endsAt: any }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const tick = () => {
      const end = endsAt?.toDate ? endsAt.toDate() : new Date(endsAt);
      const diff = end.getTime() - Date.now();
      if (diff <= 0) { setLabel('Ended'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (d > 0) setLabel(`${d}d ${h}h ${m}m`);
      else if (h > 0) setLabel(`${h}h ${m}m ${s}s`);
      else setLabel(`${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return <>{label}</>;
}

function avatarSrc(gender?: string | null): string {
  const key = gender && AVATAR_SVGS[gender] ? gender : 'default';
  return `data:image/svg+xml;base64,${btoa(AVATAR_SVGS[key])}`;
}

interface ConsumerOnboardingData {
  type: 'consumer';
  name: string;
  handle: string;
  gender: string;
  birthday: string;
  location: { lat: number; lng: number; city?: string } | null;
}

interface VendorOnboardingData {
  type: 'vendor';
  businessName: string;
  category: string;
  address: string;
  phone: string;
  description: string;
  location: { lat: number; lng: number; city?: string } | null;
}

interface UserProfile {
  uid: string;
  name: string;
  handle?: string;
  email: string;
  photoURL: string;
  role: UserRole;
  roleConfirmed?: boolean;
  onboardingComplete?: boolean;
  gender?: string;
  birthday?: string;
  location?: { lat: number; lng: number; city?: string };
  total_cards_held: number;
  totalStamps: number;
  totalRedeemed: number;
  charityAnimals?: number;
  charityTrees?: number;
  streak?: number;
  lastStreakDate?: string;
  avatar?: UserAvatar;
  dogName?: string;
  lastDogFed?: any;
  lastTreeWatered?: any;
  lastFruitHarvested?: any;
  foodCount?: number;
  waterCount?: number;
  totalSaved?: number;
}

interface StoreProfile {
  id: string;
  name: string;
  category: Category;
  address: string;
  phone: string;
  email: string;
  logoUrl: string;
  coverUrl: string;
  ownerUid: string;
  description: string;
  isVerified: boolean;
  stamps_required_for_reward: number;
  reward?: string;
  theme?: string;
  stampIcon?: string;
  stampBorderColor?: string;
  cardPattern?: string;
  location?: string;
  lat?: number;
  lng?: number;
  rewardTiers?: { stamps: number; reward: string; value?: number }[];
  rewardsGiven?: number;
  visibilitySettings?: {
    members?: boolean;
    stamps?: boolean;
    activeCards?: boolean;
    returnRate?: boolean;
    followers?: boolean;
  };
}

interface Card {
  id: string;
  user_id: string;
  store_id: string;
  current_stamps: number;
  total_completed_cycles: number;
  last_tap_timestamp: any;
  isArchived?: boolean;
  isRedeemed?: boolean;
  stamps_required?: number;
  tiersCompleted?: number;
}

interface Notification {
  id: string;
  toUid: string;
  fromUid?: string;
  fromName?: string;
  fromPhoto?: string;
  type: 'follow' | 'system' | 'like' | 'comment' | 'message' | 'broadcast';
  title?: string;
  message: string;
  storeId?: string;
  storeName?: string;
  storeLogoUrl?: string;
  isRead: boolean;
  createdAt: any;
}

interface Transaction {
  id: string;
  user_id: string;
  store_id: string;
  completed_at: any;
  stamps_at_completion: number;
  reward_claimed: boolean;
}

interface Chat {
  id: string;
  uids: string[];
  lastMessage: string;
  lastActivity: any;
  unreadCount?: { [uid: string]: number };
  isBroadcast?: boolean;
  storeId?: string;
  storeName?: string;
  storeLogoUrl?: string;
  businessName?: string;
  businessLogoUrl?: string;
}

interface ChatMessage {
  id: string;
  chatId: string;
  senderUid: string;
  senderName: string;
  text: string;
  title?: string;
  createdAt: any;
}

interface Post {
  id: string;
  store_id: string;
  authorUid: string;
  authorName: string;
  authorPhoto: string;
  content: string;
  createdAt: any;
  likesCount: number;
}

interface Comment {
  id: string;
  postId: string;
  authorUid: string;
  authorName: string;
  authorPhoto: string;
  content: string;
  createdAt: any;
}

interface GlobalPost {
  id: string;
  authorUid: string;
  authorName: string;
  authorPhoto: string;
  authorRole: 'consumer' | 'vendor';
  storeId?: string;
  storeName?: string;
  wallPost?: boolean;
  toUid?: string;
  toName?: string;
  toPhoto?: string;
  content: string;
  postType: 'post' | 'poll' | 'review';
  rating?: number;
  storeReviewId?: string;
  pollOptions?: { text: string }[];
  pollVotes?: { [key: string]: string[] };
  createdAt: any;
  likesCount: number;
  likedBy?: string[];
}

const ADMIN_EMAIL = 'info@adastranetwork.co.uk';

type StickerTier = 'brown' | 'lightblue' | 'red' | 'blue' | 'gold';

const STICKER_ORDER: StickerTier[] = ['brown', 'lightblue', 'red', 'blue', 'gold'];

interface StickerVariant { emoji: string; name: string; }

const STICKER_CONFIG: Record<StickerTier, { color: string; solid: string; bg: string; border: string; label: string; chance: string; theme: string; variants: StickerVariant[] }> = {
  brown:    { color: '#6B3A2A', solid: '#955436', bg: '#F5E6D3', border: '#C4845C', label: 'Common',    chance: '50%', theme: 'Creepy Crawlies', variants: [
    { emoji: '🕷️', name: 'Spider' },
    { emoji: '🐛', name: 'Caterpillar' },
    { emoji: '🪲', name: 'Beetle' },
  ]},
  lightblue:{ color: '#0369A1', solid: '#4AACDA', bg: '#E0F2FE', border: '#7DD3FC', label: 'Uncommon',  chance: '28%', theme: 'Beach', variants: [
    { emoji: '🦀', name: 'Crab' },
    { emoji: '🐢', name: 'Sea Turtle' },
    { emoji: '🦭', name: 'Seal' },
  ]},
  red:      { color: '#B91C1C', solid: '#D21B17', bg: '#FEE2E2', border: '#FCA5A5', label: 'Rare',      chance: '14%', theme: 'Land Animals', variants: [
    { emoji: '🦎', name: 'Gecko' },
    { emoji: '🐊', name: 'Crocodile' },
    { emoji: '🐍', name: 'Snake' },
  ]},
  blue:     { color: '#1D4ED8', solid: '#0072BB', bg: '#DBEAFE', border: '#93C5FD', label: 'Epic',      chance: '7%',  theme: 'Ocean Life', variants: [
    { emoji: '🐙', name: 'Octopus' },
    { emoji: '🦈', name: 'Shark' },
    { emoji: '🐠', name: 'Clownfish' },
  ]},
  gold:     { color: '#92400E', solid: '#F5C518', bg: '#FFFBEB', border: '#FDE68A', label: 'Legendary', chance: '1%',  theme: 'Legendary', variants: [
    { emoji: '🐉', name: 'Golden Dragon' },
    { emoji: '🦘', name: 'Kangaroo' },
  ]},
};

const DEFAULT_TIER_CHANCES = { brown: 50, lightblue: 28, red: 14, blue: 7, gold: 1 };

function rollStickerTier(chances?: { brown: number; lightblue: number; red: number; blue: number; gold: number }): StickerTier {
  const c = chances ?? DEFAULT_TIER_CHANCES;
  const r = Math.random() * 100;
  let cum = 0;
  for (const tier of STICKER_ORDER) {
    cum += c[tier] ?? 0;
    if (r < cum) return tier;
  }
  return 'brown';
}

function rollStickerVariant(tier: StickerTier): number {
  return Math.floor(Math.random() * STICKER_CONFIG[tier].variants.length);
}

// Returns how many distinct variants in this tier the player has collected at least one of
function tierSetsCompleted(revealedStickers: CollectibleSticker[], tier: StickerTier): number {
  const variants = STICKER_CONFIG[tier].variants;
  return variants.filter((_, i) => revealedStickers.some(s => s.tier === tier && (s.variant ?? 0) === i)).length;
}

// Total unique animals collected across all tiers (max 14)
function totalSetsCompleted(revealedStickers: CollectibleSticker[]): number {
  return STICKER_ORDER.reduce((sum, tier) => sum + tierSetsCompleted(revealedStickers, tier), 0);
}

function allSetsWon(revealedStickers: CollectibleSticker[]): boolean {
  return STICKER_ORDER.every(tier => tierSetsCompleted(revealedStickers, tier) >= STICKER_CONFIG[tier].variants.length);
}

interface CollectibleSticker {
  id: string;
  tier: StickerTier;
  variant: number; // index into STICKER_CONFIG[tier].variants
  earnedAt: string;
}

interface StickerCardDoc {
  id: string;
  user_id: string;
  programme_id: string;
  stickers: CollectibleSticker[];
  revealedIds: string[];
  uniqueTiers: StickerTier[];
  userName?: string;
  userPhoto?: string;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  reward: string;
  goal: number;
  unit: string;
  endsAt?: any;
  createdAt: any;
  participantUids?: string[];
  type?: 'standard' | 'collectible';
  status?: 'active' | 'paused' | 'ended';
  tierChances?: { brown: number; lightblue: number; red: number; blue: number; gold: number };
  vendorIds?: string[];
  rewardTag?: 'product' | 'experience' | 'service';
  isAvatarPrize?: boolean;
  avatarPrizeItemId?: string;
  imageUrl?: string;
}

interface StoreAutomation {
  id: string;
  storeId: string;
  storeName?: string;
  type: 'birthday' | 'scheduled';
  title: string;
  message: string;
  daysBefore?: number;
  scheduledAt?: any;
  recurring?: 'none' | 'yearly';
  status: 'active' | 'paused';
  createdAt: any;
  lastFiredDate?: string;
}

type BadgeMetric = 'stamps' | 'cards_completed' | 'challenges_joined' | 'memberships' | 'followers' | 'following' | 'posts' | 'charity_animals' | 'charity_trees' | 'charity_total';

interface EndangeredAnimal {
  name: string;
  emoji: string;
  status: 'Critically Endangered' | 'Endangered';
  fact: string;
}

const ENDANGERED_ANIMALS: EndangeredAnimal[] = [
  { name: 'Amur Leopard', emoji: '🐆', status: 'Critically Endangered', fact: 'Fewer than 100 remain in the wild' },
  { name: 'Sumatran Orangutan', emoji: '🦧', status: 'Critically Endangered', fact: 'Lost 80% of habitat in just 20 years' },
  { name: 'Vaquita Porpoise', emoji: '🐬', status: 'Critically Endangered', fact: 'Fewer than 10 remain on Earth' },
  { name: 'Javan Rhino', emoji: '🦏', status: 'Critically Endangered', fact: 'Only ~70 survive in the wild' },
  { name: 'Cross River Gorilla', emoji: '🦍', status: 'Critically Endangered', fact: 'Fewer than 300 individuals remain' },
  { name: 'Hawksbill Sea Turtle', emoji: '🐢', status: 'Critically Endangered', fact: 'Still hunted for their beautiful shells' },
  { name: 'Kakapo Parrot', emoji: '🦜', status: 'Critically Endangered', fact: "World's only flightless parrot" },
  { name: 'Siberian Tiger', emoji: '🐯', status: 'Endangered', fact: 'Only ~500 survive in the wild' },
  { name: 'Snow Leopard', emoji: '🐆', status: 'Endangered', fact: 'Lives in the high mountains of central Asia' },
  { name: 'Blue Whale', emoji: '🐋', status: 'Endangered', fact: "Earth's largest animal, still recovering from hunting" },
  { name: 'Leatherback Sea Turtle', emoji: '🐢', status: 'Critically Endangered', fact: 'Population fell 40% in just 3 generations' },
  { name: 'Sumatran Elephant', emoji: '🐘', status: 'Critically Endangered', fact: 'Half their population lost in one generation' },
  { name: 'African Wild Dog', emoji: '🐕', status: 'Endangered', fact: 'Only ~6,600 remain across Africa' },
  { name: 'Giant Panda', emoji: '🐼', status: 'Endangered', fact: 'A global symbol of conservation' },
  { name: 'Mountain Gorilla', emoji: '🦍', status: 'Endangered', fact: 'Fewer than 1,100 survive in the wild' },
];

interface RankEntry {
  uid: string;
  name: string;
  totalStamps: number;
  avatar?: UserAvatar;
  globalRank: number;
}

interface CelebrationPage {
  type: 'stamp' | 'challenge' | 'upsell' | 'charity' | 'rank' | 'monopoly_pack' | 'challenges_list' | 'upsell_list' | 'stage_reward' | 'collectible_promo';
  storeName?: string;
  challengeTitle?: string;
  upsellTitle?: string;
  currentStamps: number;
  totalStamps: number;
  reward: string;
  encouragement: string;
  done: boolean;
  charityAnimal?: EndangeredAnimal;
  rankBefore?: number;
  rankAfter?: number;
  rankChange?: number;
  rankWeeklyBefore?: number;
  rankWeeklyAfter?: number;
  rankWeeklyChange?: number;
  rankTopTen?: RankEntry[];
  rankNearby?: RankEntry[];
  monopolyChallengeName?: string;
  challengesList?: Array<{ title: string; currentStamps: number; totalStamps: number; reward: string; done: boolean }>;
  upsellList?: Array<{ title: string; totalStamps: number; reward: string; id: string }>;
  stageReward?: string;
  stageStoreName?: string;
  stageStamps?: number;
  stageValue?: number;
  nextStageStamps?: number;
  nextStageReward?: string;
  collectiblePromoName?: string;
  collectiblePromoReward?: string;
}

interface AppBadge {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  metric: BadgeMetric;
  threshold: number;
  createdAt: any;
}

// --- Main App Component ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [profileCollection, setProfileCollection] = useState<'users' | 'vendors' | null>(null);
  const intendedRoleRef = useRef<'consumer' | 'vendor' | null>(null);
  const [activeTab, setActiveTab] = useState<string>('for-you');
  const [viewingStore, setViewingStore] = useState<StoreProfile | null>(null);
  const [viewingUser, setViewingUser] = useState<UserProfile | null>(null);

  // If the target user is a vendor, go straight to their store instead of their user profile
  const handleViewUser = async (targetUser: UserProfile) => {
    if (targetUser.role === 'vendor') {
      try {
        const q = query(collection(db, 'stores'), where('ownerUid', '==', targetUser.uid));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setViewingStore({ id: snap.docs[0].id, ...snap.docs[0].data() } as StoreProfile);
          setViewingUser(null);
          return;
        }
      } catch { /* fall through to user profile */ }
    }
    setViewingUser(targetUser);
  };
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [pendingNFCStoreId, setPendingNFCStoreId] = useState<string | null>(null);
  const [userCards, setUserCards] = useState<Card[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [adminView, setAdminView] = useState<null | 'menu' | 'challenges' | 'badges' | 'stores' | 'users' | 'posts'>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Listen to user's cards globally to sync stats
  useEffect(() => {
    if (!user) {
      setUserCards([]);
      return;
    }
    const q = query(collection(db, 'cards'), where('user_id', '==', user.uid));
    return onSnapshot(q, (snap) => {
      setUserCards(snap.docs.map(d => ({ id: d.id, ...d.data() } as Card)));
    }, (error) => console.error("Global cards listener:", error));
  }, [user]);

  // Listen to ALL notifications (shown in feed); badge count tracks unread separately
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    const q = query(
      collection(db, 'notifications'),
      where('toUid', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    return onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
    }, (error) => console.error("Notifications listener:", error));
  }, [user]);

  // Listen to unread message count via chats
  useEffect(() => {
    if (!user) { setUnreadMessages(0); return; }
    const q = query(collection(db, 'chats'), where('uids', 'array-contains', user.uid));
    return onSnapshot(q, (snap) => {
      const total = snap.docs.reduce((sum, d) => {
        const uc = d.data().unreadCount || {};
        return sum + (uc[user.uid] || 0);
      }, 0);
      setUnreadMessages(total);
    }, () => {});
  }, [user]);

  // Daily stamp reminder — fires once per day per device
  useEffect(() => {
    if (!user || userCards.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const key = `stamp_reminder_${user.uid}_${today}`;
    if (localStorage.getItem(key)) return;
    const activeCards = userCards.filter(c => !c.isArchived);
    if (activeCards.length === 0) return;
    const stampedToday = activeCards.some(c => {
      if (!c.last_tap_timestamp) return false;
      const ts = c.last_tap_timestamp.toDate?.() || new Date(c.last_tap_timestamp);
      return ts.toISOString().slice(0, 10) === today;
    });
    if (!stampedToday) {
      localStorage.setItem(key, '1');
      addDoc(collection(db, 'notifications'), {
        toUid: user.uid,
        fromUid: 'system',
        fromName: 'Linq',
        fromPhoto: '',
        type: 'system',
        message: `Don't forget to collect your stamps today! You have ${activeCards.length} active card${activeCards.length > 1 ? 's' : ''}.`,
        isRead: false,
        createdAt: serverTimestamp(),
      }).catch(() => {});
    }
  }, [user, userCards]);

  // Listen to profile changes
  useEffect(() => {
    if (!user || !profileCollection) return;
    return onSnapshot(doc(db, profileCollection, user.uid), (snap) => {
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      }
    }, (error) => console.error("Profile listener:", error));
  }, [user, profileCollection]);

  // Vendors don't have a For You tab — redirect to home if they land there
  useEffect(() => {
    if (profile?.role === 'vendor' && activeTab === 'for-you') setActiveTab('home');
  }, [profile?.role]);

  // Decay avatar mood daily when no food stamps were collected — runs once per session
  const moodDecayApplied = useRef(false);
  useEffect(() => {
    if (moodDecayApplied.current) return;
    if (!user || !profile || profile.role !== 'consumer') return;
    const av = profile.avatar;
    if (!av) return;
    moodDecayApplied.current = true;

    const today = new Date().toISOString().slice(0, 10);
    const last = av.lastFoodStampDate;
    if (!last || last === today) return; // collected today, no decay

    const msPerDay = 86_400_000;
    const daysMissed = Math.floor((Date.parse(today) - Date.parse(last)) / msPerDay);
    if (daysMissed <= 0) return;

    const decayed = Math.max(0, av.mood - daysMissed * 5);
    if (decayed === av.mood) return;

    updateDoc(doc(db, 'users', user.uid), { 'avatar.mood': decayed }).catch(console.error);
  }, [user, profile]);
  useEffect(() => {
    const seedDemoStores = async () => {
      try {
        const storeSnap = await getDocs(collection(db, 'stores'));
        if (storeSnap.empty) {
          console.log("Seeding demo stores...");
          const demoStores = [
            { name: 'The Coffee House', category: 'Food', address: '123 Brew St', phone: '555-0101', email: 'coffee@example.com', logoUrl: 'https://picsum.photos/seed/coffee/200/200', coverUrl: 'https://picsum.photos/seed/coffee-bg/800/400', ownerUid: 'demo-vendor', description: 'Best beans in town.', isVerified: true, stamps_required_for_reward: 10 },
            { name: 'Glow Beauty', category: 'Beauty', address: '456 Shine Ave', phone: '555-0202', email: 'glow@example.com', logoUrl: 'https://picsum.photos/seed/beauty/200/200', coverUrl: 'https://picsum.photos/seed/beauty-bg/800/400', ownerUid: 'demo-vendor', description: 'Premium skincare.', isVerified: true, stamps_required_for_reward: 8 },
            { name: 'Iron Gym', category: 'Gym', address: '789 Muscle Rd', phone: '555-0303', email: 'iron@example.com', logoUrl: 'https://picsum.photos/seed/gym/200/200', coverUrl: 'https://picsum.photos/seed/gym-bg/800/400', ownerUid: 'demo-vendor', description: 'Get strong.', isVerified: false, stamps_required_for_reward: 12 },
            { name: 'Urban Barber', category: 'Barber', address: '101 Fade St', phone: '555-0404', email: 'barber@example.com', logoUrl: 'https://picsum.photos/seed/barber/200/200', coverUrl: 'https://picsum.photos/seed/barber-bg/800/400', ownerUid: 'demo-vendor', description: 'Sharp cuts.', isVerified: true, stamps_required_for_reward: 6 },
          ];
          for (const store of demoStores) {
            await addDoc(collection(db, 'stores'), store);
          }
          console.log("Demo stores seeded.");
        }
      } catch (error) {
        console.error("Error seeding demo stores:", error);
      }
    };
    seedDemoStores();
  }, []);

  useEffect(() => {
    if (!user) return;
    const seedDemoPosts = async () => {
      try {
        const snap = await getDocsFromServer(query(collection(db, 'global_posts'), limit(1)));
        if (!snap.empty) return;

        const users = [
          { uid: 'demo_u1', name: 'Alex Rivers',    photo: 'https://i.pravatar.cc/150?u=alexrivers',   role: 'consumer' },
          { uid: 'demo_u2', name: 'Jordan Smith',   photo: 'https://i.pravatar.cc/150?u=jordansmith',  role: 'consumer' },
          { uid: 'demo_u3', name: 'Casey Chen',     photo: 'https://i.pravatar.cc/150?u=caseychen',    role: 'consumer' },
          { uid: 'demo_u4', name: 'Sam Taylor',     photo: 'https://i.pravatar.cc/150?u=samtaylor',    role: 'consumer' },
          { uid: 'demo_u5', name: 'Morgan Lee',     photo: 'https://i.pravatar.cc/150?u=morganlee',    role: 'consumer' },
        ];

        const vendors = [
          { uid: 'demo_v1', name: 'The Coffee House',  photo: 'https://picsum.photos/seed/coffee/200/200',  store: 'The Coffee House' },
          { uid: 'demo_v2', name: 'Glow Beauty',       photo: 'https://picsum.photos/seed/beauty/200/200',  store: 'Glow Beauty' },
          { uid: 'demo_v3', name: 'Iron Gym',          photo: 'https://picsum.photos/seed/gym/200/200',     store: 'Iron Gym' },
          { uid: 'demo_v4', name: 'Urban Barber',      photo: 'https://picsum.photos/seed/barber/200/200',  store: 'Urban Barber' },
        ];

        const posts = [
          // User posts
          {
            authorUid: users[0].uid, authorName: users[0].name, authorPhoto: users[0].photo, authorRole: 'consumer',
            content: "Just hit my 8th stamp at The Coffee House ☕ Free coffee is so close I can taste it!",
            postType: 'post', likesCount: 14,
            likedBy: [users[1].uid, users[2].uid, users[3].uid, users[4].uid],
            pollOptions: null, pollVotes: null,
          },
          {
            authorUid: users[1].uid, authorName: users[1].name, authorPhoto: users[1].photo, authorRole: 'consumer',
            content: "Glow Beauty just gave me the best facial I've ever had. The loyalty rewards make it even sweeter 💅",
            postType: 'post', likesCount: 22,
            likedBy: [users[0].uid, users[2].uid, users[4].uid],
            pollOptions: null, pollVotes: null,
          },
          {
            authorUid: users[2].uid, authorName: users[2].name, authorPhoto: users[2].photo, authorRole: 'consumer',
            content: "Iron Gym is changing my life. Two months in and already redeemed my first free session 💪 Anyone else training there?",
            postType: 'post', likesCount: 18,
            likedBy: [users[3].uid, users[4].uid, users[0].uid],
            pollOptions: null, pollVotes: null,
          },
          {
            authorUid: users[3].uid, authorName: users[3].name, authorPhoto: users[3].photo, authorRole: 'consumer',
            content: "PSA: Urban Barber now has Sunday hours 🙌 Got my fresh cut this morning and earned stamp #5. One more for a free service!",
            postType: 'post', likesCount: 9,
            likedBy: [users[1].uid, users[2].uid],
            pollOptions: null, pollVotes: null,
          },
          {
            authorUid: users[4].uid, authorName: users[4].name, authorPhoto: users[4].photo, authorRole: 'consumer',
            content: "Linq is genuinely the best loyalty app I've used. Actually motivates me to keep going back to my favourite spots 🔥",
            postType: 'post', likesCount: 31,
            likedBy: [users[0].uid, users[1].uid, users[2].uid, users[3].uid],
            pollOptions: null, pollVotes: null,
          },
          // Vendor posts
          {
            authorUid: vendors[0].uid, authorName: vendors[0].name, authorPhoto: vendors[0].photo, authorRole: 'vendor',
            storeName: vendors[0].store,
            content: "🎉 DOUBLE STAMPS this entire weekend! Friday through Sunday — every purchase earns 2x stamps. Come level up your card ☕",
            postType: 'post', likesCount: 47,
            likedBy: [users[0].uid, users[1].uid, users[2].uid, users[3].uid, users[4].uid],
            pollOptions: null, pollVotes: null,
          },
          {
            authorUid: vendors[1].uid, authorName: vendors[1].name, authorPhoto: vendors[1].photo, authorRole: 'vendor',
            storeName: vendors[1].store,
            content: "✨ Our summer skincare range has arrived! Book any facial this week and receive 3 BONUS stamps. Spaces filling fast 🌸",
            postType: 'post', likesCount: 35,
            likedBy: [users[1].uid, users[4].uid],
            pollOptions: null, pollVotes: null,
          },
          {
            authorUid: vendors[2].uid, authorName: vendors[2].name, authorPhoto: vendors[2].photo, authorRole: 'vendor',
            storeName: vendors[2].store,
            content: "New Olympic lifting platform just landed 💪 First 20 members to use it this week get a bonus stamp. First come, first served!",
            postType: 'post', likesCount: 28,
            likedBy: [users[2].uid, users[3].uid],
            pollOptions: null, pollVotes: null,
          },
          // User polls
          {
            authorUid: users[0].uid, authorName: users[0].name, authorPhoto: users[0].photo, authorRole: 'consumer',
            content: "Which local business deserves more love? 👇",
            postType: 'poll', likesCount: 8,
            likedBy: [users[1].uid, users[2].uid],
            pollOptions: [{ text: 'The Coffee House ☕' }, { text: 'Glow Beauty 💅' }, { text: 'Iron Gym 💪' }, { text: 'Urban Barber ✂️' }],
            pollVotes: { '0': [users[1].uid, users[2].uid], '1': [users[3].uid, users[4].uid], '2': [users[0].uid], '3': [] },
          },
          {
            authorUid: users[3].uid, authorName: users[3].name, authorPhoto: users[3].photo, authorRole: 'consumer',
            content: "What's your ideal loyalty reward? 🎁",
            postType: 'poll', likesCount: 12,
            likedBy: [users[0].uid, users[4].uid],
            pollOptions: [{ text: 'Free item / drink' }, { text: 'Percentage discount' }, { text: 'Bonus stamps' }, { text: 'Exclusive experience' }],
            pollVotes: { '0': [users[0].uid, users[2].uid], '1': [users[1].uid, users[3].uid], '2': [users[4].uid], '3': [] },
          },
          {
            authorUid: users[4].uid, authorName: users[4].name, authorPhoto: users[4].photo, authorRole: 'consumer',
            content: "How many loyalty cards are you actively collecting? 🃏",
            postType: 'poll', likesCount: 7,
            likedBy: [users[2].uid],
            pollOptions: [{ text: '1–2 cards' }, { text: '3–5 cards' }, { text: '6–10 cards' }, { text: '10+ (collector mode)' }],
            pollVotes: { '0': [users[3].uid], '1': [users[0].uid, users[1].uid, users[4].uid], '2': [users[2].uid], '3': [] },
          },
          // Vendor polls
          {
            authorUid: vendors[0].uid, authorName: vendors[0].name, authorPhoto: vendors[0].photo, authorRole: 'vendor',
            storeName: vendors[0].store,
            content: "Help us choose our next seasonal special! Vote below ☕👇",
            postType: 'poll', likesCount: 19,
            likedBy: [users[0].uid, users[1].uid, users[2].uid],
            pollOptions: [{ text: 'Pumpkin Spice Latte 🎃' }, { text: 'Iced Matcha Coconut 🍵' }, { text: 'Lavender Honey Flat White 🌸' }, { text: 'Chai Oat Bomb 🧡' }],
            pollVotes: { '0': [users[0].uid, users[3].uid], '1': [users[1].uid, users[4].uid], '2': [users[2].uid], '3': [] },
          },
          {
            authorUid: vendors[2].uid, authorName: vendors[2].name, authorPhoto: vendors[2].photo, authorRole: 'vendor',
            storeName: vendors[2].store,
            content: "We're extending opening hours! When would you use the gym most? 🏋️",
            postType: 'poll', likesCount: 23,
            likedBy: [users[2].uid, users[3].uid, users[4].uid],
            pollOptions: [{ text: 'Earlier mornings (5am)' }, { text: 'Late nights (until 11pm)' }, { text: 'Weekend afternoons' }, { text: 'All of the above!' }],
            pollVotes: { '0': [users[0].uid], '1': [users[1].uid, users[3].uid], '2': [users[2].uid], '3': [users[4].uid] },
          },
          {
            authorUid: vendors[3].uid, authorName: vendors[3].name, authorPhoto: vendors[3].photo, authorRole: 'vendor',
            storeName: vendors[3].store,
            content: "What new service should we add? Your vote decides! ✂️",
            postType: 'poll', likesCount: 15,
            likedBy: [users[0].uid, users[3].uid],
            pollOptions: [{ text: 'Hot towel shave' }, { text: 'Hair colouring' }, { text: 'Scalp treatment' }, { text: "Men's facials" }],
            pollVotes: { '0': [users[0].uid, users[1].uid], '1': [users[2].uid], '2': [users[3].uid, users[4].uid], '3': [] },
          },
        ];

        for (const post of posts) {
          await addDoc(collection(db, 'global_posts'), { ...post, createdAt: serverTimestamp() });
        }
      } catch (err) {
        console.error('Error seeding demo posts:', err);
      }
    };
    seedDemoPosts();
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setProfile(null);
        setProfileCollection(null);
        setNeedsEmailVerification(false);
        setNeedsOnboarding(false);
        setLoading(false);
        return;
      }

      setUser(firebaseUser);

      try {
        const isEmailProvider = firebaseUser.providerData.some(p => p.providerId === 'password');
        if (isEmailProvider && !firebaseUser.emailVerified) {
          setNeedsEmailVerification(true);
          setNeedsOnboarding(false);
          setLoading(false);
          return;
        }

        setNeedsEmailVerification(false);
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        const inUsers = userDoc.exists();
        const existingDoc = inUsers ? userDoc : await getDoc(doc(db, 'vendors', firebaseUser.uid));

        if (!existingDoc.exists()) {
          setNeedsOnboarding(true);
          setProfile(null);
        } else {
          const data = existingDoc.data();
          setProfileCollection(inUsers ? 'users' : 'vendors');
          setProfile(data as UserProfile);
          setNeedsOnboarding(!data.onboardingComplete);
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        setNeedsOnboarding(false);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // Handle email verification link opened in-app (handleCodeInApp: true)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const oobCode = params.get('oobCode');
    if (mode !== 'verifyEmail' || !oobCode) return;

    // Clear the action params from the URL immediately
    window.history.replaceState({}, document.title, window.location.pathname);

    applyActionCode(auth, oobCode)
      .then(async () => {
        const currentUser = auth.currentUser;
        if (currentUser) await currentUser.reload();
        setNeedsEmailVerification(false);
        const refreshed = auth.currentUser;
        if (!refreshed) return;
        const userDoc = await getDoc(doc(db, 'users', refreshed.uid));
        const inUsers = userDoc.exists();
        const existingDoc = inUsers ? userDoc : await getDoc(doc(db, 'vendors', refreshed.uid));
        if (!existingDoc.exists()) {
          setNeedsOnboarding(true);
        } else {
          const data = existingDoc.data();
          setProfileCollection(inUsers ? 'users' : 'vendors');
          setProfile(data as UserProfile);
          setNeedsOnboarding(!data.onboardingComplete);
        }
      })
      .catch((err) => {
        console.error('Email verification failed:', err);
      });
  }, []);

  // Handle ?stamp=STORE_ID URL opened by iOS NFC banner or shared link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const storeId = params.get('stamp');
    if (!storeId) return;
    window.history.replaceState({}, document.title, window.location.pathname);
    // Store in sessionStorage so it survives a login redirect
    sessionStorage.setItem('pendingNFCStamp', storeId);
    setPendingNFCStoreId(storeId);
  }, []);

  // Once user & profile are ready, re-check sessionStorage for a pending stamp
  useEffect(() => {
    if (!user || !profile || profile.role !== 'consumer') return;
    const stored = sessionStorage.getItem('pendingNFCStamp');
    if (stored) {
      sessionStorage.removeItem('pendingNFCStamp');
      setPendingNFCStoreId(stored);
    }
  }, [user?.uid, profile?.role]);

  const handleLogin = async (): Promise<string | null> => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      return null;
    } catch (error: any) {
      console.error("Login failed", error);
      if (error?.code === 'auth/account-exists-with-different-credential') {
        return 'This email is already registered. Please sign in with your email and password instead.';
      }
      if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
        return null;
      }
      return error?.message ?? 'Sign in failed';
    }
  };

  const handleEmailSignUp = async (email: string, password: string): Promise<string | null> => {
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      sendEmailVerification(credential.user).catch(console.error);
      setNeedsEmailVerification(true);
      return null;
    } catch (err: any) {
      return err?.message ?? 'Sign up failed';
    }
  };

  const handleEmailSignIn = async (email: string, password: string): Promise<string | null> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return null;
    } catch (err: any) {
      if (err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password' || err?.code === 'auth/user-not-found') {
        return 'Incorrect email or password';
      }
      return err?.message ?? 'Sign in failed';
    }
  };

  const handleResendVerification = async () => {
    if (user && !user.emailVerified) {
      sendEmailVerification(user).catch(console.error);
    }
  };

  const handleCheckVerification = async (): Promise<boolean> => {
    if (!user) return false;
    await user.reload();
    const refreshed = auth.currentUser;
    if (refreshed?.emailVerified) {
      setNeedsEmailVerification(false);
      const userDoc = await getDoc(doc(db, 'users', refreshed.uid));
      const inUsers = userDoc.exists();
      const existingDoc = inUsers ? userDoc : await getDoc(doc(db, 'vendors', refreshed.uid));
      if (!existingDoc.exists()) {
        setNeedsOnboarding(true);
      } else {
        const data = existingDoc.data();
        setProfileCollection(inUsers ? 'users' : 'vendors');
        setProfile(data as UserProfile);
        setNeedsOnboarding(!data.onboardingComplete);
      }
      return true;
    }
    return false;
  };

  const handleLogout = () => signOut(auth);

  const handleDeleteAccount = async () => {
    if (!user) return;
    const uid = user.uid;

    const tryDelete = async (fn: () => Promise<void>) => { try { await fn(); } catch (e) { console.warn('Delete step skipped:', e); } };

    // Global posts authored by user (+ their comments subcollections)
    await tryDelete(async () => {
      const snap = await getDocs(query(collection(db, 'global_posts'), where('authorUid', '==', uid)));
      await Promise.all(snap.docs.map(async d => {
        const comments = await getDocs(collection(db, 'global_posts', d.id, 'comments'));
        await Promise.all(comments.docs.map(c => deleteDoc(c.ref)));
        await deleteDoc(d.ref);
      }));
    });
    // Wall posts made TO this user by others
    await tryDelete(async () => {
      const snap = await getDocs(query(collection(db, 'global_posts'), where('toUid', '==', uid)));
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    });
    // Follows (both directions)
    await tryDelete(async () => {
      const [a, b] = await Promise.all([
        getDocs(query(collection(db, 'follows'), where('followerUid', '==', uid))),
        getDocs(query(collection(db, 'follows'), where('followingUid', '==', uid))),
      ]);
      await Promise.all([...a.docs, ...b.docs].map(d => deleteDoc(d.ref)));
    });
    // Store follows by this user
    await tryDelete(async () => {
      const snap = await getDocs(query(collection(db, 'store_follows'), where('followerUid', '==', uid)));
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    });
    // User wall reviews written by or to this user (+ likes/replies subcollections)
    await tryDelete(async () => {
      const [a, b] = await Promise.all([
        getDocs(query(collection(db, 'user_reviews'), where('fromUid', '==', uid))),
        getDocs(query(collection(db, 'user_reviews'), where('toUid', '==', uid))),
      ]);
      const unique = [...new Map([...a.docs, ...b.docs].map(d => [d.id, d])).values()];
      await Promise.all(unique.map(async d => {
        const [likes, replies] = await Promise.all([
          getDocs(collection(db, 'user_reviews', d.id, 'likes')),
          getDocs(collection(db, 'user_reviews', d.id, 'replies')),
        ]);
        await Promise.all([...likes.docs, ...replies.docs].map(s => deleteDoc(s.ref)));
        await deleteDoc(d.ref);
      }));
    });
    // Store reviews written by this user
    await tryDelete(async () => {
      const snap = await getDocs(query(collection(db, 'store_reviews'), where('authorUid', '==', uid)));
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    });
    // Loyalty cards held by this user
    await tryDelete(async () => {
      const snap = await getDocs(query(collection(db, 'cards'), where('user_id', '==', uid)));
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    });
    // Transaction history for this user
    await tryDelete(async () => {
      const snap = await getDocs(query(collection(db, 'transactions'), where('user_id', '==', uid)));
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    });
    // Stores owned by this user (+ all store sub-data)
    await tryDelete(async () => {
      const snap = await getDocs(query(collection(db, 'stores'), where('ownerUid', '==', uid)));
      await Promise.all(snap.docs.map(async (storeDoc) => {
        const sid = storeDoc.id;
        const [posts, storeReviews, storeFollows, storeCards, storeTxns] = await Promise.all([
          getDocs(collection(db, 'stores', sid, 'posts')),
          getDocs(query(collection(db, 'store_reviews'), where('storeId', '==', sid))),
          getDocs(query(collection(db, 'store_follows'), where('storeId', '==', sid))),
          getDocs(query(collection(db, 'cards'), where('store_id', '==', sid))),
          getDocs(query(collection(db, 'transactions'), where('store_id', '==', sid))),
        ]);
        await Promise.all([
          ...posts.docs, ...storeReviews.docs, ...storeFollows.docs,
          ...storeCards.docs, ...storeTxns.docs,
        ].map(d => deleteDoc(d.ref)));
        await deleteDoc(storeDoc.ref);
      }));
    });
    // Chats this user is part of (+ messages subcollections)
    await tryDelete(async () => {
      const snap = await getDocs(query(collection(db, 'chats'), where('uids', 'array-contains', uid)));
      await Promise.all(snap.docs.map(async chatDoc => {
        const messages = await getDocs(collection(db, 'chats', chatDoc.id, 'messages'));
        await Promise.all(messages.docs.map(d => deleteDoc(d.ref)));
        await deleteDoc(chatDoc.ref);
      }));
    });
    // Notifications sent to or from this user
    await tryDelete(async () => {
      const [a, b] = await Promise.all([
        getDocs(query(collection(db, 'notifications'), where('toUid', '==', uid))),
        getDocs(query(collection(db, 'notifications'), where('fromUid', '==', uid))),
      ]);
      await Promise.all([...a.docs, ...b.docs].map(d => deleteDoc(d.ref)));
    });
    // Profile documents
    await tryDelete(() => deleteDoc(doc(db, 'users', uid)));
    await tryDelete(() => deleteDoc(doc(db, 'vendors', uid)));

    // Delete the Firebase Auth record first (requires user to still be authenticated),
    // then sign out. If deletion fails (e.g. requires-recent-login), sign out anyway.
    try { await user.delete(); } catch { /* requires-recent-login or similar — auth account survives */ }
    await signOut(auth);
  };

  const handleOnboardingComplete = async (data: ConsumerOnboardingData | VendorOnboardingData) => {
    if (!user) return;
    if (data.type === 'consumer') {
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: data.name,
        handle: data.handle,
        email: user.email || '',
        photoURL: user.photoURL || '',
        role: 'consumer',
        onboardingComplete: true,
        ...(data.gender ? { gender: data.gender } : {}),
        ...(data.birthday ? { birthday: data.birthday } : {}),
        ...(data.location ? { location: data.location } : {}),
        total_cards_held: 0,
        totalStamps: 0,
        totalRedeemed: 0,
        avatar: randomStarterAvatar(),
      });
      setProfileCollection('users');
    } else {
      await setDoc(doc(db, 'vendors', user.uid), {
        uid: user.uid,
        name: user.displayName || data.businessName,
        email: user.email || '',
        photoURL: user.photoURL || '',
        role: 'vendor',
        onboardingComplete: true,
        total_cards_held: 0,
        totalStamps: 0,
        totalRedeemed: 0
      });
      await addDoc(collection(db, 'stores'), {
        name: data.businessName,
        category: data.category,
        address: data.address,
        phone: data.phone,
        description: data.description,
        ownerUid: user.uid,
        isVerified: false,
        stamps_required_for_reward: 10,
        rewardsGiven: 0,
        ...(data.location ? { lat: data.location.lat, lng: data.location.lng, location: data.location.city ?? '' } : {}),
      });
      setProfileCollection('vendors');
    }
    setNeedsOnboarding(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="w-12 h-12 text-brand-gold" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage onLogin={handleLogin} onEmailSignUp={handleEmailSignUp} onEmailSignIn={handleEmailSignIn} />;
  }

  if (needsEmailVerification) {
    return <EmailVerificationScreen user={user} onCheck={handleCheckVerification} onResend={handleResendVerification} onLogout={handleLogout} />;
  }

  if (needsOnboarding) {
    return <OnboardingScreen user={user} onComplete={handleOnboardingComplete} />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
          <Sparkles className="w-12 h-12 text-brand-gold" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 max-w-md mx-auto shadow-xl shadow-black/5 relative overflow-hidden bg-white">
      {/* Header */}
      <header className="glass-panel sticky top-0 z-50 px-5 py-3.5 flex items-center justify-between">
        <button
          onClick={() => setShowCreatePost(true)}
          className="w-9 h-9 gradient-red rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20 active:scale-95 transition-transform"
        >
          <Plus className="w-5 h-5 text-white" />
        </button>
        <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 gradient-red rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h1 className="font-display font-bold text-xl tracking-tight"><span className="text-brand-gold">Li</span>nq</h1>
        </button>
        <div className="flex items-center gap-0.5">
          {profile?.role === 'consumer' && (
            <button
              onClick={() => setActiveTab('messages')}
              className="relative w-9 h-9 flex items-center justify-center text-brand-navy/60 hover:text-brand-navy transition-colors"
            >
              <MessageCircle className="w-6 h-6" />
              {unreadMessages > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-brand-rose rounded-full border-2 border-white" />
              )}
            </button>
          )}
          <button
            onClick={() => setShowNotifications(true)}
            className="relative w-9 h-9 flex items-center justify-center text-brand-navy/60 hover:text-brand-navy transition-colors"
          >
            <Bell className="w-6 h-6" />
            {notifications.filter(n => !n.isRead).length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-brand-gold rounded-full border-2 border-white" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 pt-4 pb-8">
        <AnimatePresence mode="wait">
          {viewingStore ? (
            <StoreProfileView
              key="store-profile"
              store={viewingStore}
              onBack={() => setViewingStore(null)}
              user={user}
              profile={profile}
              onViewUser={handleViewUser}
              onMessage={(chatId) => {
                setActiveChatId(chatId);
                setActiveTab('messages');
                setViewingStore(null);
              }}
            />
          ) : viewingUser ? (
            <PublicUserProfile
              key="user-profile"
              targetUser={viewingUser}
              onBack={() => setViewingUser(null)}
              currentUser={user}
              currentProfile={profile}
              onViewUser={(u) => { setViewingUser(null); handleViewUser(u); }}
              onMessage={(chatId) => {
                setActiveChatId(chatId);
                setActiveTab('messages');
                setViewingUser(null);
              }}
              onViewStore={(s) => {
                setViewingUser(null);
                setViewingStore(s);
              }}
            />
          ) : profile?.role === 'consumer' ? (
            <ConsumerApp
              key="consumer"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              profile={profile}
              user={user}
              onViewStore={setViewingStore}
              onViewUser={handleViewUser}
              cards={userCards}
              notifications={notifications}
              activeChatId={activeChatId}
              setActiveChatId={setActiveChatId}
              onLogout={handleLogout}
              onDeleteAccount={handleDeleteAccount}
              pendingNFCStoreId={pendingNFCStoreId}
              onClearPendingNFC={() => setPendingNFCStoreId(null)}
            />
          ) : (
            <VendorApp
              key="vendor"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              profile={profile}
              user={user}
              onViewUser={handleViewUser}
              notifications={notifications}
              activeChatId={activeChatId}
              setActiveChatId={setActiveChatId}
              onLogout={handleLogout}
              onDeleteAccount={handleDeleteAccount}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Settings Menu */}
      <AnimatePresence>
        {showSettings && (
          <SettingsMenu
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            profile={profile}
            userCards={userCards}
            isAdmin={profile?.email === ADMIN_EMAIL}
            onOpenAdmin={() => { setShowSettings(false); setAdminView('menu'); }}
            onOpenStores={() => { setShowSettings(false); setAdminView('stores'); }}
          />
        )}
      </AnimatePresence>

      {/* Admin Panels */}
      <AnimatePresence>
        {adminView === 'menu' && (
          <AdminMenuModal
            onClose={() => setAdminView(null)}
            onOpenChallenges={() => setAdminView('challenges')}
            onOpenBadges={() => setAdminView('badges')}
            onOpenStores={() => setAdminView('stores')}
            onOpenUsers={() => setAdminView('users')}
            onOpenPosts={() => setAdminView('posts')}
          />
        )}
        {adminView === 'challenges' && (
          <ChallengesAdminPanel onClose={() => setAdminView('menu')} />
        )}
        {adminView === 'badges' && (
          <BadgesAdminPanel onClose={() => setAdminView('menu')} />
        )}
        {adminView === 'stores' && (
          <AdminStoresPanel onClose={() => setAdminView('menu')} />
        )}
        {adminView === 'users' && (
          <AdminUsersPanel onClose={() => setAdminView('menu')} />
        )}
        {adminView === 'posts' && (
          <AdminPostsPanel onClose={() => setAdminView('menu')} />
        )}
      </AnimatePresence>

      {/* Notifications Panel */}
      <AnimatePresence>
        {showNotifications && (
          <NotificationsPanel
            notifications={notifications}
            onClose={() => setShowNotifications(false)}
          />
        )}
      </AnimatePresence>

      {/* Create Post Modal */}
      <AnimatePresence>
        {showCreatePost && user && (
          <CreatePostModal
            onClose={() => setShowCreatePost(false)}
            user={user}
            profile={profile}
          />
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto glass-panel border-t border-black/5 px-4 py-4 flex justify-between items-center z-50">
        {profile?.role === 'consumer' && (
          <NavButton
            active={activeTab === 'for-you'}
            onClick={() => { setActiveTab('for-you'); setViewingStore(null); setViewingUser(null); }}
            icon={<Zap />}
            label="For You"
            badgeCount={notifications.filter(n => !n.isRead).length}
          />
        )}
        {profile?.role === 'consumer' ? (
          <NavButton
            active={activeTab === 'deals'}
            onClick={() => { setActiveTab('deals'); setViewingStore(null); setViewingUser(null); }}
            icon={<Tag />}
            label="Deals"
          />
        ) : (
          <NavButton
            active={activeTab === 'messages'}
            onClick={() => { setActiveTab('messages'); setViewingStore(null); setViewingUser(null); }}
            icon={<MessageCircle />}
            label="Messages"
            badgeCount={unreadMessages}
          />
        )}
        <NavButton 
          active={activeTab === 'home'} 
          onClick={() => { setActiveTab('home'); setViewingStore(null); setViewingUser(null); }}
          icon={profile?.role === 'consumer' ? <Wallet /> : <LayoutDashboard />}
          label={profile?.role === 'consumer' ? 'Wallet' : 'Dashboard'}
        />
        <NavButton 
          active={activeTab === 'discover'} 
          onClick={() => { setActiveTab('discover'); setViewingStore(null); setViewingUser(null); }}
          icon={profile?.role === 'consumer' ? <Compass /> : <Plus />}
          label={profile?.role === 'consumer' ? 'Discovery' : 'Issue'}
        />
        <NavButton 
          active={activeTab === 'profile'} 
          onClick={() => { setActiveTab('profile'); setViewingStore(null); setViewingUser(null); }}
          icon={<UserIcon />}
          label="Profile"
        />
      </nav>
    </div>
  );
}

// --- Shared Components ---

function LandingPage({ onLogin, onEmailSignUp, onEmailSignIn }: {
  onLogin: () => Promise<string | null>;
  onEmailSignUp: (email: string, password: string) => Promise<string | null>;
  onEmailSignIn: (email: string, password: string) => Promise<string | null>;
}) {
  const [mode, setMode] = React.useState<'home' | 'signin' | 'signup'>('home');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    const err = await onLogin();
    setLoading(false);
    if (err) setError(err);
  };

  const reset = (next: 'home' | 'signin' | 'signup') => {
    setError(''); setEmail(''); setPassword(''); setConfirmPassword(''); setMode(next);
  };

  const handleSubmit = async () => {
    setError('');
    if (!email.trim() || !password) { setError('Please fill in all fields'); return; }
    if (mode === 'signup') {
      if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
      if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    }
    setLoading(true);
    const err = mode === 'signup'
      ? await onEmailSignUp(email.trim(), password)
      : await onEmailSignIn(email.trim(), password);
    setLoading(false);
    if (err) setError(err);
  };

  const bg = { background: 'linear-gradient(160deg, #1e3a8a 0%, #1d4ed8 40%, #2563eb 70%, #3b82f6 100%)' };

  if (mode === 'home') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center" style={bg}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-black/20 border border-white/30">
            <Sparkles className="w-12 h-12 text-white" />
          </div>
          <h1 className="font-display text-4xl font-bold text-white mb-4">Linq</h1>
          <p className="text-white/60 text-lg max-w-xs mx-auto">Collect stamps, unlock rewards, and support your favourite local businesses.</p>
        </motion.div>
        <div className="w-full max-w-xs space-y-3">
          {error && (
            <div className="flex items-center gap-2 bg-white/15 border border-white/25 rounded-2xl px-4 py-3">
              <AlertCircle size={14} className="text-white/80 shrink-0" />
              <p className="text-white/80 text-xs">{error}</p>
            </div>
          )}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-white text-brand-navy font-bold py-4 rounded-2xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg disabled:opacity-60"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="" />
            Continue with Google
          </button>
          <button
            onClick={() => reset('signup')}
            className="w-full bg-white/15 backdrop-blur-sm text-white font-bold py-4 rounded-2xl hover:bg-white/25 transition-all border border-white/20"
          >
            Create Account
          </button>
          <button
            onClick={() => reset('signin')}
            className="w-full text-white/60 text-sm py-2 hover:text-white transition-colors"
          >
            Already have an account? Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col px-8" style={bg}>
      <button onClick={() => reset('home')} className="flex items-center gap-2 text-white/70 hover:text-white transition-colors pt-14 mb-8">
        <ArrowLeft size={18} />
        <span className="text-sm font-medium">Back</span>
      </button>

      <div className="flex-1 flex flex-col justify-center max-w-xs mx-auto w-full">
        <div className="mb-8">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
            {mode === 'signup' ? <UserCheck className="w-7 h-7 text-white" /> : <Lock className="w-7 h-7 text-white" />}
          </div>
          <h2 className="font-display font-bold text-2xl text-white mb-1">
            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="text-white/50 text-sm">
            {mode === 'signup' ? 'We\'ll send a verification email to confirm your address' : 'Sign in to continue to Linq'}
          </p>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email address"
              autoComplete="email"
              className="w-full pl-10 pr-5 py-4 rounded-2xl bg-white/15 border border-white/20 text-white placeholder:text-white/40 text-sm focus:outline-none focus:border-white/50 focus:bg-white/20"
            />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              onKeyDown={e => e.key === 'Enter' && !confirmPassword && handleSubmit()}
              className="w-full pl-10 pr-12 py-4 rounded-2xl bg-white/15 border border-white/20 text-white placeholder:text-white/40 text-sm focus:outline-none focus:border-white/50 focus:bg-white/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {mode === 'signup' && (
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                autoComplete="new-password"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="w-full pl-10 pr-5 py-4 rounded-2xl bg-white/15 border border-white/20 text-white placeholder:text-white/40 text-sm focus:outline-none focus:border-white/50 focus:bg-white/20"
              />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-white/15 border border-white/25 rounded-2xl px-4 py-3">
              <AlertCircle size={14} className="text-white/80 shrink-0" />
              <p className="text-white/80 text-xs">{error}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-white text-brand-navy font-bold py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
          >
            {loading
              ? <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Sparkles size={16} /></motion.div> Please wait…</>
              : mode === 'signup' ? 'Create Account' : 'Sign In'}
          </button>

          <div className="flex items-center gap-3 py-2">
            <div className="flex-1 h-px bg-white/20" />
            <span className="text-white/30 text-xs">or</span>
            <div className="flex-1 h-px bg-white/20" />
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-white/10 border border-white/20 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-white/20 transition-all disabled:opacity-60"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="" />
            Continue with Google
          </button>

          <button
            onClick={() => reset(mode === 'signup' ? 'signin' : 'signup')}
            className="w-full text-white/50 text-sm py-2 hover:text-white/80 transition-colors"
          >
            {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmailVerificationScreen({ user, onCheck, onResend, onLogout }: {
  user: FirebaseUser;
  onCheck: () => Promise<boolean>;
  onResend: () => Promise<void>;
  onLogout: () => void;
}) {
  const [checking, setChecking] = React.useState(false);
  const [resent, setResent] = React.useState(false);
  const [notVerified, setNotVerified] = React.useState(false);

  const handleCheck = async () => {
    setChecking(true);
    setNotVerified(false);
    const verified = await onCheck();
    if (!verified) setNotVerified(true);
    setChecking(false);
  };

  const handleResend = async () => {
    await onResend();
    setResent(true);
    setTimeout(() => setResent(false), 4000);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center bg-brand-bg">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-xs w-full">
        <div className="w-16 h-16 bg-brand-gold/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Mail className="w-8 h-8 text-brand-gold" />
        </div>
        <h2 className="font-display font-bold text-2xl text-brand-navy mb-2">Check your inbox</h2>
        <p className="text-brand-navy/50 text-sm mb-2">
          We sent a verification email to
        </p>
        <p className="font-bold text-brand-navy text-sm mb-8">{user.email}</p>
        <p className="text-brand-navy/40 text-xs mb-8">Click the link in the email, then come back here and tap the button below.</p>

        {notVerified && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4">
            <AlertCircle size={14} className="text-amber-500 shrink-0" />
            <p className="text-amber-700 text-xs text-left">Email not verified yet. Please click the link in your email first.</p>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleCheck}
            disabled={checking}
            className="w-full py-4 rounded-2xl bg-brand-navy text-white font-bold text-sm active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {checking
              ? <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Sparkles size={16} /></motion.div> Checking…</>
              : <><CheckCircle2 size={16} /> I've verified my email</>}
          </button>

          <button
            onClick={handleResend}
            disabled={resent}
            className="w-full py-3 text-sm text-brand-navy/50 hover:text-brand-navy/80 transition-colors disabled:opacity-50"
          >
            {resent ? 'Email sent!' : 'Resend verification email'}
          </button>

          <button onClick={onLogout} className="w-full py-3 text-xs text-brand-navy/30 hover:text-brand-navy/50 transition-colors">
            Sign out
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function LocationStep({ locationData, locationStatus, onRequest }: {
  locationData: { lat: number; lng: number; city?: string } | null;
  locationStatus: 'idle' | 'requesting' | 'granted' | 'denied';
  onRequest: () => void;
}) {
  return (
    <div className="w-full">
      {locationStatus === 'idle' && (
        <button
          onClick={onRequest}
          className="w-full py-4 px-5 rounded-2xl bg-brand-navy text-white font-bold flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-lg shadow-brand-navy/20"
        >
          <MapPin size={18} />
          Allow Location Access
        </button>
      )}
      {locationStatus === 'requesting' && (
        <div className="flex items-center justify-center gap-3 py-4 text-brand-navy/50">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
            <Sparkles size={18} className="text-brand-gold" />
          </motion.div>
          <span className="font-medium text-sm">Requesting access…</span>
        </div>
      )}
      {locationStatus === 'granted' && (
        <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
            <MapPin size={18} className="text-green-600" />
          </div>
          <div className="text-left">
            <p className="font-bold text-green-700 text-sm">Location allowed</p>
            {locationData?.city && <p className="text-xs text-green-600/70 mt-0.5">{locationData.city}</p>}
          </div>
        </div>
      )}
      {locationStatus === 'denied' && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 text-center">
          <p className="font-bold text-amber-700 text-sm">Location access denied</p>
          <p className="text-xs text-amber-600/70 mt-1">You can enable it later in your device settings</p>
        </div>
      )}
    </div>
  );
}

function OnboardingScreen({ user, onComplete }: {
  user: FirebaseUser;
  onComplete: (data: ConsumerOnboardingData | VendorOnboardingData) => Promise<void>;
}) {
  const [role, setRole] = React.useState<'consumer' | 'vendor' | null>(null);
  const isVendor = role === 'vendor';
  // Step 0 = role selection; steps 1-4 = role-specific details
  const TOTAL_STEPS = 5;

  const [step, setStep] = React.useState(0);
  const [saving, setSaving] = React.useState(false);

  // Consumer fields
  const [fullName, setFullName] = React.useState('');
  const [handle, setHandle] = React.useState('');
  const [handleError, setHandleError] = React.useState('');
  const [handleChecking, setHandleChecking] = React.useState(false);
  const [gender, setGender] = React.useState('');
  const [birthday, setBirthday] = React.useState('');

  // Vendor fields
  const [businessName, setBusinessName] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [description, setDescription] = React.useState('');

  // Shared
  const [locationData, setLocationData] = React.useState<{ lat: number; lng: number; city?: string } | null>(null);
  const [locationStatus, setLocationStatus] = React.useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');

  const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
  const CATEGORIES: Category[] = ['Food', 'Beauty', 'Barber', 'Gym', 'Parking', 'Retail'];

  const requestLocation = () => {
    setLocationStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        let city: string | undefined;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
          const json = await res.json();
          city = json.address?.city || json.address?.town || json.address?.village;
        } catch {}
        setLocationData({ lat, lng, city });
        setLocationStatus('granted');
      },
      () => setLocationStatus('denied'),
      { timeout: 10000 }
    );
  };

  const canAdvance =
    step === 0 ? role !== null
    : isVendor
      ? step === 1 ? businessName.trim().length > 0
      : step === 2 ? !!category
      : step === 3 ? address.trim().length > 0 && phone.trim().length > 0
      : locationStatus === 'granted' || locationStatus === 'denied'
    : step === 1 ? fullName.trim().length > 0 && handle.trim().length >= 3 && !handleError && !handleChecking
      : step === 2 ? !!gender
      : step === 3 ? !!birthday
      : locationStatus === 'granted' || locationStatus === 'denied';

  const validateHandle = (val: string) => {
    const clean = val.toLowerCase().replace(/\s/g, '');
    setHandle(clean);
    if (clean.length > 0 && clean.length < 3) { setHandleError('Handle must be at least 3 characters'); setHandleChecking(false); return; }
    if (!/^[a-z0-9_]*$/.test(clean)) { setHandleError('Only letters, numbers and underscores'); setHandleChecking(false); return; }
    if (clean.length >= 3) { setHandleError(''); setHandleChecking(true); }
    else { setHandleError(''); setHandleChecking(false); }
  };

  React.useEffect(() => {
    if (!handleChecking || handle.length < 3) return;
    const timer = setTimeout(async () => {
      try {
        const snap = await getDocs(query(collection(db, 'users'), where('handle', '==', handle)));
        if (!snap.empty) setHandleError('This handle is already taken');
        else setHandleError('');
      } catch { setHandleError(''); }
      setHandleChecking(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [handle, handleChecking]);

  const handleFinish = async () => {
    setSaving(true);
    if (isVendor) {
      await onComplete({ type: 'vendor', businessName, category, address, phone, description, location: locationData });
    } else {
      await onComplete({ type: 'consumer', name: fullName.trim(), handle, gender, birthday, location: locationData });
    }
  };

  const consumerSteps = [
    // Step 0 — Identity (name + handle)
    <>
      <div className="w-14 h-14 bg-brand-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <UserCheck className="w-7 h-7 text-brand-gold" />
      </div>
      <h2 className="font-display font-bold text-2xl text-brand-navy mb-1">Set up your profile</h2>
      <p className="text-sm text-brand-navy/40 mb-8">Your name and handle help businesses and friends recognise you</p>
      <div className="w-full space-y-3 text-left">
        <div>
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Full name"
            className="w-full px-5 py-4 rounded-2xl bg-white border-2 border-brand-navy/10 text-brand-navy font-bold text-base focus:outline-none focus:border-brand-gold/60 placeholder:font-normal placeholder:text-brand-navy/30"
          />
        </div>
        <div>
          <div className="relative">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-navy/40 font-bold text-sm">@</span>
            <input
              type="text"
              value={handle}
              onChange={e => validateHandle(e.target.value)}
              placeholder="yourhandle"
              className={`w-full pl-9 pr-8 py-4 rounded-2xl bg-white border-2 text-brand-navy text-sm font-medium focus:outline-none focus:border-brand-gold/60 placeholder:text-brand-navy/30 ${handleError ? 'border-red-300' : handle.length >= 3 && !handleChecking && !handleError ? 'border-green-400' : 'border-brand-navy/10'}`}
            />
            {handle.length >= 3 && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2">
                {handleChecking
                  ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Sparkles size={13} className="text-brand-navy/30" /></motion.div>
                  : handleError ? <AlertCircle size={13} className="text-red-400" />
                  : <CheckCircle2 size={13} className="text-green-500" />}
              </span>
            )}
          </div>
          {handleError ? (
            <p className="text-xs text-red-500 mt-1.5 pl-1">{handleError}</p>
          ) : handleChecking ? (
            <p className="text-xs text-brand-navy/30 mt-1.5 pl-1">Checking availability…</p>
          ) : handle.length >= 3 ? (
            <p className="text-xs text-green-500 mt-1.5 pl-1">@{handle} is available</p>
          ) : (
            <p className="text-xs text-brand-navy/30 mt-1.5 pl-1">This cannot be changed later</p>
          )}
        </div>
      </div>
    </>,
    // Step 1 — Gender
    <>
      <div className="w-14 h-14 bg-brand-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <UserCheck className="w-7 h-7 text-brand-gold" />
      </div>
      <h2 className="font-display font-bold text-2xl text-brand-navy mb-1">What's your gender?</h2>
      <p className="text-sm text-brand-navy/40 mb-8">Help us personalise your experience</p>
      <div className="w-full space-y-3">
        {GENDERS.map(g => (
          <button
            key={g}
            onClick={() => setGender(g)}
            className={`w-full py-4 px-5 rounded-2xl font-bold text-sm flex items-center justify-between transition-all active:scale-[0.98] ${
              gender === g ? 'bg-brand-navy text-white shadow-lg shadow-brand-navy/20' : 'bg-white border-2 border-brand-navy/10 text-brand-navy hover:border-brand-gold/40'
            }`}
          >
            {g}
            {gender === g && <Sparkles size={16} className="text-brand-gold" />}
          </button>
        ))}
      </div>
    </>,
    // Step 1 — Birthday
    <>
      <div className="w-14 h-14 bg-brand-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <Calendar className="w-7 h-7 text-brand-gold" />
      </div>
      <h2 className="font-display font-bold text-2xl text-brand-navy mb-1">When's your birthday?</h2>
      <p className="text-sm text-brand-navy/40 mb-8">Get exclusive birthday rewards from businesses</p>
      <div className="w-full">
        <input
          type="date"
          value={birthday}
          onChange={e => setBirthday(e.target.value)}
          max={new Date().toISOString().split('T')[0]}
          className="w-full px-5 py-4 rounded-2xl bg-white border-2 border-brand-navy/10 text-brand-navy font-bold text-base focus:outline-none focus:border-brand-gold/60 text-center"
        />
      </div>
    </>,
    // Step 2 — Location
    <>
      <div className="w-14 h-14 bg-brand-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <MapPin className="w-7 h-7 text-brand-gold" />
      </div>
      <h2 className="font-display font-bold text-2xl text-brand-navy mb-1">Find nearby deals</h2>
      <p className="text-sm text-brand-navy/40 mb-8">Allow location access to discover businesses around you</p>
      <LocationStep locationData={locationData} locationStatus={locationStatus} onRequest={requestLocation} />
    </>
  ];

  const vendorSteps = [
    // Step 0 — Business Name
    <>
      <div className="w-14 h-14 bg-brand-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <Building2 className="w-7 h-7 text-brand-gold" />
      </div>
      <h2 className="font-display font-bold text-2xl text-brand-navy mb-1">Your business name</h2>
      <p className="text-sm text-brand-navy/40 mb-8">This is how customers will find you on Linq</p>
      <div className="w-full space-y-3">
        <input
          type="text"
          value={businessName}
          onChange={e => setBusinessName(e.target.value)}
          placeholder="e.g. The Coffee House"
          className="w-full px-5 py-4 rounded-2xl bg-white border-2 border-brand-navy/10 text-brand-navy font-bold text-base focus:outline-none focus:border-brand-gold/60 placeholder:font-normal placeholder:text-brand-navy/30"
        />
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Short description of your business (optional)"
          rows={3}
          className="w-full px-5 py-4 rounded-2xl bg-white border-2 border-brand-navy/10 text-brand-navy text-sm focus:outline-none focus:border-brand-gold/60 placeholder:text-brand-navy/30 resize-none"
        />
      </div>
    </>,
    // Step 1 — Category
    <>
      <div className="w-14 h-14 bg-brand-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <Hash className="w-7 h-7 text-brand-gold" />
      </div>
      <h2 className="font-display font-bold text-2xl text-brand-navy mb-1">Business category</h2>
      <p className="text-sm text-brand-navy/40 mb-8">Help customers find you in the right section</p>
      <div className="w-full grid grid-cols-2 gap-3">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`py-4 px-4 rounded-2xl font-bold text-sm flex items-center justify-between transition-all active:scale-[0.98] ${
              category === cat ? 'bg-brand-navy text-white shadow-lg shadow-brand-navy/20' : 'bg-white border-2 border-brand-navy/10 text-brand-navy hover:border-brand-gold/40'
            }`}
          >
            {cat}
            {category === cat && <Sparkles size={14} className="text-brand-gold" />}
          </button>
        ))}
      </div>
    </>,
    // Step 2 — Contact & Address
    <>
      <div className="w-14 h-14 bg-brand-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <Phone className="w-7 h-7 text-brand-gold" />
      </div>
      <h2 className="font-display font-bold text-2xl text-brand-navy mb-1">Contact details</h2>
      <p className="text-sm text-brand-navy/40 mb-8">Your address and phone number for customers</p>
      <div className="w-full space-y-3">
        <div className="relative">
          <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-navy/30" />
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Business address"
            className="w-full pl-10 pr-5 py-4 rounded-2xl bg-white border-2 border-brand-navy/10 text-brand-navy text-sm focus:outline-none focus:border-brand-gold/60 placeholder:text-brand-navy/30"
          />
        </div>
        <div className="relative">
          <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-navy/30" />
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="Phone number"
            className="w-full pl-10 pr-5 py-4 rounded-2xl bg-white border-2 border-brand-navy/10 text-brand-navy text-sm focus:outline-none focus:border-brand-gold/60 placeholder:text-brand-navy/30"
          />
        </div>
      </div>
    </>,
    // Step 3 — Location (GPS)
    <>
      <div className="w-14 h-14 bg-brand-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <MapPin className="w-7 h-7 text-brand-gold" />
      </div>
      <h2 className="font-display font-bold text-2xl text-brand-navy mb-1">Pin your location</h2>
      <p className="text-sm text-brand-navy/40 mb-8">Allow location access so customers nearby can discover you</p>
      <LocationStep locationData={locationData} locationStatus={locationStatus} onRequest={requestLocation} />
    </>
  ];

  const roleStep = (
    <>
      <div className="w-14 h-14 gradient-red rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
        <Sparkles className="w-7 h-7 text-white" />
      </div>
      <h2 className="font-display font-bold text-2xl text-brand-navy mb-1">Welcome to <span className="text-brand-gold">Li</span>nq</h2>
      <p className="text-sm text-brand-navy/40 mb-8">How would you like to use Linq?</p>
      <div className="w-full space-y-4">
        <button
          onClick={() => setRole('consumer')}
          className={`w-full rounded-[2rem] p-6 text-left flex items-center gap-4 transition-all active:scale-[0.98] border-2 ${role === 'consumer' ? 'bg-brand-gold/5 border-brand-gold shadow-md' : 'bg-white border-brand-navy/10 hover:border-brand-gold/40'}`}
        >
          <div className="w-12 h-12 bg-brand-gold/10 rounded-2xl flex items-center justify-center shrink-0">
            <Wallet className="w-6 h-6 text-brand-gold" />
          </div>
          <div>
            <p className="font-bold text-brand-navy text-base">I'm a Customer</p>
            <p className="text-xs text-brand-navy/40 mt-0.5">Collect stamps & earn rewards</p>
          </div>
          {role === 'consumer' && <CheckCircle2 className="w-5 h-5 text-brand-gold ml-auto shrink-0" />}
        </button>
        <button
          onClick={() => setRole('vendor')}
          className={`w-full rounded-[2rem] p-6 text-left flex items-center gap-4 transition-all active:scale-[0.98] ${role === 'vendor' ? 'bg-brand-navy opacity-100' : 'bg-brand-navy opacity-80 hover:opacity-100'}`}
        >
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-base">I'm a Business</p>
            <p className="text-xs text-white/50 mt-0.5">Run a loyalty programme</p>
          </div>
          {role === 'vendor' && <CheckCircle2 className="w-5 h-5 text-white ml-auto shrink-0" />}
        </button>
      </div>
    </>
  );

  const stepContent = [roleStep, ...(isVendor ? vendorSteps : consumerSteps)];
  const isLastStep = step === TOTAL_STEPS - 1;

  return (
    <div className="min-h-screen flex flex-col bg-brand-bg px-8">
      <div className="flex items-center justify-center gap-2 pt-14 mb-10">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all ${i === step ? 'w-8 h-2 bg-brand-navy' : i < step ? 'w-2 h-2 bg-brand-navy/40' : 'w-2 h-2 bg-brand-navy/15'}`}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center text-center max-w-xs mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
            className="w-full"
          >
            {stepContent[step]}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="pb-12 max-w-xs mx-auto w-full space-y-3">
        <button
          onClick={() => {
            if (!isLastStep) setStep(s => s + 1);
            else handleFinish();
          }}
          disabled={!canAdvance || saving}
          className="w-full py-4 rounded-2xl bg-brand-navy text-white font-bold text-sm active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {saving
            ? <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Sparkles size={16} /></motion.div> Setting up…</>
            : !isLastStep ? 'Continue' : isVendor ? 'Launch My Business' : 'Get Started'}
        </button>
        {step > 1 && !isLastStep && !isVendor && (
          <button onClick={() => setStep(s => s + 1)} className="w-full py-3 text-xs text-brand-navy/30 hover:text-brand-navy/50 transition-colors">
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}

async function awardAvatarItem(uid: string, itemId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), { 'avatar.inventory': arrayUnion(itemId) });
  } catch (err) {
    console.error('awardAvatarItem error:', err);
  }
}

// Bumps the user's daily streak by 1 (max once per day, resets if a day is missed).
// Returns the current streak count so it can be denormalised into documents.
async function bumpStreak(uid: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return 0;
    const d = snap.data();
    if (d.lastStreakDate === today) return d.streak || 0;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const newStreak = d.lastStreakDate === yesterday ? (d.streak || 0) + 1 : 1;
    await updateDoc(doc(db, 'users', uid), { streak: newStreak, lastStreakDate: today });
    return newStreak;
  } catch {
    return 0;
  }
}

function StreakBadge({ streak, size = 'sm' }: { streak?: number; size?: 'sm' | 'lg' }) {
  if (!streak || streak <= 0) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 font-bold text-orange-500 leading-none shrink-0 ${size === 'lg' ? 'text-2xl' : 'text-[11px]'}`}>
      🔥{streak}
    </span>
  );
}

// Increment challenge entry count for qualifying standard challenges when a stamp is issued.
// Called from both NFC stamp and vendor manual stamp flows.
async function updateChallengeProgress(customerUid: string, storeId: string, qty: number) {
  try {
    const entriesSnap = await getDocs(
      query(collection(db, 'challenge_entries'), where('uid', '==', customerUid))
    );
    if (entriesSnap.empty) return;

    await Promise.all(entriesSnap.docs.map(async entryDoc => {
      const entryData = entryDoc.data() as { challengeId: string; count?: number };
      const { challengeId } = entryData;
      if (!challengeId) return;
      const challengeSnap = await getDoc(doc(db, 'challenges', challengeId));
      if (!challengeSnap.exists()) return;
      const c = challengeSnap.data();
      if (c.type !== 'standard' || c.status !== 'active') return;
      if (c.vendorIds?.length && !c.vendorIds.includes(storeId)) return;
      const prevCount = entryData.count ?? 0;
      await updateDoc(entryDoc.ref, { count: increment(qty) });
      // Award avatar item prize on first completion
      if (c.isAvatarPrize && c.avatarPrizeItemId && prevCount < c.goal && prevCount + qty >= c.goal) {
        awardAvatarItem(customerUid, c.avatarPrizeItemId).catch(console.error);
      }
    }));
  } catch (err) {
    console.error('updateChallengeProgress error:', err);
  }
}

function NavButton({ active, onClick, icon, label, badgeCount }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, badgeCount?: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-all relative",
        active ? "text-white" : "text-brand-navy/40 hover:text-brand-navy/60"
      )}
    >
      <div className={cn(
        "p-2 rounded-xl transition-all",
        active ? "gradient-red shadow-md shadow-blue-500/20" : ""
      )}>
        {React.cloneElement(icon as React.ReactElement, { size: 24 })}
      </div>
      <span className={cn("text-[10px] font-bold uppercase tracking-wider", active && "text-brand-gold")}>{label}</span>
      {badgeCount !== undefined && badgeCount > 0 && (
        <span className="absolute top-0 right-2 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center border-2 border-white">
          {badgeCount > 9 ? '9+' : badgeCount}
        </span>
      )}
    </button>
  );
}

// --- Sticker issuance (triggered by stamp collection — 1 stamp = 1 sticker per active programme) ---

async function issueStickersToCard(customerUid: string, userName: string, qty: number): Promise<CollectibleSticker[]> {
  const joinedSnap = await getDocs(query(collection(db, 'sticker_cards'), where('user_id', '==', customerUid)));
  if (joinedSnap.empty) return [];
  const programmeIds = [...new Set(joinedSnap.docs.map(d => d.data().programme_id as string))];
  const chancesMap = new Map<string, { brown: number; lightblue: number; red: number; blue: number; gold: number } | undefined>();
  const activeProgrammeIds = new Set<string>();
  await Promise.all(programmeIds.map(async pid => {
    const snap = await getDoc(doc(db, 'challenges', pid));
    if (snap.exists() && snap.data().status === 'active') {
      chancesMap.set(pid, snap.data().tierChances);
      activeProgrammeIds.add(pid);
    }
  }));
  const allNew: CollectibleSticker[] = [];
  for (const cardDoc of joinedSnap.docs) {
    if (!activeProgrammeIds.has(cardDoc.data().programme_id)) continue;
    const chances = chancesMap.get(cardDoc.data().programme_id);
    const newStickers: CollectibleSticker[] = Array.from({ length: qty }, () => {
      const tier = rollStickerTier(chances);
      return { id: Math.random().toString(36).slice(2), tier, variant: rollStickerVariant(tier), earnedAt: new Date().toISOString() };
    });
    await updateDoc(cardDoc.ref, { stickers: arrayUnion(...newStickers), userName });
    allNew.push(...newStickers);
  }
  return allNew;
}

// --- Global user sticker collection (every stamp always issues 3 stickers here) ---

async function issueUserStickers(uid: string, userName: string, qty: number): Promise<CollectibleSticker[]> {
  const newStickers: CollectibleSticker[] = Array.from({ length: qty }, () => {
    const tier = rollStickerTier();
    return { id: Math.random().toString(36).slice(2), tier, variant: rollStickerVariant(tier), earnedAt: new Date().toISOString() };
  });
  const ref = doc(db, 'user_stickers', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, { stickers: arrayUnion(...newStickers), userName });
  } else {
    await setDoc(ref, { userId: uid, userName, stickers: newStickers, revealedIds: [], uniqueTiers: [] });
  }
  return newStickers;
}

// --- Sticker Card (flip reveal) ---

function StickerCard({ sticker, isRevealed, onReveal, size = 'md' }: {
  sticker: CollectibleSticker;
  isRevealed: boolean;
  onReveal?: () => void;
  size?: 'sm' | 'md';
  key?: React.Key;
}) {
  const [localRevealed, setLocalRevealed] = useState(isRevealed);
  const [animating, setAnimating] = useState(false);
  const cfg = STICKER_CONFIG[sticker.tier];

  useEffect(() => { if (isRevealed) setLocalRevealed(true); }, [isRevealed]);

  const dims = size === 'sm' ? { w: 60, h: 80 } : { w: 80, h: 108 };

  const handleTap = () => {
    if (localRevealed || !onReveal || animating) return;
    setAnimating(true);
  };

  return (
    <motion.div
      onClick={handleTap}
      animate={animating ? { scale: [1, 1.22, 0.83, 1.1, 1] } : { scale: 1 }}
      transition={{ duration: 0.4 }}
      onAnimationComplete={() => {
        if (animating) {
          setAnimating(false);
          setLocalRevealed(true);
          onReveal?.();
        }
      }}
      style={{ width: dims.w, height: dims.h, perspective: '800px', flexShrink: 0, cursor: localRevealed ? 'default' : 'pointer' }}
      className="relative"
    >
      <motion.div
        animate={{ rotateY: localRevealed ? 180 : 0 }}
        transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
        style={{ transformStyle: 'preserve-3d', width: '100%', height: '100%', position: 'relative' }}
      >
        {/* Front — grey mystery */}
        <div style={{
          position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
          background: 'linear-gradient(135deg, #F8FAFC, #E2E8F0)',
          border: '2px solid #CBD5E1', borderRadius: 16,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}>
          <span style={{ fontSize: 30, fontWeight: 900, color: '#94A3B8' }}>?</span>
          {!localRevealed && <span style={{ fontSize: 8, color: '#94A3B8', fontWeight: 600 }}>Tap to reveal</span>}
        </div>
        {/* Back — Emoji card */}
        <div style={{
          position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          background: 'white',
          border: `2px solid ${cfg.border}`, borderRadius: 16,
          boxShadow: `0 4px 20px ${cfg.color}33`,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ background: cfg.solid, height: '60%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: size === 'sm' ? 28 : 36, lineHeight: 1 }}>
              {cfg.variants[sticker.variant ?? 0]?.emoji ?? cfg.variants[0].emoji}
            </span>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, padding: '2px 4px' }}>
            <span style={{ fontSize: size === 'sm' ? 7 : 8, fontWeight: 900, color: cfg.color, textAlign: 'center', lineHeight: 1.1 }}>
              {cfg.variants[sticker.variant ?? 0]?.name ?? cfg.variants[0].name}
            </span>
            <span style={{ fontSize: size === 'sm' ? 6 : 7, color: cfg.color, opacity: 0.65, fontWeight: 700 }}>{cfg.label}</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// --- Sticker Collection Modal (per-store sticker card, mirrors loyalty card modal) ---

function CountUpValue({ value, prefix = '£', className = '' }: { value: number; prefix?: string; className?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 1200;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) requestAnimationFrame(tick);
      else setDisplay(value);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <span className={className}>{prefix}{display.toFixed(2)}</span>;
}

function StickerCollectionModal({ stickerCard: initialCard, programme, onClose }: {
  stickerCard: StickerCardDoc;
  programme?: Challenge;
  onClose: () => void;
  key?: React.Key;
}) {
  const [liveCard, setLiveCard] = useState<StickerCardDoc>(initialCard);

  useEffect(() => {
    return onSnapshot(doc(db, 'sticker_cards', initialCard.id), snap => {
      if (snap.exists()) setLiveCard({ id: snap.id, ...snap.data() } as StickerCardDoc);
    });
  }, [initialCard.id]);

  const stickerCard = liveCard;
  const unrevealed = stickerCard.stickers.filter(s => !(stickerCard.revealedIds || []).includes(s.id));
  const revealed = stickerCard.stickers.filter(s => (stickerCard.revealedIds || []).includes(s.id));
  const myTotalSets = totalSetsCompleted(revealed);
  const myWon = allSetsWon(revealed);
  const [showAllRevealed, setShowAllRevealed] = useState(false);
  const [topPlayers, setTopPlayers] = useState<{ uid: string; userName?: string; userPhoto?: string; uniqueCards: number; stickers: number }[]>([]);

  useEffect(() => {
    if (!programme?.id) return;
    const totalUnique = STICKER_ORDER.reduce((s, t) => s + STICKER_CONFIG[t].variants.length, 0);
    getDocs(query(collection(db, 'sticker_cards'), where('programme_id', '==', programme.id))).then(snap => {
      const entries = snap.docs.map(d => {
        const data = d.data();
        const revealedIds = (data.revealedIds || []) as string[];
        const allStickers = (data.stickers || []) as CollectibleSticker[];
        const revealedStickers = allStickers.filter(s => revealedIds.includes(s.id));
        const uniqueCards = STICKER_ORDER.reduce((sum, tier) =>
          sum + STICKER_CONFIG[tier].variants.filter((_, vi) =>
            revealedStickers.some(s => s.tier === tier && (s.variant ?? 0) === vi)
          ).length, 0);
        return {
          uid: data.user_id as string,
          userName: data.userName as string | undefined,
          userPhoto: data.userPhoto as string | undefined,
          uniqueCards,
          stickers: allStickers.length,
        };
      });
      entries.sort((a, b) => b.uniqueCards !== a.uniqueCards ? b.uniqueCards - a.uniqueCards : b.stickers - a.stickers);
      setTopPlayers(entries.slice(0, 5));
    });
  }, [programme?.id]);

  const reversedRevealed = [...revealed].reverse();
  const displayedRevealed = showAllRevealed ? reversedRevealed : reversedRevealed.slice(0, 5);

  const handleReveal = async (stickerId: string) => {
    const cardRef = doc(db, 'sticker_cards', stickerCard.id);
    await updateDoc(cardRef, { revealedIds: arrayUnion(stickerId) });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-0 z-[250] flex flex-col max-w-md mx-auto"
      >
        <button onClick={onClose} className="flex-shrink-0 h-16 w-full" />
        <div className="flex-1 bg-brand-bg rounded-t-[2.5rem] shadow-2xl flex flex-col overflow-hidden">
          {/* Header lives outside the scroll container so nothing can paint over it */}
          <div className="bg-brand-bg px-5 pt-5 pb-4 border-b border-black/5 flex-shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="font-display text-xl font-bold text-brand-navy">
                  {programme?.title || 'Sticker Collection'}
                </h2>
                <p className="text-xs text-brand-navy/50 mt-0.5">
                  {stickerCard.stickers.length} sticker{stickerCard.stickers.length !== 1 ? 's' : ''} collected
                </p>
              </div>
              <button onClick={onClose} className="p-2 rounded-2xl bg-white border border-black/5 shadow-sm flex-shrink-0">
                <X size={18} className="text-brand-navy/60" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-7">
            {topPlayers.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40 mb-3">
                  Top Players
                </p>
                <div className="space-y-2">
                  {topPlayers.map((p, i) => {
                    const pct = Math.round((p.uniqueCards / STICKER_ORDER.reduce((s, t) => s + STICKER_CONFIG[t].variants.length, 0)) * 100);
                    return (
                      <div key={p.uid} className="bg-brand-navy/5 rounded-2xl px-3 py-2.5">
                        <div className="flex items-center gap-2.5 mb-1.5">
                          <span className="text-[10px] font-black text-brand-navy/30 w-4 text-center shrink-0">{i + 1}</span>
                          <div className="w-6 h-6 rounded-full overflow-hidden bg-brand-navy/10 shrink-0 flex items-center justify-center">
                            <LivePixelAvatar uid={p.uid} size={24} view="head" />
                          </div>
                          <p className="text-[11px] font-bold text-brand-navy flex-1 truncate">{p.userName || 'Player'}</p>
                          <span className="text-[10px] font-black text-brand-navy/60 shrink-0">{pct}%</span>
                        </div>
                        <div className="ml-10 h-1.5 bg-brand-navy/10 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-brand-gold transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Card collection — 3 variants per tier, collect 3 sets to win */}
            <div className="space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40">
                Collect 1 of each animal to complete all tiers
              </p>
              {STICKER_ORDER.map(tier => {
                const cfg = STICKER_CONFIG[tier];
                const sets = tierSetsCompleted(revealed, tier);
                const tierDone = sets >= cfg.variants.length;
                return (
                  <div key={tier} className="rounded-2xl p-3 overflow-hidden relative"
                    style={{ background: cfg.solid, boxShadow: `0 4px 18px ${cfg.color}55` }}>
                    {/* Backdrop shine sweep */}
                    <span className="shine-ray" style={{ animationDelay: `${STICKER_ORDER.indexOf(tier) * 0.6}s` }} />
                    <div className="flex items-center justify-between mb-2.5 relative z-10">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-white">{cfg.label}</span>
                        <span className="text-[9px] text-white/70 ml-1.5">· {cfg.theme} · {cfg.chance}</span>
                      </div>
                      <span className="text-[10px] font-black text-white">
                        {sets}/{cfg.variants.length}{tierDone ? ' ✓' : ''}
                      </span>
                    </div>
                    <div className="flex gap-2 relative z-10">
                      {cfg.variants.map((v, vi) => {
                        const count = revealed.filter(s => s.tier === tier && (s.variant ?? 0) === vi).length;
                        return (
                          <div key={vi} className="flex-1 flex flex-col items-center gap-1">
                            <div className="w-full rounded-xl border-2 flex flex-col items-center justify-between relative overflow-hidden pt-2 pb-1.5 px-1"
                              style={count > 0
                                ? { background: 'white', borderColor: 'rgba(255,255,255,0.6)', boxShadow: '0 2px 10px rgba(0,0,0,0.15)' }
                                : { background: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.15)' }}>
                              <span style={{ fontSize: 34, lineHeight: 1, position: 'relative', zIndex: 1 }}>{count > 0 ? v.emoji : <span style={{ fontSize: 28 }} className="text-white/30">?</span>}</span>
                              <span className="text-[8px] font-bold text-center leading-tight mt-1 relative z-10 truncate w-full text-center"
                                style={{ color: count > 0 ? cfg.solid : 'rgba(255,255,255,0.4)' }}>
                                {count > 0 ? v.name : '???'}
                              </span>
                              {count > 0 && (
                                <span className="text-[7px] font-black relative z-10 mt-0.5"
                                  style={{ color: '#16a34a' }}>
                                  ✓
                                </span>
                              )}
                              {count > 0 && <span className="card-shine-ray" style={{ animationDelay: `${vi * 0.7}s` }} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {myWon && (
                <div className="p-3 rounded-2xl text-center" style={{ background: '#FEF9C3', border: '1px solid #FDE68A' }}>
                  <p className="font-bold text-amber-700 text-sm">🏆 All sets complete — you win!</p>
                </div>
              )}
              {!myWon && myTotalSets > 0 && (
                <div className="p-2.5 rounded-2xl text-center bg-brand-navy/5">
                  <p className="text-[10px] font-bold text-brand-navy/60">{myTotalSets}/14 animals collected · keep going!</p>
                </div>
              )}
            </div>

            {unrevealed.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40 mb-3">
                  Unrevealed ({unrevealed.length})
                </p>
                <div className="flex flex-wrap gap-3">
                  {unrevealed.map(s => (
                    <StickerCard key={s.id} sticker={s} isRevealed={false} onReveal={() => handleReveal(s.id)} size="md" />
                  ))}
                </div>
              </div>
            )}

            {revealed.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40 mb-3">
                  Revealed ({revealed.length})
                </p>
                <div className="flex flex-wrap gap-3">
                  {displayedRevealed.map(s => (
                    <StickerCard key={s.id} sticker={s} isRevealed={true} size="md" />
                  ))}
                </div>
                {revealed.length > 5 && !showAllRevealed && (
                  <button
                    onClick={() => setShowAllRevealed(true)}
                    className="mt-3 w-full py-2.5 rounded-2xl bg-brand-navy/5 text-brand-navy/60 text-xs font-bold active:bg-brand-navy/10 transition-colors"
                  >
                    Show all ({revealed.length})
                  </button>
                )}
              </div>
            )}

            {stickerCard.stickers.length === 0 && (
              <p className="text-sm text-brand-navy/40 text-center py-10">No stickers yet. Collect stamps to earn some!</p>
            )}
          </div>
          </div>{/* end overflow-y-auto */}
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black z-[249]"
        onClick={onClose}
      />
    </>
  );
}


// --- User Sticker Panel (profile view — own + other users) ---

function UserStickerPanel({ uid, isOwnProfile = false, onOpenPack }: {
  uid: string;
  isOwnProfile?: boolean;
  onOpenPack?: (stickers: CollectibleSticker[]) => void;
}) {
  const [col, setCol] = useState<{ stickers: CollectibleSticker[]; revealedIds: string[]; uniqueTiers: StickerTier[] } | null>(null);

  useEffect(() => {
    return onSnapshot(doc(db, 'user_stickers', uid), snap => {
      if (snap.exists()) {
        const d = snap.data();
        setCol({ stickers: d.stickers || [], revealedIds: d.revealedIds || [], uniqueTiers: d.uniqueTiers || [] });
      } else {
        setCol(null);
      }
    });
  }, [uid]);

  const handleReveal = async (stickerId: string) => {
    if (!col) return;
    const ref = doc(db, 'user_stickers', uid);
    await updateDoc(ref, { revealedIds: arrayUnion(stickerId) });
  };

  if (!col) {
    if (!isOwnProfile) return null;
    return (
      <div className="glass-card rounded-[2rem] p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40 mb-3">Animal Cards</p>
        <p className="text-xs text-brand-navy/40 text-center py-6">Collect stamps to earn your first animal cards!</p>
      </div>
    );
  }

  const unrevealed = col.stickers.filter(s => !col.revealedIds.includes(s.id));
  const revealed = col.stickers.filter(s => col.revealedIds.includes(s.id));
  const recentRevealed = [...revealed].reverse().slice(0, 6);
  const panelSets = totalSetsCompleted(revealed);
  const panelWon = allSetsWon(revealed);

  return (
    <div className="glass-card rounded-[2rem] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40">Animal Cards</p>
        <span className="text-[10px] font-bold text-brand-navy/40">{panelSets}/14 · {col.stickers.length} total</span>
      </div>

      {/* Compact tier overview — one row per tier showing variants */}
      <div className="space-y-2">
        {STICKER_ORDER.map(tier => {
          const cfg = STICKER_CONFIG[tier];
          const sets = tierSetsCompleted(revealed, tier);
          const tierDone = sets >= cfg.variants.length;
          return (
            <div key={tier} className="flex items-center gap-2 rounded-xl px-1.5 py-1 transition-all"
              style={tierDone ? { boxShadow: `0 0 10px 2px ${cfg.solid}55`, background: `${cfg.bg}` } : {}}>
              <span className="text-[8px] font-black uppercase w-14 shrink-0" style={{ color: sets > 0 ? cfg.color : '#CBD5E1' }}>{cfg.theme}</span>
              <div className="flex gap-1.5 flex-1">
                {cfg.variants.map((v, vi) => {
                  const count = revealed.filter(s => s.tier === tier && (s.variant ?? 0) === vi).length;
                  return (
                    <div key={vi} className="flex flex-col items-center gap-0.5 flex-1">
                      <div className="w-full aspect-square rounded-xl border flex items-center justify-center"
                        style={count > 0 ? { background: cfg.bg, borderColor: cfg.border } : { background: '#F1F5F9', borderColor: '#E2E8F0' }}>
                        <span style={{ fontSize: 16, lineHeight: 1 }}>{count > 0 ? v.emoji : '?'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <span className="text-[8px] font-black shrink-0 w-9 text-right" style={{ color: tierDone ? cfg.color : '#94A3B8' }}>
                {sets}/{cfg.variants.length}{tierDone ? '✓' : ''}
              </span>
            </div>
          );
        })}
      </div>

      {/* Win badge */}
      {panelWon && (
        <div className="p-2.5 rounded-2xl text-center" style={{ background: '#FEF9C3', border: '1px solid #FDE68A' }}>
          <p className="text-xs font-bold text-amber-700">🏆 All sets complete — you win!</p>
        </div>
      )}

      {/* Unrevealed cards — open pack CTA */}
      {isOwnProfile && unrevealed.length > 0 && (
        <motion.button
          className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #0D0D2B, #1A0730)', color: 'white' }}
          onClick={() => onOpenPack?.(unrevealed)}
          whileTap={{ scale: 0.97 }}
          animate={{ boxShadow: ['0 0 0px #F5C51800', '0 0 18px #F5C51866', '0 0 0px #F5C51800'] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          🎴 Open {unrevealed.length} stored card{unrevealed.length !== 1 ? 's' : ''}
        </motion.button>
      )}

      {/* Recent revealed cards */}
      {recentRevealed.length > 0 && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-brand-navy/30 mb-2">
            Recent {isOwnProfile ? '' : 'cards'}
          </p>
          <div className="flex gap-2 flex-wrap">
            {recentRevealed.map(s => (
              <StickerCard key={s.id} sticker={s} isRevealed={true} size="sm" />
            ))}
          </div>
        </div>
      )}

      {/* Unrevealed cards for own profile (in-place reveal) */}
      {isOwnProfile && unrevealed.length > 0 && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-brand-navy/30 mb-2">Tap to reveal</p>
          <div className="flex gap-2 flex-wrap">
            {unrevealed.slice(0, 6).map(s => (
              <StickerCard key={s.id} sticker={s} isRevealed={false} onReveal={() => handleReveal(s.id)} size="sm" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Pack Opening Modal ---

const PACK_STARS = [
  { x: 12, y: 8, r: 1.2, d: 1.8, delay: 0 }, { x: 78, y: 5, r: 0.8, d: 2.3, delay: 0.4 },
  { x: 35, y: 12, r: 1.5, d: 1.5, delay: 0.9 }, { x: 91, y: 18, r: 1, d: 2.8, delay: 0.2 },
  { x: 5, y: 25, r: 0.7, d: 2.1, delay: 1.1 }, { x: 65, y: 22, r: 1.3, d: 1.9, delay: 0.7 },
  { x: 48, y: 7, r: 0.9, d: 2.5, delay: 0.3 }, { x: 82, y: 35, r: 1.1, d: 1.7, delay: 0.6 },
  { x: 22, y: 38, r: 0.8, d: 2.2, delay: 1.3 }, { x: 55, y: 40, r: 1.4, d: 1.6, delay: 0.1 },
  { x: 8, y: 48, r: 1, d: 2.4, delay: 0.8 }, { x: 96, y: 45, r: 0.7, d: 2, delay: 1.5 },
  { x: 40, y: 52, r: 1.2, d: 1.8, delay: 0.5 }, { x: 71, y: 55, r: 0.9, d: 2.6, delay: 1 },
  { x: 18, y: 60, r: 1.1, d: 2.1, delay: 0.2 }, { x: 88, y: 62, r: 0.8, d: 1.9, delay: 1.4 },
  { x: 30, y: 68, r: 1.3, d: 2.3, delay: 0.7 }, { x: 60, y: 70, r: 0.7, d: 1.7, delay: 1.2 },
  { x: 50, y: 15, r: 1, d: 2, delay: 0.6 }, { x: 75, y: 10, r: 1.2, d: 2.5, delay: 0.9 },
];

const VIBRATE_PATTERNS: Record<StickerTier, number | number[]> = {
  brown:     40,
  lightblue: [60, 30, 80],
  red:       [80, 40, 100, 40, 80],
  blue:      [120, 50, 120, 50, 180],
  gold:      [200, 80, 200, 80, 200, 80, 400],
};

// Mystery card used inside PackOpeningModal — larger, dramatic reveal
function MysteryRevealCard({ sticker, isRevealed, onReveal }: {
  sticker: CollectibleSticker; isRevealed: boolean; onReveal?: () => void;
}) {
  const [localRevealed, setLocalRevealed] = useState(isRevealed);
  const [flipping, setFlipping] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const cfg = STICKER_CONFIG[sticker.tier];

  useEffect(() => { if (isRevealed) setLocalRevealed(true); }, [isRevealed]);

  const handleTap = () => {
    if (localRevealed || !onReveal || flipping) return;
    setFlipping(true);
  };

  return (
    <motion.div
      onClick={handleTap}
      animate={flipping ? { scale: [1, 1.3, 0.88, 1.12, 1] } : { scale: 1 }}
      transition={{ duration: 0.48 }}
      onAnimationComplete={() => {
        if (flipping) {
          setFlipping(false);
          setLocalRevealed(true);
          setShowFlash(true);
          setTimeout(() => setShowFlash(false), 380);
          onReveal?.();
        }
      }}
      style={{ width: 108, height: 148, perspective: '1000px', position: 'relative',
        cursor: localRevealed ? 'default' : 'pointer', flexShrink: 0 }}
    >
      {/* Unrevealed glow pulse */}
      {!localRevealed && (
        <motion.div style={{
          position: 'absolute', inset: -8, borderRadius: 28, zIndex: 0,
          background: 'radial-gradient(circle, rgba(140,60,255,0.55) 0%, transparent 70%)',
          filter: 'blur(8px)',
        }}
          animate={{ opacity: [0.3, 0.9, 0.3], scale: [0.92, 1.08, 0.92] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
      {/* Tier glow after reveal */}
      {localRevealed && (
        <motion.div style={{
          position: 'absolute', inset: -6, borderRadius: 26, zIndex: 0,
          background: cfg.solid, filter: 'blur(16px)',
        }}
          initial={{ opacity: 0 }} animate={{ opacity: 0.45 }}
          transition={{ duration: 0.4 }}
        />
      )}

      <motion.div
        animate={{ rotateY: localRevealed ? 180 : 0 }}
        transition={{ duration: 0.68, ease: [0.23, 1, 0.32, 1] }}
        style={{ transformStyle: 'preserve-3d', width: '100%', height: '100%', position: 'relative', zIndex: 1 }}
      >
        {/* Front — mystery */}
        <div style={{
          position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
          background: 'linear-gradient(148deg, #16103A, #2B1458)',
          border: '2px solid rgba(160,100,255,0.4)', borderRadius: 20,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
          overflow: 'hidden',
        }}>
          {/* Shimmer sweep */}
          <motion.div style={{
            position: 'absolute', inset: 0, borderRadius: 18,
            background: 'linear-gradient(108deg, transparent 32%, rgba(255,255,255,0.13) 50%, transparent 68%)',
            backgroundSize: '300% 100%',
          }}
            animate={{ backgroundPosition: ['-200% 0', '300% 0'] }}
            transition={{ duration: 2.0, repeat: Infinity, ease: 'linear' }}
          />
          {/* Rotating rings */}
          <motion.div style={{
            position: 'absolute', width: 86, height: 86, borderRadius: '50%',
            border: '1.5px solid rgba(170,110,255,0.28)',
          }}
            animate={{ rotate: 360 }}
            transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div style={{
            position: 'absolute', width: 58, height: 58, borderRadius: '50%',
            border: '1.5px solid rgba(200,150,255,0.22)',
          }}
            animate={{ rotate: -360 }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
          />
          {/* Question mark */}
          <motion.div style={{ fontSize: 54, lineHeight: 1, color: 'rgba(210,170,255,0.92)', fontWeight: 900,
            filter: 'drop-shadow(0 0 18px rgba(190,110,255,0.85))', zIndex: 2 }}
            animate={{ scale: [1, 1.12, 1], opacity: [0.75, 1, 0.75] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          >?</motion.div>
          <motion.div style={{ fontSize: 9, color: 'rgba(200,155,255,0.6)', fontWeight: 800,
            letterSpacing: '0.16em', zIndex: 2 }}
            animate={{ opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: 0.4 }}
          >TAP TO REVEAL</motion.div>
        </div>

        {/* Back — animal reveal */}
        <div style={{
          position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)', background: 'white',
          border: `2px solid ${cfg.border}`, borderRadius: 20,
          boxShadow: `0 8px 32px ${cfg.color}44`,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {showFlash && (
            <motion.div style={{ position: 'absolute', inset: 0, background: 'white', borderRadius: 18, zIndex: 10 }}
              initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 0.38 }}
            />
          )}
          <div style={{ background: cfg.solid, height: '60%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 58, lineHeight: 1 }}>
              {cfg.variants[sticker.variant ?? 0]?.emoji ?? cfg.variants[0].emoji}
            </span>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '4px 8px' }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: cfg.color, textAlign: 'center' }}>
              {cfg.variants[sticker.variant ?? 0]?.name ?? cfg.variants[0].name}
            </span>
            <span style={{ fontSize: 9, fontWeight: 700, color: cfg.color, opacity: 0.65 }}>{cfg.label} · {cfg.chance}</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ChallengeRedeemModal({ challenge, entry, userName, onClose }: {
  challenge: Challenge;
  entry: any;
  userName: string;
  onClose: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [marking, setMarking] = useState(false);

  const handleMark = async () => {
    setMarking(true);
    try {
      await updateDoc(doc(db, 'challenge_entries', entry.id), {
        redeemed: true,
        redeemedAt: serverTimestamp(),
      });
      setConfirmed(true);
    } finally {
      setMarking(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-end"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
        className="relative w-full max-w-md bg-brand-bg rounded-t-[2.5rem] shadow-2xl overflow-hidden"
        style={{ maxHeight: '92vh' }}
      >
        <div className="overflow-y-auto" style={{ maxHeight: '92vh' }}>
        <div className="px-5 pt-5 pb-8 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-brand-navy">Redeem Reward</h2>
            <button onClick={onClose} className="p-2 rounded-2xl bg-brand-navy/8 active:scale-90 transition-all">
              <X size={18} className="text-brand-navy/60" />
            </button>
          </div>

          {/* Instagram story card */}
          <div className="rounded-[2rem] overflow-hidden shadow-xl" style={{ background: 'linear-gradient(160deg, #0f2460 0%, #1E3A8A 50%, #162d6e 100%)', aspectRatio: '9/14', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '32px 24px' }}>
            {/* Top sparkles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(18)].map((_, i) => (
                <div key={i} className="absolute rounded-full bg-white/10"
                  style={{ width: `${4 + (i % 5) * 3}px`, height: `${4 + (i % 5) * 3}px`, top: `${(i * 37) % 90}%`, left: `${(i * 53) % 90}%`, opacity: 0.15 + (i % 4) * 0.08 }} />
              ))}
            </div>

            {/* Linq wordmark */}
            <div className="text-center relative z-10">
              <p className="font-display text-5xl font-black text-white tracking-tight leading-none">linq</p>
              <div className="h-0.5 bg-white/20 rounded-full mt-2 mx-4" />
            </div>

            {/* Achievement */}
            <div className="text-center space-y-4 relative z-10 px-2">
              <div className="w-20 h-20 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center mx-auto border-2 border-white/20">
                <span className="text-4xl">🏆</span>
              </div>
              <div className="space-y-1">
                <p className="text-white/60 text-xs font-bold uppercase tracking-widest">Challenge Complete</p>
                <p className="font-display text-2xl font-black text-white leading-tight">{challenge.title}</p>
              </div>
              <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/20">
                <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-1">Reward</p>
                <p className="font-bold text-white text-lg leading-snug">{challenge.reward}</p>
              </div>
            </div>

            {/* Footer tagline */}
            <div className="text-center relative z-10 space-y-1">
              <p className="text-white/50 text-xs font-medium">Collect stamps &amp; rewards with</p>
              <p className="font-display text-xl font-black text-white tracking-tight">linq</p>
              <p className="text-white/30 text-[10px] font-bold tracking-widest">@joinlinq</p>
            </div>
          </div>

          {confirmed ? (
            <div className="rounded-2xl bg-green-50 border border-green-200 p-4 text-center">
              <p className="font-bold text-green-700">✓ Marked as redeemed! Enjoy your reward.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-2xl bg-brand-navy/5 p-4 text-center space-y-1">
                <p className="font-bold text-sm text-brand-navy">📸 Screenshot &amp; share on your story</p>
                <p className="text-xs text-brand-navy/50">Tag <span className="font-bold">@joinlinq</span> to show off your reward!</p>
              </div>
              <button
                onClick={handleMark}
                disabled={marking}
                className="w-full py-4 rounded-2xl bg-brand-navy text-white font-bold text-sm active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {marking ? 'Marking...' : '✓ Mark as Redeemed'}
              </button>
            </div>
          )}
        </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PackOpeningModal({ stickers, cardId, uid, onClose }: { stickers: CollectibleSticker[]; cardId?: string | null; uid?: string | null; onClose: () => void }) {
  type PackPhase = 'sealed' | 'opening' | 'dealing' | 'reveal' | 'done';
  const [phase, setPhase] = useState<PackPhase>('sealed');
  const [dealtCount, setDealtCount] = useState(0);
  const [localRevealedIds, setLocalRevealedIds] = useState<Set<string>>(new Set());
  const [burstTier, setBurstTier] = useState<StickerTier | null>(null);
  const [burstKey, setBurstKey] = useState(0);

  const displayStickers = stickers.slice(0, 3);

  const vibrate = (pattern: number | number[]) => {
    try { if ('vibrate' in navigator) (navigator as any).vibrate(pattern); } catch {}
  };

  const handlePackOpen = () => {
    vibrate([100, 50, 100, 50, 200, 80, 300]);
    setPhase('opening');
    setTimeout(() => {
      setPhase('dealing');
      const N = displayStickers.length;
      for (let i = 0; i < N; i++) {
        setTimeout(() => { setDealtCount(i + 1); vibrate(35); }, i * 400);
      }
      setTimeout(() => setPhase('reveal'), N * 400 + 520);
    }, 680);
  };

  const handleCardReveal = (sticker: CollectibleSticker) => {
    vibrate(VIBRATE_PATTERNS[sticker.tier]);
    setLocalRevealedIds(prev => new Set([...prev, sticker.id]));
    if (['red', 'blue', 'gold'].includes(sticker.tier)) {
      setBurstTier(sticker.tier);
      setBurstKey(k => k + 1);
      setTimeout(() => setBurstTier(null), 900);
    }
  };

  const allRevealed = displayStickers.length > 0 && displayStickers.every(s => localRevealedIds.has(s.id));

  useEffect(() => {
    if (allRevealed && phase === 'reveal') {
      const premium = displayStickers.some(s => ['gold', 'blue', 'red'].includes(s.tier));
      vibrate(premium ? [150, 60, 150, 60, 300] : [80, 40, 120]);
      if (cardId) {
        updateDoc(doc(db, 'sticker_cards', cardId), {
          revealedIds: arrayUnion(...displayStickers.map(s => s.id)),
        }).catch(console.error);
      } else if (uid) {
        updateDoc(doc(db, 'user_stickers', uid), {
          revealedIds: arrayUnion(...displayStickers.map(s => s.id)),
          uniqueTiers: arrayUnion(...displayStickers.map(s => s.tier)),
        }).catch(console.error);
      }
      const t = setTimeout(() => setPhase('done'), 850);
      return () => clearTimeout(t);
    }
  }, [allRevealed, phase]);

  const topTier = displayStickers.length > 0
    ? displayStickers.reduce((b, s) => STICKER_ORDER.indexOf(s.tier) > STICKER_ORDER.indexOf(b.tier) ? s : b).tier
    : 'gold' as StickerTier;
  const topCfg = STICKER_CONFIG[topTier];

  const doneTitle = displayStickers.some(s => s.tier === 'gold') ? '🏆 Legendary!'
    : displayStickers.some(s => s.tier === 'blue') ? '🔥 Epic pull!'
    : displayStickers.some(s => s.tier === 'red') ? '✨ Rare find!'
    : displayStickers.some(s => s.tier === 'lightblue') ? '👍 Uncommon!'
    : '🎴 Cards collected!';

  // Deterministic burst particles (no Math.random in render)
  const burstAngles = [0,30,60,90,120,150,180,210,240,270,300,330];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center overflow-hidden gradient-logo-blue"
    >
      {/* Stars */}
      {PACK_STARS.map((star, i) => (
        <motion.div key={i} className="absolute rounded-full bg-white pointer-events-none"
          style={{ width: star.r * 2, height: star.r * 2, left: `${star.x}%`, top: `${star.y}%` }}
          animate={{ opacity: [0.1, 0.6, 0.1] }}
          transition={{ duration: star.d, repeat: Infinity, delay: star.delay }}
        />
      ))}

      {/* Rare+ burst overlay flash */}
      <AnimatePresence>
        {burstTier && (
          <motion.div key={`flash-${burstKey}`}
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0.3 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.55 }}
            style={{ background: STICKER_CONFIG[burstTier].solid }}
          />
        )}
      </AnimatePresence>

      {/* Burst particles */}
      <AnimatePresence>
        {burstTier && burstAngles.map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          const dist = 70 + (i % 4) * 28;
          return (
            <motion.div key={`p-${burstKey}-${i}`}
              className="absolute rounded-full pointer-events-none"
              style={{ width: 7, height: 7, background: STICKER_CONFIG[burstTier].solid,
                left: 'calc(50% - 3.5px)', top: 'calc(50% - 3.5px)', zIndex: 20 }}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{ x: Math.cos(rad) * dist, y: Math.sin(rad) * dist, opacity: 0, scale: 0.2 }}
              transition={{ duration: 0.65, ease: 'easeOut' }}
            />
          );
        })}
      </AnimatePresence>

      <div className="flex flex-col items-center justify-center w-full max-w-sm px-6 relative z-10">

        {/* ── SEALED ── */}
        {phase === 'sealed' && (
          <motion.div className="flex flex-col items-center gap-8"
            initial={{ scale: 0.75, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 13, stiffness: 170 }}
          >
            <p className="text-white/45 text-[11px] font-bold uppercase tracking-[0.22em]">You earned a card pack!</p>

            <motion.div className="relative cursor-pointer select-none"
              onClick={handlePackOpen}
              animate={{ y: [0, -9, 0], rotate: [0, -3.5, 3.5, -3.5, 3.5, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 0.6 }}
              whileTap={{ scale: 0.84, rotate: 0 }}
            >
              {/* Halo glow */}
              <motion.div style={{
                position: 'absolute', inset: -20, borderRadius: 36,
                background: topCfg.solid, filter: 'blur(32px)', zIndex: 0,
              }}
                animate={{ opacity: [0.25, 0.6, 0.25], scale: [0.88, 1.12, 0.88] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              {/* Back cards */}
              {[2, 1].map(i => (
                <div key={i} style={{
                  position: 'absolute', width: 118, height: 162,
                  background: 'linear-gradient(148deg, #1E1244, #130B28)',
                  borderRadius: 20, border: '1.5px solid rgba(255,255,255,0.09)',
                  transform: `rotate(${(i - 1.5) * 9}deg) translateY(${i * 5}px)`, zIndex: i,
                }} />
              ))}
              {/* Top card */}
              <div style={{
                position: 'relative', width: 118, height: 162, zIndex: 3,
                background: `linear-gradient(148deg, ${topCfg.solid}60, #200E48)`,
                borderRadius: 20, border: `2px solid ${topCfg.border}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: `0 18px 56px ${topCfg.color}80, 0 0 0 1px ${topCfg.border}55`,
                overflow: 'hidden',
              }}>
                <motion.div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(118deg, transparent 28%, rgba(255,255,255,0.22) 50%, transparent 72%)',
                  backgroundSize: '300% 100%',
                }}
                  animate={{ backgroundPosition: ['-200% 0', '300% 0'] }}
                  transition={{ duration: 1.9, repeat: Infinity, ease: 'linear' }}
                />
                <span style={{ fontSize: 52, filter: 'drop-shadow(0 2px 14px rgba(0,0,0,0.65))' }}>🎴</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', fontWeight: 800, letterSpacing: '0.12em' }}>LINQ PACK</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)' }}>{displayStickers.length} cards inside</span>
              </div>
            </motion.div>

            <motion.p className="text-white text-2xl font-bold tracking-tight"
              animate={{ opacity: [0.5, 1, 0.5], scale: [0.97, 1.03, 0.97] }}
              transition={{ duration: 1.25, repeat: Infinity }}
            >Tap to open!</motion.p>
          </motion.div>
        )}

        {/* ── OPENING ── */}
        {phase === 'opening' && (
          <motion.div className="flex items-center justify-center"
            initial={{ scale: 1, rotate: 0 }}
            animate={{ scale: [1, 1.18, 1.08, 1.28, 0.6, 1.5, 0], rotate: [0, -10, 12, -16, 14, 0], opacity: [1,1,1,1,1,1,0] }}
            transition={{ duration: 0.62, ease: 'easeIn' }}
          >
            <div style={{
              width: 118, height: 162,
              background: `linear-gradient(148deg, ${topCfg.solid}99, #200E48)`,
              borderRadius: 20, border: `2px solid ${topCfg.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 80px ${topCfg.solid}`,
            }}>
              <motion.span style={{ fontSize: 56 }}
                animate={{ rotate: [0, 360], scale: [1, 1.6, 1] }}
                transition={{ duration: 0.6 }}
              >✨</motion.span>
            </div>
          </motion.div>
        )}

        {/* ── DEALING ── */}
        {phase === 'dealing' && (
          <div className="flex flex-col items-center gap-5">
            <motion.p className="text-white/40 text-[11px] font-bold uppercase tracking-[0.2em]"
              animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }}
            >Dealing your cards…</motion.p>
            <div className="flex gap-5 items-end justify-center">
              {displayStickers.map((s, i) => (
                <AnimatePresence key={s.id}>
                  {dealtCount > i && (
                    <motion.div
                      initial={{ y: -160, scale: 0.3, rotate: -25, opacity: 0 }}
                      animate={{ y: 0, scale: 1, rotate: (i - 1) * 4, opacity: 1 }}
                      transition={{ type: 'spring', damping: 16, stiffness: 260 }}
                      style={{
                        width: 90, height: 124,
                        background: 'linear-gradient(148deg, #16103A, #2B1458)',
                        border: '2px solid rgba(160,100,255,0.38)', borderRadius: 18,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                        boxShadow: '0 8px 28px rgba(100,40,200,0.4)',
                        overflow: 'hidden',
                      }}
                    >
                      <motion.div style={{
                        position: 'absolute', inset: 0, borderRadius: 16,
                        background: 'linear-gradient(108deg, transparent 32%, rgba(255,255,255,0.1) 50%, transparent 68%)',
                        backgroundSize: '300% 100%',
                      }}
                        animate={{ backgroundPosition: ['-200% 0', '300% 0'] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      />
                      <motion.div style={{ fontSize: 38, filter: 'drop-shadow(0 0 10px rgba(190,110,255,0.9))', lineHeight: 1 }}
                        animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.3, repeat: Infinity }}
                      >?</motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              ))}
            </div>
          </div>
        )}

        {/* ── REVEAL + DONE ── */}
        {(phase === 'reveal' || phase === 'done') && (
          <motion.div className="flex flex-col items-center gap-6 w-full"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28 }}
          >
            {phase === 'reveal' && !allRevealed && (
              <motion.p className="text-white/50 text-[11px] font-bold uppercase tracking-[0.2em]"
                animate={{ opacity: [0.3, 0.85, 0.3] }} transition={{ duration: 1.4, repeat: Infinity }}
              >Tap a mystery card to reveal</motion.p>
            )}

            {phase === 'done' && (
              <motion.p className="text-white text-3xl font-bold text-center"
                initial={{ scale: 0.55, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 9, stiffness: 200 }}
              >{doneTitle}</motion.p>
            )}

            <div className="flex gap-4 justify-center items-end">
              {displayStickers.map((s, i) => (
                <motion.div key={s.id}
                  initial={{ scale: 0, y: 40, rotate: (i - 1) * 8 }}
                  animate={{ scale: 1, y: 0, rotate: (i - 1) * 4 }}
                  transition={{ type: 'spring', damping: 16, stiffness: 240, delay: i * 0.08 }}
                >
                  <MysteryRevealCard
                    sticker={s}
                    isRevealed={localRevealedIds.has(s.id)}
                    onReveal={() => handleCardReveal(s)}
                  />
                </motion.div>
              ))}
            </div>

            {phase === 'done' && (
              <motion.button
                className="mt-2 w-full py-4 rounded-2xl font-bold text-base"
                style={{ background: 'rgba(255,255,255,0.11)', color: 'white',
                  border: '1.5px solid rgba(255,255,255,0.22)', backdropFilter: 'blur(8px)' }}
                onClick={onClose}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                whileTap={{ scale: 0.96 }}
              >Collect</motion.button>
            )}
          </motion.div>
        )}

      </div>
    </motion.div>
  );
}

// --- Admin Challenges Panel ---

type TierChances = { brown: number; lightblue: number; red: number; blue: number; gold: number };
const sumChances = (c: TierChances) => STICKER_ORDER.reduce((s, t) => s + (c[t] ?? 0), 0);

function ChanceEditor({ chances, onSave }: { chances: TierChances; onSave: (c: TierChances) => void }) {
  const [local, setLocal] = useState<TierChances>({ ...chances });
  const total = Math.round(sumChances(local));
  const valid = total === 100;
  return (
    <div className="pt-2 border-t border-amber-100 space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-bold uppercase tracking-widest text-amber-700/50">Drop %</p>
        <span className={cn('text-[9px] font-bold', valid ? 'text-green-600' : 'text-red-500')}>{total}% {valid ? '✓' : '≠ 100'}</span>
      </div>
      {STICKER_ORDER.map(tier => {
        const cfg = STICKER_CONFIG[tier];
        return (
          <div key={tier} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: cfg.solid }} />
            <span className="text-[9px] font-bold flex-1" style={{ color: cfg.color }}>{cfg.label}</span>
            <input
              type="number" min={0} max={100} step={1}
              value={local[tier]}
              onChange={e => setLocal(prev => ({ ...prev, [tier]: Math.max(0, parseFloat(e.target.value) || 0) }))}
              className="w-12 px-1.5 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-[9px] text-right text-amber-800 focus:outline-none"
            />
            <span className="text-[9px] text-amber-600/50 w-3">%</span>
          </div>
        );
      })}
      <button
        onClick={() => valid && onSave(local)}
        disabled={!valid}
        className="w-full py-1.5 rounded-xl bg-amber-500 text-white text-[9px] font-bold disabled:opacity-40 active:scale-95 transition-all"
      >
        Save
      </button>
    </div>
  );
}

const BADGE_METRIC_LABELS: Record<BadgeMetric, string> = {
  stamps: 'Total stamps collected',
  cards_completed: 'Cards completed',
  challenges_joined: 'Challenges joined',
  memberships: 'Active memberships',
  followers: 'Followers',
  following: 'Following',
  posts: 'Posts published',
  charity_animals: 'Animals championed',
  charity_trees: 'Trees championed',
  charity_total: 'Total good deeds',
};

const BADGE_COLORS = [
  '#EF4444','#F97316','#EAB308','#22C55E','#14B8A6',
  '#3B82F6','#8B5CF6','#EC4899','#6366F1','#0EA5E9',
  '#10B981','#F59E0B','#84CC16','#06B6D4','#A855F7',
  '#1E293B','#7C3AED','#BE123C','#0369A1','#166534',
];

const BADGE_ICONS = [
  // faces
  '😀','😎','🤩','🥳','😏','🤓','😇','🥸','🤠','👑',
  // animals
  '🦁','🐯','🦊','🐺','🦅','🦋','🐬','🦄','🐉','🦁',
  '🐻','🦈','🦒','🐘','🦓','🐆','🦜','🦩','🦔','🐝',
  // symbols / objects
  '⭐','🏆','💎','🔥','⚡','🎯','🎖️','🛡️','⚔️','🗝️',
  '🌟','💫','✨','🎪','🎨','🎭','🚀','🌈','💪','🧩',
  // food/misc
  '🍕','🎂','🍀','🌺','🌸','🌻','🍭','🎁','🪄','🎵',
];

function BadgesAdminPanel({ onClose }: { onClose: () => void }) {
  const [badges, setBadges] = useState<AppBadge[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showList, setShowList] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Create form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [metric, setMetric] = useState<BadgeMetric>('stamps');
  const [threshold, setThreshold] = useState('');
  const [color, setColor] = useState(BADGE_COLORS[0]);
  const [icon, setIcon] = useState(BADGE_ICONS[0]);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editMetric, setEditMetric] = useState<BadgeMetric>('stamps');
  const [editThreshold, setEditThreshold] = useState('');
  const [editColor, setEditColor] = useState(BADGE_COLORS[0]);
  const [editIcon, setEditIcon] = useState(BADGE_ICONS[0]);

  const inputCls = 'w-full bg-white border border-brand-navy/15 rounded-2xl px-4 py-3 text-sm text-brand-navy placeholder:text-brand-navy/30 focus:outline-none focus:ring-2 focus:ring-brand-gold/40';
  const editInputCls = 'w-full bg-brand-bg border border-brand-navy/10 rounded-2xl px-4 py-3 text-sm text-brand-navy placeholder:text-brand-navy/30 focus:outline-none focus:ring-2 focus:ring-brand-gold/40';

  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'badges'), orderBy('createdAt', 'desc')),
      snap => setBadges(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppBadge)))
    );
  }, []);

  const handleSave = async () => {
    const t = parseInt(threshold);
    if (!name.trim() || isNaN(t) || t < 1) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'badges'), {
        name: name.trim(), description: description.trim(), color, icon, metric, threshold: t, createdAt: serverTimestamp(),
      });
      setName(''); setDescription(''); setThreshold(''); setMetric('stamps'); setColor(BADGE_COLORS[0]); setIcon(BADGE_ICONS[0]);
    } finally { setSaving(false); }
  };

  const startEdit = (b: AppBadge) => {
    setEditingId(b.id);
    setEditName(b.name);
    setEditDescription(b.description ?? '');
    setEditMetric(b.metric);
    setEditThreshold(String(b.threshold));
    setEditColor(b.color);
    setEditIcon(b.icon);
  };

  const handleUpdate = async () => {
    const t = parseInt(editThreshold);
    if (!editName.trim() || isNaN(t) || t < 1 || !editingId) return;
    setEditSaving(true);
    try {
      await updateDoc(doc(db, 'badges', editingId), {
        name: editName.trim(), description: editDescription.trim(), color: editColor, icon: editIcon, metric: editMetric, threshold: t,
      });
      setEditingId(null);
    } finally { setEditSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try { await deleteDoc(doc(db, 'badges', id)); } finally { setDeletingId(null); setConfirmDelete(null); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col max-w-md mx-auto"
    >
      <div className="flex-1 overflow-y-auto bg-brand-bg">
        <div className="sticky top-0 bg-brand-bg/95 backdrop-blur-sm px-5 pt-5 pb-4 border-b border-black/5 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-brand-navy">Badges</h2>
              <p className="text-xs text-brand-navy/50 mt-0.5">Create & manage achievement badges</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-2xl bg-white border border-black/5 shadow-sm active:scale-95 transition-all">
              <X size={18} className="text-brand-navy/60" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* Create form */}
          <div className="rounded-3xl border-2 border-dashed border-brand-navy/20 p-5 space-y-4 bg-white">
            <h3 className="font-bold text-brand-navy text-sm">New Badge</h3>

            {/* Preview */}
            <div className="flex justify-center">
              <div
                className="w-20 h-20 rounded-[1.75rem] flex items-center justify-center text-4xl shadow-lg border-4 border-white"
                style={{ background: `linear-gradient(135deg, ${color}ee, ${color}99)` }}
              >
                {icon}
              </div>
            </div>

            <input value={name} onChange={e => setName(e.target.value)} placeholder="Badge name (e.g. Coffee Devotee)" className={inputCls} />
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional, shown on profile)" rows={2} className={cn(inputCls, 'resize-none')} />

            {/* Metric & threshold */}
            <div className="flex gap-2">
              <select value={metric} onChange={e => setMetric(e.target.value as BadgeMetric)} className={cn(inputCls, 'flex-1')}>
                {(Object.entries(BADGE_METRIC_LABELS) as [BadgeMetric, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <input value={threshold} onChange={e => setThreshold(e.target.value)} placeholder="Amount" type="number" min="1" className={cn(inputCls, 'w-24')} />
            </div>

            {/* Colour picker */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40 mb-2">Colour</p>
              <div className="flex flex-wrap gap-2">
                {BADGE_COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)}
                    className={cn('w-7 h-7 rounded-full border-2 transition-transform active:scale-90', color === c ? 'border-brand-navy scale-110' : 'border-white')}
                    style={{ background: c }} />
                ))}
              </div>
            </div>

            {/* Icon picker */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40 mb-2">Icon</p>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {BADGE_ICONS.map((ic, idx) => (
                  <button key={idx} onClick={() => setIcon(ic)}
                    className={cn('w-9 h-9 rounded-xl text-xl flex items-center justify-center transition-all active:scale-90', icon === ic ? 'bg-brand-navy/10 ring-2 ring-brand-navy/30' : 'bg-brand-navy/5 hover:bg-brand-navy/10')}
                  >{ic}</button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !name.trim() || !threshold}
              className="w-full py-3 rounded-2xl bg-brand-navy text-white font-bold text-sm disabled:opacity-40 active:scale-[0.98] transition-all"
            >
              {saving ? 'Saving…' : 'Create Badge'}
            </button>
          </div>

          {/* Existing badges — collapsible */}
          {badges.length > 0 && (
            <div className="space-y-3">
              <button
                onClick={() => setShowList(v => !v)}
                className="w-full flex items-center justify-between bg-white rounded-2xl border border-black/5 px-4 py-3 active:scale-[0.98] transition-all"
              >
                <span className="text-sm font-bold text-brand-navy">{showList ? 'Hide badges' : `View all badges (${badges.length})`}</span>
                <motion.div animate={{ rotate: showList ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown size={16} className="text-brand-navy/40" />
                </motion.div>
              </button>

              <AnimatePresence>
                {showList && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3 overflow-hidden"
                  >
                    {badges.map(b => (
                      <div key={b.id} className="bg-white rounded-2xl border border-black/5 overflow-hidden">
                        {/* Badge row */}
                        <div className="p-4 flex items-center gap-3">
                          <div
                            className="w-12 h-12 rounded-[1rem] flex items-center justify-center text-2xl shrink-0 shadow-sm"
                            style={{ background: `linear-gradient(135deg, ${editingId === b.id ? editColor : b.color}ee, ${editingId === b.id ? editColor : b.color}99)` }}
                          >{editingId === b.id ? editIcon : b.icon}</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-brand-navy text-sm leading-tight">{b.name}</p>
                            <p className="text-xs text-brand-navy/50 mt-0.5">{BADGE_METRIC_LABELS[b.metric]} ≥ {b.threshold}</p>
                            {b.description ? <p className="text-[10px] text-brand-navy/40 mt-0.5 line-clamp-1">{b.description}</p> : null}
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            {editingId !== b.id && (
                              <button onClick={() => startEdit(b)} className="p-1.5 rounded-xl bg-brand-navy/8 active:scale-90 transition-transform">
                                <Pencil size={13} className="text-brand-navy/50" />
                              </button>
                            )}
                            {confirmDelete === b.id ? (
                              <div className="flex gap-1.5">
                                <button onClick={() => setConfirmDelete(null)} className="text-[10px] font-bold text-brand-navy/40 px-2 py-1 rounded-lg bg-brand-navy/5">Cancel</button>
                                <button onClick={() => handleDelete(b.id)} disabled={deletingId === b.id} className="text-[10px] font-bold text-white px-2 py-1 rounded-lg bg-brand-rose disabled:opacity-50">
                                  {deletingId === b.id ? '…' : 'Delete'}
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDelete(b.id)} className="p-1.5 rounded-xl bg-brand-rose/10 active:scale-90 transition-transform">
                                <Trash2 size={13} className="text-brand-rose" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Inline edit form */}
                        <AnimatePresence>
                          {editingId === b.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="border-t border-brand-navy/8 bg-brand-bg/50 p-4 space-y-3 overflow-hidden"
                            >
                              <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Badge name" className={editInputCls} />
                              <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Description (optional)" rows={2} className={cn(editInputCls, 'resize-none')} />
                              <div className="flex gap-2">
                                <select value={editMetric} onChange={e => setEditMetric(e.target.value as BadgeMetric)} className={cn(editInputCls, 'flex-1')}>
                                  {(Object.entries(BADGE_METRIC_LABELS) as [BadgeMetric, string][]).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                  ))}
                                </select>
                                <input value={editThreshold} onChange={e => setEditThreshold(e.target.value)} placeholder="Amount" type="number" min="1" className={cn(editInputCls, 'w-24')} />
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40 mb-2">Colour</p>
                                <div className="flex flex-wrap gap-2">
                                  {BADGE_COLORS.map(c => (
                                    <button key={c} onClick={() => setEditColor(c)}
                                      className={cn('w-7 h-7 rounded-full border-2 transition-transform active:scale-90', editColor === c ? 'border-brand-navy scale-110' : 'border-white')}
                                      style={{ background: c }} />
                                  ))}
                                </div>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40 mb-2">Icon</p>
                                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                                  {BADGE_ICONS.map((ic, idx) => (
                                    <button key={idx} onClick={() => setEditIcon(ic)}
                                      className={cn('w-9 h-9 rounded-xl text-xl flex items-center justify-center transition-all active:scale-90', editIcon === ic ? 'bg-brand-navy/10 ring-2 ring-brand-navy/30' : 'bg-brand-navy/5 hover:bg-brand-navy/10')}
                                    >{ic}</button>
                                  ))}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => setEditingId(null)} className="flex-1 py-2.5 rounded-2xl border border-brand-navy/15 text-brand-navy/60 font-bold text-sm active:scale-[0.98] transition-all">Cancel</button>
                                <button onClick={handleUpdate} disabled={editSaving || !editName.trim() || !editThreshold} className="flex-1 py-2.5 rounded-2xl bg-brand-navy text-white font-bold text-sm disabled:opacity-40 active:scale-[0.98] transition-all">
                                  {editSaving ? 'Saving…' : 'Save changes'}
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function AdminStoresPanel({ onClose }: { onClose: () => void }) {
  const [stores, setStores] = useState<StoreProfile[]>([]);
  const [search, setSearch] = useState('');
  const [editingStore, setEditingStore] = useState<StoreProfile | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    return onSnapshot(collection(db, 'stores'), snap =>
      setStores(snap.docs.map(d => ({ id: d.id, ...d.data() } as StoreProfile)).sort((a, b) => (a.name || '').localeCompare(b.name || '')))
    , () => {});
  }, []);

  const filtered = search.trim()
    ? stores.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()))
    : stores;

  const handleDelete = async (storeId: string) => {
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'stores', storeId));
      setConfirmDeleteId(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 bg-brand-bg z-[200] flex flex-col max-w-md mx-auto"
    >
      <header className="glass-panel px-5 py-4 flex items-center gap-3">
        <button onClick={onClose} className="p-2 -ml-2 text-brand-navy/60"><ArrowLeft size={22} /></button>
        <div className="flex-1">
          <p className="text-[10px] font-bold text-brand-navy/40 uppercase tracking-widest">Admin</p>
          <h2 className="font-bold text-brand-navy text-base">Businesses</h2>
        </div>
      </header>

      <div className="px-5 pt-3 pb-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search businesses…"
          className="w-full px-4 py-2.5 rounded-2xl bg-white border border-brand-navy/10 text-sm text-brand-navy outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-2 space-y-2 pb-10">
        {filtered.map(store => (
          <div key={store.id} className="bg-white rounded-2xl border border-brand-navy/5 overflow-hidden">
            {confirmDeleteId === store.id ? (
              <div className="px-4 py-3 flex items-center gap-3">
                <p className="flex-1 text-xs font-bold text-red-500">Delete "{store.name}"?</p>
                <button
                  onClick={() => handleDelete(store.id)}
                  disabled={deleting}
                  className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-xl active:scale-95 transition-all disabled:opacity-50"
                >
                  {deleting ? '…' : 'Delete'}
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-3 py-1.5 bg-brand-navy/10 text-brand-navy text-xs font-bold rounded-xl active:scale-95 transition-all"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3">
                <div
                  className="w-10 h-10 rounded-xl overflow-hidden bg-brand-navy/5 shrink-0 cursor-pointer"
                  onClick={() => setEditingStore(store)}
                >
                  {store.logoUrl
                    ? <img src={store.logoUrl} alt="" className="w-full h-full object-cover" />
                    : <Building2 size={18} className="m-auto mt-2.5 text-brand-navy/20" />}
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setEditingStore(store)}>
                  <p className="font-bold text-sm text-brand-navy truncate">{store.name}</p>
                  <p className="text-[10px] text-brand-navy/40">{store.category}{store.location ? ` · ${store.location}` : ''}</p>
                </div>
                <button
                  onClick={() => setEditingStore(store)}
                  className="p-2 text-brand-navy/30 hover:text-brand-navy/60 transition-colors"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  onClick={() => setConfirmDeleteId(store.id)}
                  className="p-2 text-red-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-brand-navy/30 text-sm py-10">No businesses found</p>
        )}
      </div>

      <AnimatePresence>
        {editingStore && (
          <AdminStoreEditModal store={editingStore} onClose={() => setEditingStore(null)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AdminMenuModal({ onClose, onOpenChallenges, onOpenBadges, onOpenStores, onOpenUsers, onOpenPosts }: { onClose: () => void; onOpenChallenges: () => void; onOpenBadges: () => void; onOpenStores: () => void; onOpenUsers: () => void; onOpenPosts: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col max-w-md mx-auto"
    >
      <div className="flex-1 overflow-y-auto bg-brand-bg">
        <div className="sticky top-0 bg-brand-bg/95 backdrop-blur-sm px-5 pt-5 pb-4 border-b border-black/5 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-brand-navy">Admin</h2>
              <p className="text-xs text-brand-navy/50 mt-0.5">Platform management</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-2xl bg-white border border-black/5 shadow-sm active:scale-95 transition-all">
              <X size={18} className="text-brand-navy/60" />
            </button>
          </div>
        </div>

        <div className="p-5 grid grid-cols-2 gap-4">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onOpenChallenges}
            className="rounded-[2rem] bg-white border border-black/5 shadow-sm p-6 flex flex-col items-start gap-3 text-left active:bg-brand-navy/5 transition-colors"
          >
            <div className="w-12 h-12 rounded-2xl bg-brand-gold/10 flex items-center justify-center">
              <Trophy size={22} className="text-brand-gold" />
            </div>
            <div>
              <p className="font-bold text-brand-navy text-sm">Challenges</p>
              <p className="text-[11px] text-brand-navy/40 mt-0.5">Create & manage active challenges</p>
            </div>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onOpenBadges}
            className="rounded-[2rem] bg-white border border-black/5 shadow-sm p-6 flex flex-col items-start gap-3 text-left active:bg-brand-navy/5 transition-colors"
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center">
              <Award size={22} className="text-purple-500" />
            </div>
            <div>
              <p className="font-bold text-brand-navy text-sm">Badges</p>
              <p className="text-[11px] text-brand-navy/40 mt-0.5">Design achievement badges</p>
            </div>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onOpenStores}
            className="rounded-[2rem] bg-white border border-black/5 shadow-sm p-6 flex flex-col items-start gap-3 text-left active:bg-brand-navy/5 transition-colors"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center">
              <Store size={22} className="text-emerald-500" />
            </div>
            <div>
              <p className="font-bold text-brand-navy text-sm">Businesses</p>
              <p className="text-[11px] text-brand-navy/40 mt-0.5">Edit & delete business profiles</p>
            </div>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onOpenUsers}
            className="rounded-[2rem] bg-white border border-black/5 shadow-sm p-6 flex flex-col items-start gap-3 text-left active:bg-brand-navy/5 transition-colors"
          >
            <div className="w-12 h-12 rounded-2xl bg-sky-100 flex items-center justify-center">
              <UserIcon size={22} className="text-sky-500" />
            </div>
            <div>
              <p className="font-bold text-brand-navy text-sm">Users</p>
              <p className="text-[11px] text-brand-navy/40 mt-0.5">Search & delete user accounts</p>
            </div>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onOpenPosts}
            className="rounded-[2rem] bg-white border border-black/5 shadow-sm p-6 flex flex-col items-start gap-3 text-left active:bg-brand-navy/5 transition-colors"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center">
              <Flag size={22} className="text-rose-500" />
            </div>
            <div>
              <p className="font-bold text-brand-navy text-sm">Posts</p>
              <p className="text-[11px] text-brand-navy/40 mt-0.5">All posts & flagged content</p>
            </div>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

function AdminUsersPanel({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    return onSnapshot(collection(db, 'users'), snap =>
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)).sort((a, b) => (a.name || '').localeCompare(b.name || '')))
    , () => {});
  }, []);

  const filtered = search.trim()
    ? users.filter(u =>
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.handle?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())
      )
    : users;

  const handleDelete = async (uid: string) => {
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'users', uid));
      await deleteDoc(doc(db, 'vendors', uid)).catch(() => {});
      setConfirmDeleteUid(null);
    } finally {
      setDeleting(false);
    }
  };

  const roleColor: Record<string, string> = {
    admin: 'bg-brand-gold/20 text-brand-gold',
    vendor: 'bg-emerald-100 text-emerald-600',
    consumer: 'bg-sky-100 text-sky-600',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 bg-brand-bg z-[200] flex flex-col max-w-md mx-auto"
    >
      <header className="glass-panel px-5 py-4 flex items-center gap-3">
        <button onClick={onClose} className="p-2 -ml-2 text-brand-navy/60"><ArrowLeft size={22} /></button>
        <div className="flex-1">
          <p className="text-[10px] font-bold text-brand-navy/40 uppercase tracking-widest">Admin</p>
          <h2 className="font-bold text-brand-navy text-base">Users</h2>
        </div>
        <span className="text-xs text-brand-navy/40 font-semibold">{users.length} total</span>
      </header>

      <div className="px-5 pt-3 pb-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, handle, or email…"
          className="w-full px-4 py-2.5 rounded-2xl bg-white border border-brand-navy/10 text-sm text-brand-navy outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-2 space-y-2 pb-10">
        {filtered.map(u => (
          <div key={u.uid} className="bg-white rounded-2xl border border-brand-navy/5 overflow-hidden">
            {confirmDeleteUid === u.uid ? (
              <div className="px-4 py-3 flex items-center gap-3">
                <p className="flex-1 text-xs font-bold text-red-500">Delete "{u.name}"?</p>
                <button
                  onClick={() => handleDelete(u.uid)}
                  disabled={deleting}
                  className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-xl active:scale-95 transition-all disabled:opacity-50"
                >
                  {deleting ? '…' : 'Delete'}
                </button>
                <button
                  onClick={() => setConfirmDeleteUid(null)}
                  className="px-3 py-1.5 bg-brand-navy/10 text-brand-navy text-xs font-bold rounded-xl active:scale-95 transition-all"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-xl overflow-hidden bg-brand-navy/5 shrink-0">
                  {u.photoURL
                    ? <img src={u.photoURL} alt="" className="w-full h-full object-cover" />
                    : <UserIcon size={16} className="m-auto mt-2 text-brand-navy/20" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="font-bold text-sm text-brand-navy truncate">{u.name || '—'}</p>
                    <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0', roleColor[u.role] || 'bg-brand-navy/10 text-brand-navy/60')}>{u.role}</span>
                  </div>
                  <p className="text-[10px] text-brand-navy/40 truncate">{u.handle ? `@${u.handle}` : u.email}</p>
                </div>
                <button
                  onClick={() => setConfirmDeleteUid(u.uid)}
                  className="p-2 text-red-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-brand-navy/30 text-sm py-10">No users found</p>
        )}
      </div>
    </motion.div>
  );
}

function AdminPostsPanel({ onClose }: { onClose: () => void }) {
  const [posts, setPosts] = useState<GlobalPost[]>([]);
  const [flaggedPosts, setFlaggedPosts] = useState<GlobalPost[]>([]);
  const [reportedPostIds, setReportedPostIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'all' | 'flagged'>('all');
  const [search, setSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const unsub1 = onSnapshot(
      query(collection(db, 'global_posts'), orderBy('createdAt', 'desc'), limit(200)),
      snap => setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as GlobalPost))),
      () => {}
    );
    const unsub2 = onSnapshot(collection(db, 'reports'), async snap => {
      const ids = [...new Set(snap.docs.map(d => d.data().postId).filter(Boolean))] as string[];
      setReportedPostIds(new Set(ids));
      if (ids.length === 0) { setFlaggedPosts([]); return; }
      const fetched: GlobalPost[] = [];
      for (const id of ids) {
        try {
          const d = await getDoc(doc(db, 'global_posts', id));
          if (d.exists()) fetched.push({ id: d.id, ...d.data() } as GlobalPost);
        } catch {}
      }
      setFlaggedPosts(fetched);
    }, () => {});
    return () => { unsub1(); unsub2(); };
  }, []);

  const base = tab === 'flagged' ? flaggedPosts : posts;

  const filtered = search.trim()
    ? base.filter(p =>
        p.authorName?.toLowerCase().includes(search.toLowerCase()) ||
        p.content?.toLowerCase().includes(search.toLowerCase())
      )
    : base;

  const handleDelete = async (postId: string) => {
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'global_posts', postId));
      setFlaggedPosts(prev => prev.filter(p => p.id !== postId));
      setConfirmDeleteId(null);
    } finally {
      setDeleting(false);
    }
  };

  const formatAge = (ts: any) => {
    if (!ts?.toDate) return '';
    const diff = Date.now() - ts.toDate().getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 bg-brand-bg z-[200] flex flex-col max-w-md mx-auto"
    >
      <header className="glass-panel px-5 py-4 flex items-center gap-3">
        <button onClick={onClose} className="p-2 -ml-2 text-brand-navy/60"><ArrowLeft size={22} /></button>
        <div className="flex-1">
          <p className="text-[10px] font-bold text-brand-navy/40 uppercase tracking-widest">Admin</p>
          <h2 className="font-bold text-brand-navy text-base">Posts</h2>
        </div>
        {tab === 'flagged' && reportedPostIds.size > 0 && (
          <span className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">{reportedPostIds.size} flagged</span>
        )}
      </header>

      <div className="px-5 pt-3 pb-2 space-y-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by user or content…"
          className="w-full px-4 py-2.5 rounded-2xl bg-white border border-brand-navy/10 text-sm text-brand-navy outline-none"
        />
        <div className="flex gap-2">
          {(['all', 'flagged'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 py-2 rounded-2xl text-xs font-bold transition-all',
                tab === t ? 'bg-brand-navy text-white' : 'bg-white border border-brand-navy/10 text-brand-navy/50'
              )}
            >
              {t === 'all' ? 'All Posts' : `Flagged${reportedPostIds.size > 0 ? ` (${reportedPostIds.size})` : ''}`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-2 space-y-2 pb-10">
        {filtered.map(post => (
          <div key={post.id} className="bg-white rounded-2xl border border-brand-navy/5 overflow-hidden">
            {confirmDeleteId === post.id ? (
              <div className="px-4 py-3 flex items-center gap-3">
                <p className="flex-1 text-xs font-bold text-red-500">Delete this post?</p>
                <button
                  onClick={() => handleDelete(post.id)}
                  disabled={deleting}
                  className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-xl active:scale-95 transition-all disabled:opacity-50"
                >
                  {deleting ? '…' : 'Delete'}
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-3 py-1.5 bg-brand-navy/10 text-brand-navy text-xs font-bold rounded-xl active:scale-95 transition-all"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="px-4 py-3">
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-full overflow-hidden bg-brand-navy/5 shrink-0 mt-0.5">
                    {post.authorPhoto
                      ? <img src={post.authorPhoto} alt="" className="w-full h-full object-cover" />
                      : <UserIcon size={12} className="m-auto mt-1 text-brand-navy/20" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-brand-navy">{post.authorName || 'Unknown'}</span>
                      {reportedPostIds.has(post.id) && (
                        <span className="text-[9px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-full">Flagged</span>
                      )}
                      <span className="text-[10px] text-brand-navy/30 ml-auto">{formatAge(post.createdAt)}</span>
                    </div>
                    <p className="text-xs text-brand-navy/70 mt-0.5 line-clamp-2">{post.content}</p>
                  </div>
                  <button
                    onClick={() => setConfirmDeleteId(post.id)}
                    className="p-1.5 text-red-400 hover:text-red-600 transition-colors shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-brand-navy/30 text-sm py-10">
            {tab === 'flagged' ? 'No flagged posts' : 'No posts found'}
          </p>
        )}
      </div>
    </motion.div>
  );
}

function ChallengesAdminPanel({ onClose }: { onClose: () => void }) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [collectibles, setCollectibles] = useState<Challenge[]>([]);
  const [deploying, setDeploying] = useState(false);
  const [deployingCollectible, setDeployingCollectible] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [restartingId, setRestartingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmRestart, setConfirmRestart] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedPlayers, setExpandedPlayers] = useState<string | null>(null);
  const [playerProfiles, setPlayerProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [challengeEntries, setChallengeEntries] = useState<Map<string, { uid: string; count: number }[]>>(new Map());
  const [expandedProgramme, setExpandedProgramme] = useState<string | null>(null);
  const [programmePlayerData, setProgrammePlayerData] = useState<Map<string, { uid: string; profile?: UserProfile; card: StickerCardDoc }[]>>(new Map());
  const [loadingProgramme, setLoadingProgramme] = useState(false);

  // All stores for vendor picker
  const [allStores, setAllStores] = useState<StoreProfile[]>([]);
  const [vendorPickerOpen, setVendorPickerOpen] = useState(false);
  const [stdVendorIds, setStdVendorIds] = useState<string[]>([]);

  useEffect(() => {
    getDocs(collection(db, 'stores')).then(snap => {
      setAllStores(snap.docs.map(d => ({ id: d.id, ...d.data() } as StoreProfile)));
    });
  }, []);

  const toggleVendor = (id: string) =>
    setStdVendorIds(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);

  const allSelected = allStores.length > 0 && stdVendorIds.length === allStores.length;

  // Standard form state
  const [stdTitle, setStdTitle] = useState('');
  const [stdDesc, setStdDesc] = useState('');
  const [stdGoal, setStdGoal] = useState('');
  const [stdUnit, setStdUnit] = useState('');
  const [stdReward, setStdReward] = useState('');
  const [stdRewardTag, setStdRewardTag] = useState<'product' | 'experience' | 'service' | ''>('');
  const [stdIsAvatarPrize, setStdIsAvatarPrize] = useState(false);
  const [stdAvatarPrizeItemId, setStdAvatarPrizeItemId] = useState('');
  const [stdImageUrl, setStdImageUrl] = useState('');
  const [stdImageUploading, setStdImageUploading] = useState(false);

  // Collectible programme form state
  const [colTitle, setColTitle] = useState('');
  const [colReward, setColReward] = useState('');
  const [colEndsAt, setColEndsAt] = useState('');
  const [stdEndsAt, setStdEndsAt] = useState('');
  const [colChances, setColChances] = useState<{ brown: number; lightblue: number; red: number; blue: number; gold: number }>({ ...DEFAULT_TIER_CHANCES });
  const [colImageUrl, setColImageUrl] = useState('');
  const [colImageUploading, setColImageUploading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'challenges'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Challenge));
      setChallenges(all.filter(c => c.type !== 'collectible'));
      setCollectibles(all.filter(c => c.type === 'collectible'));
    });
  }, []);

  const handleDeployStandard = async () => {
    const g = parseInt(stdGoal);
    if (!stdTitle.trim() || !stdReward.trim() || !stdUnit.trim() || isNaN(g) || g < 1) return;
    setDeploying(true);
    try {
      await addDoc(collection(db, 'challenges'), {
        title: stdTitle.trim(),
        description: stdDesc.trim() || `Reach ${g} ${stdUnit} to win.`,
        reward: stdReward.trim(),
        type: 'standard',
        status: 'active',
        goal: g,
        unit: stdUnit.trim(),
        participantUids: [],
        createdAt: serverTimestamp(),
        ...(stdEndsAt ? { endsAt: Timestamp.fromDate(new Date(stdEndsAt)) } : {}),
        ...(stdVendorIds.length > 0 ? { vendorIds: stdVendorIds } : {}),
        ...(stdRewardTag ? { rewardTag: stdRewardTag } : {}),
        ...(stdIsAvatarPrize && stdAvatarPrizeItemId ? { isAvatarPrize: true, avatarPrizeItemId: stdAvatarPrizeItemId } : {}),
        ...(stdImageUrl ? { imageUrl: stdImageUrl } : {}),
      });
      setStdTitle(''); setStdDesc(''); setStdGoal(''); setStdUnit(''); setStdReward(''); setStdEndsAt(''); setStdVendorIds([]); setStdRewardTag(''); setStdIsAvatarPrize(false); setStdAvatarPrizeItemId(''); setStdImageUrl('');
    } finally {
      setDeploying(false);
    }
  };

  const handleDeployCollectible = async () => {
    const total = sumChances(colChances);
    if (!colTitle.trim() || !colReward.trim() || Math.round(total) !== 100) return;
    setDeployingCollectible(true);
    try {
      await addDoc(collection(db, 'challenges'), {
        title: colTitle.trim(),
        reward: colReward.trim(),
        type: 'collectible',
        status: 'active',
        participantUids: [],
        tierChances: colChances,
        createdAt: serverTimestamp(),
        ...(colEndsAt ? { endsAt: Timestamp.fromDate(new Date(colEndsAt)) } : {}),
        ...(colImageUrl ? { imageUrl: colImageUrl } : {}),
      });
      setColTitle(''); setColReward(''); setColEndsAt(''); setColChances({ ...DEFAULT_TIER_CHANCES }); setColImageUrl('');
    } finally {
      setDeployingCollectible(false);
    }
  };

  const handleSetEndsAt = async (id: string, value: string) => {
    if (!value) {
      await updateDoc(doc(db, 'challenges', id), { endsAt: null });
    } else {
      await updateDoc(doc(db, 'challenges', id), { endsAt: Timestamp.fromDate(new Date(value)) });
    }
  };

  const handleUpdateChances = async (id: string, chances: { brown: number; lightblue: number; red: number; blue: number; gold: number }) => {
    await updateDoc(doc(db, 'challenges', id), { tierChances: chances });
  };

  const handleToggleStatus = async (c: Challenge) => {
    setTogglingId(c.id);
    const next = c.status === 'active' ? 'paused' : 'active';
    await updateDoc(doc(db, 'challenges', c.id), { status: next });
    setTogglingId(null);
  };

  const handleRestart = async (challengeId: string) => {
    setRestartingId(challengeId);
    const entriesSnap = await getDocs(query(collection(db, 'challenge_entries'), where('challengeId', '==', challengeId)));
    await Promise.all(entriesSnap.docs.map(d => deleteDoc(d.ref)));
    await updateDoc(doc(db, 'challenges', challengeId), { participantUids: [], status: 'active' });
    setRestartingId(null);
    setConfirmRestart(null);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const entriesSnap = await getDocs(query(collection(db, 'challenge_entries'), where('challengeId', '==', id)));
    await Promise.all(entriesSnap.docs.map(d => deleteDoc(d.ref)));
    await deleteDoc(doc(db, 'challenges', id));
    setDeletingId(null);
    setConfirmDelete(null);
    if (expandedPlayers === id) setExpandedPlayers(null);
  };

  const handleTogglePlayers = async (c: Challenge) => {
    if (expandedPlayers === c.id) { setExpandedPlayers(null); return; }
    setExpandedPlayers(c.id);
    setLoadingPlayers(true);
    try {
      const uids = (c.participantUids || []).filter(uid => !playerProfiles.has(uid));
      if (uids.length > 0) {
        const chunks: string[][] = [];
        for (let i = 0; i < uids.length; i += 10) chunks.push(uids.slice(i, i + 10));
        const results = await Promise.all(chunks.map(chunk => getDocs(query(collection(db, 'users'), where('uid', 'in', chunk)))));
        const updated = new Map(playerProfiles);
        results.forEach(snap => snap.docs.forEach(d => updated.set(d.id, { uid: d.id, ...d.data() } as UserProfile)));
        setPlayerProfiles(updated);
      }
      if (!challengeEntries.has(c.id)) {
        const entriesSnap = await getDocs(query(collection(db, 'challenge_entries'), where('challengeId', '==', c.id)));
        const entries = entriesSnap.docs.map(d => ({ uid: d.data().uid as string, count: (d.data().count as number) || 0 }));
        setChallengeEntries(prev => { const m = new Map<string, { uid: string; count: number }[]>(prev); m.set(c.id, entries); return m; });
      }
    } finally {
      setLoadingPlayers(false);
    }
  };

  const handleToggleProgramme = async (c: Challenge) => {
    if (expandedProgramme === c.id) { setExpandedProgramme(null); return; }
    setExpandedProgramme(c.id);
    if (programmePlayerData.has(c.id)) return;
    setLoadingProgramme(true);
    try {
      const cardsSnap = await getDocs(query(collection(db, 'sticker_cards'), where('programme_id', '==', c.id)));
      const cards = cardsSnap.docs.map(d => ({ id: d.id, ...d.data() } as StickerCardDoc));
      const uids = cards.map(card => card.user_id).filter(Boolean);
      const profileMap = new Map<string, UserProfile>();
      if (uids.length > 0) {
        const chunks: string[][] = [];
        for (let i = 0; i < uids.length; i += 10) chunks.push(uids.slice(i, i + 10));
        const results = await Promise.all(chunks.map(chunk => getDocs(query(collection(db, 'users'), where('uid', 'in', chunk)))));
        results.forEach(snap => snap.docs.forEach(d => profileMap.set(d.id, { uid: d.id, ...d.data() } as UserProfile)));
      }
      const playerEntries = cards.map(card => ({ uid: card.user_id, profile: profileMap.get(card.user_id), card }));
      setProgrammePlayerData((prev: Map<string, { uid: string; profile?: UserProfile; card: StickerCardDoc }[]>) => { const m = new Map(prev); m.set(c.id, playerEntries); return m; });
    } finally {
      setLoadingProgramme(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-xl bg-white border border-brand-navy/10 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-gold/40 placeholder:text-brand-navy/30';

  const ChallengeCard = ({ c }: { c: Challenge; key?: React.Key }) => {
    const isActive = c.status === 'active';
    const playerCount = c.participantUids?.length ?? 0;
    const showPlayers = expandedPlayers === c.id;
    return (
      <div className="glass-card rounded-3xl overflow-hidden">
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-brand-navy text-sm truncate">{c.title}</p>
              <div className="flex gap-1.5 mt-1 flex-wrap text-[10px]">
                <span className={cn('px-1.5 py-0.5 rounded-full font-bold uppercase',
                  isActive ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600')}>
                  {c.status || 'active'}
                </span>
                <span className="bg-brand-navy/5 text-brand-navy/50 px-1.5 py-0.5 rounded-full">
                  {playerCount} player{playerCount !== 1 ? 's' : ''}
                </span>
                <span className="bg-brand-gold/10 text-brand-gold font-semibold px-1.5 py-0.5 rounded-full">
                  🎁 {c.reward}
                </span>
              </div>
            </div>
            <button
              onClick={() => setConfirmDelete(c.id)}
              disabled={deletingId === c.id}
              className="p-2 rounded-xl bg-brand-rose/10 text-brand-rose active:scale-95 transition-all disabled:opacity-50 flex-shrink-0"
            >
              <Trash2 size={13} />
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleToggleStatus(c)}
              disabled={togglingId === c.id}
              className={cn(
                'flex-1 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all',
                isActive ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-green-50 text-green-700 border border-green-200'
              )}
            >
              {togglingId === c.id ? '...' : isActive ? <><Archive size={12} /> Pause</> : <><Zap size={12} /> Resume</>}
            </button>
            <button
              onClick={() => setConfirmRestart(c.id)}
              disabled={restartingId === c.id}
              className="flex-1 py-2.5 rounded-2xl text-xs font-bold bg-brand-navy/5 text-brand-navy/60 border border-brand-navy/10 flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
            >
              <RefreshCw size={12} /> Restart
            </button>
            <button
              onClick={() => handleTogglePlayers(c)}
              className={cn(
                'flex-1 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all border',
                showPlayers ? 'bg-brand-navy text-white border-brand-navy' : 'bg-brand-navy/5 text-brand-navy/60 border-brand-navy/10'
              )}
            >
              <Users size={12} /> Players
            </button>
          </div>

          <div className="flex items-center gap-1.5 px-1">
            <Clock size={11} className="text-brand-navy/30 flex-shrink-0" />
            <input
              type="datetime-local"
              defaultValue={c.endsAt?.toDate ? c.endsAt.toDate().toISOString().slice(0, 16) : ''}
              onChange={e => handleSetEndsAt(c.id, e.target.value)}
              className="flex-1 text-[10px] text-brand-navy/50 bg-transparent border-none outline-none"
            />
            {c.endsAt && (
              <span className="text-[10px] font-bold text-brand-navy/40 flex-shrink-0">
                <CountdownTimer endsAt={c.endsAt} />
              </span>
            )}
          </div>

          <AnimatePresence>
            {showPlayers && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="pt-1 space-y-1.5 max-h-60 overflow-y-auto">
                  {playerCount === 0 ? (
                    <p className="text-xs text-brand-navy/40 text-center py-3">No players yet.</p>
                  ) : loadingPlayers ? (
                    <p className="text-xs text-brand-navy/40 text-center py-3">Loading...</p>
                  ) : (
                    (c.participantUids || []).map(uid => {
                      const p = playerProfiles.get(uid);
                      const entry = challengeEntries.get(c.id)?.find((e: { uid: string; count: number }) => e.uid === uid);
                      const count = entry?.count ?? 0;
                      const pct = c.goal ? Math.min(100, Math.round((count / c.goal) * 100)) : 0;
                      return (
                        <div key={uid} className="px-3 py-2.5 rounded-xl bg-brand-bg flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 bg-brand-navy/10">
                            {p?.photoURL ? <img src={p.photoURL} alt="" className="w-full h-full object-cover" /> : null}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-brand-navy truncate">{p?.name || 'Player'}</p>
                            {p?.handle && <p className="text-[10px] text-brand-navy/40">@{p.handle}</p>}
                            {c.goal && (
                              <div className="mt-1.5 space-y-0.5">
                                <div className="h-1 rounded-full bg-brand-navy/10 overflow-hidden">
                                  <div className="h-full rounded-full bg-brand-navy/40 transition-all" style={{ width: `${pct}%` }} />
                                </div>
                                <p className="text-[10px] text-brand-navy/40">{count}/{c.goal} {c.unit}</p>
                              </div>
                            )}
                          </div>
                          {pct >= 100 && <span className="text-[10px] font-bold text-green-600 flex-shrink-0">Done!</span>}
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {confirmRestart === c.id && (
            <div className="rounded-2xl bg-brand-rose/10 border border-brand-rose/20 p-3 space-y-2">
              <p className="text-xs font-bold text-brand-rose text-center">Restart will erase ALL player progress. Continue?</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmRestart(null)} className="flex-1 py-2 rounded-xl bg-white text-brand-navy/60 text-xs font-bold border border-brand-navy/10">Cancel</button>
                <button
                  onClick={() => handleRestart(c.id)}
                  disabled={restartingId === c.id}
                  className="flex-1 py-2 rounded-xl bg-brand-rose text-white text-xs font-bold disabled:opacity-50"
                >
                  {restartingId === c.id ? 'Restarting...' : 'Yes, Restart'}
                </button>
              </div>
            </div>
          )}

          {confirmDelete === c.id && (
            <div className="rounded-2xl bg-brand-rose/10 border border-brand-rose/20 p-3 space-y-2">
              <p className="text-xs font-bold text-brand-rose text-center">Delete will permanently remove this challenge and all entries.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2 rounded-xl bg-white text-brand-navy/60 text-xs font-bold border border-brand-navy/10">Cancel</button>
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={deletingId === c.id}
                  className="flex-1 py-2 rounded-xl bg-brand-rose text-white text-xs font-bold disabled:opacity-50"
                >
                  {deletingId === c.id ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col max-w-md mx-auto"
    >
      <div className="flex-1 overflow-y-auto bg-brand-bg">
        <div className="sticky top-0 bg-brand-bg/95 backdrop-blur-sm px-5 pt-5 pb-4 border-b border-black/5 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-brand-navy">Admin Panel</h2>
              <p className="text-xs text-brand-navy/50 mt-0.5">Manage challenges</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-2xl bg-white border border-black/5 shadow-sm active:scale-95 transition-all">
              <X size={18} className="text-brand-navy/60" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-6">
          <div className="rounded-3xl overflow-hidden border-2 border-dashed border-brand-navy/20 p-5 space-y-3 bg-white">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-brand-navy/50" />
              <h3 className="font-bold text-brand-navy text-sm">Standard Challenge</h3>
            </div>
            <p className="text-xs text-brand-navy/50">
              Goal-based challenge — players track progress toward a target number.
            </p>
            <input value={stdTitle} onChange={e => setStdTitle(e.target.value)} placeholder="Challenge name" className={inputCls} />
            <input value={stdDesc} onChange={e => setStdDesc(e.target.value)} placeholder="Description (optional)" className={inputCls} />
            <div className="flex gap-2">
              <input value={stdGoal} onChange={e => setStdGoal(e.target.value)} placeholder="Goal (e.g. 10)" type="number" min="1" className={cn(inputCls, 'w-24 flex-shrink-0')} />
              <input value={stdUnit} onChange={e => setStdUnit(e.target.value)} placeholder="Unit (e.g. stamps)" className={cn(inputCls, 'flex-1')} />
            </div>
            <input value={stdReward} onChange={e => setStdReward(e.target.value)} placeholder="Prize (e.g. Free coffee)" className={inputCls} />
            <select
              value={stdRewardTag}
              onChange={e => setStdRewardTag(e.target.value as typeof stdRewardTag)}
              className={cn(inputCls, 'appearance-none')}
            >
              <option value="">Reward type (optional)</option>
              <option value="product">Product</option>
              <option value="experience">Experience</option>
              <option value="service">Service</option>
            </select>
            <div className="flex items-center gap-2">
              <label className="text-xs text-brand-navy/50 flex-shrink-0">End date</label>
              <input type="datetime-local" value={stdEndsAt} onChange={e => setStdEndsAt(e.target.value)} className={cn(inputCls, 'flex-1 text-xs')} />
            </div>

            {/* Vendor picker */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setVendorPickerOpen(p => !p)}
                className={cn(inputCls, 'w-full flex items-center justify-between text-left')}
              >
                <span className={stdVendorIds.length === 0 ? 'text-brand-navy/40' : 'text-brand-navy'}>
                  {stdVendorIds.length === 0
                    ? 'Include vendors (default: all)'
                    : allSelected
                      ? 'All vendors'
                      : `${stdVendorIds.length} vendor${stdVendorIds.length > 1 ? 's' : ''} selected`}
                </span>
                <ChevronDown size={14} className={cn('text-brand-navy/40 transition-transform', vendorPickerOpen && 'rotate-180')} />
              </button>
              {vendorPickerOpen && (
                <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-brand-navy/10 rounded-2xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                  {/* All option */}
                  <label className="flex items-center gap-3 px-4 py-3 hover:bg-brand-navy/5 cursor-pointer border-b border-brand-navy/5">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => setStdVendorIds(allSelected ? [] : allStores.map(s => s.id))}
                      className="accent-brand-navy w-4 h-4"
                    />
                    <span className="text-sm font-bold text-brand-navy">All vendors</span>
                  </label>
                  {allStores.map(s => (
                    <label key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-brand-navy/5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={stdVendorIds.includes(s.id)}
                        onChange={() => toggleVendor(s.id)}
                        className="accent-brand-navy w-4 h-4"
                      />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {s.logoUrl
                          ? <img src={s.logoUrl} alt="" className="w-6 h-6 rounded-lg object-cover shrink-0" />
                          : <div className="w-6 h-6 rounded-lg bg-brand-navy/10 shrink-0" />}
                        <span className="text-sm text-brand-navy truncate">{s.name}</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Avatar item prize toggle */}
            <label className="flex items-center gap-3 p-3 rounded-2xl bg-purple-50 border border-purple-200 cursor-pointer">
              <input
                type="checkbox"
                checked={stdIsAvatarPrize}
                onChange={e => { setStdIsAvatarPrize(e.target.checked); if (!e.target.checked) setStdAvatarPrizeItemId(''); }}
                className="accent-purple-600 w-4 h-4"
              />
              <span className="text-sm font-bold text-purple-800">🎨 Avatar item prize</span>
            </label>
            {stdIsAvatarPrize && (
              <select
                value={stdAvatarPrizeItemId}
                onChange={e => setStdAvatarPrizeItemId(e.target.value)}
                className="w-full bg-white border border-purple-200 rounded-2xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              >
                <option value="">Select avatar item prize…</option>
                {AVATAR_ITEMS.filter(i => i.rarity !== 'starter').map(item => (
                  <option key={item.id} value={item.id}>{item.name} ({item.type} · {item.rarity})</option>
                ))}
              </select>
            )}

            {/* Challenge image upload */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-brand-navy/50">Challenge image (optional)</label>
              <div className="flex items-center gap-3">
                <label className={cn('flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-brand-navy/20 text-sm font-semibold text-brand-navy/50 cursor-pointer transition-all', stdImageUploading ? 'opacity-50 pointer-events-none' : 'hover:border-brand-gold/50 hover:text-brand-navy active:scale-[0.98]')}>
                  {stdImageUploading ? 'Uploading...' : '📁 Upload image'}
                  <input type="file" accept="image/*" className="hidden" onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setStdImageUploading(true);
                    try {
                      const path = `challenge_images/${Date.now()}_${file.name}`;
                      const snap = await uploadBytes(storageRef(storage, path), file);
                      setStdImageUrl(await getDownloadURL(snap.ref));
                    } finally {
                      setStdImageUploading(false);
                    }
                  }} />
                </label>
                {stdImageUrl && (
                  <div className="relative shrink-0">
                    <img src={stdImageUrl} alt="" className="w-14 h-14 rounded-2xl object-cover border border-brand-navy/10" />
                    <button onClick={() => setStdImageUrl('')} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold">×</button>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleDeployStandard}
              disabled={deploying || !stdTitle.trim() || !stdReward.trim() || !stdUnit.trim() || !stdGoal || (stdIsAvatarPrize && !stdAvatarPrizeItemId)}
              className="w-full bg-brand-navy text-white font-bold py-3 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
              <Zap size={15} /> {deploying ? 'Deploying...' : 'Deploy Challenge'}
            </button>
          </div>

          {/* Collectible Sticker Programme */}
          <div className="rounded-3xl overflow-hidden border-2 border-dashed border-amber-300 p-5 space-y-3 bg-amber-50">
            <div className="flex items-center gap-2">
              <span className="text-lg">★</span>
              <h3 className="font-bold text-amber-800 text-sm">Monopoly Sticker Programme</h3>
            </div>
            <p className="text-xs text-amber-700/70">
              Platform-wide collectible game — 5 tiers (Brown → Gold). Every stamp issued awards 1 random sticker.
            </p>
            <input value={colTitle} onChange={e => setColTitle(e.target.value)} placeholder="Programme name (e.g. Season 1)" className={inputCls} />
            <input value={colReward} onChange={e => setColReward(e.target.value)} placeholder="Full-set reward (e.g. £50 voucher)" className={inputCls} />
            <div className="flex items-center gap-2">
              <label className="text-xs text-amber-700/60 flex-shrink-0">End date</label>
              <input type="datetime-local" value={colEndsAt} onChange={e => setColEndsAt(e.target.value)} className={cn(inputCls, 'flex-1 text-xs')} />
            </div>
            {/* Tier drop chances */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-amber-700/60 uppercase tracking-widest">Drop chances</p>
                <span className={cn('text-[10px] font-bold', Math.round(sumChances(colChances)) === 100 ? 'text-green-600' : 'text-red-500')}>
                  {sumChances(colChances)}% {Math.round(sumChances(colChances)) === 100 ? '✓' : '≠ 100'}
                </span>
              </div>
              {STICKER_ORDER.map(tier => {
                const cfg = STICKER_CONFIG[tier];
                return (
                  <div key={tier} className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ background: cfg.solid }} />
                    <span className="text-[10px] font-bold flex-1" style={{ color: cfg.color }}>{cfg.label}</span>
                    <input
                      type="number" min={0} max={100} step={1}
                      value={colChances[tier]}
                      onChange={e => setColChances(prev => ({ ...prev, [tier]: Math.max(0, parseFloat(e.target.value) || 0) }))}
                      className="w-16 px-2 py-1 rounded-lg bg-white border border-amber-200 text-xs text-right text-amber-800 focus:outline-none"
                    />
                    <span className="text-[10px] text-amber-700/50 w-4">%</span>
                  </div>
                );
              })}
            </div>
            {/* Programme image upload */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-amber-700/60">Programme image (optional)</label>
              <div className="flex items-center gap-3">
                <label className={cn('flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-amber-300 text-sm font-semibold text-amber-700/50 cursor-pointer transition-all', colImageUploading ? 'opacity-50 pointer-events-none' : 'hover:border-amber-500 hover:text-amber-700 active:scale-[0.98]')}>
                  {colImageUploading ? 'Uploading...' : '📁 Upload image'}
                  <input type="file" accept="image/*" className="hidden" onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setColImageUploading(true);
                    try {
                      const path = `challenge_images/${Date.now()}_${file.name}`;
                      const snap = await uploadBytes(storageRef(storage, path), file);
                      setColImageUrl(await getDownloadURL(snap.ref));
                    } finally {
                      setColImageUploading(false);
                    }
                  }} />
                </label>
                {colImageUrl && (
                  <div className="relative shrink-0">
                    <img src={colImageUrl} alt="" className="w-14 h-14 rounded-2xl object-cover border border-amber-200" />
                    <button onClick={() => setColImageUrl('')} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold">×</button>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleDeployCollectible}
              disabled={deployingCollectible || !colTitle.trim() || !colReward.trim() || Math.round(sumChances(colChances)) !== 100}
              className="w-full bg-amber-500 text-white font-bold py-3 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
              <Star size={15} /> {deployingCollectible ? 'Launching...' : 'Launch Programme'}
            </button>
            {collectibles.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700/50">Programmes</p>
                {collectibles.map(c => {
                  const showProg = expandedProgramme === c.id;
                  const progPlayers: { uid: string; profile?: UserProfile; card: StickerCardDoc }[] = programmePlayerData.get(c.id) || [];
                  return (
                    <div key={c.id} className="rounded-2xl bg-white border border-amber-200 overflow-hidden">
                      <div className="p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-amber-800 text-xs truncate">{c.title}</p>
                            <p className="text-[10px] text-amber-700/60">🎁 {c.reward}</p>
                          </div>
                          <button
                            onClick={() => handleToggleStatus(c)}
                            disabled={togglingId === c.id}
                            className={cn(
                              'px-2.5 py-1.5 rounded-xl text-[10px] font-bold flex-shrink-0',
                              c.status === 'active' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                            )}
                          >
                            {togglingId === c.id ? '...' : c.status === 'active' ? 'Pause' : 'Resume'}
                          </button>
                          <button
                            onClick={() => handleToggleProgramme(c)}
                            className={cn(
                              'p-1.5 rounded-xl flex-shrink-0 transition-all',
                              showProg ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-600'
                            )}
                          >
                            <Users size={12} />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(c.id)}
                            disabled={deletingId === c.id}
                            className="p-1.5 rounded-xl bg-red-50 text-brand-rose flex-shrink-0"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock size={10} className="text-amber-600/50 flex-shrink-0" />
                          <input
                            type="datetime-local"
                            defaultValue={c.endsAt?.toDate ? c.endsAt.toDate().toISOString().slice(0, 16) : ''}
                            onChange={e => handleSetEndsAt(c.id, e.target.value)}
                            className="flex-1 text-[10px] text-amber-800 bg-transparent border-none outline-none"
                          />
                          {c.endsAt && (
                            <span className="text-[9px] font-bold text-amber-600 flex-shrink-0">
                              <CountdownTimer endsAt={c.endsAt} />
                            </span>
                          )}
                        </div>
                      </div>

                      <AnimatePresence>
                        {showProg && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="overflow-hidden"
                          >
                            <div className="px-3 pb-3 space-y-1.5 border-t border-amber-100">
                              <div className="max-h-48 overflow-y-auto space-y-1.5 pt-1.5">
                                {loadingProgramme && !programmePlayerData.has(c.id) ? (
                                  <p className="text-[10px] text-amber-700/50 text-center py-3">Loading...</p>
                                ) : progPlayers.length === 0 ? (
                                  <p className="text-[10px] text-amber-700/50 text-center py-3">No players yet.</p>
                                ) : (
                                  progPlayers.map(({ uid, profile: p, card: sc }) => {
                                    const revealedIds = (sc.revealedIds || []) as string[];
                                    const revealedStickers = (sc.stickers || []).filter((s: CollectibleSticker) => revealedIds.includes(s.id));
                                    const sets = totalSetsCompleted(revealedStickers);
                                    const total = sc.stickers?.length ?? 0;
                                    const complete = allSetsWon(revealedStickers);
                                    return (
                                      <div key={uid} className="flex items-center gap-2 py-2">
                                        <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 bg-amber-100">
                                          {p?.photoURL ? <img src={p.photoURL} alt="" className="w-full h-full object-cover" /> : null}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[11px] font-bold text-amber-900 truncate">{p?.name || sc.userName || 'Player'}</p>
                                          <div className="flex gap-0.5 mt-0.5">
                                            {STICKER_ORDER.map(tier => (
                                              <div key={tier} className="w-3 h-3 rounded-sm"
                                                style={{ background: tierSetsCompleted(revealedStickers, tier) > 0 ? STICKER_CONFIG[tier].solid : '#E2E8F0' }} />
                                            ))}
                                          </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                          <p className="text-[10px] font-bold text-amber-700">{sets}/14</p>
                                          <p className="text-[9px] text-amber-600/60">{total} sticker{total !== 1 ? 's' : ''}</p>
                                        </div>
                                        {complete && <span className="text-[9px] font-black text-amber-600 flex-shrink-0">★</span>}
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                              {/* Inline tier chance editor */}
                              <ChanceEditor
                                chances={c.tierChances ?? { ...DEFAULT_TIER_CHANCES }}
                                onSave={chances => handleUpdateChances(c.id, chances)}
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {confirmDelete === c.id && (
                        <div className="mx-3 mb-3 rounded-2xl bg-white border border-brand-rose/30 p-3 space-y-2 shadow-lg">
                          <p className="text-xs font-bold text-brand-rose text-center">Delete programme and all sticker cards?</p>
                          <div className="flex gap-2">
                            <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2 rounded-xl bg-white text-brand-navy/60 text-xs font-bold border border-brand-navy/10">Cancel</button>
                            <button onClick={() => handleDelete(c.id)} disabled={deletingId === c.id} className="flex-1 py-2 rounded-xl bg-brand-rose text-white text-xs font-bold disabled:opacity-50">
                              {deletingId === c.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {challenges.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40 px-1">Standard Challenges</p>
              {challenges.map(c => <ChallengeCard key={c.id} c={c} />)}
            </div>
          )}

          {challenges.length === 0 && collectibles.length === 0 && (
            <p className="text-center text-brand-navy/40 text-sm py-8">No challenges yet. Deploy one above.</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// --- Programme Detail Modal (challenge popup) ---

function ProgrammeDetailModal({ prog, sc, onJoin, onView, onClose, joiningProgramId, joinError }: {
  prog: Challenge;
  sc?: StickerCardDoc;
  onJoin: () => void;
  onView: () => void;
  onClose: () => void;
  joiningProgramId: string | null;
  joinError: string | null;
  key?: React.Key;
}) {
  const [topPlayers, setTopPlayers] = useState<{ uid: string; userName?: string; userPhoto?: string; uniqueCards: number; stickers: number }[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);

  const joined = !!sc;
  const myRevealedStickers = (sc?.stickers || []).filter((s: CollectibleSticker) => (sc?.revealedIds || []).includes(s.id));
  const myTotalSets = totalSetsCompleted(myRevealedStickers);
  const unrevealed = (sc?.stickers || []).filter((s: CollectibleSticker) => !(sc?.revealedIds || []).includes(s.id));
  const isComplete = allSetsWon(myRevealedStickers);

  useEffect(() => {
    const totalUnique = STICKER_ORDER.reduce((s, t) => s + STICKER_CONFIG[t].variants.length, 0);
    getDocs(query(collection(db, 'sticker_cards'), where('programme_id', '==', prog.id))).then(snap => {
      const entries = snap.docs.map(d => {
        const data = d.data();
        const revealedIds = (data.revealedIds || []) as string[];
        const allStickers = (data.stickers || []) as CollectibleSticker[];
        const revealedStickers = allStickers.filter(s => revealedIds.includes(s.id));
        const uniqueCards = STICKER_ORDER.reduce((sum, tier) =>
          sum + STICKER_CONFIG[tier].variants.filter((_, vi) =>
            revealedStickers.some(s => s.tier === tier && (s.variant ?? 0) === vi)
          ).length, 0);
        return {
          uid: data.user_id as string,
          userName: data.userName as string | undefined,
          userPhoto: data.userPhoto as string | undefined,
          uniqueCards,
          stickers: allStickers.length,
        };
      });
      entries.sort((a, b) => b.uniqueCards !== a.uniqueCards ? b.uniqueCards - a.uniqueCards : b.stickers - a.stickers);
      setTopPlayers(entries.slice(0, 5));
    }).finally(() => setLoadingPlayers(false));
  }, [prog.id]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-0 z-[150] flex flex-col max-w-md mx-auto"
      >
        <button onClick={onClose} className="flex-shrink-0 h-16 w-full" />
        <div className="flex-1 overflow-y-auto gradient-logo-blue rounded-t-[2.5rem] shadow-2xl">
          <div className="sticky top-0 gradient-logo-blue px-5 pt-5 pb-4 z-10 border-b border-white/5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Monopoly Challenge</p>
                <h2 className="font-display text-xl font-bold text-white leading-tight">{prog.title}</h2>
              </div>
              <button onClick={onClose} className="p-2 rounded-2xl bg-white/10 flex-shrink-0">
                <X size={18} className="text-white/60" />
              </button>
            </div>
            {prog.endsAt && (
              <div className="mt-2 flex items-center gap-1.5 text-white/60 text-[10px] font-bold">
                <Clock size={10} />
                <CountdownTimer endsAt={prog.endsAt} />
              </div>
            )}
          </div>

          <div className="p-5 space-y-6">
            {/* Leaderboard */}
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-3">Top Players</p>
              {loadingPlayers ? (
                <p className="text-[10px] text-white/40 text-center py-4">Loading...</p>
              ) : topPlayers.length === 0 ? (
                <p className="text-[10px] text-white/40 text-center py-4">No players yet — be the first!</p>
              ) : (
                <div className="space-y-2.5">
                  {topPlayers.map((p, i) => {
                    const pct = Math.round((p.uniqueCards / STICKER_ORDER.reduce((s, t) => s + STICKER_CONFIG[t].variants.length, 0)) * 100);
                    return (
                      <div key={p.uid} className="bg-white/5 rounded-2xl px-3 py-2.5">
                        <div className="flex items-center gap-2.5 mb-1.5">
                          <span className="text-[10px] font-black text-white/30 w-4 text-center shrink-0">{i + 1}</span>
                          <div className="w-7 h-7 rounded-full overflow-hidden bg-white/10 shrink-0 flex items-center justify-center">
                            <LivePixelAvatar uid={p.uid} size={28} view="head" />
                          </div>
                          <p className="text-[11px] font-bold text-white flex-1 truncate">{p.userName || 'Player'}</p>
                          <span className="text-[10px] font-black text-white shrink-0">{pct}%</span>
                        </div>
                        <div className="ml-11 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-brand-gold transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Rarity guide */}
            <div className="pt-4 border-t border-white/10 space-y-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">Card Rarity</p>
              {STICKER_ORDER.map(tier => {
                const cfg = STICKER_CONFIG[tier];
                const pct = prog.tierChances ? prog.tierChances[tier] : DEFAULT_TIER_CHANCES[tier];
                return (
                  <div key={tier} className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-md shrink-0 relative overflow-hidden" style={{ background: cfg.solid }}>
                      <span className="card-shine-ray" style={{ animationDelay: `${STICKER_ORDER.indexOf(tier) * 0.4}s` }} />
                    </div>
                    <span className="text-[11px] font-bold text-white flex-1">{cfg.label}</span>
                    <span className="text-[11px] font-bold text-white/50">{pct}%</span>
                  </div>
                );
              })}
            </div>

            {/* Prize */}
            <div className="bg-amber-500/20 border border-amber-400/30 rounded-2xl px-4 py-3 flex items-center gap-2">
              <span className="text-lg">🏆</span>
              <div className="flex-1">
                <p className="text-xs font-bold text-amber-300">Full set reward</p>
                <p className="text-sm font-black text-white">{prog.reward}</p>
              </div>
              {joined && (
                <p className="text-[10px] text-amber-300 font-bold">{isComplete ? '✓ Earned' : `${myTotalSets} sets`}</p>
              )}
            </div>
          </div>

          <div className="px-5 pb-10 pt-2">
            {!joined ? (
              <button
                onClick={onJoin}
                disabled={joiningProgramId === prog.id}
                className="w-full bg-white text-brand-navy font-bold py-4 rounded-2xl text-sm active:scale-95 transition-all disabled:opacity-50"
              >
                {joiningProgramId === prog.id ? 'Joining...' : 'Join Game'}
              </button>
            ) : (
              <button
                onClick={onView}
                className="w-full bg-white text-brand-navy font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                {unrevealed.length > 0 ? `Reveal ${unrevealed.length} Card${unrevealed.length !== 1 ? 's' : ''}` : 'View My Collection'}
              </button>
            )}
            {joinError && <p className="text-xs text-red-400 text-center mt-2">{joinError}</p>}
          </div>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black z-[149]"
        onClick={onClose}
      />
    </>
  );
}

type CelebAnimType = 'confetti' | 'sparks' | 'fireworks' | 'sparkles' | 'burst';
const CELEB_ANIM_TYPES: CelebAnimType[] = ['confetti', 'sparks', 'fireworks', 'sparkles', 'burst'];

const TOP_Z = 999999;

function fireCelebAnimation(type: CelebAnimType) {
  switch (type) {
    case 'confetti':
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.55 }, zIndex: TOP_Z, colors: ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#A78BFA'] });
      break;
    case 'sparks':
      confetti({ particleCount: 70, spread: 40, startVelocity: 50, decay: 0.88, gravity: 1.4, scalar: 0.55, origin: { y: 0.55 }, zIndex: TOP_Z, colors: ['#FFD700', '#FF8C00', '#FF4500', '#FFF200', '#FF6B35'] });
      break;
    case 'fireworks':
      [{ angle: 60, x: 0.2 }, { angle: 90, x: 0.5 }, { angle: 120, x: 0.8 }].forEach(({ angle, x }, i) =>
        setTimeout(() => confetti({ particleCount: 60, angle, spread: 55, origin: { x, y: 0.65 }, zIndex: TOP_Z, colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#A78BFA', '#FFA500'] }), i * 150)
      );
      break;
    case 'sparkles':
      confetti({ particleCount: 90, spread: 100, startVelocity: 22, gravity: 0.5, scalar: 0.85, origin: { y: 0.55 }, zIndex: TOP_Z, colors: ['#FFD700', '#FFFFFF', '#FFF8DC', '#FFEAA7', '#FDCB6E'] });
      break;
    case 'burst':
      confetti({ particleCount: 80, spread: 360, startVelocity: 18, decay: 0.93, gravity: 0.6, origin: { x: 0.5, y: 0.5 }, zIndex: TOP_Z, colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#A78BFA', '#FF8C00', '#00B894'] });
      break;
  }
}

interface StickerCelebData {
  programmeName: string;
  newCount: number;
  totalStickers: number;
  totalSets: number;
  animType: CelebAnimType;
  stickerCardId: string;
}

const STAMP_ENCOUR = [
  (n: number, r: string) => `🔥 ${n} more stamp${n > 1 ? 's' : ''} and ${r} is yours!`,
  (n: number, r: string) => `⭐ So close! Just ${n} more stamp${n > 1 ? 's' : ''} for ${r}!`,
  (n: number, r: string) => `🚀 Keep it up! ${n} more stamp${n > 1 ? 's' : ''} to unlock ${r}!`,
  (n: number, r: string) => `💪 You're crushing it! ${n} away from ${r}!`,
];
const CHALL_ENCOUR = [
  (n: number, u: string, r: string) => `🏃 ${n} more ${u} and ${r} is yours — don't stop now!`,
  (n: number, u: string, r: string) => `🔥 So close to ${r}! Just ${n} more ${u} to go!`,
  (n: number, u: string, r: string) => `⚡ ${n} ${u} stand between you and ${r}. Let's go!`,
  (n: number, u: string, r: string) => `💫 You're doing amazing! ${n} more ${u} wins you ${r}!`,
];

function buildStampCelebrationPages(
  store: StoreProfile,
  card: Card,
  challenges: Challenge[],
  entries: Map<string, any>,
  profile: UserProfile | null,
  user: FirebaseUser,
  collectiblePrograms: Challenge[] = [],
  joinedStickerCards: StickerCardDoc[] = [],
): CelebrationPage[] {
  const pages: CelebrationPage[] = [];
  const seed = card.current_stamps;

  // 1. Stamp / card-progress page
  const tiers = store.rewardTiers?.length
    ? [...store.rewardTiers].sort((a, b) => a.stamps - b.stamps)
    : [{ stamps: store.stamps_required_for_reward || 10, reward: store.reward || 'Free Reward' }];

  const hitTier = tiers.find(t => t.stamps === card.current_stamps);
  const hitTierIdx = hitTier ? tiers.indexOf(hitTier) : -1;
  const nextStageTier = hitTier ? tiers[hitTierIdx + 1] : undefined;

  const nextTier = tiers.find(t => t.stamps > card.current_stamps);
  const stampsLeft = nextTier ? nextTier.stamps - card.current_stamps : 0;
  const done = stampsLeft === 0 && !hitTier;
  const enc = done
    ? `🎁 YES! Your reward is ready to claim at ${store.name}!`
    : stampsLeft === 1
      ? `🤩 ONE more stamp and ${nextTier!.reward} is yours!`
      : nextTier
        ? STAMP_ENCOUR[seed % STAMP_ENCOUR.length](stampsLeft, nextTier.reward)
        : `🎁 You've earned: ${hitTier?.reward || store.reward || 'Free Reward'}!`;

  pages.push({
    type: 'stamp',
    storeName: store.name,
    currentStamps: card.current_stamps,
    totalStamps: nextTier?.stamps || hitTier?.stamps || store.stamps_required_for_reward || 10,
    reward: nextTier?.reward || hitTier?.reward || store.reward || 'Free Reward',
    encouragement: enc,
    done: done || (!!hitTier && !nextStageTier),
  });

  // 1a. Stage reward page — inserted at index 0 when the current stamp hits a tier
  if (hitTier) {
    pages.unshift({
      type: 'stage_reward',
      currentStamps: card.current_stamps,
      totalStamps: hitTier.stamps,
      reward: hitTier.reward,
      encouragement: '',
      done: !nextStageTier,
      stageReward: hitTier.reward,
      stageStoreName: store.name,
      stageStamps: card.current_stamps,
      stageValue: hitTier.value ?? 0,
      nextStageStamps: nextStageTier?.stamps ?? 0,
      nextStageReward: nextStageTier?.reward ?? '',
    });
  }

  // 2. Monopoly pack page — right after card progress (rank spliced at position 2 by caller)
  const joinedStickerCardIds = new Set(joinedStickerCards.map(sc => sc.programme_id));
  const joinedProg = collectiblePrograms.find(p => joinedStickerCardIds.has(p.id));
  if (joinedProg) {
    pages.push({
      type: 'monopoly_pack',
      currentStamps: card.current_stamps,
      totalStamps: card.current_stamps,
      reward: '',
      encouragement: '',
      done: false,
      monopolyChallengeName: joinedProg.title,
    });
  } else if (collectiblePrograms.length > 0) {
    // User hasn't joined — show a promo teaser for the first active programme
    const promo = collectiblePrograms[0];
    pages.push({
      type: 'collectible_promo',
      currentStamps: card.current_stamps,
      totalStamps: card.current_stamps,
      reward: '',
      encouragement: '',
      done: false,
      collectiblePromoName: promo.title,
      collectiblePromoReward: promo.reward,
    });
  }

  // 3. Charity deed page (rank is spliced in at position 2 by caller, after the pack reveal)
  const charityAnimal = ENDANGERED_ANIMALS[card.current_stamps % ENDANGERED_ANIMALS.length];
  pages.push({
    type: 'charity',
    currentStamps: card.current_stamps,
    totalStamps: nextTier?.stamps || store.stamps_required_for_reward || 10,
    reward: '',
    encouragement: '',
    done: false,
    charityAnimal,
  });

  // 4. All joined standard-challenge progresses in one list page
  const joined = challenges.filter(c =>
    (c.participantUids || []).includes(user.uid) &&
    (!c.vendorIds?.length || c.vendorIds.includes(store.id!))
  );

  if (joined.length > 0) {
    const challengesList = joined.map(c => {
      const entry = entries.get(c.id);
      const progress = c.vendorIds?.length
        ? Math.min(c.goal, (entry?.count || 0) + 1)
        : Math.min(c.goal, Math.max(0, ((profile?.totalStamps || 0) + 1) - (entry?.totalStampsAtJoin || 0)));
      return { title: c.title, currentStamps: progress, totalStamps: c.goal, reward: c.reward, done: progress >= c.goal };
    });
    pages.push({ type: 'challenges_list', currentStamps: 0, totalStamps: 0, reward: '', encouragement: '', done: false, challengesList });
  }

  // 5. All unjoined challenges in one recommendation list page
  const notJoined = challenges.filter(c => !(c.participantUids || []).includes(user.uid)).slice(0, 5);
  if (notJoined.length > 0) {
    const upsellList = notJoined.map(c => ({ title: c.title, totalStamps: c.goal, reward: c.reward, id: c.id }));
    pages.push({ type: 'upsell_list', currentStamps: 0, totalStamps: 0, reward: '', encouragement: '', done: false, upsellList });
  }

  return pages;
}

// --- Consumer App ---

function ConsumerApp({ activeTab, setActiveTab, profile, user, onViewStore, onViewUser, cards: initialCards, notifications, activeChatId, setActiveChatId, onLogout, onDeleteAccount, pendingNFCStoreId, onClearPendingNFC }: { activeTab: string, setActiveTab: (tab: string) => void, profile: UserProfile | null, user: FirebaseUser, onViewStore: (s: StoreProfile) => void, onViewUser: (u: UserProfile) => void, cards: Card[], notifications: Notification[], activeChatId: string | null, setActiveChatId: (id: string | null) => void, onLogout: () => void, onDeleteAccount: () => Promise<void>, pendingNFCStoreId?: string | null, onClearPendingNFC?: () => void, key?: React.Key }) {
  const [stores, setStores] = useState<StoreProfile[]>([]);
  const [walletSubTab, setWalletSubTab] = useState<'stamps' | 'challenges'>('stamps');
  const [redeemingChallenge, setRedeemingChallenge] = useState<{ challenge: Challenge; entry: any; userName: string } | null>(null);
  const [myStickerCards, setMyStickerCards] = useState<StickerCardDoc[]>([]);
  const [openStickerCardId, setOpenStickerCardId] = useState<string | null>(null);
  const [activePrograms, setActivePrograms] = useState<Challenge[]>([]);
  const [activeStandardChallenges, setActiveStandardChallenges] = useState<Challenge[]>([]);
  const [myStandardEntries, setMyStandardEntries] = useState<Map<string, any>>(new Map());
  const [joiningProgramId, setJoiningProgramId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [highlightedChallengeId, setHighlightedChallengeId] = useState<string | null>(null);
  const [openProgrammeId, setOpenProgrammeId] = useState<string | null>(null);
  const [showNFCStamp, setShowNFCStamp] = useState(false);
  const [autoNFCStoreId, setAutoNFCStoreId] = useState<string | null>(null);
  const [pendingPack, setPendingPack] = useState<CollectibleSticker[] | null>(null);
  const [pendingPackCardId, setPendingPackCardId] = useState<string | null>(null);
  const [pendingCollectionCardId, setPendingCollectionCardId] = useState<string | null>(null);

  // Stamp celebration
  const [celebrationPages, setCelebrationPages] = useState<CelebrationPage[] | null>(null);
  const prevCardStampsRef = useRef<Map<string, number>>(new Map());
  const cardsInitializedRef = useRef(false);

  // Sticker (monopoly) — no intermediate modal, pack opens directly
  const prevStickerCountRef = useRef<Map<string, number>>(new Map());
  const stickerCardsInitRef = useRef(false);

  // Global user_stickers — drives pack animation for users not in any active challenge
  const prevUserStickerCountRef = useRef(-1);
  const userStickersInitRef = useRef(false);
  const hasJoinedActiveProgramRef = useRef(false);
  const pendingPackRef = useRef<CollectibleSticker[] | null>(null);
  useEffect(() => { pendingPackRef.current = pendingPack; }, [pendingPack]);
  useEffect(() => {
    const activeProgrammeIds = new Set(activePrograms.map(p => p.id));
    hasJoinedActiveProgramRef.current = myStickerCards.some(sc => activeProgrammeIds.has(sc.programme_id));
  }, [myStickerCards, activePrograms]);

  useEffect(() => {
    const activeCards = initialCards.filter(c => !c.isArchived);
    if (activeCards.length === 0) return;
    if (!cardsInitializedRef.current) {
      activeCards.forEach(c => prevCardStampsRef.current.set(c.id, c.current_stamps));
      cardsInitializedRef.current = true;
      return;
    }
    (async () => {
      for (const card of activeCards) {
        const prev = prevCardStampsRef.current.get(card.id) ?? -1;
        if (card.current_stamps > prev) {
          const store = stores.find(s => s.id === card.store_id);
          if (store) {
            const pages = buildStampCelebrationPages(store, card, activeStandardChallenges, myStandardEntries, profile, user, activePrograms, myStickerCards);

            // Increment totalSaved if a valued tier was hit
            const storeTiers = store.rewardTiers?.length
              ? [...store.rewardTiers].sort((a, b) => a.stamps - b.stamps)
              : [{ stamps: store.stamps_required_for_reward || 10, reward: store.reward || '', value: 0 }];
            const hitTierValue = storeTiers.find(t => t.stamps === card.current_stamps);
            if (hitTierValue?.value && hitTierValue.value > 0) {
              updateDoc(doc(db, 'users', user.uid), { totalSaved: increment(hitTierValue.value) }).catch(() => {});
            }

            // Build rank change page
            try {
              const snap = await getDocs(collection(db, 'users'));
              const allUsers = snap.docs
                .map(d => ({ uid: d.id, ...d.data() } as UserProfile))
                .filter(u => (u.totalStamps || 0) > 0)
                .sort((a, b) => (b.totalStamps || 0) - (a.totalStamps || 0));

              const newStamps = profile?.totalStamps || 0;
              const oldStamps = newStamps - 1;
              const userIdx = allUsers.findIndex(u => u.uid === user.uid);
              const rankAfter = userIdx >= 0 ? userIdx + 1 : allUsers.length + 1;
              const othersWithMoreThanOld = allUsers.filter(u => u.uid !== user.uid && (u.totalStamps || 0) > oldStamps).length;
              const rankBefore = othersWithMoreThanOld + 1;
              const rankChange = rankBefore - rankAfter;

              // Weekly rank: filter to users active in the last 7 days
              const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
              const weeklyUsers = allUsers.filter(u => u.lastStreakDate && u.lastStreakDate >= sevenDaysAgo);
              const weeklyUserIdx = weeklyUsers.findIndex(u => u.uid === user.uid);
              const rankWeeklyAfter = weeklyUserIdx >= 0 ? weeklyUserIdx + 1 : weeklyUsers.length + 1;
              const weeklyOthersWithMoreThanOld = weeklyUsers.filter(u => u.uid !== user.uid && (u.totalStamps || 0) > oldStamps).length;
              const rankWeeklyBefore = weeklyOthersWithMoreThanOld + 1;
              const rankWeeklyChange = rankWeeklyBefore - rankWeeklyAfter;

              if (rankAfter > 0) {
                pages.splice(1, 0, {
                  type: 'rank',
                  currentStamps: newStamps,
                  totalStamps: newStamps,
                  reward: '',
                  encouragement: '',
                  done: false,
                  rankBefore,
                  rankAfter,
                  rankChange,
                  rankWeeklyBefore,
                  rankWeeklyAfter,
                  rankWeeklyChange,
                });
              }

              if (rankChange > 0) {
                addDoc(collection(db, 'notifications'), {
                  toUid: user.uid,
                  fromUid: 'system',
                  fromName: 'Linq',
                  fromPhoto: '',
                  type: 'system',
                  message: `You moved up to rank #${rankAfter} on the leaderboard!`,
                  isRead: false,
                  createdAt: serverTimestamp(),
                }).catch(() => {});
              }
            } catch (_) { /* rank page is optional */ }

            if (pages.length > 0) setCelebrationPages(pages);
          }
        }
        prevCardStampsRef.current.set(card.id, card.current_stamps);
      }
    })();
  }, [initialCards]);

  // Watch myStickerCards for new stickers — open pack directly, no intermediate modal
  useEffect(() => {
    if (myStickerCards.length === 0) return;
    if (!stickerCardsInitRef.current) {
      myStickerCards.forEach(sc => prevStickerCountRef.current.set(sc.id, sc.stickers.length));
      stickerCardsInitRef.current = true;
      return;
    }
    const activeProgrammeIds = new Set(activePrograms.map(p => p.id));
    myStickerCards.forEach(sc => {
      const prev = prevStickerCountRef.current.get(sc.id) ?? -1;
      if (prev !== -1 && sc.stickers.length > prev && activeProgrammeIds.has(sc.programme_id)) {
        const unrevealed = (sc.stickers || []).filter((s: CollectibleSticker) => !(sc.revealedIds || []).includes(s.id));
        if (unrevealed.length > 0 && !pendingPack) {
          setPendingPack(unrevealed);
          setPendingPackCardId(sc.id);
        }
      }
      prevStickerCountRef.current.set(sc.id, sc.stickers.length);
    });
  }, [myStickerCards]);

  // Watch user_stickers — trigger pack animation for users NOT in any active challenge
  useEffect(() => {
    return onSnapshot(doc(db, 'user_stickers', user.uid), snap => {
      const stickers: CollectibleSticker[] = snap.exists() ? (snap.data().stickers || []) : [];
      if (!userStickersInitRef.current) {
        prevUserStickerCountRef.current = stickers.length;
        userStickersInitRef.current = true;
        return;
      }
      const prev = prevUserStickerCountRef.current;
      prevUserStickerCountRef.current = stickers.length;
      if (stickers.length > prev && !hasJoinedActiveProgramRef.current && !pendingPackRef.current) {
        const addedCount = stickers.length - prev;
        const newStickers = stickers.slice(-addedCount);
        setPendingPack(newStickers);
        setPendingPackCardId(null);
      }
    });
  }, [user.uid]);

  // After pack + stamp celeb are both gone, open the queued collection
  useEffect(() => {
    if (!pendingPack && !celebrationPages && pendingCollectionCardId) {
      const t = setTimeout(() => {
        setOpenStickerCardId(pendingCollectionCardId);
        setPendingCollectionCardId(null);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [pendingPack, celebrationPages, pendingCollectionCardId]);

  // Badge notification system
  const [allBadgesGlobal, setAllBadgesGlobal] = useState<AppBadge[]>([]);
  const [followersCountG, setFollowersCountG] = useState(0);
  const [followingCountG, setFollowingCountG] = useState(0);
  const [postsCountG, setPostsCountG] = useState(0);
  const [badgeNotifQueue, setBadgeNotifQueue] = useState<AppBadge[]>([]);
  const seenBadgeIdsRef = useRef<Set<string>>(new Set(JSON.parse(localStorage.getItem(`seenBadges_${user.uid}`) || '[]')));
  // Delay detection until initial data has loaded to avoid false positives
  const [badgeDetectionReady, setBadgeDetectionReady] = useState(false);

  useEffect(() => {
    if (pendingNFCStoreId) {
      setAutoNFCStoreId(pendingNFCStoreId);
      setShowNFCStamp(true);
      onClearPendingNFC?.();
    }
  }, [pendingNFCStoreId]);

  useEffect(() => {
    if (!highlightedChallengeId) return;
    const timer = setTimeout(() => {
      document.getElementById(`challenge-${highlightedChallengeId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
    const clear = setTimeout(() => setHighlightedChallengeId(null), 3000);
    return () => { clearTimeout(timer); clearTimeout(clear); };
  }, [highlightedChallengeId]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'stores'), (snapshot) => {
      setStores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoreProfile)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'stores');
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'sticker_cards'), where('user_id', '==', user.uid));
    return onSnapshot(q,
      snap => { setMyStickerCards(snap.docs.map(d => ({ id: d.id, ...d.data() } as StickerCardDoc))); },
      err => console.error('[sticker_cards snapshot]', err)
    );
  }, [user.uid]);

  useEffect(() => {
    const q = query(collection(db, 'challenges'), where('type', '==', 'collectible'));
    return onSnapshot(q, snap =>
      setActivePrograms(snap.docs.map(d => ({ id: d.id, ...d.data() } as Challenge)).filter(c => c.status === 'active'))
    );
  }, []);

  // Notify user about collectible programme they haven't joined (once per programme)
  useEffect(() => {
    if (activePrograms.length === 0) return;
    const joinedIds = new Set(myStickerCards.map(sc => sc.programme_id));
    const unjoined = activePrograms.find(p => !joinedIds.has(p.id));
    if (!unjoined) return;
    const key = `linq_monopoly_notif_${user.uid}_${unjoined.id}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    addDoc(collection(db, 'notifications'), {
      toUid: user.uid,
      fromUid: 'system',
      fromName: 'Linq',
      fromPhoto: '',
      type: 'system',
      message: `Your stickers could win you "${unjoined.reward}"! Join the ${unjoined.title} challenge to start collecting.`,
      isRead: false,
      createdAt: serverTimestamp(),
    }).catch(() => {});
  }, [activePrograms, myStickerCards]);

  useEffect(() => {
    const q = query(collection(db, 'challenges'), where('type', '==', 'standard'), where('status', '==', 'active'));
    return onSnapshot(q, snap =>
      setActiveStandardChallenges(snap.docs.map(d => ({ id: d.id, ...d.data() } as Challenge)))
    );
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'challenge_entries'), where('uid', '==', user.uid));
    return onSnapshot(q, snap => {
      const m = new Map<string, any>();
      snap.docs.forEach(d => m.set(d.data().challengeId, { id: d.id, ...d.data() }));
      setMyStandardEntries(m);
    });
  }, [user.uid]);

  // Badge notification listeners
  useEffect(() => {
    return onSnapshot(collection(db, 'badges'), snap =>
      setAllBadgesGlobal(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppBadge)))
    );
  }, []);
  useEffect(() => {
    const q = query(collection(db, 'follows'), where('followingUid', '==', user.uid));
    return onSnapshot(q, snap => setFollowersCountG(snap.size));
  }, [user.uid]);
  useEffect(() => {
    const q = query(collection(db, 'follows'), where('followerUid', '==', user.uid));
    return onSnapshot(q, snap => setFollowingCountG(snap.size));
  }, [user.uid]);
  useEffect(() => {
    const q = query(collection(db, 'global_posts'), where('authorUid', '==', user.uid));
    return onSnapshot(q, snap => setPostsCountG(snap.size));
  }, [user.uid]);
  // Allow 2s for initial data to settle before detecting earnings
  useEffect(() => {
    const t = setTimeout(() => setBadgeDetectionReady(true), 2000);
    return () => clearTimeout(t);
  }, []);

  // Detect newly earned badges
  useEffect(() => {
    if (!badgeDetectionReady || allBadgesGlobal.length === 0 || !profile) return;

    const lifetimeStamps = Math.max(profile.totalStamps || 0, initialCards.reduce((acc, c) => acc + (c.current_stamps || 0), 0));
    const metrics: Record<BadgeMetric, number> = {
      stamps: lifetimeStamps,
      cards_completed: Math.max(profile.totalRedeemed || 0, initialCards.filter(c => c.isArchived && c.isRedeemed).length),
      challenges_joined: myStandardEntries.size,
      memberships: initialCards.filter(c => !c.isArchived).length,
      followers: followersCountG,
      following: followingCountG,
      posts: postsCountG,
      charity_animals: profile.charityAnimals || 0,
      charity_trees: profile.charityTrees || 0,
      charity_total: (profile.charityAnimals || 0) + (profile.charityTrees || 0),
    };
    const earned = allBadgesGlobal.filter(b => (metrics[b.metric] ?? 0) >= b.threshold);

    const isFirstLoad = localStorage.getItem(`seenBadgesInit_${user.uid}`) !== 'true';
    if (isFirstLoad) {
      earned.forEach(b => seenBadgeIdsRef.current.add(b.id));
      localStorage.setItem(`seenBadges_${user.uid}`, JSON.stringify([...seenBadgeIdsRef.current]));
      localStorage.setItem(`seenBadgesInit_${user.uid}`, 'true');
      return;
    }

    const newBadges = earned.filter(b => !seenBadgeIdsRef.current.has(b.id));
    if (newBadges.length > 0) {
      newBadges.forEach(b => seenBadgeIdsRef.current.add(b.id));
      localStorage.setItem(`seenBadges_${user.uid}`, JSON.stringify([...seenBadgeIdsRef.current]));
      setBadgeNotifQueue(q => [...q, ...newBadges]);
    }
  }, [badgeDetectionReady, allBadgesGlobal, initialCards, profile, followersCountG, followingCountG, postsCountG, myStandardEntries]);

  const handleJoinStore = async (store: StoreProfile) => {
    if (!user) return;
    const cardId = `${user.uid}_${store.id}`;
    const cardRef = doc(db, 'cards', cardId);
    const cardSnap = await getDoc(cardRef);
    if (!cardSnap.exists() || cardSnap.data()?.isArchived) {
      const userName = profile?.name || user.displayName || user.email?.split('@')[0] || 'Loyal Customer';
      const userPhoto = profile?.photoURL || user.photoURL || '';
      await setDoc(cardRef, {
        user_id: user.uid,
        store_id: store.id,
        current_stamps: 0,
        total_completed_cycles: 0,
        stamps_required: store.stamps_required_for_reward || 10,
        last_tap_timestamp: serverTimestamp(),
        isArchived: false,
        isRedeemed: false,
        userName,
        userPhoto,
      });
      await updateDoc(doc(db, 'users', user.uid), { total_cards_held: increment(1) });
      setActiveTab('home');
    }
  };

  const handleJoinProgramme = async (prog: Challenge) => {
    if (!user) return;
    setJoiningProgramId(prog.id);
    setJoinError(null);
    try {
      const cardId = `${prog.id}_${user.uid}`;
      const userName = profile?.name || user.displayName || user.email?.split('@')[0] || 'Player';
      await setDoc(doc(db, 'sticker_cards', cardId), {
        user_id: user.uid,
        programme_id: prog.id,
        stickers: [],
        revealedIds: [],
        uniqueTiers: [],
        userName,
      });
    } catch (err: any) {
      console.error('join programme failed:', err);
      setJoinError(err?.message || 'Failed to join. Try again.');
    }
    setJoiningProgramId(null);
  };


  const activeCards = initialCards.filter(c => !c.isArchived);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      {activeTab === 'for-you' && (
        <ForYouScreen
          onViewUser={onViewUser}
          onViewStore={onViewStore}
          onViewChallenges={() => { setActiveTab('home'); setWalletSubTab('challenges'); }}
          currentUser={user}
          currentProfile={profile}
          userCards={initialCards}
        />
      )}

      {activeTab === 'messages' && (
        <MessagesScreen
          currentUser={user}
          currentProfile={profile}
          activeChatId={activeChatId}
          setActiveChatId={setActiveChatId}
          onViewUser={onViewUser}
        />
      )}

      {activeTab === 'deals' && (
        <DealsScreen
          currentUser={user}
          currentProfile={profile}
          onViewStore={onViewStore}
          userCards={initialCards}
          onViewChallenge={(c) => { setActiveTab('home'); setWalletSubTab('challenges'); setHighlightedChallengeId(c.id); }}
        />
      )}

      {activeTab === 'home' && (
        <div className="space-y-6">
          <header>
            <h2 className="font-display text-3xl font-bold mb-1">Wallet</h2>
          </header>

          {/* Sub-tabs */}
          {(() => {
            const totalUnrevealed = myStickerCards.reduce((n, sc) => n + sc.stickers.filter(s => !(sc.revealedIds || []).includes(s.id)).length, 0);
            return (
              <div className="flex bg-brand-bg rounded-2xl p-1 gap-1">
                <button
                  onClick={() => setWalletSubTab('stamps')}
                  className={cn(
                    'flex-1 py-2.5 rounded-xl text-sm font-bold transition-all',
                    walletSubTab === 'stamps' ? 'bg-white text-brand-navy shadow-sm' : 'text-brand-navy/50'
                  )}
                >
                  Wallet
                </button>
                <button
                  onClick={() => setWalletSubTab('challenges')}
                  className={cn(
                    'flex-1 py-2.5 rounded-xl text-sm font-bold transition-all relative',
                    walletSubTab === 'challenges' ? 'bg-white text-brand-navy shadow-sm' : 'text-brand-navy/50'
                  )}
                >
                  Challenges
                  {totalUnrevealed > 0 && (
                    <span className="absolute top-1 right-3 w-4 h-4 bg-brand-rose text-white text-[9px] font-black rounded-full flex items-center justify-center">
                      {totalUnrevealed > 9 ? '9+' : totalUnrevealed}
                    </span>
                  )}
                </button>
              </div>
            );
          })()}

          {/* Stamps sub-tab */}
          {walletSubTab === 'stamps' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-brand-navy/60 text-sm">You have {activeCards.length} active loyalty card{activeCards.length !== 1 ? 's' : ''}.</p>
                <button
                  onClick={() => setShowNFCStamp(true)}
                  className="flex items-center gap-2 gradient-red text-white px-4 py-2 rounded-xl font-bold text-xs"
                >
                  <Wifi size={14} />
                  Tap to Stamp
                </button>
              </div>
              {activeCards.length > 0 ? (
                activeCards.map(card => {
                  const store = stores.find(s => s.id === card.store_id);
                  return <LoyaltyCard key={card.id} card={card} store={store} onViewStore={onViewStore} />;
                })
              ) : (
                <div className="glass-card p-10 rounded-[2.5rem] border-2 border-dashed border-brand-rose/40 text-center">
                  <div className="w-16 h-16 bg-brand-bg rounded-full flex items-center justify-center mx-auto mb-4">
                    <Wallet className="w-8 h-8 text-brand-navy/20" />
                  </div>
                  <p className="text-brand-navy/60 mb-6">Your wallet is empty.</p>
                  <button
                    onClick={() => setActiveTab('discover')}
                    className="gradient-red text-white px-8 py-3 rounded-xl font-bold text-sm"
                  >
                    Find Stores
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Challenges sub-tab — Monopoly sticker programme */}
          {walletSubTab === 'challenges' && (
            <div className="space-y-5">
              {activePrograms.length === 0 ? (
                <div className="glass-card p-10 rounded-[2.5rem] border-2 border-dashed border-amber-300/60 text-center">
                  <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trophy className="w-8 h-8 text-amber-300" />
                  </div>
                  <p className="text-brand-navy/60">No active sticker programmes right now. Check back soon!</p>
                </div>
              ) : (() => {
                const joinedProgs = activePrograms.filter(p => myStickerCards.some(s => s.programme_id === p.id));
                const availableProgs = activePrograms.filter(p => !myStickerCards.some(s => s.programme_id === p.id));
                const maxSets = STICKER_ORDER.reduce((sum, t) => sum + STICKER_CONFIG[t].variants.length, 0);
                return (
                  <>
                    {/* ── My Challenges ── */}
                    {joinedProgs.length > 0 && (
                      <div className="rounded-[2rem] overflow-hidden shadow-lg border border-black/5">
                        <div className="gradient-logo-blue px-5 py-3 relative overflow-hidden">
                          <span className="shine-ray" aria-hidden="true" />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 relative z-10">My Challenges</p>
                          <h3 className="font-display text-base font-bold text-white relative z-10">Your progress</h3>
                        </div>
                        <div className="bg-white divide-y divide-black/5">
                          {joinedProgs.map(prog => {
                            const sc = myStickerCards.find(s => s.programme_id === prog.id)!;
                            const myRevealedCards = sc.stickers.filter((s: CollectibleSticker) => (sc.revealedIds || []).includes(s.id));
                            const myProgSets = totalSetsCompleted(myRevealedCards);
                            const unrevealed = sc.stickers.filter((s: CollectibleSticker) => !(sc.revealedIds || []).includes(s.id));
                            const isComplete = allSetsWon(myRevealedCards);
                            const pct = Math.round((myProgSets / maxSets) * 100);
                            return (
                              <div key={prog.id} className="px-4 py-3">
                                <div className="flex items-center gap-3 mb-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-bold text-brand-navy truncate">{prog.title}</p>
                                      {unrevealed.length > 0 && (
                                        <span className="text-[9px] font-bold text-white bg-brand-gold px-2 py-0.5 rounded-full animate-pulse shrink-0">
                                          {unrevealed.length} new!
                                        </span>
                                      )}
                                    </div>
                                    {prog.endsAt && (
                                      <div className="flex items-center gap-1 text-brand-navy/40 text-[10px] mt-0.5">
                                        <Clock size={9} /><CountdownTimer endsAt={prog.endsAt} />
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => setOpenStickerCardId(sc.id)}
                                    className="px-3 py-1.5 rounded-xl bg-brand-navy text-white text-[11px] font-bold active:scale-95 transition-all shrink-0"
                                  >
                                    {unrevealed.length > 0 ? 'Reveal' : 'View'}
                                  </button>
                                </div>
                                {/* Mini rank tiles */}
                                <div className="flex gap-1 mb-2">
                                  {STICKER_ORDER.map((tier, idx) => {
                                    const cfg = STICKER_CONFIG[tier];
                                    const sets = tierSetsCompleted(myRevealedCards, tier);
                                    const firstFound = myRevealedCards.find((s: CollectibleSticker) => s.tier === tier);
                                    return (
                                      <div key={tier} className="flex-1 rounded-lg flex flex-col items-center justify-center py-1.5 relative overflow-hidden"
                                        style={{ background: cfg.solid, opacity: sets > 0 ? 1 : 0.3 }}>
                                        <span style={{ fontSize: 14, lineHeight: 1 }}>{firstFound ? cfg.variants[firstFound.variant ?? 0]?.emoji ?? '?' : '?'}</span>
                                        <span className="text-[6px] font-black text-white mt-0.5">{sets}/{cfg.variants.length}</span>
                                        {sets > 0 && <span className="card-shine-ray" style={{ animationDelay: `${idx * 0.45}s` }} />}
                                      </div>
                                    );
                                  })}
                                </div>
                                {/* Progress bar */}
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-brand-navy/8 rounded-full overflow-hidden">
                                    <motion.div
                                      className={cn("h-full rounded-full", isComplete ? 'bg-green-400' : 'bg-brand-gold')}
                                      initial={{ width: 0 }}
                                      animate={{ width: `${pct}%` }}
                                      transition={{ duration: 0.6, ease: 'easeOut' }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-bold text-brand-navy/40 shrink-0">{pct}%</span>
                                </div>
                                {isComplete && (
                                  <p className="text-[10px] font-bold text-amber-600 mt-1">🏆 Complete! Claim: {prog.reward}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {/* Prize footer */}
                        <div className="bg-amber-50 border-t border-amber-100 px-5 py-2.5 flex items-center gap-2">
                          <span className="text-sm">🏆</span>
                          <p className="text-xs text-amber-800 font-semibold">Collect 3 full sets to win the reward</p>
                        </div>
                      </div>
                    )}

                    {/* ── Available to Join ── */}
                    {availableProgs.length > 0 && (
                      <div className="rounded-[2rem] overflow-hidden shadow-lg border border-black/5">
                        <div className="gradient-logo-blue px-5 py-3 relative overflow-hidden">
                          <span className="shine-ray" aria-hidden="true" />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 relative z-10">Available to Join</p>
                          <h3 className="font-display text-base font-bold text-white relative z-10">Sticker challenges</h3>
                        </div>
                        <div className="bg-white divide-y divide-black/5">
                          {availableProgs.map(prog => (
                            <div key={prog.id} className="px-4 py-3 flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-brand-navy truncate">{prog.title}</p>
                                <p className="text-[10px] text-brand-navy/40 mt-0.5">🏆 {prog.reward}</p>
                                {prog.endsAt && (
                                  <div className="flex items-center gap-1 text-brand-navy/40 text-[10px] mt-0.5">
                                    <Clock size={9} /><CountdownTimer endsAt={prog.endsAt} />
                                  </div>
                                )}
                              </div>
                              {/* Rank preview tiles */}
                              <div className="flex gap-0.5 shrink-0">
                                {STICKER_ORDER.map((tier, idx) => (
                                  <div key={tier} className="w-7 h-7 rounded-md relative overflow-hidden"
                                    style={{ background: STICKER_CONFIG[tier].solid, opacity: 0.5 }}>
                                    <span className="card-shine-ray" style={{ animationDelay: `${idx * 0.4}s` }} />
                                  </div>
                                ))}
                              </div>
                              <button
                                onClick={() => setOpenProgrammeId(prog.id)}
                                className="px-3 py-1.5 rounded-xl bg-brand-navy text-white text-[11px] font-bold active:scale-95 transition-all shrink-0"
                              >
                                Join
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Standard challenges */}
              {/* Redeemed / archived challenges */}
              {(() => {
                const redeemedEntries = [...myStandardEntries.values()].filter(e => e.redeemed);
                const redeemedChallenges = redeemedEntries.map(e => activeStandardChallenges.find(c => c.id === e.challengeId)).filter(Boolean) as Challenge[];
                if (redeemedChallenges.length === 0) return null;
                return (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40 px-1">Redeemed</p>
                    {redeemedChallenges.map(c => {
                      const entry = myStandardEntries.get(c.id);
                      return (
                        <div key={c.id} className="rounded-2xl bg-white border border-brand-navy/8 px-4 py-3 flex items-center gap-3 opacity-60">
                          <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                            <Trophy size={16} className="text-green-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-brand-navy truncate">{c.title}</p>
                            <p className="text-[10px] text-brand-navy/40 mt-0.5">🎁 {c.reward}</p>
                          </div>
                          <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full shrink-0">Redeemed</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {activeStandardChallenges.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40 px-1">Challenges</p>
                  {activeStandardChallenges.map(c => {
                    const joined = (c.participantUids || []).includes(user.uid);
                    const entry = myStandardEntries.get(c.id);
                    const joinedCount = activeStandardChallenges.filter(ch => (ch.participantUids || []).includes(user.uid) && !myStandardEntries.get(ch.id)?.redeemed).length;
                    let stampsProgress = 0;
                    if (joined && entry) {
                      if (c.vendorIds?.length) {
                        // Directly tracked via updateChallengeProgress at stamp time
                        stampsProgress = Math.min(c.goal, entry.count || 0);
                      } else {
                        stampsProgress = Math.max(0, Math.min(c.goal, (profile?.totalStamps || 0) - (entry.totalStampsAtJoin || 0)));
                      }
                    }
                    const progressPct = c.goal > 0 ? Math.min(100, Math.round((stampsProgress / c.goal) * 100)) : 0;
                    const isComplete = progressPct >= 100;
                    const isRedeemed = !!entry?.redeemed;
                    const isHighlighted = highlightedChallengeId === c.id;
                    if (isRedeemed) return null; // shown in archived section
                    return (
                      <div key={c.id} id={`challenge-${c.id}`} className={cn("rounded-[2rem] shadow-lg overflow-hidden transition-all duration-500", isHighlighted ? 'ring-2 ring-brand-gold/60' : '')}>
                        {/* Gradient header */}
                        <div className="gradient-logo-blue px-5 py-4 relative overflow-hidden">
                          {c.imageUrl && (
                            <div className="absolute inset-0">
                              <img src={c.imageUrl} alt="" className="w-full h-full object-cover opacity-20" />
                            </div>
                          )}
                          <span className="shine-ray" aria-hidden="true" />
                          <div className="flex items-start justify-between gap-3 relative z-10">
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-0.5">Challenge</p>
                              <p className="font-bold text-white text-base leading-tight">{c.title}</p>
                              {c.description && <p className="text-xs text-white/60 mt-1">{c.description}</p>}
                            </div>
                            <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5", isComplete ? 'bg-green-400/30' : 'bg-white/15')}>
                              <Trophy size={18} className={isComplete ? 'text-green-300' : 'text-white'} />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap mt-2.5 relative z-10">
                            <span className="text-[10px] font-bold bg-white/20 text-white px-2.5 py-1 rounded-full">
                              🎁 {c.reward}
                            </span>
                            {c.endsAt && (
                              <span className="text-[10px] font-bold bg-white/10 text-white/70 px-2.5 py-1 rounded-full flex items-center gap-1">
                                <Clock size={9} /> <CountdownTimer endsAt={c.endsAt} />
                              </span>
                            )}
                          </div>
                        </div>
                        {/* White body */}
                        <div className="bg-white px-5 py-4 space-y-3">

                          {c.vendorIds?.length ? (
                            <div>
                              <p className="text-[10px] font-bold text-brand-navy/40 uppercase tracking-widest mb-1.5">Participating stores</p>
                              {stores.length > 0 && c.vendorIds.length >= stores.length ? (
                                <div className="flex items-center gap-1.5 bg-brand-navy/5 rounded-full px-2.5 py-1 w-fit">
                                  <Store size={10} className="text-brand-navy/40 shrink-0" />
                                  <span className="text-[10px] font-bold text-brand-navy/70">All vendors</span>
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {c.vendorIds.map(vid => {
                                    const s = stores.find(st => st.id === vid);
                                    return s ? (
                                      <div key={vid} className="flex items-center gap-1.5 bg-brand-navy/5 rounded-full px-2.5 py-1">
                                        {s.logoUrl
                                          ? <img src={s.logoUrl} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
                                          : <Store size={10} className="text-brand-navy/40 shrink-0" />}
                                        <span className="text-[10px] font-bold text-brand-navy/70">{s.name}</span>
                                      </div>
                                    ) : null;
                                  })}
                                </div>
                              )}
                            </div>
                          ) : null}

                          {joined && (
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center">
                                <p className="text-xs font-bold text-brand-navy/60">
                                  {stampsProgress} / {c.goal} {c.unit}
                                </p>
                                <p className="text-xs font-bold text-brand-navy/40">{progressPct}%</p>
                              </div>
                              <div className="h-2.5 bg-brand-navy/5 rounded-full overflow-hidden">
                                <motion.div
                                  className={cn("h-full rounded-full", isComplete ? 'bg-green-400' : 'bg-brand-gold')}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progressPct}%` }}
                                  transition={{ duration: 0.6, ease: 'easeOut' }}
                                />
                              </div>
                              {isComplete && (
                                <p className="text-[10px] font-bold text-green-600 text-center">
                                  ✓ Goal reached! Claim your reward below.
                                </p>
                              )}
                            </div>
                          )}

                          {joined && isComplete && (
                            <button
                              onClick={() => setRedeemingChallenge({ challenge: c, entry, userName: profile?.name || '' })}
                              className="w-full py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 bg-brand-gold text-white shadow-lg"
                            >
                              🏆 Redeem Now
                            </button>
                          )}

                          {joined ? (
                            !isComplete && (
                            <button
                              onClick={async () => {
                                if (!entry) return;
                                await updateDoc(doc(db, 'challenges', c.id), { participantUids: arrayRemove(user.uid) });
                                await deleteDoc(doc(db, 'challenge_entries', entry.id));
                              }}
                              className="w-full py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 bg-red-50 text-red-500 border border-red-200"
                            >
                              Leave Challenge
                            </button>
                            )
                          ) : (
                            <>
                              {joinedCount >= 5 && (
                                <p className="text-[11px] text-center text-brand-rose font-semibold">
                                  You're in 5 challenges — leave one to join this.
                                </p>
                              )}
                              <button
                                disabled={joinedCount >= 5}
                                onClick={async () => {
                                  if (joinedCount >= 5) return;
                                  await updateDoc(doc(db, 'challenges', c.id), { participantUids: arrayUnion(user.uid) });
                                  const stampsAtJoinPerStore: Record<string, number> = {};
                                  if (c.vendorIds?.length) {
                                    for (const vid of c.vendorIds) {
                                      const card = initialCards.find(cd => cd.store_id === vid);
                                      if (card) {
                                        stampsAtJoinPerStore[vid] =
                                          (card.total_completed_cycles || 0) * (card.stamps_required || 10) + (card.current_stamps || 0);
                                      }
                                    }
                                  }
                                  await addDoc(collection(db, 'challenge_entries'), {
                                    challengeId: c.id,
                                    uid: user.uid,
                                    count: 0,
                                    totalStampsAtJoin: profile?.totalStamps || 0,
                                    ...(c.vendorIds?.length ? { stampsAtJoinPerStore } : {}),
                                    createdAt: serverTimestamp(),
                                  });
                                }}
                                className={cn(
                                  'w-full py-3 rounded-2xl text-sm font-bold transition-all active:scale-95',
                                  joinedCount >= 5 ? 'bg-brand-navy/20 text-brand-navy/40 cursor-not-allowed' : 'bg-brand-navy text-white'
                                )}
                              >
                                Join Challenge
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}
        </div>
      )}

      {/* Sticker Collection Modal */}
      <AnimatePresence>
        {openStickerCardId && (() => {
          const sc = myStickerCards.find(s => s.id === openStickerCardId);
          if (!sc) return null;
          const programme = activePrograms.find(p => p.id === sc.programme_id);
          return (
            <StickerCollectionModal
              key={openStickerCardId}
              stickerCard={sc}
              programme={programme}
              onClose={() => setOpenStickerCardId(null)}
            />
          );
        })()}
      </AnimatePresence>

      {/* Programme Detail Modal */}
      <AnimatePresence>
        {openProgrammeId && (() => {
          const prog = activePrograms.find(p => p.id === openProgrammeId);
          if (!prog) return null;
          const sc = myStickerCards.find(s => s.programme_id === openProgrammeId);
          return (
            <ProgrammeDetailModal
              key={openProgrammeId}
              prog={prog}
              sc={sc}
              onJoin={() => {
                handleJoinProgramme(prog);
              }}
              onView={() => {
                if (sc) {
                  setOpenProgrammeId(null);
                  setOpenStickerCardId(sc.id);
                }
              }}
              onClose={() => setOpenProgrammeId(null)}
              joiningProgramId={joiningProgramId}
              joinError={joinError}
            />
          );
        })()}
      </AnimatePresence>

      {/* NFC Stamp Modal */}
      <AnimatePresence>
        {showNFCStamp && (
          <NFCStampModal
            user={user}
            profile={profile}
            autoStoreId={autoNFCStoreId}
            onPackReady={() => { setShowNFCStamp(false); setAutoNFCStoreId(null); }}
            onClose={() => { setShowNFCStamp(false); setAutoNFCStoreId(null); }}
          />
        )}
      </AnimatePresence>

      {/* Challenge Redeem Modal */}
      <AnimatePresence>
        {redeemingChallenge && (
          <ChallengeRedeemModal
            challenge={redeemingChallenge.challenge}
            entry={redeemingChallenge.entry}
            userName={redeemingChallenge.userName}
            onClose={() => setRedeemingChallenge(null)}
          />
        )}
      </AnimatePresence>

      {/* Pack Opening Modal — standalone, only when no stamp celebration is running */}
      <AnimatePresence>
        {pendingPack && !celebrationPages && (
          <PackOpeningModal
            stickers={pendingPack}
            cardId={pendingPackCardId}
            uid={user.uid}
            onClose={() => {
              const cardId = pendingPackCardId;
              setPendingPack(null);
              setPendingPackCardId(null);
              if (cardId) setOpenStickerCardId(cardId);
            }}
          />
        )}
      </AnimatePresence>

      {activeTab === 'discover' && (
        <DiscoveryScreen
          stores={stores}
          cards={initialCards}
          onJoin={handleJoinStore}
          onViewStore={onViewStore}
          onViewUser={onViewUser}
          currentUser={user}
          currentProfile={profile}
        />
      )}

      {activeTab === 'profile' && (
        <ProfileScreen
          profile={profile}
          userCards={initialCards}
          stores={stores}
          onLogout={onLogout}
          onDeleteAccount={onDeleteAccount}
          onViewUser={onViewUser}
          user={user}
        />
      )}

      {/* Stamp celebration — shows immediately; pack opens inside when monopoly_pack page is reached */}
      <AnimatePresence>
        {celebrationPages && (
          <StampCelebrationModal
            pages={celebrationPages}
            onClose={() => {
              setCelebrationPages(null);
            }}
            avatarConfig={profile?.avatar}
            userUid={user.uid}
            charityAnimals={profile?.charityAnimals ?? 0}
            charityTrees={profile?.charityTrees ?? 0}
            onCharityPick={async (choice) => {
              const field = choice === 'animal' ? 'charityAnimals' : 'charityTrees';
              await updateDoc(doc(db, 'users', user.uid), { [field]: increment(1) });
            }}
            pendingPack={pendingPack}
            pendingPackCardId={pendingPackCardId}
            onPackClosed={(cardId) => {
              setPendingPack(null);
              setPendingPackCardId(null);
              if (cardId) setOpenStickerCardId(cardId);
            }}
          />
        )}
      </AnimatePresence>

      {/* Badge earned notification */}
      <AnimatePresence mode="wait">
        {badgeNotifQueue.length > 0 && (
          <BadgeNotifCard
            badge={badgeNotifQueue[0]}
            queueCount={badgeNotifQueue.length}
            onDismiss={() => setBadgeNotifQueue(q => q.slice(1))}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const BADGE_CELEB_LINES = [
  'You\'ve earned it! 🎉',
  'What a legend! 🌟',
  'Achievement unlocked! 🔥',
  'You\'re incredible! 💎',
];

function BadgeNotifCard({ badge, queueCount, onDismiss }: { badge: AppBadge; queueCount: number; onDismiss: () => void }) {
  useEffect(() => { fireCelebAnimation('fireworks'); }, []);
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-end max-w-md mx-auto"
      onClick={onDismiss}
    >
      <motion.div
        initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 120, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="w-full bg-brand-bg rounded-t-3xl px-6 pt-6 pb-12 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: [0, 1.35, 0.9, 1.1, 1], rotate: [-20, 15, -8, 4, 0] }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
            className="w-28 h-28 rounded-[2rem] flex items-center justify-center text-6xl shadow-2xl"
            style={{ background: `linear-gradient(135deg, ${badge.color}ee, ${badge.color}99)` }}
          >{badge.icon}</motion.div>
        </div>
        <div className="text-center space-y-1">
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="text-[10px] font-bold uppercase tracking-widest text-brand-gold">
            🏅 New Badge Earned!
          </motion.p>
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="font-display text-2xl font-bold text-brand-navy">{badge.name}</motion.p>
          {badge.description && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              className="text-sm text-brand-navy/60 leading-relaxed">{badge.description}</motion.p>
          )}
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
            className="text-xs text-brand-navy/40">{BADGE_METRIC_LABELS[badge.metric]} ≥ {badge.threshold}</motion.p>
        </div>
        {queueCount > 1 && (
          <p className="text-center text-[10px] text-brand-navy/30 font-medium">+{queueCount - 1} more badge{queueCount - 1 > 1 ? 's' : ''} unlocked!</p>
        )}
        <motion.button
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          onClick={onDismiss}
          className="w-full py-3.5 rounded-2xl bg-brand-navy text-white font-bold text-sm active:scale-[0.98] transition-all"
        >
          {BADGE_CELEB_LINES[Math.floor(Math.random() * BADGE_CELEB_LINES.length)]}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// --- NFC Stamp Modal ---

async function processNFCStamp(storeId: string, user: FirebaseUser, profile: UserProfile | null,
  onStatus: (state: 'processing' | 'success' | 'error', msg: string) => void): Promise<CollectibleSticker[]> {
  onStatus('processing', 'Verifying stamp...');
  try {
    const storeSnap = await getDoc(doc(db, 'stores', storeId));
    if (!storeSnap.exists()) { onStatus('error', 'Store not found. Please try again.'); return []; }

    const store = { id: storeSnap.id, ...storeSnap.data() } as StoreProfile;
    const limit = store.stamps_required_for_reward || 10;
    const cardId = `${user.uid}_${store.id}`;
    const cardRef = doc(db, 'cards', cardId);
    const cardSnap = await getDoc(cardRef);

    if (cardSnap.exists()) {
      const ts = cardSnap.data()?.last_tap_timestamp;
      if (ts) {
        const lastTap = ts.toDate ? ts.toDate() : new Date(ts);
        const diffMins = (Date.now() - lastTap.getTime()) / 60000;
        if (diffMins < 30) {
          const waitMins = Math.ceil(30 - diffMins);
          onStatus('error', `Already stamped at ${store.name} recently. Try again in ${waitMins} min.`);
          return [];
        }
      }
    }

    const userName = profile?.name || user.displayName || user.email?.split('@')[0] || 'Customer';
    const userPhoto = profile?.photoURL || user.photoURL || '';
    let newStamps: number;
    let newCycles: number;

    if (!cardSnap.exists() || cardSnap.data()?.isArchived) {
      newStamps = 1; newCycles = 0;
      await setDoc(cardRef, {
        user_id: user.uid, store_id: store.id, current_stamps: newStamps,
        total_completed_cycles: newCycles, stamps_required: limit,
        last_tap_timestamp: serverTimestamp(), isArchived: false, isRedeemed: false, userName, userPhoto,
      });
      await updateDoc(doc(db, 'users', user.uid), { total_cards_held: increment(1) });
    } else {
      const current = cardSnap.data()?.current_stamps || 0;
      newCycles = cardSnap.data()?.total_completed_cycles || 0;
      newStamps = current + 1;
      if (newStamps >= limit) {
        newCycles += 1;
        if (newStamps > limit) newStamps = limit;
        await addDoc(collection(db, 'transactions'), {
          user_id: user.uid, store_id: store.id, completed_at: serverTimestamp(),
          stamps_at_completion: limit, reward_claimed: false,
        });
      }
      await updateDoc(cardRef, { current_stamps: newStamps, total_completed_cycles: newCycles, last_tap_timestamp: serverTimestamp() });
    }

    await updateDoc(doc(db, 'users', user.uid), { totalStamps: increment(1) });
    bumpStreak(user.uid).catch(console.error);

    // Update avatar mood on every stamp (food stores give a bigger boost)
    if (store.category === 'Food') {
      getDoc(doc(db, 'users', user.uid)).then(snap => {
        const cur = (snap.data()?.avatar?.mood ?? 50) as number;
        const today = new Date().toISOString().slice(0, 10);
        updateDoc(doc(db, 'users', user.uid), {
          'avatar.mood': Math.min(100, cur + 6),
          'avatar.lastFoodStampDate': today,
        }).catch(console.error);
      }).catch(console.error);
    } else {
      getDoc(doc(db, 'users', user.uid)).then(snap => {
        const cur = (snap.data()?.avatar?.mood ?? 50) as number;
        updateDoc(doc(db, 'users', user.uid), {
          'avatar.mood': Math.min(100, cur + 3),
        }).catch(console.error);
      }).catch(console.error);
    }

    const newStickers = await issueUserStickers(user.uid, userName, 3).catch(() => [] as CollectibleSticker[]);
    issueStickersToCard(user.uid, userName, 3).catch(console.error);
    updateChallengeProgress(user.uid, store.id, 1).catch(console.error);
    onStatus('success', `Stamp added at ${store.name}!`);
    return newStickers;
  } catch (err: any) {
    console.error('NFC stamp error:', err);
    onStatus('error', err?.message || 'Something went wrong. Please try again.');
    return [];
  }
}

function NFCStampModal({ user, profile, onClose, autoStoreId, onPackReady }: {
  user: FirebaseUser;
  profile: UserProfile | null;
  onClose: () => void;
  autoStoreId?: string | null;
  onPackReady?: (stickers: CollectibleSticker[]) => void;
}) {
  type NFCState = 'ios' | 'scanning' | 'processing' | 'success' | 'error';
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const hasNFC = 'NDEFReader' in window;

  const initialState: NFCState = autoStoreId ? 'processing' : isIOS ? 'ios' : 'scanning';
  const [nfcState, setNfcState] = useState<NFCState>(initialState);
  const [statusMsg, setStatusMsg] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const onStatus = (state: 'processing' | 'success' | 'error', msg: string) => {
    setNfcState(state); setStatusMsg(msg);
  };

  // Auto-process stamp from URL (iOS NFC banner / shared link)
  useEffect(() => {
    if (!autoStoreId) return;
    processNFCStamp(autoStoreId, user, profile, onStatus).then(stickers => {
      if (stickers.length > 0) onPackReady?.(stickers);
    });
  }, []);

  // Android Web NFC scanning
  useEffect(() => {
    if (autoStoreId || isIOS || !hasNFC) return;
    const controller = new AbortController();
    abortRef.current = controller;

    const startScan = async () => {
      try {
        const reader = new (window as any).NDEFReader();
        reader.onreadingerror = () => onStatus('error', 'Could not read NFC tag. Try again.');
        reader.onreading = async (event: any) => {
          controller.abort();
          setNfcState('processing');
          let storeId: string | null = null;
          for (const record of event.message.records) {
            if (record.recordType === 'text') {
              const text = new TextDecoder(record.encoding || 'utf-8').decode(record.data);
              if (text.startsWith('linq4:')) { storeId = text.slice(6).trim(); break; }
            }
            if (record.recordType === 'url') {
              const url = new TextDecoder().decode(record.data);
              const m = url.match(/[?&]stamp=([^&]+)/);
              if (m) { storeId = m[1]; break; }
            }
          }
          if (!storeId) { onStatus('error', 'This tag is not a valid Linq store tag.'); return; }
          const stickers = await processNFCStamp(storeId, user, profile, onStatus);
          if (stickers.length > 0) onPackReady?.(stickers);
        };
        await reader.scan({ signal: controller.signal });
      } catch (err: any) {
        if (err.name !== 'AbortError') onStatus('error', err?.message || 'Could not start NFC scan. Check permissions.');
      }
    };

    startScan();
    return () => { abortRef.current?.abort(); };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-white rounded-t-[2rem] w-full max-w-md p-8 pb-12 text-center"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-brand-navy/20 rounded-full mx-auto mb-6" style={{ width: 40, height: 4 }} />

        {nfcState === 'ios' && (
          <>
            <div className="w-24 h-24 rounded-full bg-brand-navy/5 flex items-center justify-center mx-auto mb-6 relative">
              <Smartphone size={36} className="text-brand-navy" />
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-brand-navy/30"
                animate={{ scale: [1, 1.5, 1], opacity: [0.7, 0, 0.7] }}
                transition={{ duration: 1.8, repeat: Infinity }}
              />
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-brand-navy/15"
                animate={{ scale: [1, 1.9, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1.8, repeat: Infinity, delay: 0.4 }}
              />
            </div>
            <h2 className="font-display text-2xl font-bold text-brand-navy mb-2">Hold to NFC Tag</h2>
            <p className="text-brand-navy/60 text-sm mb-4 leading-relaxed">
              Hold the top of your iPhone near the store's NFC tag. Your iPhone will show a notification — tap it to collect your stamp.
            </p>
            <p className="text-[11px] text-brand-navy/30 font-bold uppercase tracking-widest">iPhone reads NFC automatically</p>
          </>
        )}

        {nfcState === 'scanning' && (
          <>
            <div className="w-24 h-24 rounded-full bg-brand-navy/5 flex items-center justify-center mx-auto mb-6 relative">
              <Wifi size={40} className="text-brand-navy" />
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-brand-navy/30"
                animate={{ scale: [1, 1.4, 1], opacity: [0.8, 0, 0.8] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </div>
            <h2 className="font-display text-2xl font-bold text-brand-navy mb-2">Ready to Scan</h2>
            <p className="text-brand-navy/60 text-sm">Hold your phone near the store NFC tag</p>
          </>
        )}

        {nfcState === 'processing' && (
          <>
            <div className="w-24 h-24 rounded-full bg-brand-navy/5 flex items-center justify-center mx-auto mb-6">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                <Wifi size={40} className="text-brand-navy" />
              </motion.div>
            </div>
            <h2 className="font-display text-2xl font-bold text-brand-navy mb-2">Processing...</h2>
            <p className="text-brand-navy/60 text-sm">{statusMsg}</p>
          </>
        )}

        {nfcState === 'success' && (
          <>
            <div className="w-24 h-24 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={48} className="text-green-500" />
            </div>
            <h2 className="font-display text-2xl font-bold text-brand-navy mb-2">Stamp Added!</h2>
            <p className="text-brand-navy/60 text-sm mb-6">{statusMsg}</p>
            <button onClick={onClose} className="bg-brand-navy text-white px-8 py-3 rounded-xl font-bold text-sm w-full">Done</button>
          </>
        )}

        {nfcState === 'error' && (
          <>
            <div className="w-24 h-24 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
              <X size={48} className="text-red-400" />
            </div>
            <h2 className="font-display text-2xl font-bold text-brand-navy mb-2">Oops</h2>
            <p className="text-brand-navy/60 text-sm mb-6">{statusMsg}</p>
            <button onClick={onClose} className="bg-brand-navy text-white px-8 py-3 rounded-xl font-bold text-sm w-full">Close</button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

const PAGE_ICONS: Record<string, string> = { stamp: '⭐', challenge: '🏆', challenge_done: '🎉', upsell: '🎯', monopoly_pack: '🎰', challenges_list: '🏃', upsell_list: '🎯', stage_reward: '🎁', collectible_promo: '🎴' };
const PAGE_ANIM: Record<string, CelebAnimType> = { stamp: 'confetti', challenge: 'sparkles', challenge_done: 'fireworks', upsell: 'burst', monopoly_pack: 'sparks', challenges_list: 'sparkles', upsell_list: 'burst', stage_reward: 'fireworks', collectible_promo: 'sparks' };
const CTA_LABELS = ['Keep smashing it! 🚀', 'You\'re on fire! 🔥', 'Unstoppable! 💪', 'Legend! ⭐', 'Amazing work! 🎉'];

function getCharityFeedback(type: 'animal' | 'tree', newCount: number): { emoji: string; title: string; detail: string } {
  if (type === 'tree') {
    if (newCount === 1) return { emoji: '🌿', title: 'Your land is coming to life!', detail: 'Green grass is growing — your support is making a real difference.' };
    if (newCount === 2) return { emoji: '🌱', title: 'Land is blooming!', detail: '1 more plant and tiny creatures will start moving in.' };
    if (newCount === 3) return { emoji: '🐀', title: 'Tiny rats moved in!', detail: 'Little critters have arrived thanks to your support.' };
    if (newCount === 4) return { emoji: '🐭', title: 'Almost there!', detail: '1 more plant for rabbits to arrive with their burrows.' };
    if (newCount === 5) return { emoji: '🐇', title: 'Rabbits have arrived!', detail: 'Amazing — your donations are bringing wildlife back to life.' };
    if (newCount === 6) return { emoji: '🌳', title: 'Thriving ecosystem!', detail: '1 more plant to reach the final stage of your journey.' };
    return { emoji: '🌍', title: 'Your land is fully alive!', detail: 'You\'ve reached the final stage — what an incredible difference you\'ve made.' };
  }
  if (newCount < 5) return { emoji: '🐾', title: `${newCount} animal${newCount !== 1 ? 's' : ''} championed!`, detail: `${5 - newCount} more animal${(5 - newCount) !== 1 ? 's' : ''} to champion — every stamp counts!` };
  if (newCount === 5) return { emoji: '🐕', title: 'Dog champion!', detail: 'Your support is making a real difference for endangered species.' };
  return { emoji: '🦁', title: 'Wildlife champion!', detail: 'Your support is making a real difference for endangered species.' };
}

function StampCelebrationModal({
  pages,
  onClose,
  avatarConfig,
  userUid,
  onCharityPick,
  charityAnimals = 0,
  charityTrees = 0,
  pendingPack,
  pendingPackCardId,
  onPackClosed,
}: {
  pages: CelebrationPage[];
  onClose: () => void;
  avatarConfig?: UserAvatar;
  userUid?: string;
  onCharityPick?: (choice: 'animal' | 'tree') => void;
  charityAnimals?: number;
  charityTrees?: number;
  pendingPack?: CollectibleSticker[] | null;
  pendingPackCardId?: string | null;
  onPackClosed?: (cardId: string | null) => void;
}) {
  const [pageIdx, setPageIdx] = useState(0);
  const [charityPicked, setCharityPicked] = useState<'animal' | 'tree' | null>(null);
  const [charityFeedback, setCharityFeedback] = useState<{ emoji: string; title: string; detail: string } | null>(null);
  const [displayRankGlobal, setDisplayRankGlobal] = useState(0);
  const [displayRankWeekly, setDisplayRankWeekly] = useState(0);
  const [rankRevealed, setRankRevealed] = useState(false);
  const [monopolyPackOpen, setMonopolyPackOpen] = useState(false);
  const [stageRedeemed, setStageRedeemed] = useState(false);
  const page = pages[pageIdx];
  const isLast = pageIdx === pages.length - 1;
  const pct = Math.min(100, page.totalStamps > 0 ? Math.round((page.currentStamps / page.totalStamps) * 100) : 0);
  const circumference = 2 * Math.PI * 42;
  const isUpsell = page.type === 'upsell';
  const isCharity = page.type === 'charity';
  const isRank = page.type === 'rank';
  const isMonopolyPack = page.type === 'monopoly_pack';
  const isChallengesList = page.type === 'challenges_list';
  const isUpsellList = page.type === 'upsell_list';
  const isStageReward = page.type === 'stage_reward';
  const isCollectiblePromo = page.type === 'collectible_promo';
  const pageKey = page.type === 'challenge' && page.done ? 'challenge_done' : page.type;

  // Rank page data
  const rankAfterVal = page.rankAfter ?? 0;
  const rankChange = page.rankChange ?? 0;
  const weeklyRankAfterVal = page.rankWeeklyAfter ?? 0;
  const weeklyRankChange = page.rankWeeklyChange ?? 0;

  useEffect(() => {
    setCharityPicked(null);
    setCharityFeedback(null);
    setMonopolyPackOpen(false);
    setStageRedeemed(false);
    if (!isCharity && !isRank && !isMonopolyPack) {
      fireCelebAnimation(PAGE_ANIM[pageKey] || 'sparkles');
    }
  }, [pageIdx]);

  // Drumroll countdown effect for rank page
  useEffect(() => {
    if (!isRank || !rankAfterVal) return;
    setRankRevealed(false);

    const gTarget = rankAfterVal;
    const wTarget = weeklyRankAfterVal || rankAfterVal;
    let iv1: ReturnType<typeof setInterval>;
    let t1: ReturnType<typeof setTimeout>;
    let iv2: ReturnType<typeof setInterval>;

    // Phase 1 (1.2s): fast slot-machine random numbers
    iv1 = setInterval(() => {
      setDisplayRankGlobal(Math.max(1, Math.floor(Math.random() * Math.max(gTarget * 6, 200)) + 1));
      setDisplayRankWeekly(Math.max(1, Math.floor(Math.random() * Math.max(wTarget * 6, 100)) + 1));
    }, 55);

    // Phase 2 (1.3s): decelerate into the real number
    t1 = setTimeout(() => {
      clearInterval(iv1);
      const startG = Math.max(gTarget + 40, Math.round(gTarget * 2.5));
      const startW = Math.max(wTarget + 20, Math.round(wTarget * 2.5));
      const t0 = Date.now();
      const dur = 1300;
      iv2 = setInterval(() => {
        const p = Math.min(1, (Date.now() - t0) / dur);
        setDisplayRankGlobal(Math.max(1, Math.round(startG + (gTarget - startG) * Math.pow(p, 0.6))));
        setDisplayRankWeekly(Math.max(1, Math.round(startW + (wTarget - startW) * Math.pow(p, 0.6))));
        if (p >= 1) {
          clearInterval(iv2);
          setDisplayRankGlobal(gTarget);
          setDisplayRankWeekly(wTarget);
          setRankRevealed(true);
          if (rankChange > 0 || weeklyRankChange > 0) setTimeout(() => fireCelebAnimation('sparkles'), 150);
        }
      }, 60);
    }, 1200);

    return () => { clearInterval(iv1); clearTimeout(t1); clearInterval(iv2); };
  }, [pageIdx, isRank]);

  const handleCharityChoice = (choice: 'animal' | 'tree') => {
    if (charityPicked) return;
    setCharityPicked(choice);
    onCharityPick?.(choice);
    const currentCount = choice === 'animal' ? charityAnimals : charityTrees;
    const feedback = getCharityFeedback(choice, currentCount + 1);
    setCharityFeedback(feedback);
    setTimeout(() => {
      if (isLast) onClose();
      else setPageIdx(i => i + 1);
    }, 2600);
  };

  const ctaLabel = isLast
    ? (isUpsell ? 'Join the challenge! 🎯' : isUpsellList ? 'Explore Challenges! 🎯' : CTA_LABELS[pageIdx % CTA_LABELS.length])
    : 'Next 🎉';

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-end max-w-md mx-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 120, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
        className="w-full bg-brand-bg rounded-t-3xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={pageIdx}
            initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative overflow-hidden p-6 pb-12 space-y-5"
          >
            {/* ── Big reward overlay — slides in after charity pick ── */}
            <AnimatePresence>
              {charityFeedback && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.88, y: 24 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                  className="absolute inset-0 bg-brand-bg z-20 flex flex-col items-center justify-center p-8 text-center gap-4"
                >
                  <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 14, delay: 0.12 }}
                    className="text-7xl select-none"
                  >{charityFeedback.emoji}</motion.div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-500">Thank you! 💚</p>
                    <h2 className="font-display font-bold text-2xl text-brand-navy leading-tight">{charityFeedback.title}</h2>
                  </div>
                  <p className="text-sm text-brand-navy/70 leading-relaxed max-w-xs">{charityFeedback.detail}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {isRank ? (
              /* ── Rank reveal with drumroll countdown ── */
              <>
                {/* Avatar */}
                <motion.div
                  initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.05 }}
                  className="flex justify-center"
                >
                  <div className="w-20 h-20 rounded-[1.75rem] bg-gradient-to-b from-indigo-100 to-indigo-50 flex items-center justify-center shadow-md border border-brand-navy/8">
                    <PixelAvatar config={avatarConfig} uid={userUid ?? 'x'} size={68} view="full" />
                  </div>
                </motion.div>

                {/* Drumroll label */}
                <motion.div
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  className="text-center"
                >
                  <motion.p
                    animate={!rankRevealed ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
                    transition={!rankRevealed ? { duration: 0.55, repeat: Infinity } : {}}
                    className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40"
                  >
                    {rankRevealed ? '🏆 Your rank' : '🥁 Calculating your rank...'}
                  </motion.p>
                </motion.div>

                {/* Two rank cards */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Global rank */}
                  <div className={cn(
                    'rounded-2xl p-4 text-center space-y-1 border transition-colors duration-300',
                    rankRevealed
                      ? rankChange > 0 ? 'bg-emerald-50 border-emerald-200' : rankChange < 0 ? 'bg-red-50/60 border-red-100' : 'bg-brand-navy/4 border-brand-navy/8'
                      : 'bg-brand-navy/4 border-brand-navy/8'
                  )}>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-brand-navy/40">Global</p>
                    <motion.p
                      key={rankRevealed ? 'g-final' : 'g-spin'}
                      animate={rankRevealed ? { scale: [0.7, 1.25, 1], opacity: [0.5, 1, 1] } : {}}
                      transition={{ type: 'spring', stiffness: 380, damping: 14 }}
                      className={cn(
                        'font-display font-black text-3xl leading-none tabular-nums',
                        rankRevealed
                          ? rankChange > 0 ? 'text-emerald-600' : rankChange < 0 ? 'text-red-500' : 'text-brand-navy'
                          : 'text-brand-navy/25'
                      )}
                    >
                      #{displayRankGlobal || '—'}
                    </motion.p>
                    <AnimatePresence>
                      {rankRevealed && rankChange !== 0 && (
                        <motion.p
                          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className={cn('text-[10px] font-black', rankChange > 0 ? 'text-emerald-500' : 'text-red-400')}
                        >
                          {rankChange > 0 ? `↑ +${rankChange}` : `↓ ${rankChange}`}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Weekly rank */}
                  <div className={cn(
                    'rounded-2xl p-4 text-center space-y-1 border transition-colors duration-300',
                    rankRevealed
                      ? weeklyRankChange > 0 ? 'bg-emerald-50 border-emerald-200' : weeklyRankChange < 0 ? 'bg-red-50/60 border-red-100' : 'bg-brand-navy/4 border-brand-navy/8'
                      : 'bg-brand-navy/4 border-brand-navy/8'
                  )}>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-brand-navy/40">This Week</p>
                    <motion.p
                      key={rankRevealed ? 'w-final' : 'w-spin'}
                      animate={rankRevealed ? { scale: [0.7, 1.25, 1], opacity: [0.5, 1, 1] } : {}}
                      transition={{ type: 'spring', stiffness: 380, damping: 14, delay: 0.08 }}
                      className={cn(
                        'font-display font-black text-3xl leading-none tabular-nums',
                        rankRevealed
                          ? weeklyRankChange > 0 ? 'text-emerald-600' : weeklyRankChange < 0 ? 'text-red-500' : 'text-brand-navy'
                          : 'text-brand-navy/25'
                      )}
                    >
                      #{displayRankWeekly || '—'}
                    </motion.p>
                    <AnimatePresence>
                      {rankRevealed && weeklyRankChange !== 0 && (
                        <motion.p
                          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className={cn('text-[10px] font-black', weeklyRankChange > 0 ? 'text-emerald-500' : 'text-red-400')}
                        >
                          {weeklyRankChange > 0 ? `↑ +${weeklyRankChange}` : `↓ ${weeklyRankChange}`}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {pages.length > 1 && (
                  <div className="flex justify-center gap-1.5">
                    {pages.map((_, i) => (
                      <motion.div key={i} animate={{ width: i === pageIdx ? 16 : 6 }} className={cn('h-1.5 rounded-full transition-colors', i === pageIdx ? 'bg-brand-navy' : 'bg-brand-navy/20')} />
                    ))}
                  </div>
                )}

                <motion.button
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: rankRevealed ? 1 : 0.35, y: 0 }} transition={{ delay: 0.35 }}
                  onClick={rankRevealed ? (isLast ? onClose : () => setPageIdx(i => i + 1)) : undefined}
                  style={{ pointerEvents: rankRevealed ? 'auto' : 'none' }}
                  className="w-full py-3.5 rounded-2xl bg-brand-navy text-white font-bold text-sm active:scale-[0.98] transition-all"
                >
                  {ctaLabel}
                </motion.button>
              </>
            ) : isCharity ? (
              /* ── Charity deed page ── */
              <>
                {/* Header */}
                <div className="text-center space-y-1">
                  <motion.p
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="text-[10px] font-bold uppercase tracking-widest text-emerald-500"
                  >
                    🌍 Do a Good Deed!
                  </motion.p>
                  <motion.h2
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                    className="font-display text-xl font-bold text-brand-navy leading-tight"
                  >
                    Your stamp can help the planet
                  </motion.h2>
                </div>

                {/* Waving avatar with party hat */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
                  className="flex justify-center"
                >
                  <div className="relative flex items-end gap-2">
                    {/* Avatar + party hat */}
                    <motion.div
                      animate={{ rotate: [0, -8, 8, -8, 8, 0] }}
                      transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 0.8, ease: 'easeInOut' }}
                      className="relative"
                    >
                      {/* Party hat emoji above avatar head */}
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-2xl z-10 select-none">🎉</div>
                      <div className="bg-gradient-to-b from-emerald-100 to-teal-50 rounded-[1.5rem] p-3">
                        <PixelAvatar config={avatarConfig} uid={userUid ?? 'x'} size={64} view="full" />
                      </div>
                    </motion.div>
                    {/* Waving hand */}
                    <motion.div
                      animate={{ rotate: [0, 25, 0, 25, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 1.4, ease: 'easeInOut' }}
                      className="text-3xl mb-2 origin-bottom select-none"
                    >
                      👋
                    </motion.div>
                  </div>
                </motion.div>

                {/* Pick a cause */}
                <motion.p
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                  className="text-center text-xs font-bold text-brand-navy/50 uppercase tracking-widest"
                >
                  Pick what to champion today:
                </motion.p>

                {/* Animal + Tree cards */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                  className="grid grid-cols-2 gap-3"
                >
                  {/* Endangered animal card */}
                  <button
                    onClick={() => handleCharityChoice('animal')}
                    disabled={!!charityPicked}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.97]',
                      charityPicked === 'animal'
                        ? 'border-emerald-400 bg-emerald-50 scale-[0.97]'
                        : charityPicked === 'tree'
                          ? 'border-brand-navy/10 bg-white opacity-40'
                          : 'border-brand-navy/10 bg-white hover:border-emerald-300 hover:bg-emerald-50/50',
                    )}
                  >
                    <div className="text-4xl">{page.charityAnimal?.emoji ?? '🐾'}</div>
                    <div className="w-full">
                      <p className="font-display font-bold text-sm text-brand-navy leading-tight">{page.charityAnimal?.name ?? 'Endangered Animal'}</p>
                      <p className="text-[10px] font-bold text-red-500 mt-0.5">{page.charityAnimal?.status}</p>
                      <p className="text-[10px] text-brand-navy/50 mt-1 leading-tight">{page.charityAnimal?.fact}</p>
                    </div>
                    {charityPicked === 'animal' && (
                      <motion.div
                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className="text-xl"
                      >✅</motion.div>
                    )}
                  </button>

                  {/* Plant a tree card */}
                  <button
                    onClick={() => handleCharityChoice('tree')}
                    disabled={!!charityPicked}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.97]',
                      charityPicked === 'tree'
                        ? 'border-emerald-400 bg-emerald-50 scale-[0.97]'
                        : charityPicked === 'animal'
                          ? 'border-brand-navy/10 bg-white opacity-40'
                          : 'border-brand-navy/10 bg-white hover:border-emerald-300 hover:bg-emerald-50/50',
                    )}
                  >
                    <div className="text-4xl">🌳</div>
                    <div className="w-full">
                      <p className="font-display font-bold text-sm text-brand-navy leading-tight">Plant a Tree</p>
                      <p className="text-[10px] font-bold text-emerald-600 mt-0.5">Reforestation</p>
                      <p className="text-[10px] text-brand-navy/50 mt-1 leading-tight">Help restore forests and fight climate change</p>
                    </div>
                    {charityPicked === 'tree' && (
                      <motion.div
                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className="text-xl"
                      >✅</motion.div>
                    )}
                  </button>
                </motion.div>

                {/* Donation note */}
                <motion.div
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
                  className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 flex items-start gap-2"
                >
                  <span className="text-lg shrink-0">💚</span>
                  <p className="text-[11px] text-emerald-700 font-medium leading-snug">
                    We donate <strong>10% of our profits</strong> to charitable organisations supporting wildlife conservation and reforestation.
                  </p>
                </motion.div>

                {/* Page dots */}
                {pages.length > 1 && (
                  <div className="flex justify-center gap-1.5">
                    {pages.map((_, i) => (
                      <motion.div key={i} animate={{ width: i === pageIdx ? 16 : 6 }} className={cn('h-1.5 rounded-full transition-colors', i === pageIdx ? 'bg-brand-navy' : 'bg-brand-navy/20')} />
                    ))}
                  </div>
                )}
              </>
            ) : isStageReward ? (
              /* ── Stage reward page (2-step: reward → next stage progress) ── */
              <>
                {!stageRedeemed ? (
                  /* Step 1: reward celebration */
                  <>
                    <div className="text-center space-y-1">
                      <motion.p
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                        className="text-[10px] font-bold uppercase tracking-widest text-brand-gold"
                      >
                        🎁 Stage Reward Unlocked!
                      </motion.p>
                      <motion.h2
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                        className="font-display text-2xl font-bold text-brand-navy leading-tight"
                      >
                        {page.stageStoreName}
                      </motion.h2>
                    </div>

                    <motion.div
                      initial={{ scale: 0, rotate: -15 }} animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
                      className="flex justify-center"
                    >
                      <div className="text-8xl select-none">🎁</div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                      className="rounded-3xl bg-brand-navy p-5 text-center space-y-2"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold/70">Your reward</p>
                      <p className="font-display text-xl font-bold text-white leading-tight">{page.stageReward}</p>
                      <p className="text-xs text-white/50 mt-1">Show this screen at {page.stageStoreName} to claim</p>
                    </motion.div>

                    {pages.length > 1 && (
                      <div className="flex justify-center gap-1.5">
                        {pages.map((_, i) => (
                          <motion.div key={i} animate={{ width: i === pageIdx ? 16 : 6 }} className={cn('h-1.5 rounded-full transition-colors', i === pageIdx ? 'bg-brand-navy' : 'bg-brand-navy/20')} />
                        ))}
                      </div>
                    )}

                    <motion.button
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                      onClick={() => { setStageRedeemed(true); fireCelebAnimation('fireworks'); }}
                      className="w-full py-3.5 rounded-2xl font-bold text-sm active:scale-[0.98] transition-all"
                      style={{ background: 'linear-gradient(135deg, #16A34A, #15803D)', color: 'white' }}
                    >
                      Redeem 🎁
                    </motion.button>
                  </>
                ) : (
                  /* Step 2: next stage progress */
                  <>
                    <div className="text-center space-y-1">
                      <motion.p
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        className="text-[10px] font-bold uppercase tracking-widest text-green-600"
                      >
                        ✓ Redeemed!
                      </motion.p>
                      <motion.h2
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                        className="font-display text-2xl font-bold text-brand-navy leading-tight"
                      >
                        {page.nextStageStamps ? 'Keep going!' : 'Card Complete!'}
                      </motion.h2>
                    </div>

                    {/* Savings animation */}
                    {(page.stageValue ?? 0) > 0 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.15, type: 'spring', stiffness: 280, damping: 20 }}
                        className="rounded-3xl bg-emerald-50 border-2 border-emerald-200 p-5 text-center space-y-1"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">You saved</p>
                        <CountUpValue value={page.stageValue!} prefix="£" className="font-display text-4xl font-black text-emerald-500" />
                        <p className="text-xs text-emerald-500/70">Added to your total savings 💚</p>
                      </motion.div>
                    )}

                    {page.nextStageStamps ? (
                      <>
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
                          className="flex justify-center"
                        >
                          <div className="relative w-32 h-32">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                              <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" stroke="currentColor" className="text-brand-navy/8" />
                              <motion.circle
                                cx="50" cy="50" r="42" fill="none" strokeWidth="8" stroke="currentColor"
                                className="text-brand-gold"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                initial={{ strokeDashoffset: circumference }}
                                animate={{ strokeDashoffset: circumference * (1 - (page.stageStamps ?? 0) / (page.nextStageStamps ?? 1)) }}
                                transition={{ duration: 0.9, ease: 'easeOut' }}
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-3xl font-display font-bold text-brand-navy leading-none">{page.stageStamps}</span>
                              <span className="text-xs text-brand-navy/40 font-bold">/ {page.nextStageStamps}</span>
                            </div>
                          </div>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                          className="rounded-2xl bg-brand-gold/10 p-4 text-center"
                        >
                          <p className="font-bold text-sm text-brand-navy">
                            {(page.nextStageStamps - (page.stageStamps ?? 0))} more stamp{page.nextStageStamps - (page.stageStamps ?? 0) !== 1 ? 's' : ''} to earn:
                          </p>
                          <p className="font-display font-bold text-lg text-brand-navy mt-0.5">{page.nextStageReward}</p>
                        </motion.div>
                      </>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
                        className="rounded-3xl bg-green-50 border border-green-200 p-6 text-center space-y-2"
                      >
                        <p className="text-5xl">🏆</p>
                        <p className="font-display font-bold text-lg text-green-800">All rewards earned!</p>
                        <p className="text-xs text-green-600/80">A new card starts fresh next visit</p>
                      </motion.div>
                    )}

                    {pages.length > 1 && (
                      <div className="flex justify-center gap-1.5">
                        {pages.map((_, i) => (
                          <motion.div key={i} animate={{ width: i === pageIdx ? 16 : 6 }} className={cn('h-1.5 rounded-full transition-colors', i === pageIdx ? 'bg-brand-navy' : 'bg-brand-navy/20')} />
                        ))}
                      </div>
                    )}

                    <motion.button
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                      onClick={isLast ? onClose : () => setPageIdx(i => i + 1)}
                      className="w-full py-3.5 rounded-2xl bg-brand-navy text-white font-bold text-sm active:scale-[0.98] transition-all"
                    >
                      {isLast ? 'Done 🎉' : 'Continue 🎉'}
                    </motion.button>
                  </>
                )}
              </>
            ) : isMonopolyPack ? (
              /* ── Monopoly/collectible pack page ── */
              <>
                {/* PackOpeningModal renders on top when triggered */}
                {monopolyPackOpen && pendingPack && (
                  <PackOpeningModal
                    stickers={pendingPack}
                    cardId={pendingPackCardId}
                    uid={userUid}
                    onClose={() => {
                      setMonopolyPackOpen(false);
                      onPackClosed?.(pendingPackCardId ?? null);
                      if (isLast) onClose();
                      else setPageIdx(i => i + 1);
                    }}
                  />
                )}

                <div className="text-center space-y-1">
                  <motion.p
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="text-[10px] font-bold uppercase tracking-widest text-brand-gold"
                  >
                    🎰 Sticker Pack
                  </motion.p>
                  <motion.h2
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                    className="font-display text-xl font-bold text-brand-navy leading-tight"
                  >
                    {page.monopolyChallengeName ?? 'Collectible Challenge'}
                  </motion.h2>
                </div>

                <motion.div
                  initial={{ scale: 0, rotate: -15 }} animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
                  className="flex justify-center"
                >
                  <div className="text-8xl select-none">🎁</div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                  className="rounded-2xl bg-brand-gold/10 p-4 text-center"
                >
                  <p className="font-bold text-sm text-brand-navy">
                    {pendingPack ? 'Your sticker pack is ready — tap to reveal! 🎉' : 'Getting your sticker pack ready...'}
                  </p>
                </motion.div>

                {pages.length > 1 && (
                  <div className="flex justify-center gap-1.5">
                    {pages.map((_, i) => (
                      <motion.div key={i} animate={{ width: i === pageIdx ? 16 : 6 }} className={cn('h-1.5 rounded-full transition-colors', i === pageIdx ? 'bg-brand-navy' : 'bg-brand-navy/20')} />
                    ))}
                  </div>
                )}

                <motion.button
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: pendingPack ? 1 : 0.4, y: 0 }} transition={{ delay: 0.35 }}
                  onClick={pendingPack ? () => setMonopolyPackOpen(true) : undefined}
                  style={{ pointerEvents: pendingPack ? 'auto' : 'none' }}
                  className="w-full py-3.5 rounded-2xl bg-brand-navy text-white font-bold text-sm active:scale-[0.98] transition-all"
                >
                  {pendingPack ? 'Open Your Pack! 🎰' : 'Loading...'}
                </motion.button>
              </>
            ) : isChallengesList ? (
              /* ── All joined challenge progresses as a list ── */
              <>
                <div className="text-center space-y-1">
                  <motion.p
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="text-[10px] font-bold uppercase tracking-widest text-brand-gold"
                  >
                    🏃 Challenge Updates
                  </motion.p>
                  <motion.h2
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                    className="font-display text-xl font-bold text-brand-navy leading-tight"
                  >
                    Your Progress
                  </motion.h2>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {page.challengesList?.map((c, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.08 }}
                      className={cn('rounded-2xl p-4 space-y-2', c.done ? 'bg-green-50' : 'bg-brand-navy/5')}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-sm text-brand-navy truncate">{c.title}</p>
                        {c.done && (
                          <motion.span
                            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 14 }}
                            className="text-[10px] font-black text-green-500 shrink-0"
                          >✓ DONE!</motion.span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-brand-navy/40">
                          <span className="truncate max-w-[70%]">{c.reward}</span>
                          <span>{c.currentStamps}/{c.totalStamps}</span>
                        </div>
                        <div className="h-1.5 bg-brand-navy/8 rounded-full overflow-hidden">
                          <motion.div
                            className={cn('h-full rounded-full', c.done ? 'bg-green-400' : 'bg-brand-gold')}
                            initial={{ width: 0 }}
                            animate={{ width: `${c.totalStamps > 0 ? Math.min(100, Math.round((c.currentStamps / c.totalStamps) * 100)) : 0}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 + i * 0.08 }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {pages.length > 1 && (
                  <div className="flex justify-center gap-1.5">
                    {pages.map((_, i) => (
                      <motion.div key={i} animate={{ width: i === pageIdx ? 16 : 6 }} className={cn('h-1.5 rounded-full transition-colors', i === pageIdx ? 'bg-brand-navy' : 'bg-brand-navy/20')} />
                    ))}
                  </div>
                )}

                <motion.button
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                  onClick={isLast ? onClose : () => setPageIdx(i => i + 1)}
                  className="w-full py-3.5 rounded-2xl bg-brand-navy text-white font-bold text-sm active:scale-[0.98] transition-all"
                >
                  {ctaLabel}
                </motion.button>
              </>
            ) : isUpsellList ? (
              /* ── Recommended challenges list ── */
              <>
                <div className="text-center space-y-1">
                  <motion.p
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="text-[10px] font-bold uppercase tracking-widest text-brand-gold"
                  >
                    ✨ Level Up!
                  </motion.p>
                  <motion.h2
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                    className="font-display text-xl font-bold text-brand-navy leading-tight"
                  >
                    Make every stamp count!
                  </motion.h2>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {page.upsellList?.map((c, i) => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.07 }}
                      className="rounded-2xl bg-brand-navy/5 border border-brand-navy/8 p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-brand-navy truncate">{c.title}</p>
                        <p className="text-[11px] text-brand-navy/50 mt-0.5 truncate">🏆 {c.reward}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] font-bold text-brand-navy/40">{c.totalStamps} stamps</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                  className="rounded-2xl bg-brand-gold/10 border border-brand-gold/20 p-3.5 text-center"
                >
                  <p className="text-xs font-bold text-brand-navy">🎯 Join in the Challenges tab — every stamp counts!</p>
                </motion.div>

                {pages.length > 1 && (
                  <div className="flex justify-center gap-1.5">
                    {pages.map((_, i) => (
                      <motion.div key={i} animate={{ width: i === pageIdx ? 16 : 6 }} className={cn('h-1.5 rounded-full transition-colors', i === pageIdx ? 'bg-brand-navy' : 'bg-brand-navy/20')} />
                    ))}
                  </div>
                )}

                <motion.button
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
                  onClick={isLast ? onClose : () => setPageIdx(i => i + 1)}
                  className="w-full py-3.5 rounded-2xl bg-brand-navy text-white font-bold text-sm active:scale-[0.98] transition-all"
                >
                  {ctaLabel}
                </motion.button>
              </>
            ) : isCollectiblePromo ? (
              /* ── Collectible programme promo (user not yet joined) ── */
              <>
                <div className="text-center space-y-1">
                  <motion.p
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="text-[10px] font-bold uppercase tracking-widest text-brand-gold"
                  >
                    🎴 Sticker Game
                  </motion.p>
                  <motion.h2
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                    className="font-display text-xl font-bold text-brand-navy leading-tight"
                  >
                    {page.collectiblePromoName ?? 'Collectible Challenge'}
                  </motion.h2>
                </div>

                <motion.div
                  initial={{ scale: 0, rotate: -12 }} animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
                  className="flex justify-center"
                >
                  <div className="text-8xl select-none">🎴</div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  className="rounded-2xl bg-brand-navy/5 p-4 text-center space-y-2"
                >
                  <p className="text-xs font-semibold text-brand-navy/60">
                    Your stickers could go towards the {page.collectiblePromoName ?? 'game'} — join to start collecting!
                  </p>
                </motion.div>

                {page.collectiblePromoReward && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
                    className="rounded-2xl bg-brand-gold/15 border border-brand-gold/30 p-5 text-center"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-1">Prize</p>
                    <p className="font-display text-2xl font-black text-brand-navy leading-tight">{page.collectiblePromoReward}</p>
                  </motion.div>
                )}

                {pages.length > 1 && (
                  <div className="flex justify-center gap-1.5">
                    {pages.map((_, i) => (
                      <motion.div key={i} animate={{ width: i === pageIdx ? 16 : 6 }} className={cn('h-1.5 rounded-full transition-colors', i === pageIdx ? 'bg-brand-navy' : 'bg-brand-navy/20')} />
                    ))}
                  </div>
                )}

                <motion.button
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                  onClick={isLast ? onClose : () => setPageIdx(i => i + 1)}
                  className="w-full py-3.5 rounded-2xl bg-brand-navy text-white font-bold text-sm active:scale-[0.98] transition-all"
                >
                  {ctaLabel}
                </motion.button>
              </>
            ) : (
              /* ── Standard stamp page ── */
              <>
                {/* Animated icon + label */}
                <div className="text-center space-y-1">
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 15, delay: 0.05 }}
                    className="text-5xl mb-2"
                  >
                    {PAGE_ICONS[pageKey]}
                  </motion.div>
                  <motion.p
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                    className="text-[10px] font-bold uppercase tracking-widest text-brand-gold"
                  >
                    {isUpsell ? '✨ Level up your stamps!' : page.type === 'stamp' ? '🎉 Stamp Collected!' : page.done ? '🏆 Challenge Complete!' : '🏃 Challenge Update'}
                  </motion.p>
                  <motion.h2
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="font-display text-2xl font-bold text-brand-navy leading-tight"
                  >
                    {isUpsell ? page.upsellTitle : page.type === 'stamp' ? page.storeName : page.challengeTitle}
                  </motion.h2>
                </div>

                {isUpsell ? (
                  /* Upsell layout — no ring, just big prize highlight */
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                    className="rounded-3xl bg-brand-navy p-5 text-center space-y-2"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold/70">Prize</p>
                    <p className="font-display text-xl font-bold text-white leading-tight">{page.reward}</p>
                    <p className="text-xs text-white/60">Collect {page.totalStamps} stamps to win</p>
                  </motion.div>
                ) : (
                  /* Progress ring */
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15, type: 'spring', stiffness: 300 }}
                    className="flex justify-center"
                  >
                    <div className="relative w-32 h-32">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" stroke="currentColor" className="text-brand-navy/8" />
                        <motion.circle
                          cx="50" cy="50" r="42" fill="none" strokeWidth="8" stroke="currentColor"
                          className={page.done ? 'text-green-400' : 'text-brand-gold'}
                          strokeLinecap="round"
                          strokeDasharray={circumference}
                          initial={{ strokeDashoffset: circumference }}
                          animate={{ strokeDashoffset: circumference * (1 - pct / 100) }}
                          transition={{ duration: 0.9, ease: 'easeOut' }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-display font-bold text-brand-navy leading-none">{page.currentStamps}</span>
                        <span className="text-xs text-brand-navy/40 font-bold">/ {page.totalStamps}</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Encouragement pill */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                  className={cn('rounded-2xl p-4 text-center', page.done ? 'bg-green-50' : isUpsell ? 'bg-brand-gold/15' : 'bg-brand-gold/10')}
                >
                  <p className={cn('font-bold text-sm leading-snug', page.done ? 'text-green-600' : 'text-brand-navy')}>
                    {page.encouragement}
                  </p>
                </motion.div>

                {/* Progress bar (skip for upsell) */}
                {!isUpsell && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                    className="space-y-1.5"
                  >
                    <div className="flex justify-between text-[10px] font-bold text-brand-navy/40">
                      <span className="truncate max-w-[70%]">{page.reward}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-2 bg-brand-navy/8 rounded-full overflow-hidden">
                      <motion.div
                        className={cn('h-full rounded-full', page.done ? 'bg-green-400' : 'bg-brand-gold')}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.9, ease: 'easeOut' }}
                      />
                    </div>
                  </motion.div>
                )}

                {/* Page dots */}
                {pages.length > 1 && (
                  <div className="flex justify-center gap-1.5">
                    {pages.map((_, i) => (
                      <motion.div key={i} animate={{ width: i === pageIdx ? 16 : 6 }} className={cn('h-1.5 rounded-full transition-colors', i === pageIdx ? 'bg-brand-navy' : 'bg-brand-navy/20')} />
                    ))}
                  </div>
                )}

                {/* CTA */}
                <motion.button
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                  onClick={isLast ? onClose : () => setPageIdx(i => i + 1)}
                  className="w-full py-3.5 rounded-2xl bg-brand-navy text-white font-bold text-sm active:scale-[0.98] transition-all"
                >
                  {ctaLabel}
                </motion.button>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

const MONOPOLY_EMOJIS = ['🎰', '🃏', '🎲', '🏆', '🎯', '⭐', '💎', '🌟', '🎪', '🎡'];

function StickerCelebrationModal({ programmeName, newCount, totalStickers, totalSets, animType, stickerCardId, onClose, onReveal }: {
  programmeName: string;
  newCount: number;
  totalStickers: number;
  totalSets: number;
  animType: CelebAnimType;
  stickerCardId: string;
  onClose: () => void;
  onReveal: () => void;
}) {
  const emoji = MONOPOLY_EMOJIS[Math.floor(Math.random() * MONOPOLY_EMOJIS.length)];
  const maxSets = STICKER_ORDER.reduce((sum, t) => sum + STICKER_CONFIG[t].variants.length * 3, 0);
  const allWon = totalSets >= maxSets;

  useEffect(() => { fireCelebAnimation(animType); }, []);

  // Vary the enter animation style per animation type
  const iconAnims: Record<CelebAnimType, object> = {
    confetti: { scale: [0, 1.3, 0.9, 1], rotate: [0, -15, 10, 0] },
    sparks:   { scale: [0, 1.4, 0.85, 1], y: [30, -10, 5, 0] },
    fireworks:{ scale: [0, 1.5, 0.8, 1.1, 1], rotate: [0, 20, -15, 5, 0] },
    sparkles: { scale: [0, 1.2, 1], rotate: [0, 360] },
    burst:    { scale: [0, 2, 0.85, 1], opacity: [0, 1, 1, 1] },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[210] flex items-end max-w-md mx-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 140, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 140, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
        className="w-full bg-brand-bg rounded-t-3xl p-6 pb-12 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Animated icon */}
        <div className="flex justify-center">
          <motion.div
            animate={iconAnims[animType]}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            className="w-28 h-28 rounded-[2rem] bg-brand-navy flex items-center justify-center text-6xl shadow-xl"
          >
            {emoji}
          </motion.div>
        </div>

        {/* Header */}
        <div className="text-center space-y-1">
          <motion.p
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="text-[10px] font-bold uppercase tracking-widest text-brand-gold"
          >
            {newCount === 1 ? '🎴 Ooh, a new sticker just dropped!' : `🎴 WOW — ${newCount} new stickers!`}
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="font-display text-2xl font-bold text-brand-navy"
          >
            {programmeName}
          </motion.h2>
        </div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="flex gap-3"
        >
          <div className="flex-1 bg-white rounded-2xl p-3 text-center border border-black/5">
            <p className="text-2xl font-display font-bold text-brand-navy">{totalStickers}</p>
            <p className="text-[10px] text-brand-navy/40 font-bold uppercase tracking-wider mt-0.5">Stickers</p>
          </div>
          <div className={cn('flex-1 rounded-2xl p-3 text-center border', allWon ? 'bg-green-50 border-green-200' : 'bg-white border-black/5')}>
            <p className={cn('text-2xl font-display font-bold', allWon ? 'text-green-500' : 'text-brand-navy')}>{totalSets}</p>
            <p className={cn('text-[10px] font-bold uppercase tracking-wider mt-0.5', allWon ? 'text-green-400' : 'text-brand-navy/40')}>Sets</p>
          </div>
        </motion.div>

        {/* Encouragement */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className={cn('rounded-2xl p-4 text-center', allWon ? 'bg-green-50' : 'bg-brand-gold/10')}
        >
          <p className={cn('font-bold text-sm leading-snug', allWon ? 'text-green-600' : 'text-brand-navy')}>
            {allWon
              ? '🏆 ALL SETS COMPLETE! You absolute legend!'
              : totalSets >= maxSets - 3
                ? `🔥 So close! Just ${maxSets - totalSets} more set${maxSets - totalSets > 1 ? 's' : ''} to go!`
                : `✨ ${totalSets} set${totalSets !== 1 ? 's' : ''} collected — keep going and win big!`}
          </p>
        </motion.div>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="flex gap-2"
        >
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl border border-brand-navy/15 text-brand-navy/60 font-bold text-sm active:scale-[0.98] transition-all">
            Save for later
          </button>
          <button
            onClick={() => { onClose(); onReveal(); }}
            className="flex-1 py-3 rounded-2xl bg-brand-navy text-white font-bold text-sm active:scale-[0.98] transition-all"
          >
            Reveal it! 🎴
          </button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// --- Vendor Broadcast: Add Automation Modal ---

function AddAutomationModal({ store, onClose }: { store: StoreProfile; onClose: () => void }) {
  const [type, setType] = useState<'birthday' | 'scheduled'>('birthday');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [daysBefore, setDaysBefore] = useState(0);
  const [scheduledAt, setScheduledAt] = useState('');
  const [recurring, setRecurring] = useState<'none' | 'yearly'>('none');
  const [saving, setSaving] = useState(false);

  const valid = title.trim() && message.trim() && (type === 'birthday' || !!scheduledAt);

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const data: any = {
        storeId: store.id,
        storeName: store.name,
        type,
        title: title.trim(),
        message: message.trim(),
        status: 'active',
        createdAt: serverTimestamp(),
      };
      if (type === 'birthday') {
        data.daysBefore = daysBefore;
      } else {
        data.scheduledAt = Timestamp.fromDate(new Date(scheduledAt));
        data.recurring = recurring;
      }
      await addDoc(collection(db, 'store_automations'), data);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 30, stiffness: 350 }}
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[160] max-w-sm mx-auto bg-white rounded-[2rem] shadow-2xl p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-brand-navy">New Automation</h3>
          <button onClick={onClose} className="p-2 rounded-xl bg-brand-navy/5">
            <X size={16} className="text-brand-navy/50" />
          </button>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40 mb-2">Type</p>
          <div className="flex gap-2">
            {(['birthday', 'scheduled'] as const).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all',
                  type === t ? 'bg-brand-navy text-white' : 'bg-brand-navy/5 text-brand-navy/50'
                )}
              >
                {t === 'birthday' ? <><Gift size={12} /> Birthday</> : <><Calendar size={12} /> Scheduled</>}
              </button>
            ))}
          </div>
        </div>

        {type === 'birthday' && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40 mb-2">When to send</p>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setDaysBefore(0)}
                className={cn(
                  'px-3 py-2 rounded-xl text-xs font-bold transition-all',
                  daysBefore === 0 ? 'bg-brand-navy text-white' : 'bg-brand-navy/5 text-brand-navy/50'
                )}
              >
                On birthday
              </button>
              <span className="text-brand-navy/30 text-xs">or</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={daysBefore > 0 ? daysBefore : ''}
                  onChange={e => setDaysBefore(Math.max(1, parseInt(e.target.value) || 1))}
                  onFocus={() => { if (daysBefore === 0) setDaysBefore(7); }}
                  placeholder="7"
                  className="w-14 px-2 py-2 rounded-xl border border-black/10 text-xs text-center font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                />
                <span className="text-xs text-brand-navy/50 whitespace-nowrap">days before</span>
              </div>
            </div>
          </div>
        )}

        {type === 'scheduled' && (
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40 mb-2">Date &amp; Time</p>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-black/10 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
              />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40 mb-2">Repeat</p>
              <div className="flex gap-2">
                {(['none', 'yearly'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setRecurring(r)}
                    className={cn(
                      'flex-1 py-2 rounded-xl text-xs font-bold transition-all',
                      recurring === r ? 'bg-brand-navy text-white' : 'bg-brand-navy/5 text-brand-navy/50'
                    )}
                  >
                    {r === 'none' ? 'Once' : 'Yearly'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2.5">
          <input
            type="text"
            placeholder="Notification title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={80}
            className="w-full px-4 py-3 rounded-2xl border border-black/10 text-sm font-bold text-brand-navy placeholder:text-brand-navy/30 focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
          />
          <textarea
            placeholder="Message body..."
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={3}
            maxLength={500}
            className="w-full px-4 py-3 rounded-2xl border border-black/10 text-sm text-brand-navy placeholder:text-brand-navy/30 focus:outline-none focus:ring-2 focus:ring-brand-navy/20 resize-none"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!valid || saving}
          className="w-full bg-brand-navy text-white font-bold py-3.5 rounded-2xl text-sm active:scale-95 transition-all disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Save Automation'}
        </button>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black z-[159]"
        onClick={onClose}
      />
    </>
  );
}

// --- Vendor Broadcast Panel ---

function VendorBroadcastPanel({ store, storeCards, onClose }: {
  store: StoreProfile;
  storeCards: Card[];
  onClose: () => void;
}) {
  const [subTab, setSubTab] = useState<'mass' | 'automations'>('mass');

  // Mass message
  const [filter, setFilter] = useState<'cardholders' | 'followers' | 'both' | 'topX'>('cardholders');
  const [topXCount, setTopXCount] = useState(10);
  const [msgTitle, setMsgTitle] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState<number | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [storeFollowerUids, setStoreFollowerUids] = useState<string[]>([]);
  const [userFollowerUids, setUserFollowerUids] = useState<string[]>([]);
  const [loadingFollowers, setLoadingFollowers] = useState(true);
  const [broadcastHistory, setBroadcastHistory] = useState<any[]>([]);

  const stampsReq = store.stamps_required_for_reward || 10;
  const cardHolderUids = [...new Set(storeCards.filter(c => !c.isArchived).map(c => c.user_id))];
  const followerUids = [...new Set([...storeFollowerUids, ...userFollowerUids])];

  // Top X users by lifetime stamps
  const topXUids = [...new Set<string>(storeCards.map(c => c.user_id))]
    .map(uid => ({
      uid,
      stamps: storeCards.filter(c => c.user_id === uid).reduce((s, c) => s + (c.current_stamps || 0) + ((c.total_completed_cycles || 0) * stampsReq), 0),
    }))
    .sort((a, b) => b.stamps - a.stamps)
    .slice(0, topXCount)
    .map(u => u.uid);

  useEffect(() => {
    let done = 0;
    const finish = () => { if (++done === 2) setLoadingFollowers(false); };
    getDocs(query(collection(db, 'store_follows'), where('storeId', '==', store.id)))
      .then(snap => setStoreFollowerUids(snap.docs.map(d => d.data().followerUid as string)))
      .catch(console.error)
      .finally(finish);
    getDocs(query(collection(db, 'follows'), where('followingUid', '==', store.ownerUid)))
      .then(snap => setUserFollowerUids(snap.docs.map(d => d.data().followerUid as string)))
      .catch(console.error)
      .finally(finish);
  }, [store.id, store.ownerUid]);

  useEffect(() => {
    getDocs(query(collection(db, 'stores', store.id, 'broadcasts'), orderBy('sentAt', 'desc'), limit(20)))
      .then(snap => setBroadcastHistory(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => {});
  }, [store.id]);

  const recipientUids = (() => {
    const s = new Set<string>();
    if (filter === 'cardholders' || filter === 'both') cardHolderUids.forEach(u => s.add(u));
    if (filter === 'followers' || filter === 'both') followerUids.forEach(u => s.add(u));
    if (filter === 'topX') topXUids.forEach(u => s.add(u));
    return [...s];
  })();

  const handleSend = async () => {
    if (!msgTitle.trim() || !msgBody.trim() || recipientUids.length === 0) return;
    setSending(true);
    setSentCount(null);
    setSendError(null);
    try {
      for (let i = 0; i < recipientUids.length; i += 50) {
        await Promise.all(recipientUids.slice(i, i + 50).map(async uid => {
          const chatId = `broadcast_${store.id}_${uid}`;
          const chatRef = doc(db, 'chats', chatId);
          await setDoc(chatRef, {
            uids: [store.ownerUid, uid],
            isBroadcast: true,
            storeId: store.id,
            storeName: store.name,
            storeLogoUrl: store.logoUrl || '',
            lastMessage: msgBody.trim(),
            lastActivity: serverTimestamp(),
          }, { merge: true });
          await updateDoc(chatRef, { [`unreadCount.${uid}`]: increment(1) });
          await addDoc(collection(db, 'chats', chatId, 'messages'), {
            chatId,
            senderUid: store.ownerUid,
            senderName: store.name,
            title: msgTitle.trim(),
            text: msgBody.trim(),
            createdAt: serverTimestamp(),
          });
        }));
      }
      const record: any = {
        title: msgTitle.trim(),
        message: msgBody.trim(),
        filter,
        recipientCount: recipientUids.length,
        sentAt: serverTimestamp(),
      };
      if (filter === 'topX') record.topXCount = topXCount;
      await addDoc(collection(db, 'stores', store.id, 'broadcasts'), record);
      const histSnap = await getDocs(query(collection(db, 'stores', store.id, 'broadcasts'), orderBy('sentAt', 'desc'), limit(20)));
      setBroadcastHistory(histSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setSentCount(recipientUids.length);
      setMsgTitle('');
      setMsgBody('');
    } catch (err: any) {
      console.error(err);
      setSendError(err?.message || 'Failed to send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // Automations
  const [automations, setAutomations] = useState<StoreAutomation[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'store_automations'), where('storeId', '==', store.id)),
      snap => setAutomations(snap.docs.map(d => ({ id: d.id, ...d.data() } as StoreAutomation)))
    );
  }, [store.id]);

  const toggleStatus = async (a: StoreAutomation) => {
    await updateDoc(doc(db, 'store_automations', a.id), {
      status: a.status === 'active' ? 'paused' : 'active',
    });
  };

  const deleteAutomation = async (id: string) => {
    await deleteDoc(doc(db, 'store_automations', id));
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-0 z-[150] flex flex-col max-w-md mx-auto"
      >
        <button onClick={onClose} className="flex-shrink-0 h-8 w-full" />
        <div className="flex-1 flex flex-col overflow-hidden bg-brand-bg rounded-t-[2.5rem] shadow-2xl">
          <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-black/5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display text-xl font-bold text-brand-navy">Broadcast</h2>
                <p className="text-xs text-brand-navy/40">{store.name}</p>
              </div>
              <button onClick={onClose} className="p-2 rounded-2xl bg-white border border-black/5 shadow-sm">
                <X size={18} className="text-brand-navy/60" />
              </button>
            </div>
            <div className="flex gap-2">
              {(['mass', 'automations'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setSubTab(t)}
                  className={cn(
                    'flex-1 py-2.5 rounded-xl text-xs font-bold transition-all',
                    subTab === t ? 'bg-brand-navy text-white' : 'bg-brand-navy/5 text-brand-navy/50'
                  )}
                >
                  {t === 'mass' ? 'Mass Message' : 'Automations'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {subTab === 'mass' && (
              <div className="space-y-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40 mb-2">Send To</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['cardholders', 'followers', 'both', 'topX'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => { setFilter(f); setSentCount(null); setSendError(null); }}
                        className={cn(
                          'py-2.5 rounded-xl text-xs font-bold transition-all',
                          filter === f ? 'bg-brand-navy text-white' : 'bg-brand-navy/5 text-brand-navy/50'
                        )}
                      >
                        {f === 'cardholders' ? 'Card Holders' : f === 'followers' ? 'Followers' : f === 'both' ? 'Both' : '⭐ Top Users'}
                      </button>
                    ))}
                  </div>
                  {filter === 'topX' && (
                    <div className="flex items-center gap-3 mt-3">
                      <p className="text-xs font-bold text-brand-navy/50 shrink-0">Top</p>
                      <input
                        type="number" min={1} max={cardHolderUids.length || 100}
                        value={topXCount}
                        onChange={e => setTopXCount(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20 px-3 py-2 rounded-xl bg-white border border-brand-navy/10 text-sm font-bold text-brand-navy text-center focus:outline-none focus:ring-2 focus:ring-brand-gold/30"
                      />
                      <p className="text-xs font-bold text-brand-navy/50 shrink-0">users by stamps</p>
                    </div>
                  )}
                  <p className="text-xs text-brand-navy/40 mt-2 text-center">
                    {loadingFollowers && filter !== 'topX'
                      ? 'Loading...'
                      : `${recipientUids.length} recipient${recipientUids.length !== 1 ? 's' : ''}`}
                  </p>
                </div>

                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Message title"
                    value={msgTitle}
                    onChange={e => { setMsgTitle(e.target.value); setSentCount(null); setSendError(null); }}
                    maxLength={80}
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-black/8 text-sm font-bold text-brand-navy placeholder:text-brand-navy/30 focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                  />
                  <textarea
                    placeholder="Write your message..."
                    value={msgBody}
                    onChange={e => { setMsgBody(e.target.value); setSentCount(null); setSendError(null); }}
                    rows={5}
                    maxLength={500}
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-black/8 text-sm text-brand-navy placeholder:text-brand-navy/30 focus:outline-none focus:ring-2 focus:ring-brand-navy/20 resize-none"
                  />
                  <p className="text-[10px] text-brand-navy/30 text-right">{msgBody.length}/500</p>
                </div>

                {sentCount !== null && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-2xl text-center">
                    <p className="text-sm font-bold text-green-700">
                      ✓ Sent to {sentCount} {sentCount === 1 ? 'person' : 'people'}
                    </p>
                  </div>
                )}

                {sendError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-center">
                    <p className="text-sm font-bold text-red-700">✕ {sendError}</p>
                  </div>
                )}

                <button
                  onClick={handleSend}
                  disabled={sending || !msgTitle.trim() || !msgBody.trim() || recipientUids.length === 0}
                  className="w-full bg-brand-navy text-white font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
                >
                  <Send size={16} />
                  {sending ? 'Sending...' : `Send to ${recipientUids.length} recipient${recipientUids.length !== 1 ? 's' : ''}`}
                </button>

                {broadcastHistory.length > 0 && (
                  <div className="pt-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40 mb-3">Previously Sent</p>
                    <div className="space-y-3">
                      {broadcastHistory.map((b: any) => (
                        <div key={b.id} className="bg-white rounded-2xl p-4 border border-black/5 shadow-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm text-brand-navy truncate">{b.title}</p>
                              <p className="text-xs text-brand-navy/60 line-clamp-2 mt-0.5">{b.message}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[10px] font-bold text-brand-navy">{b.recipientCount} sent</p>
                              <p className="text-[10px] text-brand-navy/30 mt-0.5">
                                {b.sentAt?.toDate ? format(b.sentAt.toDate(), 'MMM d, h:mm a') : ''}
                              </p>
                            </div>
                          </div>
                          <span className="inline-block mt-2 text-[9px] font-bold uppercase tracking-widest bg-brand-navy/5 text-brand-navy/40 px-2 py-0.5 rounded-full">
                            {b.filter === 'cardholders' ? 'Card Holders' : b.filter === 'followers' ? 'Followers' : b.filter === 'topX' ? `Top ${b.topXCount ?? ''} Users` : 'Both'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {subTab === 'automations' && (
              <div className="space-y-4">
                <button
                  onClick={() => setShowAdd(true)}
                  className="w-full border-2 border-dashed border-brand-navy/20 rounded-2xl py-4 flex items-center justify-center gap-2 text-brand-navy/40 font-bold text-sm active:bg-brand-navy/5 transition-colors"
                >
                  <Plus size={18} />
                  Add Automation
                </button>

                {automations.length === 0 && (
                  <p className="text-center text-sm text-brand-navy/30 py-6">
                    No automations yet. Automate birthday messages, holiday deals, and more.
                  </p>
                )}

                {automations.map(a => (
                  <div key={a.id} className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className={cn(
                          'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                          a.type === 'birthday' ? 'bg-pink-50' : 'bg-blue-50'
                        )}>
                          {a.type === 'birthday'
                            ? <Gift size={16} className="text-pink-500" />
                            : <Calendar size={16} className="text-blue-500" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-brand-navy truncate">{a.title}</p>
                          <p className="text-[10px] text-brand-navy/40">
                            {a.type === 'birthday'
                              ? (a.daysBefore === 0 ? 'On birthday' : `${a.daysBefore} days before birthday`)
                              : a.scheduledAt
                                ? new Date(a.scheduledAt.toDate?.() ?? a.scheduledAt).toLocaleDateString('en-GB', {
                                    day: 'numeric', month: 'short', year: 'numeric',
                                  })
                                : 'Scheduled'}
                            {a.recurring === 'yearly' ? ' · Yearly' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => toggleStatus(a)}
                          className={cn(
                            'text-[10px] font-bold px-2.5 py-1 rounded-full transition-colors',
                            a.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-brand-navy/8 text-brand-navy/40'
                          )}
                        >
                          {a.status === 'active' ? 'Active' : 'Paused'}
                        </button>
                        <button
                          onClick={() => deleteAutomation(a.id)}
                          className="p-1.5 rounded-xl text-brand-navy/20 active:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-brand-navy/50 line-clamp-2 ml-11">{a.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black z-[149]"
        onClick={onClose}
      />
      <AnimatePresence>
        {showAdd && <AddAutomationModal store={store} onClose={() => setShowAdd(false)} />}
      </AnimatePresence>
    </>
  );
}

// --- Vendor App ---

function VendorApp({ activeTab, setActiveTab, profile, user, onViewUser, notifications, activeChatId, setActiveChatId, onLogout, onDeleteAccount }: { activeTab: string, setActiveTab: (tab: string) => void, profile: UserProfile | null, user: FirebaseUser, onViewUser: (u: UserProfile) => void, notifications: Notification[], activeChatId: string | null, setActiveChatId: (id: string | null) => void, onLogout: () => void, onDeleteAccount: () => Promise<void>, key?: React.Key }) {
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [userCards, setUserCards] = useState<Card[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'cards'), where('user_id', '==', user.uid));
    return onSnapshot(q, (snap) => {
      setUserCards(snap.docs.map(d => ({ id: d.id, ...d.data() } as Card)));
    });
  }, [user]);
  const [storeCards, setStoreCards] = useState<Card[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [customerHandle, setCustomerHandle] = useState('');
  const [stampQuantity, setStampQuantity] = useState(1);
  const [isIssuing, setIsIssuing] = useState(false);
  const [lastIssueTime, setLastIssueTime] = useState(0);
  const [issueStatus, setIssueStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [cardStampsInput, setCardStampsInput] = useState('');
  const [cardRewardInput, setCardRewardInput] = useState('');
  const [isSavingCard, setIsSavingCard] = useState(false);
  const [cardSaved, setCardSaved] = useState(false);
  const [statModal, setStatModal] = useState<null | 'members' | 'stamps' | 'activeCards'>(null);
  const [statModalSearch, setStatModalSearch] = useState('');
  const [memberProfiles, setMemberProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [chartMode, setChartMode] = useState<'days' | 'weeks'>('weeks');
  const [chartOffset, setChartOffset] = useState(0);
  const [signupsOffset, setSignupsOffset] = useState(0);
  const [chartTransactions, setChartTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (!store) return;
    const q = query(
      collection(db, 'transactions'),
      where('store_id', '==', store.id),
      orderBy('completed_at', 'desc'),
      limit(10)
    );
    return onSnapshot(q, (snap) => {
      setRecentTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [store]);

  useEffect(() => {
    if (!store) return;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const q = query(
      collection(db, 'transactions'),
      where('store_id', '==', store.id),
      orderBy('completed_at', 'asc')
    );
    return onSnapshot(q, snap => setChartTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
  }, [store?.id]);

  useEffect(() => {
    const q = query(collection(db, 'stores'), where('ownerUid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const s = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as StoreProfile;
        setStore(s);
        setCardStampsInput(String(s.stamps_required_for_reward || 10));
        setCardRewardInput(s.reward || '');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'stores');
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!store) return;
    const q = query(collection(db, 'cards'), where('store_id', '==', store.id));
    return onSnapshot(q, snap => setStoreCards(snap.docs.map(d => ({ id: d.id, ...d.data() } as Card))), () => {});
  }, [store?.id]);

  // Run automations once when store + cards are ready
  useEffect(() => {
    if (!store || storeCards.length === 0) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    const cardHolderUids: string[] = [...new Set<string>(storeCards.filter((c: Card) => !c.isArchived).map((c: Card) => c.user_id))];

    getDocs(query(collection(db, 'store_automations'), where('storeId', '==', store.id), where('status', '==', 'active')))
      .then(async snap => {
        for (const autoDoc of snap.docs) {
          const a = { id: autoDoc.id, ...autoDoc.data() } as StoreAutomation;
          if (a.lastFiredDate === todayStr) continue;

          const sendNotifs = async (uids: string[]) => {
            if (uids.length === 0) return;
            for (let i = 0; i < uids.length; i += 400) {
              await Promise.all(uids.slice(i, i + 400).map(uid =>
                addDoc(collection(db, 'notifications'), {
                  toUid: uid, type: 'broadcast',
                  title: a.title, message: a.message,
                  storeId: store.id, storeName: store.name,
                  createdAt: serverTimestamp(), isRead: false,
                })
              ));
            }
          };

          if (a.type === 'birthday' && cardHolderUids.length > 0) {
            const target = new Date();
            target.setDate(target.getDate() + (a.daysBefore || 0));
            const targetMD = `${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
            const recipients: string[] = [];
            const chunks: string[][] = [];
            for (let i = 0; i < cardHolderUids.length; i += 10) chunks.push(cardHolderUids.slice(i, i + 10));
            for (const chunk of chunks) {
              const pSnap = await getDocs(query(collection(db, 'users'), where('uid', 'in', chunk)));
              pSnap.docs.forEach(d => {
                const b = (d.data() as UserProfile).birthday;
                if (b && b.slice(5) === targetMD) recipients.push(d.data().uid);
              });
            }
            await sendNotifs(recipients);
            await updateDoc(autoDoc.ref, { lastFiredDate: todayStr });
          }

          if (a.type === 'scheduled' && a.scheduledAt) {
            const scheduledDate = a.scheduledAt.toDate ? a.scheduledAt.toDate() : new Date(a.scheduledAt);
            if (scheduledDate <= new Date()) {
              await sendNotifs(cardHolderUids);
              if (a.recurring === 'yearly') {
                const next = new Date(scheduledDate);
                next.setFullYear(next.getFullYear() + 1);
                await updateDoc(autoDoc.ref, { scheduledAt: Timestamp.fromDate(next), lastFiredDate: todayStr });
              } else {
                await updateDoc(autoDoc.ref, { status: 'paused', lastFiredDate: todayStr });
              }
            }
          }
        }
      })
      .catch(console.error);
  }, [store?.id, storeCards.length]);

  const totalMembers = new Set(storeCards.map(c => c.user_id)).size;
  const stampsPerReward = store?.stamps_required_for_reward || 10;
  const totalStampsGiven = storeCards.reduce((sum, c) => sum + (c.current_stamps || 0) + ((c.total_completed_cycles || 0) * stampsPerReward), 0);
  const activeStoreCards = storeCards.filter(c => !c.isArchived).length;
  const returningUsers = storeCards.filter(c => (c.total_completed_cycles || 0) > 0).length;
  const returnRate = totalMembers > 0 ? Math.round((returningUsers / totalMembers) * 100) : 0;
  const totalCompletedCycles = storeCards.reduce((sum, c) => sum + (c.total_completed_cycles || 0), 0);
  const redemptionRate = Math.round((totalCompletedCycles / Math.max(1, totalStampsGiven / stampsPerReward)) * 100);
  const avgScansPerWeekPerUser = (() => {
    if (totalMembers === 0 || chartTransactions.length === 0) return '—';
    const first = chartTransactions[0]?.completed_at?.toDate?.();
    if (!first) return '—';
    const weeksElapsed = Math.max(1, (Date.now() - first.getTime()) / (7 * 86400000));
    return (chartTransactions.length / weeksElapsed / totalMembers).toFixed(1);
  })();
  const storeTiersVendor = store?.rewardTiers?.length || Math.max(...storeCards.map(c => c.tiersCompleted || 0), 1);
  const vendorRewardsGiven = Math.max(
    storeCards.filter(c => !c.isArchived).reduce((sum, c) => sum + (c.total_completed_cycles || 0), 0) * storeTiersVendor,
    storeCards.filter(c => c.isArchived && c.isRedeemed).length * storeTiersVendor,
    store?.rewardsGiven || 0
  );

  // Pre-load member profiles for top-10 display
  useEffect(() => {
    if (storeCards.length === 0) return;
    const uids: string[] = [...new Set<string>(storeCards.map(c => c.user_id))];
    const missing = uids.filter(uid => !memberProfiles.has(uid));
    if (missing.length === 0) return;
    const chunks: string[][] = [];
    for (let i = 0; i < missing.length; i += 10) chunks.push(missing.slice(i, i + 10));
    Promise.all(chunks.map(chunk => getDocs(query(collection(db, 'users'), where('uid', 'in', chunk))))).then(results => {
      setMemberProfiles(prev => {
        const updated = new Map(prev);
        results.forEach(snap => snap.docs.forEach(d => updated.set(d.id, { uid: d.id, ...d.data() } as UserProfile)));
        return updated;
      });
    });
  }, [storeCards.length]);

  const openStatModal = async (type: 'members' | 'stamps' | 'activeCards') => {
    setStatModal(type);
    setStatModalSearch('');
    const uids: string[] = [...new Set<string>(storeCards.map((c: Card) => c.user_id))];
    const missing = uids.filter(uid => !memberProfiles.has(uid));
    if (missing.length === 0) return;
    const chunks: string[][] = [];
    for (let i = 0; i < missing.length; i += 10) chunks.push(missing.slice(i, i + 10));
    const results = await Promise.all(
      chunks.map(chunk => getDocs(query(collection(db, 'users'), where('uid', 'in', chunk))))
    );
    const updated = new Map(memberProfiles);
    results.forEach(snap => snap.docs.forEach(d => updated.set(d.id, { uid: d.id, ...d.data() } as UserProfile)));
    setMemberProfiles(updated);
  };

  const handleIssueStamp = async () => {
    if (!customerHandle || !store) return;
    
    const now = Date.now();
    if (now - lastIssueTime < 1000) {
      setIssueStatus({ type: 'error', message: 'Please wait a second between issues' });
      return;
    }
    setLastIssueTime(now);

    setIsIssuing(true);
    setIssueStatus(null);

    try {
      const usersRef = collection(db, 'users');
      const handle = customerHandle.replace(/^@/, '').toLowerCase().trim();
      const q = query(usersRef, where('handle', '==', handle));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setIssueStatus({ type: 'error', message: 'User not found' });
      } else {
        const customer = querySnapshot.docs[0].data() as UserProfile;
        const cardId = `${customer.uid}_${store.id}`;
        const cardRef = doc(db, 'cards', cardId);
        
        const cardDoc = await getDoc(cardRef);
        const qty = Number(stampQuantity);
        const limit = store.stamps_required_for_reward;

        if (cardDoc.exists()) {
          const data = cardDoc.data() as Card;
          let newStamps = data.current_stamps + qty;
          let newCycles = data.total_completed_cycles;

          if (newStamps >= limit) {
            newCycles += 1;
            // Cap at limit to force redemption before starting new cycle
            if (newStamps > limit) newStamps = limit; 
            
            // Record transaction
            await addDoc(collection(db, 'transactions'), {
              user_id: customer.uid,
              store_id: store.id,
              completed_at: serverTimestamp(),
              stamps_at_completion: limit,
              reward_claimed: false
            });
          }

          await updateDoc(cardRef, {
            current_stamps: newStamps,
            total_completed_cycles: newCycles,
            tiersCompleted: store.rewardTiers?.length || 1,
            last_tap_timestamp: serverTimestamp()
          });
        } else {
          let newStamps = qty;
          let newCycles = 0;

          if (newStamps >= limit) {
            newCycles = 1;
            // Cap at limit to force redemption before starting new cycle
            if (newStamps > limit) newStamps = limit;

            await addDoc(collection(db, 'transactions'), {
              user_id: customer.uid,
              store_id: store.id,
              completed_at: serverTimestamp(),
              stamps_at_completion: limit,
              reward_claimed: false
            });
          }

          await setDoc(cardRef, {
            user_id: customer.uid,
            store_id: store.id,
            current_stamps: newStamps,
            total_completed_cycles: newCycles,
            stamps_required: limit,
            tiersCompleted: store.rewardTiers?.length || 1,
            last_tap_timestamp: serverTimestamp(),
            isArchived: false
          });

          await updateDoc(doc(db, 'users', customer.uid), {
            total_cards_held: increment(1)
          });
        }
        
        await updateDoc(doc(db, 'users', customer.uid), {
          totalStamps: increment(qty)
        });
        bumpStreak(customer.uid).catch(console.error);

        // Food stamps increase avatar mood and record date
        if (store.category === 'Food') {
          (async () => {
            try {
              const snap = await getDoc(doc(db, 'users', customer.uid));
              const cur = (snap.data()?.avatar?.mood ?? 50) as number;
              const today = new Date().toISOString().slice(0, 10);
              await updateDoc(doc(db, 'users', customer.uid), {
                'avatar.mood': Math.min(100, cur + qty * 3),
                'avatar.lastFoodStampDate': today,
              });
            } catch { /* non-fatal */ }
          })();
        }

        // Check stamp milestone avatar rewards
        (async () => {
          try {
            const snap = await getDoc(doc(db, 'users', customer.uid));
            const newTotal = (snap.data()?.totalStamps ?? 0) as number;
            for (const [milestone, itemId] of STAMP_MILESTONE_REWARDS) {
              const prev = newTotal - qty;
              if (prev < milestone && newTotal >= milestone) {
                await awardAvatarItem(customer.uid, itemId);
              }
            }
          } catch { /* non-fatal */ }
        })();

        issueUserStickers(customer.uid, customer.name, qty).catch(console.error);
        issueStickersToCard(customer.uid, customer.name, qty).catch(console.error);
        updateChallengeProgress(customer.uid, store.id, qty).catch(console.error);
        setIssueStatus({ type: 'success', message: `${qty} stamp(s) issued to ${customer.name}!` });
        setCustomerHandle('');
        setStampQuantity(1);
      }
    } catch (error) {
      console.error(error);
      setIssueStatus({ type: 'error', message: 'Failed to issue stamp' });
    } finally {
      setIsIssuing(false);
    }
  };

  const handleSaveCardSettings = async () => {
    if (!store) return;
    const stamps = parseInt(cardStampsInput);
    if (!stamps || stamps < 1 || stamps > 50) return;
    setIsSavingCard(true);
    try {
      await updateDoc(doc(db, 'stores', store.id), {
        stamps_required_for_reward: stamps,
        reward: cardRewardInput.trim(),
      });
      setCardSaved(true);
      setTimeout(() => setCardSaved(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingCard(false);
    }
  };

  if (!store && activeTab !== 'profile') {
    return (
      <div className="glass-card p-10 rounded-[2.5rem] border-2 border-dashed border-brand-rose/40 text-center space-y-6">
        <div className="w-20 h-20 bg-brand-bg rounded-full flex items-center justify-center mx-auto">
          <Store className="w-10 h-10 text-brand-navy/20" />
        </div>
        <div>
          <h3 className="text-xl font-bold mb-2">Setup Your Store</h3>
          <p className="text-brand-navy/60 text-sm">You haven't registered a store yet. Create one to start issuing stamps.</p>
        </div>
        <button 
          onClick={async () => {
            const newStore = {
              name: `${profile?.name}'s Shop`,
              category: 'Retail',
              address: '123 Main St',
              phone: '555-0000',
              email: profile?.email || '',
              logoUrl: `https://picsum.photos/seed/${user.uid}/200/200`,
              coverUrl: `https://picsum.photos/seed/${user.uid}-bg/800/400`,
              ownerUid: user.uid,
              description: 'A wonderful local shop.',
              isVerified: false,
              stamps_required_for_reward: 10
            };
            await addDoc(collection(db, 'stores'), newStore);
          }}
          className="w-full bg-brand-navy text-white py-4 rounded-2xl font-bold"
        >
          Create Demo Store
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      {activeTab === 'for-you' && (
        <ForYouScreen onViewUser={onViewUser} currentUser={user} currentProfile={profile} />
      )}

      {activeTab === 'messages' && (
        <MessagesScreen
          currentUser={user}
          currentProfile={profile}
          activeChatId={activeChatId}
          setActiveChatId={setActiveChatId}
          onViewUser={onViewUser}
          vendorStore={store}
          storeCards={storeCards}
        />
      )}

      {activeTab === 'home' && (
        <div className="space-y-6">
          <header>
            <h2 className="font-display text-3xl font-bold mb-1">Dashboard</h2>
            <p className="text-brand-navy/60">{store?.name || 'Your Store'}</p>
          </header>

          {/* Stat tiles */}
          <div className="grid grid-cols-3 gap-3">
            <div onClick={() => openStatModal('members')} className="cursor-pointer active:scale-95 transition-transform">
              <StatSquare icon={<Users className="text-blue-500" />} label="Members" value={String(totalMembers)} />
            </div>
            <div onClick={() => openStatModal('stamps')} className="cursor-pointer active:scale-95 transition-transform">
              <StatSquare icon={<Stamp className="text-brand-gold" />} label="Stamps Given" value={String(totalStampsGiven)} />
            </div>
            <div onClick={() => openStatModal('activeCards')} className="cursor-pointer active:scale-95 transition-transform">
              <StatSquare icon={<Wallet className="text-purple-500" />} label="Active Cards" value={String(activeStoreCards)} />
            </div>
            <StatSquare icon={<RefreshCw className="text-orange-500" />} label="Return Rate" value={`${returnRate}%`} />
            <StatSquare icon={<TrendingUp className="text-green-500" />} label="Avg/Wk/User" value={String(avgScansPerWeekPerUser)} />
            <StatSquare icon={<Gift className="text-rose-500" />} label="Rewards Given" value={String(vendorRewardsGiven)} />
          </div>

          {/* Stamps chart */}
          {(() => {
            const periodCount = chartMode === 'weeks' ? 8 : 14;
            const msPerPeriod = chartMode === 'weeks' ? 7 * 86400000 : 86400000;
            const now = Date.now();
            const periodEnd = now - chartOffset * periodCount * msPerPeriod;
            const periods: { label: string; count: number }[] = [];
            for (let i = periodCount - 1; i >= 0; i--) {
              const end = periodEnd - i * msPerPeriod;
              const start = end - msPerPeriod;
              const count = chartTransactions.filter(tx => {
                const t = tx.completed_at?.toMillis?.() ?? tx.completed_at?.seconds * 1000 ?? 0;
                return t >= start && t < end;
              }).length;
              const d = new Date(start);
              const label = chartMode === 'weeks'
                ? `${d.getDate()}/${d.getMonth() + 1}`
                : `${d.getDate()}/${d.getMonth() + 1}`;
              periods.push({ label, count });
            }
            const maxVal = Math.max(...periods.map(p => p.count), 1);
            return (
              <div className="glass-card p-5 rounded-[2rem] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-brand-navy">Stamps Chart</p>
                    <p className="text-[10px] text-brand-navy/40 font-bold uppercase tracking-widest mt-0.5">
                      {chartMode === 'weeks' ? 'By week' : 'By day'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex p-0.5 bg-brand-navy/8 rounded-xl">
                      {(['days', 'weeks'] as const).map(m => (
                        <button key={m} onClick={() => { setChartMode(m); setChartOffset(0); }}
                          className={cn('px-3 py-1.5 rounded-[10px] text-[10px] font-bold transition-all', chartMode === m ? 'bg-white text-brand-navy shadow-sm' : 'text-brand-navy/40')}>
                          {m === 'days' ? 'Days' : 'Weeks'}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setChartOffset(o => o + 1)} className="p-1.5 rounded-xl bg-brand-navy/8 active:scale-90 transition-all">
                      <ChevronLeft size={14} className="text-brand-navy" />
                    </button>
                    <button onClick={() => setChartOffset(o => Math.max(0, o - 1))} disabled={chartOffset === 0} className="p-1.5 rounded-xl bg-brand-navy/8 disabled:opacity-30 active:scale-90 transition-all">
                      <ChevronRight size={14} className="text-brand-navy" />
                    </button>
                  </div>
                </div>
                <div className="flex items-end gap-1 h-28">
                  {periods.map((p, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
                        <motion.div
                          initial={{ height: 0 }} animate={{ height: `${Math.round((p.count / maxVal) * 80)}px` }}
                          transition={{ duration: 0.4, delay: i * 0.03 }}
                          className="w-full rounded-t-lg bg-brand-gold"
                          style={{ minHeight: p.count > 0 ? '4px' : '0' }}
                        />
                      </div>
                      <p className="text-[8px] text-brand-navy/30 font-bold leading-none">{p.label}</p>
                    </div>
                  ))}
                </div>
                {chartTransactions.length === 0 && (
                  <p className="text-center text-xs text-brand-navy/30 font-bold py-2">No stamp data yet</p>
                )}
              </div>
            );
          })()}

          {/* User base growth chart */}
          {(() => {
            // Cumulative unique members over time based on first transaction per user
            const firstTxByUser = new Map<string, number>();
            chartTransactions.forEach(tx => {
              const uid = tx.user_id;
              const ms = tx.completed_at?.toMillis?.() ?? (tx.completed_at?.seconds ?? 0) * 1000;
              if (!firstTxByUser.has(uid) || ms < firstTxByUser.get(uid)!) firstTxByUser.set(uid, ms);
            });
            const joinTimestamps = [...firstTxByUser.values()].sort((a, b) => a - b);
            if (joinTimestamps.length === 0) return null;
            const periodCount = 10;
            const msPerDay = 86400000;
            const now = Date.now();
            const rangeMs = periodCount * msPerDay;
            const rangeEnd = now - signupsOffset * rangeMs;
            const rangeStart = rangeEnd - rangeMs;
            const points: { label: string; cumulative: number }[] = [];
            for (let i = 0; i < periodCount; i++) {
              const dayEnd = rangeStart + (i + 1) * msPerDay;
              const cumulative = joinTimestamps.filter(ms => ms < dayEnd).length;
              const d = new Date(rangeStart + i * msPerDay);
              points.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, cumulative });
            }
            const maxVal = Math.max(...points.map(p => p.cumulative), 1);
            return (
              <div className="glass-card p-5 rounded-[2rem] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-brand-navy">User Base Growth</p>
                    <p className="text-[10px] text-brand-navy/40 font-bold uppercase tracking-widest mt-0.5">Cumulative members</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSignupsOffset(o => o + 1)} className="p-1.5 rounded-xl bg-brand-navy/8 active:scale-90 transition-all">
                      <ChevronLeft size={14} className="text-brand-navy" />
                    </button>
                    <button onClick={() => setSignupsOffset(o => Math.max(0, o - 1))} disabled={signupsOffset === 0} className="p-1.5 rounded-xl bg-brand-navy/8 disabled:opacity-30 active:scale-90 transition-all">
                      <ChevronRight size={14} className="text-brand-navy" />
                    </button>
                  </div>
                </div>
                <div className="flex items-end gap-1 h-28">
                  {points.map((p, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
                        <motion.div
                          initial={{ height: 0 }} animate={{ height: `${Math.round((p.cumulative / maxVal) * 80)}px` }}
                          transition={{ duration: 0.4, delay: i * 0.03 }}
                          className="w-full rounded-t-lg bg-blue-400"
                          style={{ minHeight: p.cumulative > 0 ? '4px' : '0' }}
                        />
                      </div>
                      <p className="text-[8px] text-brand-navy/30 font-bold leading-none">{p.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Sign-ups per day chart */}
          {(() => {
            // New distinct users per day (first transaction per user = sign-up proxy)
            const firstTxByUser2 = new Map<string, number>();
            chartTransactions.forEach(tx => {
              const uid = tx.user_id;
              const ms = tx.completed_at?.toMillis?.() ?? (tx.completed_at?.seconds ?? 0) * 1000;
              if (!firstTxByUser2.has(uid) || ms < firstTxByUser2.get(uid)!) firstTxByUser2.set(uid, ms);
            });
            const [signupsDays, setSignupsDays] = [14, null] as any; // static 14-day window
            const periodCount = 14;
            const msPerDay = 86400000;
            const now = Date.now();
            const rangeEnd = now - signupsOffset * periodCount * msPerDay;
            const rangeStart = rangeEnd - periodCount * msPerDay;
            const days: { label: string; count: number }[] = [];
            for (let i = 0; i < periodCount; i++) {
              const dayStart = rangeStart + i * msPerDay;
              const dayEnd = dayStart + msPerDay;
              const count = [...firstTxByUser2.values()].filter(ms => ms >= dayStart && ms < dayEnd).length;
              const d = new Date(dayStart);
              days.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, count });
            }
            const maxVal = Math.max(...days.map(d => d.count), 1);
            const totalNew = days.reduce((s, d) => s + d.count, 0);
            return (
              <div className="glass-card p-5 rounded-[2rem] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-brand-navy">New Sign-ups / Day</p>
                    <p className="text-[10px] text-brand-navy/40 font-bold uppercase tracking-widest mt-0.5">
                      {totalNew} new in this period
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSignupsOffset(o => o + 1)} className="p-1.5 rounded-xl bg-brand-navy/8 active:scale-90 transition-all">
                      <ChevronLeft size={14} className="text-brand-navy" />
                    </button>
                    <button onClick={() => setSignupsOffset(o => Math.max(0, o - 1))} disabled={signupsOffset === 0} className="p-1.5 rounded-xl bg-brand-navy/8 disabled:opacity-30 active:scale-90 transition-all">
                      <ChevronRight size={14} className="text-brand-navy" />
                    </button>
                  </div>
                </div>
                <div className="flex items-end gap-1 h-28">
                  {days.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
                        <motion.div
                          initial={{ height: 0 }} animate={{ height: `${Math.round((d.count / maxVal) * 80)}px` }}
                          transition={{ duration: 0.4, delay: i * 0.03 }}
                          className="w-full rounded-t-lg bg-emerald-400"
                          style={{ minHeight: d.count > 0 ? '4px' : '0' }}
                        />
                      </div>
                      <p className="text-[8px] text-brand-navy/30 font-bold leading-none">{d.label}</p>
                    </div>
                  ))}
                </div>
                {totalNew === 0 && (
                  <p className="text-center text-xs text-brand-navy/30 font-bold py-2">No new sign-ups in this period</p>
                )}
              </div>
            );
          })()}

          {/* Top 10 users */}
          {(() => {
            const top10 = [...new Set<string>(storeCards.map(c => c.user_id))]
              .map(uid => {
                const cards = storeCards.filter(c => c.user_id === uid);
                const stamps = cards.reduce((s, c) => s + (c.current_stamps || 0) + ((c.total_completed_cycles || 0) * stampsPerReward), 0);
                return { uid, stamps, prof: memberProfiles.get(uid) };
              })
              .sort((a, b) => b.stamps - a.stamps)
              .slice(0, 10);
            if (top10.length === 0) return null;
            return (
              <div className="glass-card p-5 rounded-[2rem] space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-brand-navy">Top 10 Users</p>
                  <Trophy size={16} className="text-brand-gold" />
                </div>
                {top10.map(({ uid, stamps, prof }, i) => (
                  <div key={uid} className="flex items-center gap-3">
                    <span className="text-[11px] font-bold text-brand-navy/30 w-5 text-right">{i + 1}</span>
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-indigo-50 shrink-0 flex items-center justify-center">
                      <PixelAvatar config={prof?.avatar} uid={prof?.uid ?? uid} size={32} view="head" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{prof?.name || 'Customer'}</p>
                      <div className="h-1 bg-brand-navy/8 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-brand-gold rounded-full" style={{ width: `${Math.round((stamps / (top10[0].stamps || 1)) * 100)}%` }} />
                      </div>
                    </div>
                    <span className="text-xs font-bold text-brand-navy/50 shrink-0">{stamps}</span>
                  </div>
                ))}
              </div>
            );
          })()}

          <AnimatePresence>
            {statModal && (() => {
              const titles: Record<string, string> = { members: 'Members', stamps: 'Stamps Breakdown', activeCards: 'Active Cards' };
              const uniqueUids = [...new Set<string>(storeCards.map(c => c.user_id))];
              const q = statModalSearch.toLowerCase();

              const matchesSearch = (uid: string) => {
                if (!q) return true;
                const prof = memberProfiles.get(uid);
                return (prof?.name || '').toLowerCase().includes(q) || (prof?.handle || '').toLowerCase().includes(q) || uid.toLowerCase().includes(q);
              };

              const memberRows = uniqueUids.filter(matchesSearch).map(uid => {
                const cards = storeCards.filter(c => c.user_id === uid);
                const prof = memberProfiles.get(uid);
                const totalStamps = cards.reduce((s, c) => s + (c.current_stamps || 0) + ((c.total_completed_cycles || 0) * stampsPerReward), 0);
                const cycles = cards.reduce((s, c) => s + (c.total_completed_cycles || 0), 0);
                return { uid, prof, totalStamps, cycles };
              }).sort((a, b) => b.totalStamps - a.totalStamps);

              const stampRows = [...storeCards].filter(c => matchesSearch(c.user_id)).sort((a, b) => {
                const ta = (a.current_stamps || 0) + ((a.total_completed_cycles || 0) * stampsPerReward);
                const tb = (b.current_stamps || 0) + ((b.total_completed_cycles || 0) * stampsPerReward);
                return tb - ta;
              });

              const activeRows = storeCards.filter(c => !c.isArchived && matchesSearch(c.user_id)).sort((a, b) => (b.current_stamps || 0) - (a.current_stamps || 0));

              return (
                <Modal title={titles[statModal]} onClose={() => setStatModal(null)}>
                  <div className="relative mb-3">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-navy/30 pointer-events-none" />
                    <input
                      type="text"
                      value={statModalSearch}
                      onChange={e => setStatModalSearch(e.target.value)}
                      placeholder="Search by name or handle…"
                      className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-brand-bg border border-brand-navy/10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                    {statModal === 'members' && memberRows.map(({ uid, prof, totalStamps, cycles }) => (
                      <div key={uid} className="flex items-center gap-3 p-3 rounded-2xl bg-brand-bg">
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-indigo-50 shrink-0 flex items-center justify-center">
                          <PixelAvatar config={prof?.avatar} uid={prof?.uid ?? uid} size={36} view="head" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1"><p className="font-bold text-sm truncate">{prof?.name || 'Unknown'}</p><StreakBadge streak={prof?.streak} /></div>
                          <p className="text-[11px] text-brand-navy/40">@{prof?.handle || uid.slice(0, 8)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-sm">{totalStamps} stamps</p>
                          {cycles > 0 && <p className="text-[11px] text-brand-gold">{cycles}× completed</p>}
                        </div>
                      </div>
                    ))}

                    {statModal === 'stamps' && stampRows.map(card => {
                      const prof = memberProfiles.get(card.user_id);
                      const total = (card.current_stamps || 0) + ((card.total_completed_cycles || 0) * stampsPerReward);
                      return (
                        <div key={card.id} className="flex items-center gap-3 p-3 rounded-2xl bg-brand-bg">
                          <div className="w-9 h-9 rounded-full overflow-hidden bg-indigo-50 shrink-0 flex items-center justify-center">
                            <PixelAvatar config={prof?.avatar} uid={prof?.uid ?? card.user_id} size={36} view="head" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1"><p className="font-bold text-sm truncate">{prof?.name || 'Unknown'}</p><StreakBadge streak={prof?.streak} /></div>
                            <p className="text-[11px] text-brand-navy/40">@{prof?.handle || card.user_id.slice(0, 8)}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-sm">{total} total</p>
                            <p className="text-[11px] text-brand-navy/40">{card.current_stamps}/{stampsPerReward} current</p>
                          </div>
                        </div>
                      );
                    })}

                    {statModal === 'activeCards' && activeRows.map(card => {
                      const prof = memberProfiles.get(card.user_id);
                      return (
                        <div key={card.id} className="flex items-center gap-3 p-3 rounded-2xl bg-brand-bg">
                          <div className="w-9 h-9 rounded-full overflow-hidden bg-indigo-50 shrink-0 flex items-center justify-center">
                            <PixelAvatar config={prof?.avatar} uid={prof?.uid ?? card.user_id} size={36} view="head" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1"><p className="font-bold text-sm truncate">{prof?.name || 'Unknown'}</p><StreakBadge streak={prof?.streak} /></div>
                            <p className="text-[11px] text-brand-navy/40">@{prof?.handle || card.user_id.slice(0, 8)}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-sm">{card.current_stamps}/{stampsPerReward}</p>
                            <div className="w-16 h-1.5 bg-brand-navy/10 rounded-full mt-1">
                              <div className="h-full bg-brand-gold rounded-full" style={{ width: `${Math.min(100, ((card.current_stamps || 0) / stampsPerReward) * 100)}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {((statModal === 'members' && memberRows.length === 0) ||
                      (statModal === 'stamps' && stampRows.length === 0) ||
                      (statModal === 'activeCards' && activeRows.length === 0)) && (
                      <p className="text-center text-brand-navy/30 py-8 font-bold text-sm">No data yet</p>
                    )}
                  </div>
                </Modal>
              );
            })()}
          </AnimatePresence>


          <div className="bg-brand-navy p-8 rounded-[2.5rem] text-white text-center">
            <h3 className="font-display text-xl font-bold mb-4">Issue a Stamp</h3>
            <p className="text-white/60 text-sm mb-8">Scan a customer's QR code or enter their handle to issue a loyalty stamp.</p>

            <div className="space-y-4">
              <button
                onClick={() => setIsScanning(true)}
                className="w-full bg-brand-gold text-brand-navy font-bold py-4 rounded-2xl flex items-center justify-center gap-3"
              >
                <QrCode className="w-6 h-6" />
                Open Scanner
              </button>

              <div className="flex gap-4">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-4 flex items-center text-white/30 font-bold text-sm pointer-events-none">@</span>
                  <input
                    type="text"
                    value={customerHandle}
                    onChange={(e) => setCustomerHandle(e.target.value.toLowerCase().replace(/\s/g, '').replace(/^@/, ''))}
                    placeholder="customerhandle"
                    className="w-full bg-white/10 border border-white/10 rounded-2xl py-4 pl-8 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                  />
                </div>
                <div className="w-24">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={stampQuantity}
                    onChange={(e) => setStampQuantity(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-4 rounded-2xl bg-white/10 border border-white/10 text-white text-center focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                  />
                  <p className="text-[10px] text-white/40 mt-1 font-bold uppercase">Qty</p>
                </div>
              </div>

              <button
                onClick={handleIssueStamp}
                disabled={isIssuing || !customerHandle}
                className="w-full bg-white text-brand-navy font-bold py-4 rounded-2xl disabled:opacity-50 transition-all"
              >
                {isIssuing ? 'Issuing...' : 'Issue Manually'}
              </button>

              {issueStatus && (
                <p className={cn(
                  "text-sm font-bold",
                  issueStatus.type === 'success' ? "text-brand-gold" : "text-red-400"
                )}>
                  {issueStatus.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-display text-xl font-bold">Recent Activity</h3>
            {recentTransactions.map(tx => (
              <div key={tx.id} className="glass-card p-4 rounded-2xl flex items-center gap-4">
                <div className="w-10 h-10 bg-brand-bg rounded-full flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-brand-navy/40" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm">Card Completed</p>
                  <p className="text-xs text-brand-navy/40">
                    {tx.completed_at ? format(tx.completed_at.toDate(), 'h:mm a') : 'Just now'}
                  </p>
                </div>
                <div className="w-2 h-2 bg-brand-gold rounded-full" />
              </div>
            ))}
            {recentTransactions.length === 0 && (
              <div className="py-8 text-center text-brand-navy/20">
                <Clock size={40} className="mx-auto mb-2 opacity-10" />
                <p className="text-sm font-bold">No recent activity</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'discover' && <CardBuilder store={store} />}
      {activeTab === 'profile' && (
        <ProfileScreen
          profile={profile}
          userCards={userCards}
          onLogout={onLogout}
          onDeleteAccount={onDeleteAccount}
          onViewUser={onViewUser}
          user={user}
        />
      )}

      {/* Broadcast Panel */}
      <AnimatePresence>
        {showBroadcast && store && (
          <VendorBroadcastPanel store={store} storeCards={storeCards} onClose={() => setShowBroadcast(false)} />
        )}
      </AnimatePresence>

      {/* Scanner Modal Simulation */}
      <AnimatePresence>
        {isScanning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-8"
          >
            <div className="w-64 h-64 border-2 border-brand-gold rounded-3xl relative overflow-hidden mb-12">
              <div className="absolute inset-0 bg-brand-gold/10 animate-pulse" />
              <div className="absolute top-0 left-0 right-0 h-1 bg-brand-gold animate-scan" />
            </div>
            <h3 className="text-white text-xl font-bold mb-4">Scanning...</h3>
            <p className="text-white/60 text-center mb-12">Align the customer's QR code within the frame to issue a stamp.</p>
            
            <div className="flex flex-col gap-4 w-full">
              <button 
                onClick={() => {
                  setCustomerHandle(user.email || ''); // Simulate scanning own QR
                  setIsScanning(false);
                  setTimeout(() => handleIssueStamp(), 100);
                }}
                className="bg-brand-gold text-brand-navy px-12 py-4 rounded-2xl font-bold hover:scale-105 transition-transform"
              >
                Simulate Successful Scan
              </button>
              <button 
                onClick={() => setIsScanning(false)}
                className="bg-white/10 text-white px-12 py-4 rounded-2xl font-bold"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- UI Components ---

function LoyaltyCard({ card, store, onViewStore }: { card: Card, store?: StoreProfile, onViewStore?: (s: StoreProfile) => void, key?: React.Key }) {
  const [showQR, setShowQR] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [testQty, setTestQty] = useState(1);
  const [isTestIssuing, setIsTestIssuing] = useState(false);
  const [lastTestTime, setLastTestTime] = useState(0);
  const limit = card.stamps_required || store?.stamps_required_for_reward || 10;
  const isCompleted = card.current_stamps >= limit;
  const [unlockedReward, setUnlockedReward] = useState<string | null>(null);
  const prevStampsRef = useRef(card.current_stamps);

  // Show completion popup when card is completed
  useEffect(() => {
    if (isCompleted && !card.isArchived && !card.isRedeemed) {
      setShowCompletionPopup(true);
    }
  }, [isCompleted, card.isArchived, card.isRedeemed]);

  // Fire confetti when any reward tier is reached
  useEffect(() => {
    const prev = prevStampsRef.current;
    const curr = card.current_stamps;
    prevStampsRef.current = curr;
    if (curr <= prev || card.isArchived) return;
    const tiers = store?.rewardTiers?.length ? store.rewardTiers : [{ stamps: limit, reward: store?.reward || 'Reward Unlocked!' }];
    const hit = tiers.find(t => t.stamps > prev && t.stamps <= curr);
    if (hit) {
      setUnlockedReward(hit.reward);
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, zIndex: TOP_Z, colors: ['#f5a623', '#ffffff', '#1e3a5f'] });
      setTimeout(() => setUnlockedReward(null), 4000);
    }
  }, [card.current_stamps]);

  const handleTestStamp = async () => {
    if (!auth.currentUser || !store) return;
    
    const now = Date.now();
    if (now - lastTestTime < 1000) return;
    setLastTestTime(now);

    setIsTestIssuing(true);
    try {
      const qty = Number(testQty);
      const cardRef = doc(db, 'cards', card.id);
      
      let newStamps = card.current_stamps + qty;
      let newCycles = card.total_completed_cycles;

      if (newStamps >= limit) {
        newCycles += 1;
        // We don't modulo here if we want the user to "stop" at 10 for the popup
        // But the requirement says "when user reaches 10... show it to shop... then stamp again"
        // So let's cap it at limit for the completion state
        if (newStamps > limit) newStamps = limit; 
        
        await addDoc(collection(db, 'transactions'), {
          user_id: auth.currentUser.uid,
          store_id: store.id,
          completed_at: serverTimestamp(),
          stamps_at_completion: limit,
          reward_claimed: false
        });
      }

      await updateDoc(cardRef, {
        current_stamps: newStamps,
        total_completed_cycles: newCycles,
        last_tap_timestamp: serverTimestamp()
      });

      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        totalStamps: increment(qty)
      });
      bumpStreak(auth.currentUser.uid).catch(console.error);

      const customerName = auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Customer';
      issueUserStickers(auth.currentUser.uid, customerName, qty).catch(console.error);
      issueStickersToCard(auth.currentUser.uid, customerName, qty).catch(console.error);
      updateChallengeProgress(auth.currentUser.uid, store.id, qty).catch(console.error);

      if (newStamps >= limit) {
        setShowQR(false);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsTestIssuing(false);
    }
  };

  const handleArchive = async () => {
    if (!auth.currentUser || !store) return;
    setIsArchiving(true);
    const numTiers = store.rewardTiers?.length || 1;
    try {
      // Reset the active card first — this is the critical write
      await updateDoc(doc(db, 'cards', card.id), {
        current_stamps: 0,
        isRedeemed: false,
        isArchived: false,
        stamps_required: store?.stamps_required_for_reward || limit,
        tiersCompleted: numTiers,
        last_tap_timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error('Card reset failed:', error);
    } finally {
      // Always close the popup and clear loading state regardless of write outcome
      setShowCompletionPopup(false);
      setIsArchiving(false);
    }

    // Fire-and-forget: archive history + stats updates (non-critical)
    const uid = auth.currentUser.uid;
    addDoc(collection(db, 'cards'), {
      user_id: card.user_id,
      store_id: card.store_id,
      current_stamps: limit,
      total_completed_cycles: card.total_completed_cycles,
      last_tap_timestamp: serverTimestamp(),
      isArchived: true,
      isRedeemed: true,
      archivedAt: serverTimestamp(),
      tiersCompleted: numTiers,
    }).catch(console.error);
    updateDoc(doc(db, 'users', uid), { totalRedeemed: increment(numTiers) }).catch(console.error);
    updateDoc(doc(db, 'stores', card.store_id), { rewardsGiven: increment(numTiers) }).catch(console.error);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!auth.currentUser) return;
    
    setIsDeleting(true);
    try {
      await updateDoc(doc(db, 'cards', card.id), {
        isArchived: true
      });
      // Also decrement user's total_cards_held
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        total_cards_held: increment(-1)
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsDeleting(false);
      setShowOptions(false);
    }
  };

  const handleReset = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'cards', card.id), {
        isRedeemed: false,
        current_stamps: 0,
        last_tap_timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error(error);
    }
  };

  if (card.isArchived) return null;

  return (
    <>
      <motion.div
        whileTap={{ scale: 0.98 }}
        onClick={() => !isCompleted && setShowQR(true)}
        className={cn(
          "glass-card p-6 rounded-[2.5rem] border relative overflow-hidden transition-all w-full",
          isCompleted ? "border-brand-gold/40 bg-blue-50/60" : "border-transparent cursor-pointer"
        )}
      >
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {isCompleted && !card.isRedeemed && (
            <div className="bg-brand-gold text-brand-navy text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest animate-pulse">
              Completed
            </div>
          )}
          {card.isRedeemed && (
            <div className="bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">
              Redeemed
            </div>
          )}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setShowOptions(!showOptions);
            }}
            className="p-2 hover:bg-brand-navy/5 rounded-full transition-colors text-brand-navy/40"
          >
            <MoreVertical size={18} />
          </button>
        </div>

        <AnimatePresence>
          {showOptions && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-14 right-4 z-20 glass-panel rounded-2xl shadow-xl p-2 min-w-[140px]"
            >
              <button 
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors text-xs font-bold"
              >
                <Trash2 size={16} />
                {isDeleting ? 'Removing...' : 'Remove Card'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-4 mb-6">
          <div 
            className="w-14 h-14 rounded-2xl overflow-hidden border border-brand-navy/5 bg-white cursor-pointer hover:scale-105 transition-transform"
            onClick={(e) => {
              if (store && onViewStore) {
                e.stopPropagation();
                onViewStore(store);
              }
            }}
          >
            <img src={store?.logoUrl || `https://picsum.photos/seed/${card.store_id}/200/200`} alt="" className="w-full h-full object-cover" />
          </div>
          <div 
            className="cursor-pointer group flex-1"
            onClick={(e) => {
              if (store && onViewStore) {
                e.stopPropagation();
                onViewStore(store);
              }
            }}
          >
            <h4 className="font-bold text-lg group-hover:text-brand-gold transition-colors">{store?.name || 'Store'}</h4>
            <p className="text-xs text-brand-navy/40 font-bold uppercase tracking-widest">{store?.category || 'Retail'}</p>
          </div>
        </div>

        {(() => {
          const cardTheme = store?.theme || '#3a6fcc';
          const rewardTiers = store?.rewardTiers?.length ? store.rewardTiers : [{ stamps: limit, reward: store?.reward || '' }];
          const tierStamps = new Set(rewardTiers.map(t => t.stamps));
          const nextTier = rewardTiers.find(t => t.stamps > card.current_stamps);
          const currentTierReward = [...rewardTiers].reverse().find(t => t.stamps <= card.current_stamps);

          if (card.isRedeemed) return (
            <div className="space-y-4">
              <div className="rounded-2xl p-4 text-center" style={{ background: `${cardTheme}22`, border: `1px solid ${cardTheme}44` }}>
                <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-xs font-bold uppercase tracking-widest text-green-600/60">Reward Claimed</p>
                <p className="font-bold">Enjoy your reward!</p>
              </div>
              <button onClick={handleReset} className="w-full py-3 rounded-2xl text-white text-xs font-bold uppercase tracking-widest transition-all" style={{ backgroundColor: cardTheme }}>
                Start New Card
              </button>
            </div>
          );

          if (isCompleted) return (
            <div className="space-y-4">
              <div className="rounded-2xl p-4 text-center" style={{ background: `${cardTheme}22`, border: `1px solid ${cardTheme}44` }}>
                <Gift className="w-8 h-8 text-brand-gold mx-auto mb-2" />
                <p className="text-xs font-bold uppercase tracking-widest text-brand-navy/40">Your Reward</p>
                <p className="font-bold">{rewardTiers[rewardTiers.length - 1]?.reward || 'Reward Unlocked!'}</p>
              </div>
              <button onClick={() => setShowCompletionPopup(true)} className="w-full py-3 rounded-2xl text-white text-xs font-bold uppercase tracking-widest transition-all" style={{ backgroundColor: cardTheme }}>
                Claim Reward
              </button>
            </div>
          );

          const stampIcon = store?.stampIcon || '⭐';
          const stampBorderColor = store?.stampBorderColor || '#ffffff';
          const cardPattern = store?.cardPattern || 'solid';
          return (
            <div className="rounded-[1.5rem] p-4 space-y-4 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${cardTheme} 0%, ${cardTheme}cc 100%)` }}>
              {cardPattern !== 'solid' && (
                <div className="absolute inset-0 pointer-events-none rounded-[1.5rem]" style={getCardPatternStyle(cardPattern)} />
              )}
              <div className="relative z-[1] grid gap-1.5" style={{ gridTemplateColumns: `repeat(5, 1fr)` }}>
                {Array.from({ length: limit }).map((_, i) => {
                  const stampNum = i + 1;
                  const isFilled = i < card.current_stamps;
                  const isTier = tierStamps.has(stampNum);
                  return (
                    <div key={i}
                      className={cn(
                        "aspect-square rounded-xl border-2 flex items-center justify-center transition-all",
                        isFilled
                          ? isTier ? "bg-brand-gold" : "bg-white/30"
                          : isTier ? "bg-white/10 border-dashed" : "border-dashed"
                      )}
                      style={{ borderColor: isTier ? (isFilled ? stampBorderColor : `${stampBorderColor}88`) : (isFilled ? stampBorderColor : `${stampBorderColor}55`) }}
                    >
                      {isFilled
                        ? isTier ? <Gift size={11} className="text-brand-navy" /> : <span className="text-base leading-none">{stampIcon}</span>
                        : isTier ? <Gift size={10} style={{ color: stampBorderColor, opacity: 0.65 }} /> : <span className="text-[8px] font-bold" style={{ color: stampBorderColor, opacity: 0.8 }}>{stampNum}</span>}
                    </div>
                  );
                })}
              </div>
              <div className="relative z-[1] flex items-center justify-between">
                <span className="text-white/60 text-xs font-bold">{card.current_stamps} / {limit} Stamps</span>
                {nextTier && <span className="text-white/50 text-[10px]">{nextTier.stamps - card.current_stamps} to <span className="text-white font-semibold">{nextTier.reward}</span></span>}
              </div>
              {currentTierReward && (
                <div className="relative z-[1] bg-white/10 border border-white/20 rounded-xl px-3 py-2 flex items-center gap-2">
                  <Gift size={12} className="text-brand-gold flex-shrink-0" />
                  <p className="text-white/80 text-[11px] font-medium">Unlocked: <span className="font-bold text-white">{currentTierReward.reward}</span></p>
                </div>
              )}
            </div>
          );
        })()}
      </motion.div>

      <AnimatePresence>
        {showCompletionPopup && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-brand-navy/95 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="glass-panel w-full max-w-sm p-10 rounded-[3.5rem] text-center relative z-10 shadow-2xl"
            >
              <div className="w-24 h-24 bg-brand-gold/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy className="w-12 h-12 text-brand-gold" />
              </div>
              <h3 className="font-display text-3xl font-bold mb-2">Congratulations!</h3>
              <p className="text-brand-navy/60 mb-8">You've reached {limit} stamps at {store?.name}! Show this screen to the shop staff to claim your reward.</p>
              
              <div className="bg-blue-50/80 p-6 rounded-3xl mb-8 border-2 border-dashed border-brand-gold/40">
                <p className="text-[10px] font-bold text-brand-gold uppercase tracking-widest mb-2">Staff Action Required</p>
                <p className="text-sm font-bold text-brand-navy">Scan NFC Tag or Stamp again to confirm redemption</p>
              </div>

              <div className="space-y-3">
                <button 
                  onClick={handleArchive}
                  disabled={isArchiving}
                  className="w-full bg-brand-navy text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isArchiving ? 'Processing...' : 'Confirm & Redeem'}
                </button>
                <button 
                  onClick={() => setShowCompletionPopup(false)}
                  className="w-full py-4 text-brand-navy/40 font-bold text-sm"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showQR && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQR(false)}
              className="absolute inset-0 bg-brand-navy/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel w-full max-w-xs p-8 rounded-[3rem] text-center relative z-10"
            >
              <h3 className="font-display text-2xl font-bold mb-2">{store?.name}</h3>
              <p className="text-brand-navy/60 text-sm mb-8">Show this code to the vendor to receive your stamp.</p>
              <div className="bg-white/80 p-6 rounded-3xl mb-8 flex justify-center border border-brand-rose/20">
                <QRCodeSVG value={`stamp:${auth.currentUser?.uid}:${card.store_id}`} size={200} />
              </div>

              {/* Test Controls */}
              <div className="mb-8 p-4 glass-card rounded-2xl">
                <p className="text-[10px] font-bold text-brand-navy/40 uppercase tracking-widest mb-3">Test: Simulate Stamp</p>
                <div className="flex gap-2">
                  <input 
                    type="number"
                    min="1"
                    max="10"
                    value={testQty}
                    onChange={(e) => setTestQty(parseInt(e.target.value) || 1)}
                    className="w-16 px-3 py-2 rounded-xl bg-white border border-brand-navy/10 text-center font-bold text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                  />
                  <button 
                    onClick={handleTestStamp}
                    disabled={isTestIssuing}
                    className="flex-1 bg-brand-gold text-brand-navy py-2 rounded-xl font-bold text-sm hover:scale-105 transition-transform disabled:opacity-50"
                  >
                    {isTestIssuing ? 'Issuing...' : 'Add Stamps'}
                  </button>
                </div>
              </div>

              <button 
                onClick={() => setShowQR(false)}
                className="w-full bg-brand-navy text-white py-4 rounded-2xl font-bold"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Tier unlock popup */}
      <AnimatePresence>
        {unlockedReward && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-8 pointer-events-none"
          >
            <div className="bg-brand-navy rounded-[2rem] p-8 text-center shadow-2xl max-w-xs w-full border border-brand-gold/40">
              <div className="text-5xl mb-3">🎉</div>
              <p className="text-brand-gold text-xs font-bold uppercase tracking-widest mb-1">Reward Unlocked!</p>
              <p className="text-white text-2xl font-extrabold leading-tight">{unlockedReward}</p>
              <p className="text-white/50 text-xs mt-2">Show this to the vendor to claim</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function StoreCard({ store, card, onJoin, onClick }: { store: StoreProfile, card?: Card, onJoin: () => void, onClick?: () => void, key?: React.Key }) {
  const stampsRequired = store.stamps_required_for_reward || 10;
  const finalReward = store.rewardTiers?.length
    ? [...store.rewardTiers].sort((a, b) => b.stamps - a.stamps)[0]?.reward
    : store.reward;

  return (
    <div
      onClick={onClick}
      className="glass-card p-4 rounded-3xl flex items-center gap-4 hover:shadow-lg transition-all cursor-pointer group"
    >
      <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0">
        <img src={store.logoUrl || `https://picsum.photos/seed/${store.id}/200/200`} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-1">
          <h4 className="font-bold truncate">{store.name}</h4>
          {store.isVerified && <CheckCircle2 size={14} className="text-blue-500 fill-blue-500/10" />}
        </div>
        <p className="text-xs text-brand-navy/40 mb-2 flex items-center gap-1">
          <StoreCategoryIcon category={store.category} size={11} />
          {store.category} • 1.2km away
        </p>

        {card ? (
          <div className="space-y-2">
            <div className="flex gap-1">
              {Array.from({ length: stampsRequired }).map((_, i) => (
                <div key={i} className={cn(
                  "h-1 rounded-full flex-1",
                  i < card.current_stamps ? "bg-brand-gold" : "bg-brand-navy/10"
                )} />
              ))}
            </div>
            <p className="text-[10px] font-bold text-brand-gold uppercase tracking-widest">
              {card.current_stamps} / {stampsRequired} Stamps
            </p>
          </div>
        ) : (
          finalReward && (
            <div className="px-2 py-1 bg-brand-gold/10 rounded-lg w-fit">
              <span className="text-[10px] font-bold text-brand-gold">🎁 {finalReward}</span>
            </div>
          )
        )}
      </div>
      {!card && (
        <button
          onClick={(e) => { e.stopPropagation(); onJoin(); }}
          className="px-4 py-2 gradient-logo-blue text-white text-xs font-bold rounded-2xl active:scale-95 transition-all shrink-0 shadow"
        >
          Join
        </button>
      )}
    </div>
  );
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function DiscoveryScreen({ stores, cards, onJoin, onViewStore, onViewUser, currentUser, currentProfile }: {
  stores: StoreProfile[];
  cards: Card[];
  onJoin: (s: StoreProfile) => void;
  onViewStore: (s: StoreProfile) => void;
  onViewUser: (u: UserProfile) => void;
  currentUser: FirebaseUser;
  currentProfile: UserProfile | null;
}) {
  const [search, setSearch] = useState('');
  const [searchType, setSearchType] = useState<'stores' | 'users'>('stores');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      );
    }
  }, []);

  useEffect(() => {
    if (searchType === 'users') {
      setLoadingUsers(true);
      const q = query(collection(db, 'users'), where('role', '==', 'consumer'), limit(50));
      getDocs(q).then(snap => {
        const fetched = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
        // Ensure current user appears even if not in query results
        if (currentProfile && !fetched.some(u => u.uid === currentProfile.uid)) {
          fetched.unshift(currentProfile);
        }
        setUsers(fetched);
        setLoadingUsers(false);
      });
    }
  }, [searchType, currentProfile]);

  const filteredStores = (() => {
    const matched = stores.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
                            s.category.toLowerCase().includes(search.toLowerCase());
      const matchesCat = activeCategory === 'All' || s.category === activeCategory;
      const notJoined = !cards.some(c => c.store_id === s.id && !c.isArchived);
      return matchesSearch && matchesCat && notJoined;
    });
    if (!userCoords) return matched;
    return [...matched].sort((a, b) => {
      const distA = (a.lat != null && a.lng != null) ? haversineKm(userCoords.lat, userCoords.lng, a.lat, a.lng) : Infinity;
      const distB = (b.lat != null && b.lng != null) ? haversineKm(userCoords.lat, userCoords.lng, b.lat, b.lng) : Infinity;
      return distA - distB;
    });
  })();

  const filteredUsers = users.filter(u =>
    (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.handle || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-display text-3xl font-bold mb-4">Discovery</h2>
        <div className="space-y-4">
          <div className="flex gap-2 p-1 glass-card rounded-2xl">
            <button 
              onClick={() => setSearchType('stores')}
              className={cn(
                "flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                searchType === 'stores' ? "gradient-red text-white shadow-lg" : "text-brand-navy/40 hover:bg-brand-bg"
              )}
            >
              <Store size={18} />
              Businesses
            </button>
            <button 
              onClick={() => setSearchType('users')}
              className={cn(
                "flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                searchType === 'users' ? "gradient-red text-white shadow-lg" : "text-brand-navy/40 hover:bg-brand-bg"
              )}
            >
              <Users size={18} />
              Users
            </button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-navy/40" />
            <input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchType === 'stores' ? "Search businesses..." : "Search users..."}
              className="w-full pl-12 pr-4 py-4 rounded-2xl glass-card border-brand-rose/20 focus:outline-none focus:ring-2 focus:ring-brand-navy/20 font-medium"
            />
          </div>
        </div>
      </header>

      {searchType === 'stores' && (
        <>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {['All', 'Food', 'Beauty', 'Barber', 'Gym', 'Retail'].map(cat => (
              <button 
                key={cat} 
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-6 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all",
                  activeCategory === cat ? "gradient-red text-white shadow-md" : "glass-card text-brand-navy/50 hover:text-brand-navy"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {filteredStores.map(store => (
              <StoreCard 
                key={store.id} 
                store={store} 
                onJoin={() => onJoin(store)} 
                onClick={() => onViewStore(store)} 
              />
            ))}
            {filteredStores.length === 0 && (
              <div className="py-12 text-center text-brand-navy/20">
                <Compass size={48} className="mx-auto mb-4 opacity-10" />
                <p className="font-bold">No results found</p>
                <p className="text-xs">Try a different search term or category</p>
              </div>
            )}
          </div>
        </>
      )}

      {searchType === 'users' && (
        <div className="space-y-3">
          {loadingUsers ? (
            <div className="flex justify-center py-12">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                <Sparkles className="w-8 h-8 text-brand-gold" />
              </motion.div>
            </div>
          ) : (
            <>
              {filteredUsers.map(u => (
                <div 
                  key={u.uid} 
                  className="glass-card p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:shadow-md transition-all"
                  onClick={() => onViewUser(u)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-brand-navy/5 bg-indigo-50 flex items-center justify-center">
                      <PixelAvatar config={u.avatar} uid={u.uid} size={48} view="head" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1"><p className="font-bold text-sm">{u.name || u.handle || u.email?.split('@')[0]}</p><StreakBadge streak={u.streak} /></div>
                      <p className="text-xs text-brand-navy/40">{u.handle ? `@${u.handle}` : u.email?.split('@')[0]}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-brand-navy">{u.totalStamps || 0}</p>
                    <p className="text-[10px] text-brand-navy/40 font-bold uppercase tracking-widest">Stamps</p>
                  </div>
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <div className="py-20 text-center text-brand-navy/20">
                  <Users size={64} className="mx-auto mb-4 opacity-10" />
                  <p className="font-bold">No users found</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LivePixelAvatar({ uid, size, view }: { uid?: string; size: number; view: 'head' | 'full' }) {
  const [avatarConfig, setAvatarConfig] = useState<UserAvatar | null>(null);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, 'users', uid), (snap) => {
      setAvatarConfig(snap.exists() ? (snap.data().avatar ?? null) : null);
    }, () => {});
  }, [uid]);
  if (!uid) return null;
  return <PixelAvatar config={avatarConfig ?? undefined} uid={uid} size={size} view={view} />;
}

function WallPostItem({ post, currentUser, wallOwnerUid, onViewUser }: { post: any, currentUser: FirebaseUser, wallOwnerUid?: string, onViewUser?: (u: UserProfile) => void, key?: React.Key }) {
  const [likes, setLikes] = useState<string[]>([]);
  const [replies, setReplies] = useState<any[]>([]);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [newReply, setNewReply] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canDelete = currentUser.uid === post.fromUid || currentUser.uid === (wallOwnerUid ?? post.toUid);

  const handleDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'user_reviews', post.id));
      // Also remove the cross-posted global_posts entry
      if (post.userReviewId) {
        await deleteDoc(doc(db, 'global_posts', post.userReviewId)).catch(() => {});
      } else {
        // Fallback for older posts without the link: query by authorUid + toUid
        const snap = await getDocs(query(
          collection(db, 'global_posts'),
          where('userReviewId', '==', post.id)
        )).catch(() => null);
        if (snap) await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
      }
    } catch (err) {
      console.error('Wall post delete failed:', err);
      setDeleting(false);
    }
  };

  useEffect(() => {
    const unsubLikes = onSnapshot(collection(db, 'user_reviews', post.id, 'likes'), (snap) => {
      setLikes(snap.docs.map(d => d.id));
    }, (error) => console.error(error));

    const unsubReplies = onSnapshot(query(collection(db, 'user_reviews', post.id, 'replies'), orderBy('createdAt', 'asc')), (snap) => {
      setReplies(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => console.error(error));

    return () => {
      unsubLikes();
      unsubReplies();
    };
  }, [post.id]);

  const isLiked = likes.includes(currentUser.uid);

  const handleLike = async () => {
    const likeRef = doc(db, 'user_reviews', post.id, 'likes', currentUser.uid);
    const postRef = doc(db, 'user_reviews', post.id);
    try {
      if (isLiked) {
        await deleteDoc(likeRef);
        await updateDoc(postRef, { likesCount: increment(-1) });
      } else {
        await setDoc(likeRef, { createdAt: serverTimestamp() });
        await updateDoc(postRef, { likesCount: increment(1) });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handlePostReply = async () => {
    if (!newReply.trim()) return;
    setIsReplying(true);
    try {
      const replyStreak = await bumpStreak(currentUser.uid);
      await addDoc(collection(db, 'user_reviews', post.id, 'replies'), {
        fromUid: currentUser.uid,
        fromName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Anonymous',
        fromPhoto: currentUser.photoURL || '',
        fromStreak: replyStreak,
        content: newReply,
        createdAt: serverTimestamp()
      });
      setNewReply('');
      setShowReplyInput(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsReplying(false);
    }
  };

  const handleViewProfile = async (uid: string) => {
    if (!onViewUser || !uid) return;
    const snap = await getDoc(doc(db, 'users', uid)).catch(() => null);
    if (snap?.exists()) { onViewUser({ uid: snap.id, ...snap.data() } as UserProfile); return; }
    const vSnap = await getDoc(doc(db, 'vendors', uid)).catch(() => null);
    if (vSnap?.exists()) onViewUser({ uid: vSnap.id, ...vSnap.data() } as UserProfile);
  };

  return (
    <div className="glass-card p-6 rounded-[2.5rem] space-y-4 animation-fade-in">
      <div className="flex items-center justify-between">
        <button
          onClick={() => handleViewProfile(post.fromUid)}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left"
        >
          <div className="w-10 h-10 rounded-full overflow-hidden border border-brand-navy/5 bg-indigo-50 flex items-center justify-center">
            <LivePixelAvatar uid={post.fromUid} size={40} view="head" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <p className="font-bold text-sm text-brand-navy">{post.fromName}</p>
              <StreakBadge streak={post.fromStreak} />
            </div>
            <p className="text-[10px] text-brand-navy/40 font-bold uppercase tracking-widest">
              {post.createdAt ? format(post.createdAt.toDate(), 'MMM d, h:mm a') : 'Just now'}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 rounded-xl text-brand-navy/20 hover:text-red-400 hover:bg-red-50 transition-all disabled:opacity-40"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-brand-navy/80 leading-relaxed italic">"{post.content}"</p>

      <div className="flex items-center gap-6 pt-2 border-t border-brand-navy/5">
        <button 
          onClick={handleLike}
          className={cn("flex items-center gap-2 transition-colors", isLiked ? "text-red-500" : "text-brand-navy/40 hover:text-red-500")}
        >
          <Heart size={18} className={isLiked ? "fill-current" : ""} />
          <span className="text-xs font-bold">{likes.length}</span>
        </button>
        <button 
          onClick={() => setShowReplyInput(!showReplyInput)}
          className="flex items-center gap-2 text-brand-navy/40 hover:text-brand-navy transition-colors"
        >
          <MessageSquare size={18} />
          <span className="text-xs font-bold">{replies.length || 'Reply'}</span>
        </button>
      </div>

      {replies.length > 0 && (
        <div className="mt-4 space-y-3 pl-4 border-l-2 border-brand-navy/5">
          {replies.map(reply => (
            <div key={reply.id} className="flex gap-3">
              <button onClick={() => handleViewProfile(reply.fromUid)} className="shrink-0 hover:opacity-80 transition-opacity">
                <div className="w-6 h-6 rounded-full overflow-hidden bg-indigo-50 flex items-center justify-center">
                  <LivePixelAvatar uid={reply.fromUid} size={24} view="head" />
                </div>
              </button>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => handleViewProfile(reply.fromUid)} className="font-bold text-[10px] text-brand-navy hover:text-brand-gold transition-colors">{reply.fromName}</button>
                  <StreakBadge streak={reply.fromStreak} />
                  <p className="text-[8px] text-brand-navy/40">{reply.createdAt ? format(reply.createdAt.toDate(), 'h:mm a') : ''}</p>
                </div>
                <p className="text-xs text-brand-navy/70">{reply.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showReplyInput && (
        <div className="flex items-center gap-2 pt-2">
          <input 
            value={newReply}
            onChange={(e) => setNewReply(e.target.value)}
            placeholder="Write a reply..."
            className="flex-1 bg-brand-bg border-none rounded-xl px-4 py-2 text-xs focus:ring-1 focus:ring-brand-gold/20"
            onKeyDown={(e) => e.key === 'Enter' && handlePostReply()}
          />
          <button 
            onClick={handlePostReply}
            disabled={isReplying || !newReply.trim()}
            className="text-brand-navy hover:text-brand-gold disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function StatSquare({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="glass-card aspect-square rounded-[1.5rem] flex flex-col items-center justify-center p-3 hover:shadow-md transition-all">
      <div className="w-7 h-7 bg-brand-bg rounded-xl flex items-center justify-center mb-1.5">
        {React.cloneElement(icon as React.ReactElement, { size: 15 })}
      </div>
      <p className="font-display text-base font-bold text-brand-navy leading-none mb-0.5">{value}</p>
      <p className="text-[8px] text-brand-navy/40 font-bold uppercase tracking-wider text-center">{label}</p>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string, children: React.ReactNode, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-brand-navy/80 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="glass-panel w-full max-w-md rounded-t-[3rem] sm:rounded-[3rem] p-8 relative z-10 max-h-[80vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-8">
          <h3 className="font-display text-2xl font-bold">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-full bg-brand-bg text-brand-navy/40">
            <X size={20} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

const STAMP_ICON_GROUPS = [
  { group: 'Food & Drink',       icons: ['☕','🫘','🍴','🥐','🍕','🍔','🧃','🍦','🍰'] },
  { group: 'Barber & Beauty',    icons: ['✂️','💈','💅','🌸','✨','🪥','💆','🧖'] },
  { group: 'Health & Fitness',   icons: ['💪','🏋️','⚡','🔥','❤️','🎯','🏃','🧘'] },
  { group: 'Retail & Other',     icons: ['🛍️','👑','💎','⭐','🎫','🏆','🌟','🎁'] },
];

const CARD_PATTERNS: { id: string; label: string }[] = [
  { id: 'solid',    label: 'Solid' },
  { id: 'dots',     label: 'Dots' },
  { id: 'grid',     label: 'Grid' },
  { id: 'lines',    label: 'Lines' },
];

function getCardPatternStyle(pattern: string): React.CSSProperties {
  switch (pattern) {
    case 'dots':  return { backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.18) 1.5px, transparent 1.5px)', backgroundSize: '18px 18px' };
    case 'grid':  return { backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '20px 20px' };
    case 'lines': return { backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.07) 0px, rgba(255,255,255,0.07) 2px, transparent 2px, transparent 14px)' };
    default:      return {};
  }
}

function CardBuilder({ store }: { store: StoreProfile | null }) {
  const initTiers = (s: StoreProfile | null) => {
    if (s?.rewardTiers?.length) return s.rewardTiers;
    const total = s?.stamps_required_for_reward || 10;
    return [{ stamps: total, reward: s?.reward || '' }];
  };

  const [numTiers, setNumTiers] = useState(() => store?.rewardTiers?.length || 1);
  const [tiers, setTiers] = useState<{ stamps: number; reward: string; value?: number }[]>(() => initTiers(store));
  const [theme, setTheme] = useState(store?.theme || '#3a6fcc');
  const [stampIcon, setStampIcon] = useState(store?.stampIcon || '⭐');
  const [stampBorderColor, setStampBorderColor] = useState(store?.stampBorderColor || '#ffffff');
  const [cardPattern, setCardPattern] = useState(store?.cardPattern || 'solid');
  const [selectedIconGroup, setSelectedIconGroup] = useState(STAMP_ICON_GROUPS[0].group);
  const [openColorPicker, setOpenColorPicker] = useState<'primary' | 'secondary' | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!store) return;
    const loaded = initTiers(store);
    setNumTiers(loaded.length);
    setTiers(loaded);
    setTheme(store.theme || '#1a1a2e');
    setStampIcon(store.stampIcon || '⭐');
    setStampBorderColor(store.stampBorderColor || '#ffffff');
    setCardPattern(store.cardPattern || 'solid');
  }, [store?.id]);

  // When numTiers changes, resize tiers array
  useEffect(() => {
    setTiers(prev => {
      const next = Array.from({ length: numTiers }, (_, i) => prev[i] ?? { stamps: 0, reward: '' });
      // Auto-space stamp counts evenly if not set
      return next.map((t, i) => ({
        ...t,
        stamps: t.stamps > 0 ? t.stamps : Math.round((i + 1) * (prev[prev.length - 1]?.stamps || 10) / numTiers),
      }));
    });
  }, [numTiers]);

  const updateTier = (i: number, field: 'stamps' | 'reward' | 'value', val: string) => {
    setTiers(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: field === 'stamps' ? Math.max(1, parseInt(val) || 1) : field === 'value' ? (parseFloat(val) || 0) : val } : t));
  };

  const handleSave = async () => {
    if (!store) return;
    setSaving(true);
    try {
      const sorted = [...tiers].sort((a, b) => a.stamps - b.stamps);
      const topTier = sorted[sorted.length - 1];
      await updateDoc(doc(db, 'stores', store.id), {
        rewardTiers: sorted,
        stamps_required_for_reward: topTier.stamps,
        reward: topTier.reward,
        theme,
        stampIcon,
        stampBorderColor,
        cardPattern,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const DARK_THEMES = ['#3a6fcc', '#8a4db8', '#2a9b72', '#c4622a', '#2e7fc4', '#b07830'];
  const totalStamps = tiers[tiers.length - 1]?.stamps || 10;
  const tierStampSet = new Set(tiers.map(t => t.stamps));

  return (
    <div className="space-y-6 pb-20">
      <header>
        <h2 className="font-display text-3xl font-bold mb-1">Card Builder</h2>
        <p className="text-brand-navy/60">Design your loyalty reward tiers.</p>
      </header>

      <div className="glass-card p-6 rounded-[2.5rem] space-y-6">

        {/* Number of reward stages */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-brand-navy/40">Number of Reward Stages</label>
          <div className="relative">
            <select
              value={numTiers}
              onChange={e => setNumTiers(parseInt(e.target.value))}
              className="w-full px-5 py-4 rounded-2xl bg-brand-bg border border-brand-navy/10 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-gold/30 appearance-none"
            >
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} {n === 1 ? 'Stage' : 'Stages'}</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-navy/40 pointer-events-none" />
          </div>
        </div>

        {/* Tier inputs */}
        <div className="space-y-4">
          <label className="text-xs font-bold uppercase tracking-widest text-brand-navy/40">Reward at Each Stage</label>
          {tiers.slice(0, numTiers).map((tier, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-gold/10 flex items-center justify-center">
                  <span className="text-[10px] font-extrabold text-brand-gold">{i + 1}</span>
                </div>
                <span className="text-[10px] font-bold text-brand-navy/40 uppercase tracking-widest">Stage {i + 1}</span>
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min="1"
                  value={tier.stamps}
                  onChange={e => updateTier(i, 'stamps', e.target.value)}
                  className="w-16 px-2 py-2.5 rounded-xl bg-brand-bg border border-brand-navy/10 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-brand-gold/30"
                  placeholder="Stamps"
                />
                <input
                  value={tier.reward}
                  onChange={e => updateTier(i, 'reward', e.target.value)}
                  placeholder={i === numTiers - 1 ? 'e.g. Free coffee' : `Stage ${i + 1} reward`}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-brand-bg border border-brand-navy/10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-gold/30"
                />
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-xs font-bold text-emerald-600">£</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={tier.value ?? ''}
                    onChange={e => updateTier(i, 'value', e.target.value)}
                    className="w-20 pl-6 pr-2 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          ))}
          <p className="text-[11px] text-brand-navy/30 pl-1">Set stamps, reward name, and the £ value saved. Stage {numTiers} is the top reward.</p>
        </div>

        {/* Colours — primary & secondary side by side */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-brand-navy/40">Colours</label>
          <div className="flex gap-3">

            {/* Primary — card background */}
            <div className="flex-1 relative">
              <p className="text-[10px] text-brand-navy/35 font-bold uppercase tracking-wider mb-1.5">Primary</p>
              <button
                onClick={() => setOpenColorPicker(v => v === 'primary' ? null : 'primary')}
                className="w-full h-12 rounded-2xl border-2 border-brand-navy/10 flex items-center justify-center gap-2 bg-brand-bg active:scale-95 transition-all"
              >
                <div className="w-6 h-6 rounded-full border border-black/10 shadow-sm" style={{ backgroundColor: theme }} />
                <span className="text-xs font-bold text-brand-navy/60">Card</span>
              </button>
              {openColorPicker === 'primary' && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setOpenColorPicker(null)} />
                  <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-black/5 p-3 w-52">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {DARK_THEMES.map(c => (
                        <button key={c} onClick={() => { setTheme(c); setOpenColorPicker(null); }}
                          className={cn("w-9 h-9 rounded-xl border-2 transition-all", theme === c ? "border-brand-gold scale-110 shadow" : "border-transparent")}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <div className="relative h-9">
                      <input type="color" value={theme} onChange={e => setTheme(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <div className="h-9 rounded-xl border-2 border-dashed border-brand-navy/15 flex items-center justify-center gap-2" style={{ backgroundColor: theme }}>
                        <Palette size={13} className="text-white/70" />
                        <span className="text-[11px] text-white/70 font-bold">Custom</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Secondary — border & text */}
            <div className="flex-1 relative">
              <p className="text-[10px] text-brand-navy/35 font-bold uppercase tracking-wider mb-1.5">Secondary</p>
              <button
                onClick={() => setOpenColorPicker(v => v === 'secondary' ? null : 'secondary')}
                className="w-full h-12 rounded-2xl border-2 border-brand-navy/10 flex items-center justify-center gap-2 bg-brand-bg active:scale-95 transition-all"
              >
                <div className="w-6 h-6 rounded-full border border-black/10 shadow-sm" style={{ backgroundColor: stampBorderColor }} />
                <span className="text-xs font-bold text-brand-navy/60">Border &amp; Text</span>
              </button>
              {openColorPicker === 'secondary' && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setOpenColorPicker(null)} />
                  <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-black/5 p-3 w-52">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {['#ffffff', '#f5a623', '#a78bfa', '#34d399', '#fb7185', '#60a5fa'].map(c => (
                        <button key={c} onClick={() => { setStampBorderColor(c); setOpenColorPicker(null); }}
                          className={cn("w-9 h-9 rounded-xl border-2 transition-all", stampBorderColor === c ? "border-brand-navy scale-110 shadow" : "border-transparent")}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <div className="relative h-9">
                      <input type="color" value={stampBorderColor} onChange={e => setStampBorderColor(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <div className="h-9 rounded-xl border-2 border-dashed border-brand-navy/15 flex items-center justify-center gap-2" style={{ backgroundColor: stampBorderColor }}>
                        <Palette size={13} className="text-white/70" />
                        <span className="text-[11px] text-white/70 font-bold">Custom</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>

        {/* Stamp Icon */}
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-widest text-brand-navy/40">Stamp Icon</label>
          <div className="relative">
            <select
              value={selectedIconGroup}
              onChange={e => setSelectedIconGroup(e.target.value)}
              className="w-full px-5 py-3.5 rounded-2xl bg-brand-bg border border-brand-navy/10 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-gold/30 appearance-none"
            >
              {STAMP_ICON_GROUPS.map(({ group }) => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-navy/40 pointer-events-none" />
          </div>
          <div className="flex flex-wrap gap-2">
            {(STAMP_ICON_GROUPS.find(g => g.group === selectedIconGroup)?.icons || []).map(icon => (
              <button
                key={icon}
                onClick={() => setStampIcon(icon)}
                className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center text-2xl transition-all",
                  stampIcon === icon ? "bg-brand-gold/20 ring-2 ring-brand-gold scale-110 shadow" : "bg-brand-bg hover:bg-brand-navy/5"
                )}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>


        {/* Card Pattern */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-brand-navy/40">Card Pattern</label>
          <div className="flex gap-2">
            {CARD_PATTERNS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setCardPattern(id)}
                className={cn(
                  "flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all border",
                  cardPattern === id ? "bg-brand-navy text-white border-brand-navy" : "bg-brand-bg text-brand-navy/40 border-brand-navy/10"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Live preview */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40 mb-3">Live Preview</p>
          <div className="rounded-[2rem] p-5 space-y-4 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${theme} 0%, ${theme}dd 100%)` }}>
            {cardPattern !== 'solid' && (
              <div className="absolute inset-0 pointer-events-none rounded-[2rem]" style={getCardPatternStyle(cardPattern)} />
            )}
            <div className="relative z-[1] flex items-center justify-between">
              <div className="flex items-center gap-3">
                {store?.logoUrl
                  ? <img src={store.logoUrl} alt="" className="w-11 h-11 rounded-2xl object-cover border-2 border-white/30" />
                  : <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center"><Store size={18} className="text-white/50" /></div>}
                <div>
                  <p className="text-white font-bold">{store?.name || 'Your Business'}</p>
                  <p className="text-white/50 text-xs">{totalStamps} stamps · {numTiers} reward{numTiers > 1 ? 's' : ''}</p>
                </div>
              </div>
              {tiers[numTiers - 1]?.reward && (
                <div className="bg-white/10 border border-white/20 rounded-xl px-2.5 py-1">
                  <p className="text-white text-[10px] font-bold">{tiers[numTiers - 1].reward}</p>
                </div>
              )}
            </div>
            <div className="relative z-[1] grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(totalStamps, 5)}, 1fr)` }}>
              {Array.from({ length: totalStamps }).map((_, i) => {
                const stampNum = i + 1;
                const isTier = tiers.slice(0, numTiers).some(t => t.stamps === stampNum);
                const isFilled = i < 3;
                return (
                  <div key={i}
                    className={cn("aspect-square rounded-xl border-2 flex items-center justify-center",
                      isFilled ? isTier ? "bg-brand-gold" : "bg-white/30"
                      : isTier ? "bg-white/10 border-dashed" : "border-dashed"
                    )}
                    style={{ borderColor: isTier ? (isFilled ? stampBorderColor : `${stampBorderColor}99`) : (isFilled ? stampBorderColor : `${stampBorderColor}66`) }}
                  >
                    {isFilled
                      ? isTier ? <Gift size={10} className="text-brand-navy" /> : <span className="text-base leading-none">{stampIcon}</span>
                      : isTier ? <Gift size={10} style={{ color: stampBorderColor, opacity: 0.7 }} /> : <span className="text-[8px] font-bold" style={{ color: stampBorderColor, opacity: 0.8 }}>{stampNum}</span>}
                  </div>
                );
              })}
            </div>
            {numTiers > 1 && (
              <div className="relative z-[1] space-y-1">
                {tiers.slice(0, numTiers).map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-white/10 border border-white/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-white/60 text-[8px] font-bold">{i + 1}</span>
                    </div>
                    <p className="text-white/50 text-[10px]">{t.stamps} stamps → <span className="text-white/80 font-semibold">{t.reward || '—'}</span></p>
                  </div>
                ))}
              </div>
            )}
            <p className="relative z-[1] text-white/30 text-[10px] text-right">3 / {totalStamps} Stamps (preview)</p>
          </div>
        </div>

        <p className="text-xs text-brand-navy/40">Existing cards finish their current cycle first. New cycles use these settings.</p>

        {store && (
          <div className="bg-brand-navy/5 rounded-2xl p-4 text-left">
            <p className="text-xs font-bold text-brand-navy mb-1 flex items-center gap-1.5"><Wifi size={12} /> NFC Tag URL</p>
            <p className="text-[10px] text-brand-navy/50 mb-2 leading-relaxed">Program this URL onto your NFC tags. Customers tap the tag to collect a stamp on any device.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[10px] bg-white rounded-xl px-3 py-2 text-brand-navy/70 truncate border border-brand-navy/10">
                {`${window.location.origin}/?stamp=${store.id}`}
              </code>
              <button
                onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/?stamp=${store.id}`)}
                className="shrink-0 px-3 py-2 bg-brand-navy text-white text-[10px] font-bold rounded-xl"
              >Copy</button>
            </div>
          </div>
        )}

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-brand-navy text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
          {saved ? <><CheckCircle2 size={16} /> Saved!</> : saving ? 'Saving...' : <><Save size={16} /> Save — Set as New Card</>}
        </button>
      </div>
    </div>
  );
}

function BadgeSwipeRow({ badges, onSelectBadge }: { badges: AppBadge[]; onSelectBadge: (b: AppBadge) => void }) {
  if (badges.length === 0) return null;
  return (
    <div className="overflow-x-auto no-scrollbar -mx-5 px-5">
      <div className={cn('flex gap-3 pb-1', badges.length <= 5 ? 'justify-center' : 'w-max')}>
        {badges.map(b => (
          <button
            key={b.id}
            onClick={() => onSelectBadge(b)}
            className="flex flex-col items-center gap-1 shrink-0 active:scale-95 transition-transform"
          >
            <div
              className="w-12 h-12 rounded-[1rem] flex items-center justify-center text-2xl shadow-sm"
              style={{ background: `linear-gradient(135deg, ${b.color}ee, ${b.color}99)` }}
            >
              {b.icon}
            </div>
            <span className="text-[9px] font-bold text-brand-navy/50 text-center w-12 leading-tight line-clamp-2">{b.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function BadgeSquarePanel({ badges, onSelectBadge }: { badges: AppBadge[]; onSelectBadge: (b: AppBadge) => void }) {
  const [showAll, setShowAll] = useState(false);
  return (
    <>
      <div className="grid grid-cols-2 gap-1.5 w-full">
        {[0, 1, 2].map(i => {
          const b = badges[i];
          if (!b) return (
            <div key={i} className="aspect-square rounded-[1.1rem] bg-brand-navy/5 border border-brand-navy/8 flex items-center justify-center">
              <span className="text-brand-navy/20 text-lg">✦</span>
            </div>
          );
          return (
            <button key={b.id} onClick={() => onSelectBadge(b)}
              className="aspect-square rounded-[1.1rem] flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform shadow-md overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${b.color}ee, ${b.color}99)` }}>
              <span className="text-2xl leading-none">{b.icon}</span>
              <span className="text-[6px] font-bold text-white/90 text-center px-1 leading-tight line-clamp-2 max-w-full">{b.name}</span>
            </button>
          );
        })}
        <button onClick={() => setShowAll(true)}
          className="aspect-square rounded-[1.1rem] bg-brand-navy flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform shadow-md">
          <span className="text-lg leading-none">🏅</span>
          <span className="text-[7px] font-bold text-white/70 uppercase tracking-wide">See all</span>
          {badges.length > 0 && <span className="text-[9px] font-black text-brand-gold">{badges.length}</span>}
        </button>
      </div>

      <AnimatePresence>
        {showAll && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-end max-w-md mx-auto"
            onClick={() => setShowAll(false)}>
            <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              className="w-full bg-brand-bg rounded-t-3xl p-6 pb-10"
              onClick={e => e.stopPropagation()}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40 mb-4">All Badges</p>
              {badges.length === 0 ? (
                <p className="text-xs text-brand-navy/40 text-center py-8">No badges earned yet</p>
              ) : (
                <div className="grid grid-cols-4 gap-3 max-h-72 overflow-y-auto pb-1">
                  {badges.map(b => (
                    <button key={b.id} onClick={() => { setShowAll(false); onSelectBadge(b); }}
                      className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
                      <div className="w-14 h-14 rounded-[1.1rem] flex items-center justify-center text-2xl shadow-md"
                        style={{ background: `linear-gradient(135deg, ${b.color}ee, ${b.color}99)` }}>{b.icon}</div>
                      <p className="text-[8px] font-bold text-brand-navy/60 text-center max-w-[56px] leading-tight line-clamp-2">{b.name}</p>
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => setShowAll(false)} className="w-full mt-5 py-3 rounded-2xl bg-brand-navy/8 text-brand-navy font-bold text-sm active:scale-[0.98] transition-all">Close</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function StickerListPanel({ uid }: { uid: string }) {
  const [stickers, setStickers] = useState<CollectibleSticker[] | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'user_stickers', uid), async snap => {
      if (snap.exists() && (snap.data().stickers || []).length > 0) {
        setStickers(snap.data().stickers || []);
      } else {
        const cardsSnap = await getDocs(query(collection(db, 'sticker_cards'), where('user_id', '==', uid)));
        if (cardsSnap.empty) { setStickers([]); return; }
        const all: CollectibleSticker[] = [];
        cardsSnap.docs.forEach(d => all.push(...(d.data().stickers || [])));
        setStickers(all);
      }
    });
    return unsub;
  }, [uid]);

  // Group by tier+variant, count duplicates
  const grouped = (() => {
    const map = new Map<string, { bg: string; border: string; emoji: string; name: string; count: number }>();
    (stickers || []).forEach(s => {
      const key = `${s.tier}-${s.variant ?? 0}`;
      if (!map.has(key)) {
        const cfg = STICKER_CONFIG[s.tier];
        const v = cfg.variants[s.variant ?? 0];
        map.set(key, { bg: cfg.bg, border: cfg.border, emoji: v?.emoji ?? '?', name: v?.name ?? cfg.label, count: 0 });
      }
      map.get(key)!.count++;
    });
    return Array.from(map.values());
  })();

  return (
    <>
      <div className="grid grid-cols-2 gap-1.5 w-full">
        {[0, 1, 2].map(i => {
          const g = grouped[i];
          if (!g) return (
            <div key={i} className="aspect-square rounded-[1.1rem] bg-brand-navy/5 border border-brand-navy/8 flex items-center justify-center">
              <span className="text-brand-navy/20 text-lg">✦</span>
            </div>
          );
          return (
            <button key={i} onClick={() => setShowAll(true)}
              className="aspect-square rounded-[1.1rem] flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform shadow-md overflow-hidden relative"
              style={{ background: g.bg, border: `1.5px solid ${g.border}` }}>
              <span className="text-2xl leading-none">{g.emoji}</span>
              <span className="text-[6px] font-bold text-brand-navy/80 text-center px-1 leading-tight line-clamp-2 max-w-full">{g.name}</span>
              {g.count > 1 && (
                <span className="absolute top-1 right-1 bg-brand-navy text-white text-[6px] font-black w-3 h-3 rounded-full flex items-center justify-center leading-none">
                  {g.count}
                </span>
              )}
            </button>
          );
        })}
        <button onClick={() => setShowAll(true)}
          className="aspect-square rounded-[1.1rem] bg-brand-navy flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform shadow-md">
          <span className="text-lg leading-none">🌟</span>
          <span className="text-[7px] font-bold text-white/70 uppercase tracking-wide">See all</span>
          {grouped.length > 0 && <span className="text-[9px] font-black text-brand-gold">{grouped.length}</span>}
        </button>
      </div>

      <AnimatePresence>
        {showAll && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-end max-w-md mx-auto"
            onClick={() => setShowAll(false)}>
            <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              className="w-full bg-brand-bg rounded-t-3xl p-6 pb-10"
              onClick={e => e.stopPropagation()}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40 mb-4">All Stickers</p>
              {grouped.length === 0 ? (
                <p className="text-xs text-brand-navy/40 text-center py-8">No stickers collected yet</p>
              ) : (
                <div className="grid grid-cols-4 gap-3 max-h-72 overflow-y-auto pb-1">
                  {grouped.map((g, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className="relative w-14 h-14 rounded-[1.1rem] flex items-center justify-center text-2xl shadow-md"
                        style={{ background: g.bg, border: `1.5px solid ${g.border}` }}>
                        {g.emoji}
                        {g.count > 1 && (
                          <span className="absolute -top-1 -right-1 bg-brand-navy text-white text-[7px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center leading-none">
                            {g.count}
                          </span>
                        )}
                      </div>
                      <p className="text-[8px] font-bold text-brand-navy/60 text-center max-w-[56px] leading-tight line-clamp-2">{g.name}</p>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => setShowAll(false)} className="w-full mt-5 py-3 rounded-2xl bg-brand-navy/8 text-brand-navy font-bold text-sm active:scale-[0.98] transition-all">Close</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ProfileScreen({ profile, userCards, stores, onLogout, onDeleteAccount, onViewUser, user }: { profile: UserProfile | null, userCards: Card[], stores?: StoreProfile[], onLogout: () => void, onDeleteAccount: () => Promise<void>, onViewUser: (u: UserProfile) => void, user: FirebaseUser }) {
  const [activeSubTab, setActiveSubTab] = useState<'posts' | 'interactions'>('posts');
  const [profileRedeemingChallenge, setProfileRedeemingChallenge] = useState<{ challenge: Challenge; entry: any; userName: string } | null>(null);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [avatarViewOpen, setAvatarViewOpen] = useState(false);
  const [avatarCustomiserOpen, setAvatarCustomiserOpen] = useState(false);
  const profileLastDocRef = useRef<any>(null);
  const [profileHasMore, setProfileHasMore] = useState(true);
  const [profileLoadingMore, setProfileLoadingMore] = useState(false);
  const profileSentinelRef = useRef<HTMLDivElement>(null);
  const PROFILE_PAGE_SIZE = 10;
  const [vendorStore, setVendorStore] = useState<StoreProfile | null>(null);
  const [storeCards, setStoreCards] = useState<Card[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<AppBadge | null>(null);
  const [profilePendingPack, setProfilePendingPack] = useState<CollectibleSticker[] | null>(null);

  useEffect(() => {
    if (profile?.role !== 'vendor') return;
    const q = query(collection(db, 'stores'), where('ownerUid', '==', profile.uid));
    return onSnapshot(q, snap => {
      if (!snap.empty) setVendorStore({ id: snap.docs[0].id, ...snap.docs[0].data() } as StoreProfile);
    });
  }, [profile?.uid, profile?.role]);

  useEffect(() => {
    if (!vendorStore) return;
    const q = query(collection(db, 'cards'), where('store_id', '==', vendorStore.id));
    return onSnapshot(q, snap => setStoreCards(snap.docs.map(d => ({ id: d.id, ...d.data() } as Card))));
  }, [vendorStore?.id]);

  const [storeWallPosts, setStoreWallPosts] = useState<any[]>([]);
  useEffect(() => {
    if (!vendorStore) return;
    const q = query(collection(db, 'stores', vendorStore.id, 'posts'), orderBy('createdAt', 'desc'), limit(30));
    return onSnapshot(q, snap => setStoreWallPosts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [vendorStore?.id]);

  useEffect(() => {
    if (!vendorStore) return;
    getDocs(query(collection(db, 'store_follows'), where('storeId', '==', vendorStore.id)))
      .then(snap => setStoreFollowerCount(snap.size))
      .catch(() => {});
  }, [vendorStore?.id]);
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [storeFollowerCount, setStoreFollowerCount] = useState(0);
  const [showFollowModal, setShowFollowModal] = useState(false);
  const [followModalTab, setFollowModalTab] = useState<'following' | 'followers'>('following');
  const [myGlobalPosts, setMyGlobalPosts] = useState<GlobalPost[]>([]);
  const [likedPosts, setLikedPosts] = useState<GlobalPost[]>([]);
  const [allPostsForVotes, setAllPostsForVotes] = useState<GlobalPost[]>([]);
  const [newPost, setNewPost] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    if (!profile?.uid) return;

    const fetchUsersByIds = async (uids: string[]): Promise<UserProfile[]> => {
      if (uids.length === 0) return [];
      const snaps = await Promise.all(uids.map(uid => getDoc(doc(db, 'users', uid))));
      return snaps.filter(s => s.exists()).map(s => ({ uid: s.id, ...s.data() } as UserProfile));
    };

    const unsubFollowing = onSnapshot(
      query(collection(db, 'follows'), where('followerUid', '==', profile.uid)),
      async (snap) => {
        const uids = snap.docs.map(d => d.data().followingUid as string);
        setFollowing(await fetchUsersByIds(uids));
      }
    );

    const unsubFollowers = onSnapshot(
      query(collection(db, 'follows'), where('followingUid', '==', profile.uid)),
      async (snap) => {
        const uids = snap.docs.map(d => d.data().followerUid as string);
        setFollowers(await fetchUsersByIds(uids));
      }
    );

    getDocs(query(collection(db, 'global_posts'), where('authorUid', '==', profile.uid), orderBy('createdAt', 'desc'), limit(PROFILE_PAGE_SIZE))).then(snap => {
      setMyGlobalPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as GlobalPost)));
      profileLastDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
      setProfileHasMore(snap.docs.length === PROFILE_PAGE_SIZE);
    }).catch(() => {});
    const unsubGlobalPosts = () => {};

    const lq = query(collection(db, 'global_posts'), where('likedBy', 'array-contains', profile.uid), orderBy('createdAt', 'desc'));
    const unsubLiked = onSnapshot(lq, (snap) => {
      setLikedPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as GlobalPost)));
    });

    const aq = query(collection(db, 'global_posts'), where('postType', '==', 'poll'), orderBy('createdAt', 'desc'), limit(100));
    const unsubAllPolls = onSnapshot(aq, (snap) => {
      setAllPostsForVotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as GlobalPost)));
    });

    return () => {
      unsubFollowing();
      unsubFollowers();
      unsubGlobalPosts();
      unsubLiked();
      unsubAllPolls();
    };
  }, [profile?.uid]);

  const profileLoadingMoreRef = useRef(false);

  const loadMoreProfilePosts = async () => {
    if (!profile || profileLoadingMoreRef.current || !profileHasMore || !profileLastDocRef.current) return;
    profileLoadingMoreRef.current = true;
    setProfileLoadingMore(true);
    try {
      const snap = await getDocs(query(collection(db, 'global_posts'), where('authorUid', '==', profile.uid), orderBy('createdAt', 'desc'), startAfter(profileLastDocRef.current), limit(PROFILE_PAGE_SIZE)));
      setMyGlobalPosts(prev => [...prev, ...snap.docs.map(d => ({ id: d.id, ...d.data() } as GlobalPost))]);
      profileLastDocRef.current = snap.docs[snap.docs.length - 1] ?? profileLastDocRef.current;
      setProfileHasMore(snap.docs.length === PROFILE_PAGE_SIZE);
    } catch { /* ignore */ }
    profileLoadingMoreRef.current = false;
    setProfileLoadingMore(false);
  };

  useEffect(() => {
    const el = profileSentinelRef.current;
    if (!el || !profileHasMore) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) loadMoreProfilePosts(); }, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [myGlobalPosts.length, profileHasMore, profile?.uid]);

  const handlePostOnWall = async () => {
    if (!newPost.trim() || !profile) return;
    setIsPosting(true);
    try {
      await addDoc(collection(db, 'global_posts'), {
        authorUid: user.uid,
        authorName: profile.name || user.displayName || 'User',
        authorPhoto: profile.photoURL || user.photoURL || '',
        authorRole: profile.role || 'consumer',
        content: newPost.trim(),
        postType: 'post',
        createdAt: serverTimestamp(),
        likesCount: 0,
        likedBy: []
      });
      setNewPost('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsPosting(false);
    }
  };

  // Challenges + badges (consumer only)
  const [profileChallenges, setProfileChallenges] = useState<Challenge[]>([]);
  const [profileEntries, setProfileEntries] = useState<Map<string, any>>(new Map());
  const [allBadges, setAllBadges] = useState<AppBadge[]>([]);

  useEffect(() => {
    if (profile?.role !== 'consumer') return;
    const q = query(collection(db, 'challenges'), where('type', '==', 'standard'), where('status', '==', 'active'));
    return onSnapshot(q, snap => setProfileChallenges(snap.docs.map(d => ({ id: d.id, ...d.data() } as Challenge))));
  }, [profile?.role]);

  useEffect(() => {
    if (profile?.role !== 'consumer' || !user?.uid) return;
    const q = query(collection(db, 'challenge_entries'), where('uid', '==', user.uid));
    return onSnapshot(q, snap => {
      const m = new Map<string, any>();
      snap.docs.forEach(d => m.set(d.data().challengeId, { id: d.id, ...d.data() }));
      setProfileEntries(m);
    });
  }, [profile?.role, user?.uid]);

  useEffect(() => {
    return onSnapshot(collection(db, 'badges'), snap =>
      setAllBadges(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppBadge)))
    );
  }, []);

  if (!profile) return null;

  const lifetimeStamps = Math.max(
    profile.totalStamps || 0,
    userCards.reduce((acc, c) => acc + (c.current_stamps || 0), 0)
  );
  // Build tiers-per-store map: live store data is authoritative, cards fill gaps for stores not yet loaded.
  const storeMap = new Map<string, StoreProfile>((stores || []).map(s => [s.id!, s]));
  const tiersByStore = new Map<string, number>();
  userCards.forEach(c => {
    if ((c.tiersCompleted || 0) > (tiersByStore.get(c.store_id) || 0))
      tiersByStore.set(c.store_id, c.tiersCompleted as number);
  });
  const stagesFor = (sid: string) => {
    const s = storeMap.get(sid);
    if (s) return s.rewardTiers?.length || 1;
    return tiersByStore.get(sid) || 1;
  };
  // Formula: for each active card → cycles × stages. For each archived reward doc → 1 cycle × stages.
  const activeCardRewards = userCards
    .filter(c => !c.isArchived)
    .reduce((sum, c) => sum + (c.total_completed_cycles || 0) * stagesFor(c.store_id), 0);
  const archivedDocRewards = userCards
    .filter(c => c.isArchived && c.isRedeemed)
    .reduce((sum, c) => sum + stagesFor(c.store_id), 0);
  const archivedCardsCount = Math.max(activeCardRewards, archivedDocRewards, profile.totalRedeemed || 0);
  const activeCardsCount = userCards.filter(c => !c.isArchived).length;

  // Challenges I'm in (consumer)
  const myChallenges = profileChallenges.filter(c => (c.participantUids || []).includes(user.uid));

  // Badge metric map
  const badgeMetrics: Record<BadgeMetric, number> = {
    stamps: lifetimeStamps,
    cards_completed: archivedCardsCount,
    challenges_joined: myChallenges.length,
    memberships: activeCardsCount,
    followers: followers.length,
    following: following.length,
    posts: myGlobalPosts.length,
    charity_animals: profile.charityAnimals || 0,
    charity_trees: profile.charityTrees || 0,
    charity_total: (profile.charityAnimals || 0) + (profile.charityTrees || 0),
  };
  const earnedBadges = allBadges.filter(b => (badgeMetrics[b.metric] ?? 0) >= b.threshold);

  // Vendor stats
  const totalMembers = storeCards.length > 0 ? new Set(storeCards.map(c => c.user_id)).size : 0;
  const stampsRequired = vendorStore?.stamps_required_for_reward || 10;
  const totalStampsGiven = storeCards.reduce((sum, c) => sum + (c.current_stamps || 0) + ((c.total_completed_cycles || 0) * stampsRequired), 0);
  const activeStoreCards = storeCards.filter(c => !c.isArchived).length;
  const returningUsers = storeCards.filter(c => (c.total_completed_cycles || 0) > 0).length;
  const returnRate = totalMembers > 0 ? Math.round((returningUsers / totalMembers) * 100) : 0;
  const storeTiersProfile = vendorStore?.rewardTiers?.length || Math.max(...storeCards.map(c => c.tiersCompleted || 0), 1);
  const profileRewardsGiven = Math.max(
    storeCards.filter(c => !c.isArchived).reduce((sum, c) => sum + (c.total_completed_cycles || 0), 0) * storeTiersProfile,
    storeCards.filter(c => c.isArchived && c.isRedeemed).length * storeTiersProfile,
    vendorStore?.rewardsGiven || 0
  );
  const vis = vendorStore?.visibilitySettings;

  const settingsModal = (
    <AnimatePresence>
      {showProfileSettings && (
        <ProfileSettingsModal profile={profile} user={user} onClose={() => setShowProfileSettings(false)} onLogout={onLogout} onDeleteAccount={onDeleteAccount} />
      )}
    </AnimatePresence>
  );

  // ── Vendor profile layout ──
  if (profile.role === 'vendor') {
    const theme = vendorStore?.theme || '#1e3a5f';
    return (
      <div className="space-y-6 pb-20 text-brand-navy">
        {settingsModal}

        {/* Business hero banner */}
        <div className="relative rounded-[2.5rem] overflow-hidden" style={{ background: `linear-gradient(135deg, ${theme}ee, ${theme}88)` }}>
          <div className="px-6 pt-8 pb-6">
            <button onClick={() => setShowProfileSettings(true)}
              className="absolute top-4 right-4 p-2 rounded-2xl bg-white/20 backdrop-blur-sm active:scale-95 transition-all">
              <Settings size={18} className="text-white" />
            </button>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-[1.5rem] overflow-hidden border-4 border-white/30 shadow-xl shrink-0 bg-white/10">
                {vendorStore?.logoUrl
                  ? <img src={vendorStore.logoUrl} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><Building2 size={32} className="text-white/60" /></div>}
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold text-white leading-tight">{vendorStore?.name || profile.name}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {vendorStore?.category && (
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest bg-white/20 text-white px-2 py-1 rounded-lg">
                        <StoreCategoryIcon category={vendorStore.category} size={10} />
                        {vendorStore.category}
                      </span>
                  )}
                  {vendorStore?.location && (
                    <span className="flex items-center gap-1 text-[10px] text-white/70 font-medium">
                      <MapPin size={10} />{vendorStore.location}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-white/60 mt-1">@{profile.handle || user.email?.split('@')[0]}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Followers / Following */}
        {(vis?.followers !== false) && (
          <div className="flex items-center gap-4 text-sm px-1">
            <button onClick={() => { setFollowModalTab('following'); setShowFollowModal(true); }} className="flex items-center gap-1 font-bold hover:text-brand-gold transition-colors">
              <span>{following.length}</span>
              <span className="text-brand-navy/40 font-normal">Following</span>
            </button>
            <span className="text-brand-navy/20">•</span>
            <button onClick={() => { setFollowModalTab('followers'); setShowFollowModal(true); }} className="flex items-center gap-1 font-bold hover:text-brand-gold transition-colors">
              <span>{followers.length + storeFollowerCount}</span>
              <span className="text-brand-navy/40 font-normal">Followers</span>
            </button>
          </div>
        )}

        {/* Posts */}
        <div className="flex p-1 glass-card rounded-2xl">
          <button onClick={() => setActiveSubTab('posts')}
            className={cn("flex-1 py-3 rounded-xl text-xs font-bold transition-all", activeSubTab === 'posts' ? "bg-brand-navy text-white shadow-lg" : "text-brand-navy/40")}>
            Posts
          </button>
          <button onClick={() => setActiveSubTab('interactions')}
            className={cn("flex-1 py-3 rounded-xl text-xs font-bold transition-all", activeSubTab === 'interactions' ? "bg-brand-navy text-white shadow-lg" : "text-brand-navy/40")}>
            Interactions
          </button>
        </div>

        {activeSubTab === 'posts' && (() => {
          const merged = [
            ...myGlobalPosts.map(p => ({ _type: 'global' as const, _ts: p.createdAt?.toMillis?.() ?? 0, data: p })),
            ...storeWallPosts.map(p => ({ _type: 'wall' as const, _ts: p.createdAt?.toMillis?.() ?? 0, data: p })),
          ].sort((a, b) => b._ts - a._ts);
          return (
            <div className="space-y-4">
              {merged.map(item =>
                item._type === 'global' ? (
                  <FeedPostCard key={item.data.id} post={item.data} currentUser={user} onViewUser={onViewUser}
                    onLike={async (p) => { const ref = doc(db, 'global_posts', p.id); const liked = (p.likedBy || []).includes(user.uid); await updateDoc(ref, { likedBy: liked ? arrayRemove(user.uid) : arrayUnion(user.uid), likesCount: liked ? Math.max(0, p.likesCount - 1) : p.likesCount + 1 }); }}
                    onVote={async (p, idx) => { const ref = doc(db, 'global_posts', p.id); const votes = p.pollVotes || {}; const oldKey = Object.keys(votes).find(k => (votes[k] || []).includes(user.uid)); const updates: any = { [`pollVotes.${idx}`]: arrayUnion(user.uid) }; if (oldKey !== undefined && oldKey !== String(idx)) updates[`pollVotes.${oldKey}`] = arrayRemove(user.uid); await updateDoc(ref, updates); }}
                  />
                ) : (
                  <div key={item.data.id} className="glass-card p-5 rounded-[2rem] space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full overflow-hidden border border-brand-navy/5 bg-indigo-50 shrink-0 flex items-center justify-center">
                        <PixelAvatar uid={item.data.authorUid} size={36} view="head" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug">
                          <span className="font-bold cursor-pointer hover:text-brand-gold transition-colors"
                            onClick={async () => { const snap = await getDoc(doc(db, 'users', item.data.authorUid)).catch(() => null); if (snap?.exists()) onViewUser({ uid: snap.id, ...snap.data() } as UserProfile); }}>
                            {item.data.authorName}
                          </span>
                          <span className="text-brand-navy/30 mx-1">›</span>
                          <span className="font-bold text-brand-gold">{vendorStore?.name || profile.name}</span>
                        </p>
                        <p className="text-[10px] text-brand-navy/40 font-medium">{item.data.createdAt ? format(item.data.createdAt.toDate(), 'MMM d · h:mm a') : 'Just now'}</p>
                      </div>
                    </div>
                    <p className="text-sm text-brand-navy/80 leading-relaxed">{item.data.content}</p>
                  </div>
                )
              )}
              {merged.length === 0 && <div className="py-16 text-center text-brand-navy/20"><MessageSquare size={48} className="mx-auto mb-3 opacity-10" /><p className="font-bold text-sm">No posts yet</p></div>}
            </div>
          );
        })()}

        {activeSubTab === 'interactions' && (() => {
          const votedPolls = allPostsForVotes.filter(p => Object.values(p.pollVotes || {}).some(arr => (arr as string[]).includes(profile.uid)));
          return (
            <div className="space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold px-1 flex items-center gap-2"><Heart size={12} fill="currentColor" /> Liked ({likedPosts.length})</p>
              {likedPosts.map(post => (
                <FeedPostCard key={post.id} post={post} currentUser={user} onViewUser={onViewUser}
                  onLike={async (p) => { const ref = doc(db, 'global_posts', p.id); const liked = (p.likedBy || []).includes(user.uid); await updateDoc(ref, { likedBy: liked ? arrayRemove(user.uid) : arrayUnion(user.uid), likesCount: liked ? Math.max(0, p.likesCount - 1) : p.likesCount + 1 }); }}
                  onVote={async (p, idx) => { const ref = doc(db, 'global_posts', p.id); const votes = p.pollVotes || {}; const oldKey = Object.keys(votes).find(k => (votes[k] || []).includes(user.uid)); const updates: any = { [`pollVotes.${idx}`]: arrayUnion(user.uid) }; if (oldKey !== undefined && oldKey !== String(idx)) updates[`pollVotes.${oldKey}`] = arrayRemove(user.uid); await updateDoc(ref, updates); }}
                />
              ))}
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold px-1 flex items-center gap-2 mt-4"><BarChart2 size={12} /> Votes Cast ({votedPolls.length})</p>
              {votedPolls.map(post => (
                <FeedPostCard key={post.id} post={post} currentUser={user} onViewUser={onViewUser}
                  onLike={async (p) => { const ref = doc(db, 'global_posts', p.id); const liked = (p.likedBy || []).includes(user.uid); await updateDoc(ref, { likedBy: liked ? arrayRemove(user.uid) : arrayUnion(user.uid), likesCount: liked ? Math.max(0, p.likesCount - 1) : p.likesCount + 1 }); }}
                  onVote={async (p, idx) => { const ref = doc(db, 'global_posts', p.id); const votes = p.pollVotes || {}; const oldKey = Object.keys(votes).find(k => (votes[k] || []).includes(user.uid)); const updates: any = { [`pollVotes.${idx}`]: arrayUnion(user.uid) }; if (oldKey !== undefined && oldKey !== String(idx)) updates[`pollVotes.${oldKey}`] = arrayRemove(user.uid); await updateDoc(ref, updates); }}
                />
              ))}
            </div>
          );
        })()}

        <AnimatePresence>
          {showFollowModal && (
            <Modal title={followModalTab === 'following' ? `Following (${following.length})` : `Followers (${followers.length})`} onClose={() => setShowFollowModal(false)}>
              <div className="space-y-4">
                <div className="flex p-1 bg-brand-bg rounded-2xl">
                  <button onClick={() => setFollowModalTab('following')} className={cn("flex-1 py-2.5 rounded-xl text-xs font-bold transition-all", followModalTab === 'following' ? "bg-brand-navy text-white shadow" : "text-brand-navy/40")}>Following ({following.length})</button>
                  <button onClick={() => setFollowModalTab('followers')} className={cn("flex-1 py-2.5 rounded-xl text-xs font-bold transition-all", followModalTab === 'followers' ? "bg-brand-navy text-white shadow" : "text-brand-navy/40")}>Followers ({followers.length})</button>
                </div>
                <div className="space-y-2">
                  {(followModalTab === 'following' ? following : followers).map(u => (
                    <div key={u.uid} className="flex items-center gap-3 p-3 rounded-2xl bg-brand-bg cursor-pointer" onClick={() => { onViewUser(u); setShowFollowModal(false); }}>
                      <div className="w-10 h-10 rounded-2xl overflow-hidden border border-brand-navy/5 shrink-0 bg-indigo-50 flex items-center justify-center"><PixelAvatar config={u.avatar} uid={u.uid} size={40} view="head" /></div>
                      <div>
                        <div className="flex items-center gap-1"><p className="font-bold text-sm">{u.name}</p><StreakBadge streak={u.streak} /></div>
                        <p className="text-[10px] text-brand-navy/40 font-bold uppercase">@{u.email?.split('@')[0]}</p>
                      </div>
                    </div>
                  ))}
                  {(followModalTab === 'following' ? following : followers).length === 0 && <p className="text-xs text-brand-navy/40 text-center py-8">{followModalTab === 'following' ? 'Not following anyone yet' : 'No followers yet'}</p>}
                </div>
              </div>
            </Modal>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Consumer profile layout ──
  return (
    <div className="space-y-6 pb-20 text-brand-navy">
      {/* Avatar customiser modal */}
      <AnimatePresence>
        {avatarViewOpen && (
          <AvatarViewModal
            avatar={profile.avatar}
            uid={profile.uid}
            onClose={() => setAvatarViewOpen(false)}
            onCustomise={() => {
              setAvatarViewOpen(false);
              setAvatarCustomiserOpen(true);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {avatarCustomiserOpen && profile.avatar && (
          <AvatarCustomiserModal
            avatar={profile.avatar}
            onClose={() => setAvatarCustomiserOpen(false)}
            onSave={async (updated) => {
              await updateDoc(doc(db, 'users', profile.uid), { avatar: updated });
              setAvatarCustomiserOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      <header className="relative">
        <button onClick={() => setShowProfileSettings(true)}
          className="absolute right-0 top-0 p-2 rounded-2xl bg-white border border-brand-navy/10 shadow-sm active:scale-95 transition-all">
          <Settings size={18} className="text-brand-navy/60" />
        </button>

        <div className="flex items-start gap-4">
          {/* Photo — top left */}
          <div className="flex flex-col items-center shrink-0">
            <button
              onClick={() => {
                if (!profile.avatar) {
                  updateDoc(doc(db, 'users', profile.uid), { avatar: deriveAvatarFromUid(profile.uid) })
                    .then(() => setAvatarViewOpen(true));
                } else {
                  setAvatarViewOpen(true);
                }
              }}
              className="bg-gradient-to-b from-indigo-50 to-purple-50 rounded-full p-2 border-4 border-white shadow-xl active:scale-95 transition-all"
            >
              <PixelAvatar config={profile.avatar} uid={profile.uid} size={64} view="head" />
            </button>
            <div className="flex items-center gap-1 mt-1.5">
              <p className="text-[8px] text-brand-navy/40 font-bold uppercase tracking-wider">tap to customise</p>
            </div>
          </div>

          {/* Name, handle, followers — right of photo */}
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-2xl font-bold">{profile.name}</h2>
              <StreakBadge streak={profile.streak} size="lg" />
            </div>
            <p className="text-brand-gold font-bold text-xs uppercase tracking-[0.2em]">@{profile.handle || user.email?.split('@')[0]}</p>
            <div className="flex items-center gap-3 mt-2 text-sm">
              <button onClick={() => { setFollowModalTab('following'); setShowFollowModal(true); }} className="flex items-center gap-1 font-bold hover:text-brand-gold transition-colors">
                <span>{following.length}</span>
                <span className="text-brand-navy/40 font-normal">Following</span>
              </button>
              <span className="text-brand-navy/20">•</span>
              <button onClick={() => { setFollowModalTab('followers'); setShowFollowModal(true); }} className="flex items-center gap-1 font-bold hover:text-brand-gold transition-colors">
                <span>{followers.length}</span>
                <span className="text-brand-navy/40 font-normal">Followers</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {settingsModal}

      {/* Compact stats — centered text */}
      <div className="flex gap-2">
        {[
          { val: lifetimeStamps,    label: 'Stamps'  },
          { val: archivedCardsCount, label: 'Rewards' },
          { val: activeCardsCount,  label: 'Cards'   },
        ].map(s => (
          <div key={s.label} className="flex-1 rounded-2xl px-3 py-2.5 flex flex-col items-center gap-0.5" style={{ background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 50%, #3B82F6 100%)' }}>
            <p className="font-bold text-sm leading-none text-white">{s.val}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5 text-white/60">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Badges swipe row */}
      {earnedBadges.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40 mb-2.5 text-center">Badges</p>
          <BadgeSwipeRow badges={earnedBadges} onSelectBadge={setSelectedBadge} />
        </div>
      )}


      {/* Badge detail sheet */}
      <AnimatePresence>
        {selectedBadge && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-end max-w-md mx-auto"
            onClick={() => setSelectedBadge(null)}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              className="w-full bg-brand-bg rounded-t-3xl p-6 pb-10 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-[1.25rem] flex items-center justify-center text-3xl shadow-lg shrink-0"
                  style={{ background: `linear-gradient(135deg, ${selectedBadge.color}ee, ${selectedBadge.color}99)` }}
                >{selectedBadge.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-brand-navy text-lg leading-tight">{selectedBadge.name}</p>
                  <p className="text-xs text-brand-navy/50 mt-1">{BADGE_METRIC_LABELS[selectedBadge.metric]} ≥ {selectedBadge.threshold}</p>
                </div>
              </div>
              {selectedBadge.description ? (
                <p className="text-sm text-brand-navy/70 leading-relaxed">{selectedBadge.description}</p>
              ) : null}
              <button onClick={() => setSelectedBadge(null)} className="w-full py-3 rounded-2xl bg-brand-navy/8 text-brand-navy font-bold text-sm active:scale-[0.98] transition-all">Close</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* My challenges */}
      {myChallenges.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40 px-1">Challenges</p>
          <div className="space-y-2">
            {myChallenges.map(c => {
              const entry = profileEntries.get(c.id);
              if (entry?.redeemed) return null;
              let progress = 0;
              if (entry) {
                if (c.vendorIds?.length) {
                  progress = Math.min(c.goal, entry.count || 0);
                } else {
                  progress = Math.max(0, Math.min(c.goal, (profile.totalStamps || 0) - (entry.totalStampsAtJoin || 0)));
                }
              }
              const pct = c.goal > 0 ? Math.min(100, Math.round((progress / c.goal) * 100)) : 0;
              const done = pct >= 100;
              return (
                <div key={c.id} className="gradient-logo-blue rounded-2xl px-4 py-3 pb-4 relative overflow-hidden shadow-lg space-y-2">
                  <span className="shine-ray" aria-hidden="true" />
                  <div className="flex items-center justify-between gap-2 relative z-10">
                    <p className="text-xs font-bold leading-tight line-clamp-1 flex-1 text-white">{c.title}</p>
                    <span className={cn('text-[10px] font-bold shrink-0', done ? 'text-green-300' : 'text-white/80')}>{done ? '✓ Done' : `${pct}%`}</span>
                  </div>
                  <div className="h-1.5 bg-white/20 rounded-full overflow-hidden relative z-10">
                    <motion.div
                      className={cn('h-full rounded-full', done ? 'bg-green-400' : 'bg-white')}
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                  <p className="text-[9px] font-medium text-white/60 relative z-10">{progress} / {c.goal} {c.unit} · 🎁 {c.reward}</p>
                  {done && entry && (
                    <button
                      onClick={() => setProfileRedeemingChallenge({ challenge: c, entry, userName: profile.name || '' })}
                      className="w-full py-2.5 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-white font-bold text-xs relative z-10 active:scale-95 transition-all"
                    >
                      🏆 Redeem Now
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Redeemed challenges */}
          {myChallenges.some(c => profileEntries.get(c.id)?.redeemed) && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40 px-1">Redeemed</p>
              {myChallenges.filter(c => profileEntries.get(c.id)?.redeemed).map(c => (
                <div key={c.id} className="rounded-2xl bg-white border border-brand-navy/8 px-4 py-3 flex items-center gap-3 opacity-60">
                  <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                    <Trophy size={14} className="text-green-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-brand-navy truncate">{c.title}</p>
                    <p className="text-[10px] text-brand-navy/40">🎁 {c.reward}</p>
                  </div>
                  <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full shrink-0">Redeemed</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {profileRedeemingChallenge && (
          <ChallengeRedeemModal
            challenge={profileRedeemingChallenge.challenge}
            entry={profileRedeemingChallenge.entry}
            userName={profileRedeemingChallenge.userName}
            onClose={() => setProfileRedeemingChallenge(null)}
          />
        )}
      </AnimatePresence>

      <div className="flex p-1 glass-card rounded-2xl">
        <button
          onClick={() => setActiveSubTab('posts')}
          className={cn("flex-1 py-3 rounded-xl text-xs font-bold transition-all", activeSubTab === 'posts' ? "bg-brand-navy text-white shadow-lg" : "text-brand-navy/40")}
        >
          Posts
        </button>
        <button
          onClick={() => setActiveSubTab('interactions')}
          className={cn("flex-1 py-3 rounded-xl text-xs font-bold transition-all", activeSubTab === 'interactions' ? "bg-brand-navy text-white shadow-lg" : "text-brand-navy/40")}
        >
          Interactions
        </button>
      </div>

      <AnimatePresence>
        {profilePendingPack && (
          <PackOpeningModal stickers={profilePendingPack} uid={user.uid} onClose={() => setProfilePendingPack(null)} />
        )}
      </AnimatePresence>

      {activeSubTab === 'posts' && (
        <div className="space-y-6">
          {/* Post composer */}
          <div className="glass-card p-5 rounded-[2rem] space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-brand-navy/10 bg-indigo-50 flex items-center justify-center">
                <PixelAvatar config={profile?.avatar} uid={profile?.uid} size={36} view="head" />
              </div>
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="What's on your mind?"
                className="flex-1 p-3 rounded-2xl bg-brand-bg border-none focus:ring-2 focus:ring-brand-gold/20 text-sm h-20 resize-none"
              />
            </div>
            <button
              onClick={handlePostOnWall}
              disabled={isPosting || !newPost.trim()}
              className="w-full bg-brand-navy text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
            >
              <Plus size={16} /> {isPosting ? 'Posting...' : 'Post'}
            </button>
          </div>

          {/* Posts feed */}
          {myGlobalPosts.length > 0 && (
            <div className="space-y-4">
              {myGlobalPosts.map(post => (
                <FeedPostCard
                  key={post.id}
                  post={post}
                  currentUser={user}
                  onViewUser={onViewUser}
                  onLike={async (p) => {
                    const ref = doc(db, 'global_posts', p.id);
                    const liked = (p.likedBy || []).includes(user.uid);
                    await updateDoc(ref, {
                      likedBy: liked ? arrayRemove(user.uid) : arrayUnion(user.uid),
                      likesCount: liked ? Math.max(0, p.likesCount - 1) : p.likesCount + 1
                    });
                  }}
                  onVote={async (p, idx) => {
                    const ref = doc(db, 'global_posts', p.id);
                    const votes = p.pollVotes || {};
                    const oldKey = Object.keys(votes).find(k => (votes[k] || []).includes(user.uid));
                    const updates: any = { [`pollVotes.${idx}`]: arrayUnion(user.uid) };
                    if (oldKey !== undefined && oldKey !== String(idx)) updates[`pollVotes.${oldKey}`] = arrayRemove(user.uid);
                    await updateDoc(ref, updates);
                  }}
                />
              ))}
            </div>
          )}

          {/* Infinite scroll sentinel for profile posts */}
          <div ref={profileSentinelRef} className="h-4" />
          {profileLoadingMore && (
            <div className="flex justify-center py-4">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
                <Sparkles className="w-5 h-5 text-brand-gold/50" />
              </motion.div>
            </div>
          )}

          {myGlobalPosts.length === 0 && (
            <div className="py-20 text-center text-brand-navy/20">
              <MessageSquare size={64} className="mx-auto mb-4 opacity-5" />
              <p className="font-bold">Nothing posted yet</p>
              <p className="text-xs">Use the + button or post to your wall above</p>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'interactions' && (() => {
        const votedPolls = allPostsForVotes.filter(p =>
          Object.values(p.pollVotes || {}).some(arr => (arr as string[]).includes(profile.uid))
        );
        return (
          <div className="space-y-6">
            {/* Liked posts */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold px-1 flex items-center gap-2">
                <Heart size={12} fill="currentColor" /> Liked ({likedPosts.length})
              </p>
              {likedPosts.length === 0 ? (
                <div className="glass-card rounded-2xl p-6 text-center text-brand-navy/30 text-sm">Nothing liked yet</div>
              ) : likedPosts.map(post => (
                <FeedPostCard
                  key={post.id}
                  post={post}
                  currentUser={user}
                  onViewUser={onViewUser}
                  onLike={async (p) => {
                    const ref = doc(db, 'global_posts', p.id);
                    const liked = (p.likedBy || []).includes(user.uid);
                    await updateDoc(ref, {
                      likedBy: liked ? arrayRemove(user.uid) : arrayUnion(user.uid),
                      likesCount: liked ? Math.max(0, p.likesCount - 1) : p.likesCount + 1
                    });
                  }}
                  onVote={async (p, idx) => {
                    const ref = doc(db, 'global_posts', p.id);
                    const votes = p.pollVotes || {};
                    const oldKey = Object.keys(votes).find(k => (votes[k] || []).includes(user.uid));
                    const updates: any = { [`pollVotes.${idx}`]: arrayUnion(user.uid) };
                    if (oldKey !== undefined && oldKey !== String(idx)) updates[`pollVotes.${oldKey}`] = arrayRemove(user.uid);
                    await updateDoc(ref, updates);
                  }}
                />
              ))}
            </div>

            {/* Voted polls */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold px-1 flex items-center gap-2">
                <BarChart2 size={12} /> Votes Cast ({votedPolls.length})
              </p>
              {votedPolls.length === 0 ? (
                <div className="glass-card rounded-2xl p-6 text-center text-brand-navy/30 text-sm">No polls voted in yet</div>
              ) : votedPolls.map(post => (
                <FeedPostCard
                  key={post.id}
                  post={post}
                  currentUser={user}
                  onViewUser={onViewUser}
                  onLike={async (p) => {
                    const ref = doc(db, 'global_posts', p.id);
                    const liked = (p.likedBy || []).includes(user.uid);
                    await updateDoc(ref, {
                      likedBy: liked ? arrayRemove(user.uid) : arrayUnion(user.uid),
                      likesCount: liked ? Math.max(0, p.likesCount - 1) : p.likesCount + 1
                    });
                  }}
                  onVote={async (p, idx) => {
                    const ref = doc(db, 'global_posts', p.id);
                    const votes = p.pollVotes || {};
                    const oldKey = Object.keys(votes).find(k => (votes[k] || []).includes(user.uid));
                    const updates: any = { [`pollVotes.${idx}`]: arrayUnion(user.uid) };
                    if (oldKey !== undefined && oldKey !== String(idx)) updates[`pollVotes.${oldKey}`] = arrayRemove(user.uid);
                    await updateDoc(ref, updates);
                  }}
                />
              ))}
            </div>
          </div>
        );
      })()}

      <AnimatePresence>
        {showFollowModal && (
          <Modal title={followModalTab === 'following' ? `Following (${following.length})` : `Followers (${followers.length})`} onClose={() => setShowFollowModal(false)}>
            <div className="space-y-4">
              <div className="flex p-1 bg-brand-bg rounded-2xl">
                <button
                  onClick={() => setFollowModalTab('following')}
                  className={cn("flex-1 py-2.5 rounded-xl text-xs font-bold transition-all", followModalTab === 'following' ? "bg-brand-navy text-white shadow" : "text-brand-navy/40")}
                >
                  Following ({following.length})
                </button>
                <button
                  onClick={() => setFollowModalTab('followers')}
                  className={cn("flex-1 py-2.5 rounded-xl text-xs font-bold transition-all", followModalTab === 'followers' ? "bg-brand-navy text-white shadow" : "text-brand-navy/40")}
                >
                  Followers ({followers.length})
                </button>
              </div>

              <div className="space-y-2">
                {(followModalTab === 'following' ? following : followers).map(u => (
                  <div key={u.uid} className="flex items-center justify-between p-3 rounded-2xl bg-brand-bg hover:bg-brand-gold/5 transition-colors group">
                    <div
                      className="flex items-center gap-3 flex-1 cursor-pointer"
                      onClick={() => { onViewUser(u); setShowFollowModal(false); }}
                    >
                      <div className="w-10 h-10 rounded-2xl overflow-hidden border border-brand-navy/5 shrink-0 bg-indigo-50 flex items-center justify-center">
                        <PixelAvatar config={u.avatar} uid={u.uid} size={40} view="head" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1"><p className="font-bold text-sm group-hover:text-brand-gold transition-colors">{u.name}</p><StreakBadge streak={u.streak} /></div>
                        <p className="text-[10px] text-brand-navy/40 font-bold uppercase tracking-widest">@{u.email?.split('@')[0]}</p>
                      </div>
                    </div>
                    {followModalTab === 'following' && (
                      <button
                        onClick={async () => {
                          const followId = `${profile.uid}_${u.uid}`;
                          await deleteDoc(doc(db, 'follows', followId));
                        }}
                        className="px-3 py-1.5 rounded-xl border border-brand-navy/10 text-xs font-bold text-brand-navy/50 hover:border-brand-gold/50 hover:text-brand-gold transition-all ml-2 shrink-0"
                      >
                        Unfollow
                      </button>
                    )}
                  </div>
                ))}
                {(followModalTab === 'following' ? following : followers).length === 0 && (
                  <p className="text-xs text-brand-navy/40 text-center py-8">
                    {followModalTab === 'following' ? 'Not following anyone yet' : 'No followers yet'}
                  </p>
                )}
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

const THEME_COLOURS = [
  { label: 'Navy',   value: '#1e3a5f' },
  { label: 'Gold',   value: '#f59e0b' },
  { label: 'Rose',   value: '#f43f5e' },
  { label: 'Green',  value: '#10b981' },
  { label: 'Purple', value: '#8b5cf6' },
  { label: 'Blue',   value: '#3b82f6' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Teal',   value: '#14b8a6' },
];

const CATEGORIES: Category[] = ['Food', 'Beauty', 'Barber', 'Gym', 'Parking', 'Retail'];

function ToggleSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={cn('w-12 h-7 rounded-full transition-all relative shrink-0', on ? 'bg-green-500' : 'bg-brand-navy/20')}
    >
      <span className={cn('absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all', on ? 'left-6' : 'left-1')} />
    </button>
  );
}

function ProfileSettingsModal({ profile, user, onClose, onLogout, onDeleteAccount }: { profile: UserProfile, user: FirebaseUser, onClose: () => void, onLogout: () => void, onDeleteAccount: () => Promise<void> }) {
  const [name, setName] = useState(profile.name || '');
  const [handle, setHandle] = useState(profile.handle || user.email?.split('@')[0] || '');
  const [gender, setGender] = useState(profile.gender || '');
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [storeName, setStoreName] = useState('');
  const [storeReward, setStoreReward] = useState('');
  const [storeCategory, setStoreCategory] = useState<Category>('Food');
  const [storeTheme, setStoreTheme] = useState('#1e3a5f');
  const [storeLogo, setStoreLogo] = useState('');
  const [logoFetchUrl, setLogoFetchUrl] = useState('');
  const [logoFetching, setLogoFetching] = useState(false);
  const [logoFetchError, setLogoFetchError] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [storeLocation, setStoreLocation] = useState('');
  const [visibility, setVisibility] = useState({ members: true, stamps: true, activeCards: true, returnRate: true, followers: true });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (profile.role !== 'vendor') return;
    const q = query(collection(db, 'stores'), where('ownerUid', '==', profile.uid));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const s = { id: snap.docs[0].id, ...snap.docs[0].data() } as StoreProfile;
        setStore(s);
        setStoreName(s.name || '');
        setStoreReward(s.reward || '');
        setStoreCategory(s.category || 'Food');
        setStoreTheme(s.theme || '#1e3a5f');
        setStoreLogo(s.logoUrl || '');
        setStoreLocation(s.location || s.address || '');
        setVisibility({ members: true, stamps: true, activeCards: true, returnRate: true, followers: true, ...(s.visibilitySettings || {}) });
      }
    });
    return unsub;
  }, [profile.uid, profile.role]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const profileUpdates: any = { name, ...(gender ? { gender } : {}) };
      await updateDoc(doc(db, 'users', profile.uid), profileUpdates);

      if (profile.role === 'vendor' && store) {
        await updateDoc(doc(db, 'stores', store.id), {
          name: storeName, reward: storeReward, category: storeCategory, theme: storeTheme,
          logoUrl: storeLogo, location: storeLocation, address: storeLocation, visibilitySettings: visibility,
        });
      }

      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1000);
    } catch (err) {
      console.error('Save profile error:', err);
    } finally {
      setSaving(false);
    }
  };

  const visibilityItems: { key: keyof typeof visibility; label: string }[] = [
    { key: 'members', label: 'Members' },
    { key: 'stamps', label: 'Stamps Given' },
    { key: 'activeCards', label: 'Active Cards' },
    { key: 'returnRate', label: 'Return Rate' },
    { key: 'followers', label: 'Followers & Following' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 bg-brand-bg z-[200] flex flex-col max-w-md mx-auto"
    >
      <header className="glass-panel px-6 py-4 flex items-center gap-4">
        <button onClick={onClose} className="p-2 -ml-2 text-brand-navy/60"><ArrowLeft size={24} /></button>
        <h2 className="font-display text-xl font-bold flex-1">Edit Profile</h2>
        <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-brand-navy text-white rounded-2xl font-bold text-sm disabled:opacity-50 active:scale-95 transition-all">
          {saved ? 'Saved!' : saving ? 'Saving…' : 'Save'}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 pb-12">

        {/* Avatar preview (customiser is on Profile tab) */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-brand-navy/50 uppercase tracking-widest">Avatar</label>
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="bg-gradient-to-b from-indigo-50 to-purple-50 rounded-[1.5rem] p-3 shadow-inner">
              <PixelAvatar config={profile.avatar} uid={profile.uid} size={64} view="full" />
            </div>
            <p className="text-xs text-brand-navy/40">Customise your avatar on the Profile tab</p>
          </div>
        </div>

        {/* Name */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-brand-navy/50 uppercase tracking-widest">Display Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
            className="w-full px-5 py-4 rounded-2xl bg-white border border-brand-navy/10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-gold/30" />
        </div>

        {/* Handle — read-only */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-brand-navy/50 uppercase tracking-widest">Handle</label>
            <span className="text-[10px] text-brand-navy/30 flex items-center gap-1"><Lock size={9} /> Cannot be changed</span>
          </div>
          <div className="w-full px-5 py-4 rounded-2xl bg-brand-navy/5 border border-brand-navy/10 text-sm font-medium text-brand-navy/60 flex items-center gap-1">
            <span className="text-brand-navy/30">@</span>{handle || profile.handle || '—'}
          </div>
        </div>

        {/* Consumer info fields — read-only */}
        {profile.role === 'consumer' && (
          <div className="space-y-4">
            <SectionLabel icon={<UserIcon size={14} className="text-brand-gold" />} label="Your Information" />
            <div className="space-y-3">
              {/* Email */}
              <div className="flex items-center justify-between bg-white px-5 py-4 rounded-2xl border border-brand-navy/10">
                <div className="flex items-center gap-3">
                  <Mail size={15} className="text-brand-navy/30 shrink-0" />
                  <span className="text-xs font-bold text-brand-navy/40 uppercase tracking-widest">Email</span>
                </div>
                <span className="text-sm text-brand-navy/70 font-medium truncate max-w-[160px]">{profile.email}</span>
              </div>
              {/* Gender */}
              <div className="flex items-center justify-between bg-white px-5 py-4 rounded-2xl border border-brand-navy/10">
                <div className="flex items-center gap-3">
                  <UserCheck size={15} className="text-brand-navy/30 shrink-0" />
                  <span className="text-xs font-bold text-brand-navy/40 uppercase tracking-widest">Gender</span>
                </div>
                <span className="text-sm text-brand-navy/70 font-medium">{profile.gender || '—'}</span>
              </div>
              {/* Birthday */}
              <div className="flex items-center justify-between bg-white px-5 py-4 rounded-2xl border border-brand-navy/10">
                <div className="flex items-center gap-3">
                  <Calendar size={15} className="text-brand-navy/30 shrink-0" />
                  <span className="text-xs font-bold text-brand-navy/40 uppercase tracking-widest">Birthday</span>
                </div>
                <span className="text-sm text-brand-navy/70 font-medium">
                  {profile.birthday ? new Date(profile.birthday).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </span>
              </div>
              {/* Location */}
              <div className="flex items-center justify-between bg-white px-5 py-4 rounded-2xl border border-brand-navy/10">
                <div className="flex items-center gap-3">
                  <MapPin size={15} className="text-brand-navy/30 shrink-0" />
                  <span className="text-xs font-bold text-brand-navy/40 uppercase tracking-widest">Location</span>
                </div>
                <span className="text-sm text-brand-navy/70 font-medium">{profile.location?.city || '—'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Business Fields */}
        {profile.role === 'vendor' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

            <SectionLabel icon={<Building2 size={14} className="text-brand-gold" />} label="Business Details" />

            <div className="space-y-2">
              <label className="text-xs font-bold text-brand-navy/50 uppercase tracking-widest">Business Name</label>
              <input value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="Your business name"
                className="w-full px-5 py-4 rounded-2xl bg-white border border-brand-navy/10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-gold/30" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-brand-navy/50 uppercase tracking-widest">Stamp Card Reward</label>
              <input value={storeReward} onChange={e => setStoreReward(e.target.value)} placeholder="e.g. Free coffee, Free class"
                className="w-full px-5 py-4 rounded-2xl bg-white border border-brand-navy/10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-gold/30" />
              <p className="text-[10px] text-brand-navy/30 px-1">Shown on the Hot tab so customers know what they earn</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-brand-navy/50 uppercase tracking-widest">Category</label>
              <div className="relative">
                <select value={storeCategory} onChange={e => setStoreCategory(e.target.value as Category)}
                  className="w-full px-5 py-4 rounded-2xl bg-white border border-brand-navy/10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-gold/30 appearance-none pr-10">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-navy/40 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-brand-navy/50 uppercase tracking-widest">
                  Business Address <span className="text-red-400">*</span>
                </label>
                {!storeLocation && (
                  <span className="text-[10px] font-bold text-brand-gold bg-brand-gold/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <MapPin size={9} /> Required for nearby discovery
                  </span>
                )}
              </div>
              <div className="relative">
                <MapPin size={15} className={cn("absolute left-4 top-1/2 -translate-y-1/2", storeLocation ? "text-brand-navy/30" : "text-brand-gold")} />
                <input
                  value={storeLocation}
                  onChange={e => setStoreLocation(e.target.value)}
                  placeholder="e.g. 123 High Street, London, UK"
                  className={cn(
                    "w-full pl-10 pr-5 py-4 rounded-2xl bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-gold/30 border",
                    storeLocation ? "border-brand-navy/10" : "border-brand-gold/50"
                  )}
                />
              </div>
              {!storeLocation && (
                <p className="text-[11px] text-brand-navy/40 pl-1">Enter your full address so customers nearby can discover you in the Hot tab.</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-brand-navy/50 uppercase tracking-widest">Logo</label>

              {/* Fetch from website */}
              <div className="flex gap-2">
                <input
                  value={logoFetchUrl}
                  onChange={e => { setLogoFetchUrl(e.target.value); setLogoFetchError(''); }}
                  placeholder="yourwebsite.com"
                  className="flex-1 px-4 py-3 rounded-2xl bg-white border border-brand-navy/10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-gold/30"
                />
                <button
                  type="button"
                  disabled={logoFetching || !logoFetchUrl.trim()}
                  onClick={async () => {
                    setLogoFetching(true);
                    setLogoFetchError('');
                    try {
                      let raw = logoFetchUrl.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
                      const clearbitUrl = `https://logo.clearbit.com/${raw}`;
                      const res = await fetch(clearbitUrl);
                      if (res.ok) {
                        setStoreLogo(clearbitUrl);
                      } else {
                        const fallback = `https://www.google.com/s2/favicons?domain=${raw}&sz=128`;
                        setStoreLogo(fallback);
                      }
                    } catch {
                      setLogoFetchError('Could not fetch logo — paste the URL manually below.');
                    } finally {
                      setLogoFetching(false);
                    }
                  }}
                  className="px-4 py-3 rounded-2xl bg-brand-navy text-white text-xs font-bold shrink-0 disabled:opacity-40 active:scale-95 transition-all"
                >
                  {logoFetching ? '...' : 'Fetch Logo'}
                </button>
              </div>
              {logoFetchError && <p className="text-[11px] text-red-500 pl-1">{logoFetchError}</p>}

              {/* Upload from device */}
              <div className="flex gap-3 items-center">
                <label className={cn('flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-brand-navy/20 text-sm font-semibold text-brand-navy/50 cursor-pointer transition-all', logoUploading ? 'opacity-50 pointer-events-none' : 'hover:border-brand-gold/50 hover:text-brand-navy active:scale-[0.98]')}>
                  {logoUploading ? 'Uploading...' : '📁 Upload from device'}
                  <input type="file" accept="image/*" className="hidden" onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setLogoUploading(true);
                    try {
                      const path = `store_logos/${user.uid}/${Date.now()}_${file.name}`;
                      const snap = await uploadBytes(storageRef(storage, path), file);
                      const url = await getDownloadURL(snap.ref);
                      setStoreLogo(url);
                    } catch {
                      setLogoFetchError('Upload failed — check your connection and try again.');
                    } finally {
                      setLogoUploading(false);
                    }
                  }} />
                </label>
                {storeLogo && (
                  <div className="w-14 h-14 rounded-2xl overflow-hidden border border-brand-navy/10 shrink-0">
                    <img src={storeLogo} alt="" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                  </div>
                )}
              </div>

              {/* Manual URL override — only show when no logo set */}
              {!storeLogo && (
                <input value={storeLogo} onChange={e => setStoreLogo(e.target.value)} placeholder="Or paste logo URL directly..."
                  className="w-full px-5 py-4 rounded-2xl bg-white border border-brand-navy/10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-gold/30" />
              )}
            </div>

            {/* Colour Theme */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-brand-navy/50 uppercase tracking-widest">Brand Colour</label>
                <Palette size={13} className="text-brand-navy/30" />
              </div>
              <div className="grid grid-cols-4 gap-3">
                {THEME_COLOURS.map(c => (
                  <button key={c.value} onClick={() => setStoreTheme(c.value)}
                    className={cn("h-12 rounded-2xl transition-all active:scale-95 relative", storeTheme === c.value ? "ring-4 ring-offset-2 ring-brand-navy/30 scale-105" : "")}
                    style={{ backgroundColor: c.value }}>
                    {storeTheme === c.value && <CheckCircle2 size={16} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow" />}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-brand-navy/40 font-bold">Custom</label>
                <input type="color" value={storeTheme} onChange={e => setStoreTheme(e.target.value)}
                  className="w-10 h-10 rounded-xl border border-brand-navy/10 cursor-pointer p-1 bg-white" />
                <span className="text-sm font-mono text-brand-navy/60">{storeTheme}</span>
              </div>
            </div>

            {/* Public Visibility */}
            <div className="space-y-3">
              <SectionLabel icon={<Settings size={14} className="text-brand-gold" />} label="Public Visibility" />
              <p className="text-xs text-brand-navy/40">Choose which stats are visible on your public profile.</p>
              <div className="space-y-3">
                {visibilityItems.map(item => (
                  <div key={item.key} className="flex items-center justify-between bg-white px-5 py-4 rounded-2xl border border-brand-navy/10">
                    <span className="text-sm font-medium">{item.label}</span>
                    <ToggleSwitch on={visibility[item.key]} onChange={v => setVisibility(prev => ({ ...prev, [item.key]: v }))} />
                  </div>
                ))}
              </div>
            </div>

          </motion.div>
        )}

        {/* Account Actions */}
        <div className="pt-4 border-t border-brand-navy/10 space-y-3">
          <button
            onClick={onLogout}
            className="w-full py-4 px-5 rounded-2xl text-red-500 font-bold text-sm flex items-center gap-3 hover:bg-red-50 transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-4 px-5 rounded-2xl text-red-400/70 text-sm flex items-center gap-3 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={18} />
            Delete Account
          </button>
        </div>

      </div>

      {/* Delete confirmation overlay */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex items-end justify-center bg-black/40 backdrop-blur-sm pb-8 px-6"
            onClick={() => !deleting && setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full bg-white rounded-[2.5rem] p-8 space-y-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={24} className="text-red-500" />
                </div>
                <h3 className="font-display font-bold text-xl text-brand-navy">Delete Account?</h3>
                <p className="text-sm text-brand-navy/50">This permanently removes your profile, posts, and follow connections. Your stamp history and loyalty cards will remain.</p>
              </div>
              <div className="space-y-3">
                <button
                  onClick={async () => {
                    setDeleting(true);
                    try {
                      await onDeleteAccount();
                    } catch (err: any) {
                      console.error('Delete account error:', err);
                      alert('Could not delete account: ' + (err?.message ?? 'Unknown error'));
                      setDeleting(false);
                    }
                  }}
                  disabled={deleting}
                  className="w-full bg-red-500 text-white font-bold py-4 rounded-2xl hover:bg-red-600 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {deleting
                    ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Sparkles size={18} /></motion.div>
                    : <Trash2 size={18} />}
                  {deleting ? 'Deleting…' : 'Yes, Delete My Account'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="w-full py-4 rounded-2xl text-brand-navy/60 font-bold text-sm hover:bg-brand-navy/5 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 px-1 pt-2">
      {icon}
      <p className="text-xs font-bold text-brand-navy/50 uppercase tracking-widest">{label}</p>
    </div>
  );
}

function SettingsMenu({
  isOpen,
  onClose,
  profile,
  userCards,
  isAdmin,
  onOpenAdmin,
  onOpenStores,
}: {
  isOpen: boolean,
  onClose: () => void,
  profile: UserProfile | null,
  userCards: Card[],
  isAdmin?: boolean,
  onOpenAdmin?: () => void,
  onOpenStores?: () => void,
}) {
  const [showArchive, setShowArchive] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [archivedCards, setArchivedCards] = useState<Card[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (!profile) return;
    const aq = query(collection(db, 'cards'), where('user_id', '==', profile.uid), where('isArchived', '==', true));
    const unsubArchive = onSnapshot(aq, (snap) => {
      setArchivedCards(snap.docs.map(d => ({ id: d.id, ...d.data() } as Card)));
    }, (error) => console.error("SettingsMenu archive listener:", error));

    const hq = query(collection(db, 'transactions'), where('user_id', '==', profile.uid), orderBy('completed_at', 'desc'));
    const unsubHistory = onSnapshot(hq, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => console.error("SettingsMenu history listener:", error));

    return () => {
      unsubArchive();
      unsubHistory();
    };
  }, [profile?.uid]);

  const seedData = async () => {
    if (!profile) return;
    setIsSeeding(true);
    try {
      const sampleStores = [
        {
          name: "The Daily Grind",
          category: "Food",
          address: "42 Espresso Lane",
          description: "Artisanal coffee and fresh pastries in the heart of the city.",
          stamps_required_for_reward: 8,
          isVerified: true,
          logoUrl: "https://picsum.photos/seed/coffee/200/200",
          coverUrl: "https://picsum.photos/seed/coffee-bg/800/400"
        },
        {
          name: "Glow Beauty Bar",
          category: "Beauty",
          address: "77 Radiance Blvd",
          description: "Premium skincare and beauty treatments for your natural glow.",
          stamps_required_for_reward: 10,
          isVerified: true,
          logoUrl: "https://picsum.photos/seed/beauty/200/200",
          coverUrl: "https://picsum.photos/seed/beauty-bg/800/400"
        },
        {
          name: "Iron Haven Gym",
          category: "Gym",
          address: "10 Strength St",
          description: "Your local community gym with top-tier equipment and trainers.",
          stamps_required_for_reward: 12,
          isVerified: false,
          logoUrl: "https://picsum.photos/seed/gym/200/200",
          coverUrl: "https://picsum.photos/seed/gym-bg/800/400"
        },
        {
          name: "The Barber Shop",
          category: "Barber",
          address: "15 Grooming Way",
          description: "Traditional cuts and modern styles for the modern gentleman.",
          stamps_required_for_reward: 6,
          isVerified: true,
          logoUrl: "https://picsum.photos/seed/barber/200/200",
          coverUrl: "https://picsum.photos/seed/barber-bg/800/400"
        },
        {
          name: "Green Leaf Salads",
          category: "Food",
          address: "88 Healthy Ave",
          description: "Fresh, organic salads and cold-pressed juices.",
          stamps_required_for_reward: 10,
          isVerified: true,
          logoUrl: "https://picsum.photos/seed/salad/200/200",
          coverUrl: "https://picsum.photos/seed/salad-bg/800/400"
        }
      ];

      // 1. Create/Update All Stores and track their IDs
      const seededStoreIds: string[] = [];
      for (const s of sampleStores) {
        const q = query(collection(db, 'stores'), where('name', '==', s.name));
        const snap = await getDocs(q);
        let storeId = '';
        if (snap.empty) {
          const storeRef = await addDoc(collection(db, 'stores'), {
            ...s,
            ownerUid: "system_seed",
            email: "contact@" + s.name.toLowerCase().replace(/\s/g, '') + ".com",
            createdAt: serverTimestamp()
          });
          storeId = storeRef.id;
        } else {
          storeId = snap.docs[0].id;
          await updateDoc(doc(db, 'stores', storeId), { ...s });
        }
        seededStoreIds.push(storeId);
      }

      // 2. Define Dummy Users
      const dummyUsers = [
        { uid: "dummy_1", name: "Alex Rivers", email: "alex@example.com", photoURL: "https://i.pravatar.cc/150?u=alex", role: "consumer" },
        { uid: "dummy_2", name: "Jordan Smith", email: "jordan@example.com", photoURL: "https://i.pravatar.cc/150?u=jordan", role: "consumer" },
        { uid: "dummy_3", name: "Casey Chen", email: "casey@example.com", photoURL: "https://i.pravatar.cc/150?u=casey", role: "consumer" },
        { uid: "dummy_4", name: "Sam Taylor", email: "sam@example.com", photoURL: "https://i.pravatar.cc/150?u=sam", role: "consumer" },
        { uid: "dummy_5", name: "Morgan Lee", email: "morgan@example.com", photoURL: "https://i.pravatar.cc/150?u=morgan", role: "consumer" },
        { uid: "dummy_6", name: "Bowie Star", email: "bowie@example.com", photoURL: "https://i.pravatar.cc/150?u=bowie", role: "consumer" },
        { uid: "dummy_7", name: "Charlie Drift", email: "charlie@example.com", photoURL: "https://i.pravatar.cc/150?u=charlie", role: "consumer" },
        { uid: "dummy_8", name: "Dakota Sky", email: "dakota@example.com", photoURL: "https://i.pravatar.cc/150?u=dakota", role: "consumer" },
        { uid: "dummy_9", name: "Emerson Blaise", email: "emerson@example.com", photoURL: "https://i.pravatar.cc/150?u=emerson", role: "consumer" },
        { uid: "dummy_10", name: "Finley Gray", email: "finley@example.com", photoURL: "https://i.pravatar.cc/150?u=finley", role: "consumer" },
        { uid: "dummy_11", name: "River Song", email: "river@example.com", photoURL: "https://i.pravatar.cc/150?u=river", role: "consumer" },
        { uid: "dummy_12", name: "Ocean Waves", email: "ocean@example.com", photoURL: "https://i.pravatar.cc/150?u=ocean", role: "consumer" }
      ];

      // 3. Process Dummy Users
      for (const du of dummyUsers) {
        let totalStamps = 0;
        let activeCardsCount = 0;
        let totalRedeemed = Math.floor(Math.random() * 5);

        // Assign random cards to each dummy user
        const numCards = Math.floor(Math.random() * 4) + 2; // 2-5 cards
        const userStores = [...seededStoreIds].sort(() => 0.5 - Math.random()).slice(0, numCards);

        for (const storeId of userStores) {
          const stamps = Math.floor(Math.random() * 10);
          totalStamps += stamps;
          activeCardsCount++;

          const cardId = `${du.uid}_${storeId}`;
          await setDoc(doc(db, 'cards', cardId), {
            user_id: du.uid,
            store_id: storeId,
            current_stamps: stamps,
            total_completed_cycles: Math.floor(Math.random() * 2),
            last_tap_timestamp: serverTimestamp(),
            isArchived: false,
            isRedeemed: false,
            userName: du.name,
            userPhoto: du.photoURL
          });
        }

        // Update dummy user statistics to match assigned cards
        await setDoc(doc(db, 'users', du.uid), {
          ...du,
          totalStamps,
          total_cards_held: activeCardsCount,
          totalRedeemed,
          createdAt: serverTimestamp()
        });

        // Add random wall posts for each dummy user
        const sampleShoutouts = [
          "Amazing stamps system, so easy to use!",
          "Highly recommend The Daily Grind for coffee lovers.",
          "Finally earned my first reward at Glow Beauty Bar!",
          "Anyone else training at Iron Haven сегодня?",
          "Does anyone know if The Barber Shop is open late?",
          "This app makes loyalty so much fun!"
        ];

        if (Math.random() > 0.3) {
          const author = dummyUsers[Math.floor(Math.random() * dummyUsers.length)];
          await addDoc(collection(db, 'user_reviews'), {
            fromUid: author.uid,
            fromName: author.name,
            fromPhoto: author.photoURL,
            toUid: du.uid,
            content: sampleShoutouts[Math.floor(Math.random() * sampleShoutouts.length)],
            rating: 5,
            likesCount: Math.floor(Math.random() * 10),
            createdAt: serverTimestamp()
          });
        }
      }

      // 4. Process Current User (Self)
      let myTotalStamps = 0;
      let myActiveCardsCount = 0;
      
      // Give current user 3 random cards
      const myStores = [...seededStoreIds].sort(() => 0.5 - Math.random()).slice(0, 3);
      for (const storeId of myStores) {
        const stamps = Math.floor(Math.random() * 5) + 3;
        myTotalStamps += stamps;
        myActiveCardsCount++;

        const cardId = `${profile.uid}_${storeId}`;
        await setDoc(doc(db, 'cards', cardId), {
          user_id: profile.uid,
          store_id: storeId,
          current_stamps: stamps,
          total_completed_cycles: 0,
          last_tap_timestamp: serverTimestamp(),
          isArchived: false,
          isRedeemed: false,
          userName: profile.name || 'Me',
          userPhoto: profile.photoURL || ''
        });
      }

      // Sync statistics for current user
      await updateDoc(doc(db, 'users', profile.uid), {
        totalStamps: myTotalStamps,
        total_cards_held: myActiveCardsCount
      });

      // 5. Seed global_posts (posts + polls from users and vendors)
      const existingPostsSnap = await getDocs(query(collection(db, 'global_posts'), limit(1)));
      if (existingPostsSnap.empty) {
        const d1 = dummyUsers[0], d2 = dummyUsers[1], d3 = dummyUsers[2];
        const d4 = dummyUsers[3], d5 = dummyUsers[4], d6 = dummyUsers[5];
        const d7 = dummyUsers[6], d8 = dummyUsers[7], d9 = dummyUsers[8];
        const storeNames = sampleStores.map(s => s.name);
        const storePics = [
          "https://picsum.photos/seed/coffee/200/200",
          "https://picsum.photos/seed/beauty/200/200",
          "https://picsum.photos/seed/gym/200/200",
          "https://picsum.photos/seed/barber/200/200",
          "https://picsum.photos/seed/salad/200/200",
        ];

        const postsToSeed = [
          // --- User regular posts ---
          {
            authorUid: d1.uid, authorName: d1.name, authorPhoto: d1.photoURL, authorRole: "consumer",
            content: "Just hit my 8th stamp at The Daily Grind ☕ Free coffee is so close I can taste it!",
            postType: "post", likesCount: 14, likedBy: [d2.uid, d3.uid, d4.uid, d5.uid, d6.uid, d7.uid, profile.uid],
            pollOptions: null, pollVotes: null
          },
          {
            authorUid: d2.uid, authorName: d2.name, authorPhoto: d2.photoURL, authorRole: "consumer",
            content: "Glow Beauty Bar just gave me the best facial I've ever had. The staff are incredible and the loyalty rewards make it even better 💅",
            postType: "post", likesCount: 22, likedBy: [d1.uid, d3.uid, d5.uid, d8.uid, d9.uid, profile.uid],
            pollOptions: null, pollVotes: null
          },
          {
            authorUid: d3.uid, authorName: d3.name, authorPhoto: d3.photoURL, authorRole: "consumer",
            content: "Iron Haven Gym is genuinely changing my life. Two months in and I've already redeemed my first free session reward. Anyone else training there? 💪",
            postType: "post", likesCount: 18, likedBy: [d4.uid, d5.uid, d6.uid, d1.uid, profile.uid],
            pollOptions: null, pollVotes: null
          },
          {
            authorUid: d4.uid, authorName: d4.name, authorPhoto: d4.photoURL, authorRole: "consumer",
            content: "PSA: The Barber Shop now has Sunday hours 🙌 Got my fresh cut this morning and earned my 5th stamp. One more and I get a free service!",
            postType: "post", likesCount: 9, likedBy: [d2.uid, d7.uid, d8.uid],
            pollOptions: null, pollVotes: null
          },
          {
            authorUid: d5.uid, authorName: d5.name, authorPhoto: d5.photoURL, authorRole: "consumer",
            content: "Green Leaf Salads for lunch every day this week. No regrets and 4 stamps richer 🥗 Who else is on their health journey?",
            postType: "post", likesCount: 11, likedBy: [d1.uid, d3.uid, d6.uid, d9.uid],
            pollOptions: null, pollVotes: null
          },
          {
            authorUid: d6.uid, authorName: d6.name, authorPhoto: d6.photoURL, authorRole: "consumer",
            content: "Linq is genuinely the best loyalty app I've used. Actually motivates me to go back to the same spots 🔥",
            postType: "post", likesCount: 31, likedBy: [d1.uid, d2.uid, d3.uid, d4.uid, d5.uid, d7.uid, d8.uid, d9.uid, profile.uid],
            pollOptions: null, pollVotes: null
          },
          // --- Vendor posts ---
          {
            authorUid: "vendor_daily_grind", authorName: "The Daily Grind", authorPhoto: storePics[0], authorRole: "vendor",
            storeName: storeNames[0],
            content: "🎉 DOUBLE STAMPS this entire weekend! Friday through Sunday — every purchase earns you 2x stamps. Come on in and level up your card faster. See you soon! ☕",
            postType: "post", likesCount: 47, likedBy: [d1.uid, d2.uid, d3.uid, d4.uid, d5.uid, d6.uid, d7.uid, d8.uid, profile.uid],
            pollOptions: null, pollVotes: null
          },
          {
            authorUid: "vendor_glow_beauty", authorName: "Glow Beauty Bar", authorPhoto: storePics[1], authorRole: "vendor",
            storeName: storeNames[1],
            content: "✨ NEW: Our summer skincare range has arrived. Book any facial this week and receive 3 BONUS stamps. Spaces are filling up fast — book via the link in bio!",
            postType: "post", likesCount: 35, likedBy: [d2.uid, d5.uid, d8.uid, d9.uid, profile.uid],
            pollOptions: null, pollVotes: null
          },
          {
            authorUid: "vendor_iron_haven", authorName: "Iron Haven Gym", authorPhoto: storePics[2], authorRole: "vendor",
            storeName: storeNames[2],
            content: "New Olympic lifting platform just dropped 💪 First 20 members to use it this week get an extra stamp added to their card. First come, first served!",
            postType: "post", likesCount: 28, likedBy: [d3.uid, d6.uid, d7.uid, profile.uid],
            pollOptions: null, pollVotes: null
          },
          // --- User polls ---
          {
            authorUid: d7.uid, authorName: d7.name, authorPhoto: d7.photoURL, authorRole: "consumer",
            content: "Which local business deserves more love? 👇",
            postType: "poll",
            pollOptions: [{ text: "The Daily Grind ☕" }, { text: "Glow Beauty Bar 💅" }, { text: "Iron Haven Gym 💪" }, { text: "The Barber Shop ✂️" }],
            pollVotes: { "0": [d1.uid, d2.uid, d5.uid], "1": [d3.uid, d8.uid, d9.uid, profile.uid], "2": [d4.uid, d6.uid], "3": [d7.uid] },
            likesCount: 8, likedBy: [d1.uid, d2.uid, d3.uid, d4.uid]
          },
          {
            authorUid: d8.uid, authorName: d8.name, authorPhoto: d8.photoURL, authorRole: "consumer",
            content: "What's your ideal loyalty reward? 🎁",
            postType: "poll",
            pollOptions: [{ text: "Free item / drink" }, { text: "Percentage discount" }, { text: "Bonus stamps" }, { text: "Exclusive experience" }],
            pollVotes: { "0": [d1.uid, d3.uid, d6.uid, profile.uid], "1": [d2.uid, d4.uid, d7.uid], "2": [d5.uid, d9.uid], "3": [d8.uid] },
            likesCount: 12, likedBy: [d2.uid, d5.uid, d6.uid, d7.uid, d8.uid]
          },
          {
            authorUid: d9.uid, authorName: d9.name, authorPhoto: d9.photoURL, authorRole: "consumer",
            content: "How many loyalty cards are you actively collecting right now? 🃏",
            postType: "poll",
            pollOptions: [{ text: "1–2 cards" }, { text: "3–5 cards" }, { text: "6–10 cards" }, { text: "10+ cards (collector mode)" }],
            pollVotes: { "0": [d4.uid, d5.uid], "1": [d1.uid, d2.uid, d6.uid, d8.uid, profile.uid], "2": [d3.uid, d7.uid], "3": [d9.uid] },
            likesCount: 7, likedBy: [d1.uid, d3.uid, d9.uid]
          },
          // --- Vendor polls ---
          {
            authorUid: "vendor_daily_grind", authorName: "The Daily Grind", authorPhoto: storePics[0], authorRole: "vendor",
            storeName: storeNames[0],
            content: "Help us choose our next seasonal special! ☕ Vote below 👇",
            postType: "poll",
            pollOptions: [{ text: "Pumpkin Spice Latte 🎃" }, { text: "Iced Matcha Coconut 🍵" }, { text: "Lavender Honey Flat White 🌸" }, { text: "Chai Oat Bomb 🧡" }],
            pollVotes: { "0": [d1.uid, d4.uid, d7.uid], "1": [d2.uid, d5.uid, d8.uid, profile.uid], "2": [d3.uid, d9.uid], "3": [d6.uid] },
            likesCount: 19, likedBy: [d1.uid, d2.uid, d3.uid, d4.uid, d5.uid, profile.uid]
          },
          {
            authorUid: "vendor_iron_haven", authorName: "Iron Haven Gym", authorPhoto: storePics[2], authorRole: "vendor",
            storeName: storeNames[2],
            content: "We're extending our opening hours! When would you use the gym most? 🏋️",
            postType: "poll",
            pollOptions: [{ text: "Earlier mornings (5am open)" }, { text: "Late nights (until 11pm)" }, { text: "Weekend afternoons" }, { text: "All of the above!" }],
            pollVotes: { "0": [d3.uid, d7.uid], "1": [d1.uid, d4.uid, d6.uid], "2": [d5.uid, d8.uid], "3": [d2.uid, d9.uid, profile.uid] },
            likesCount: 23, likedBy: [d3.uid, d4.uid, d5.uid, d6.uid, d7.uid, profile.uid]
          },
          {
            authorUid: "vendor_barber", authorName: "The Barber Shop", authorPhoto: storePics[3], authorRole: "vendor",
            storeName: storeNames[3],
            content: "What new service should we add to our menu? Your vote decides! ✂️",
            postType: "poll",
            pollOptions: [{ text: "Hot towel shave" }, { text: "Hair colouring" }, { text: "Scalp treatment" }, { text: "Men's facials" }],
            pollVotes: { "0": [d1.uid, d2.uid, d4.uid, d6.uid], "1": [d3.uid, d8.uid], "2": [d5.uid, d9.uid], "3": [d7.uid, profile.uid] },
            likesCount: 15, likedBy: [d2.uid, d4.uid, d8.uid]
          },
        ];

        for (const post of postsToSeed) {
          await addDoc(collection(db, 'global_posts'), {
            ...post,
            createdAt: serverTimestamp()
          });
        }
      }

      alert("Sample data successfully seeded! Users, Businesses, and consistent statistics are ready.");
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert("Seeding failed: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-brand-navy/60 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="glass-panel w-full max-w-md rounded-t-[3rem] p-8 space-y-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-2xl font-bold">Menu</h2>
          <button onClick={onClose} className="p-2 bg-brand-navy/5 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <MenuButton icon={<Archive />} label="Archived Cards" sub="View completed programs" onClick={() => setShowArchive(true)} />
          <MenuButton icon={<Clock />} label="Stamp History" sub="Timeline of collections" onClick={() => setShowHistory(true)} />
          <MenuButton icon={<Settings />} label="Settings" sub="Account preferences" />
          <MenuButton icon={<Sparkles />} label="Seed Sample Data" sub="Generate test users & stamps" onClick={seedData} disabled={isSeeding} />
          {isAdmin && (
            <MenuButton icon={<Flag />} label="Admin Panel" sub="Challenges, badges & settings" onClick={onOpenAdmin} />
          )}
        </div>

        <AnimatePresence>
          {showArchive && (
            <Modal title="Archived Cards" onClose={() => setShowArchive(false)}>
              <div className="space-y-4">
                {archivedCards.map(card => (
                  <div key={card.id} className="glass-card p-4 rounded-2xl">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-sm">Completed Program</p>
                      <span className="text-[10px] font-bold text-brand-gold uppercase">Archived</span>
                    </div>
                    <p className="text-xs text-brand-navy/60">Completed cycles: {card.total_completed_cycles}</p>
                  </div>
                ))}
                {archivedCards.length === 0 && (
                  <div className="py-12 text-center text-brand-navy/20">
                    <Archive size={48} className="mx-auto mb-4 opacity-10" />
                    <p className="font-bold">No archived cards yet</p>
                  </div>
                )}
              </div>
            </Modal>
          )}

          {showHistory && (
            <Modal title="Stamp History" onClose={() => setShowHistory(false)}>
              <div className="space-y-4">
                {transactions.map(tx => (
                  <div key={tx.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 bg-brand-gold rounded-full flex items-center justify-center text-brand-navy">
                        <CheckCircle2 size={16} />
                      </div>
                      <div className="w-0.5 flex-1 bg-brand-navy/5 my-1" />
                    </div>
                    <div className="flex-1 pb-6">
                      <p className="font-bold text-sm">Card Completed</p>
                      <p className="text-xs text-brand-navy/40 mb-2">
                        {tx.completed_at ? format(tx.completed_at.toDate(), 'MMM d, yyyy • h:mm a') : 'Recently'}
                      </p>
                      <div className="bg-brand-bg p-3 rounded-xl text-[10px] font-bold text-brand-navy/60 uppercase tracking-widest">
                        {tx.stamps_at_completion} Stamps Collected
                      </div>
                    </div>
                  </div>
                ))}
                {transactions.length === 0 && (
                  <div className="py-12 text-center text-brand-navy/20">
                    <Clock size={48} className="mx-auto mb-4 opacity-10" />
                    <p className="font-bold">No history yet</p>
                  </div>
                )}
              </div>
            </Modal>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

function MenuButton({ icon, label, sub, onClick, disabled }: { icon: React.ReactNode, label: string, sub: string, onClick?: () => void, disabled?: boolean }) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className="w-full bg-white p-5 rounded-3xl border border-brand-navy/5 flex items-center justify-between group hover:border-brand-gold/50 transition-all disabled:opacity-50"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-brand-navy/5 rounded-2xl flex items-center justify-center text-brand-navy/40 group-hover:scale-110 transition-transform">
          {React.cloneElement(icon as React.ReactElement, { size: 24 })}
        </div>
        <div className="text-left">
          <p className="font-bold">{label}</p>
          <p className="text-xs text-brand-navy/40">{sub}</p>
        </div>
      </div>
      <ChevronRight className="text-brand-navy/20" />
    </button>
  );
}

function ProfileLink({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="w-full p-6 flex items-center justify-between hover:bg-brand-bg transition-all border-b border-brand-navy/5 last:border-0"
    >
      <div className="flex items-center gap-4">
        <div className="text-brand-navy/40">{icon}</div>
        <span className="font-bold">{label}</span>
      </div>
      <ChevronRight size={18} className="text-brand-navy/20" />
    </button>
  );
}

// --- Social & Community Components ---

function FeedPostCard({ post, currentUser, currentProfile, onViewUser, onViewStore, onLike, onVote, onDelete }: {
  key?: React.Key;
  post: GlobalPost;
  currentUser?: FirebaseUser;
  currentProfile?: UserProfile | null;
  onViewUser: (u: UserProfile) => void;
  onViewStore?: (s: StoreProfile) => void;
  onLike: (post: GlobalPost) => void | Promise<void>;
  onVote: (post: GlobalPost, optionIndex: number) => void | Promise<void>;
  onDelete?: (post: GlobalPost) => void | Promise<void>;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [showAllComments, setShowAllComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [authorProfile, setAuthorProfile] = useState<{ name: string; logoUrl?: string; gender?: string; avatar?: UserAvatar; streak?: number } | null>(null);

  useEffect(() => {
    if (post.authorRole === 'vendor' && post.storeId) {
      return onSnapshot(doc(db, 'stores', post.storeId), (snap) => {
        if (snap.exists()) setAuthorProfile({ name: snap.data().name, logoUrl: snap.data().logoUrl || '' });
      }, () => {});
    }
    return onSnapshot(doc(db, 'users', post.authorUid), (snap) => {
      if (snap.exists()) setAuthorProfile({ name: snap.data().name, gender: snap.data().gender, avatar: snap.data().avatar, streak: snap.data().streak });
    }, () => {});
  }, [post.authorUid, post.storeId, post.authorRole]);

  const isLiked = currentUser ? (post.likedBy || []).includes(currentUser.uid) : false;
  const handleViewCommentAuthor = async (uid: string) => {
    if (!onViewUser || !uid) return;
    const snap = await getDoc(doc(db, 'users', uid)).catch(() => null);
    if (snap?.exists()) { onViewUser({ uid: snap.id, ...snap.data() } as UserProfile); return; }
    const vSnap = await getDoc(doc(db, 'vendors', uid)).catch(() => null);
    if (vSnap?.exists()) onViewUser({ uid: vSnap.id, ...vSnap.data() } as UserProfile);
  };

  const isOwn = currentUser?.uid === post.authorUid;
  const totalVotes = post.postType === 'poll'
    ? Object.values(post.pollVotes || {}).reduce((s, arr) => s + (arr?.length || 0), 0)
    : 0;
  const userVoteKey = currentUser
    ? Object.keys(post.pollVotes || {}).find(k => (post.pollVotes![k] || []).includes(currentUser.uid))
    : undefined;
  const likesCount = post.likesCount || 0;

  useEffect(() => {
    const q = query(
      collection(db, 'global_posts', post.id, 'comments'),
      orderBy('likesCount', 'desc'),
      orderBy('createdAt', 'asc'),
      limit(50)
    );
    return onSnapshot(q, (snap) => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
  }, [post.id]);

  const handleAvatarClick = async () => {
    try {
      if (post.authorRole === 'vendor' && post.storeId && onViewStore) {
        const snap = await getDoc(doc(db, 'stores', post.storeId));
        if (snap.exists()) { onViewStore({ id: snap.id, ...snap.data() } as StoreProfile); return; }
      }
      const snap = await getDoc(doc(db, 'users', post.authorUid));
      if (snap.exists()) onViewUser({ uid: snap.id, ...snap.data() } as UserProfile);
    } catch {/* seed users may not exist */}
  };

  const handleSubmitComment = async () => {
    if (!currentUser || !newComment.trim()) return;
    setIsCommenting(true);
    const text = newComment.trim();
    try {
      // Fetch fresh sender profile so name/photo are always accurate; bump streak
      const [senderSnap, commentStreak] = await Promise.all([
        getDoc(doc(db, 'users', currentUser.uid)).catch(() => null),
        bumpStreak(currentUser.uid),
      ]);
      const senderData = senderSnap?.exists() ? senderSnap.data() : null;
      const fromName = senderData?.name || currentProfile?.name || currentUser.displayName || 'User';
      const fromPhoto = senderData?.photoURL || currentProfile?.photoURL || currentUser.photoURL || '';

      await addDoc(collection(db, 'global_posts', post.id, 'comments'), {
        fromUid: currentUser.uid,
        fromName,
        fromPhoto,
        fromStreak: commentStreak,
        content: text,
        likesCount: 0,
        likedBy: [],
        createdAt: serverTimestamp(),
      });
      if (post.authorUid !== currentUser.uid) {
        addDoc(collection(db, 'notifications'), {
          toUid: post.authorUid,
          fromUid: currentUser.uid,
          fromName,
          fromPhoto,
          type: 'comment',
          message: `commented: "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`,
          isRead: false,
          createdAt: serverTimestamp(),
        }).catch(() => {});
      }
      setNewComment('');
    } finally {
      setIsCommenting(false);
    }
  };

  const handleLikeComment = async (comment: any) => {
    if (!currentUser) return;
    const ref = doc(db, 'global_posts', post.id, 'comments', comment.id);
    const liked = (comment.likedBy || []).includes(currentUser.uid);
    await updateDoc(ref, {
      likedBy: liked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
      likesCount: liked ? Math.max(0, comment.likesCount - 1) : comment.likesCount + 1,
    });
  };

  const visibleComments = showAllComments ? comments : comments.slice(0, 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-[2rem] overflow-hidden border border-black/5 shadow-sm"
    >
      {/* Post header */}
      <div className="px-5 pt-5 pb-3 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-black/5 cursor-pointer shrink-0 bg-indigo-50 flex items-center justify-center" onClick={handleAvatarClick}>
            {post.authorRole === 'vendor'
              ? <img src={authorProfile?.logoUrl || post.authorPhoto || ''} alt="" className="w-full h-full object-cover" />
              : <PixelAvatar config={authorProfile?.avatar} uid={post.authorUid} size={40} view="head" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {post.wallPost && post.storeName ? (
                <p className="text-sm leading-snug">
                  <span className="inline-flex items-center gap-1 flex-wrap">
                    <span
                      className="font-bold cursor-pointer hover:text-brand-gold transition-colors"
                      onClick={handleAvatarClick}
                    >
                      {authorProfile?.name || post.authorName}
                    </span>
                    <StreakBadge streak={authorProfile?.streak} />
                  </span>
                  <span className="text-brand-navy/30 mx-1">›</span>
                  <span
                    className="font-bold text-brand-gold cursor-pointer hover:opacity-70 transition-opacity"
                    onClick={async () => {
                      if (!post.storeId || !onViewStore) return;
                      const snap = await getDoc(doc(db, 'stores', post.storeId));
                      if (snap.exists()) onViewStore({ id: snap.id, ...snap.data() } as StoreProfile);
                    }}
                  >
                    {post.storeName}
                  </span>
                </p>
              ) : post.wallPost && post.toUid ? (
                <p className="text-sm leading-snug">
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="font-bold cursor-pointer hover:text-brand-gold transition-colors"
                      onClick={handleAvatarClick}
                    >
                      {authorProfile?.name || post.authorName}
                    </span>
                    <StreakBadge streak={authorProfile?.streak} />
                  </span>
                  <span className="text-brand-navy/30 mx-1">›</span>
                  <span
                    className="font-bold cursor-pointer hover:text-brand-gold transition-colors"
                    onClick={async () => {
                      const snap = await getDoc(doc(db, 'users', post.toUid!));
                      if (snap.exists()) onViewUser({ uid: snap.id, ...snap.data() } as UserProfile);
                    }}
                  >
                    {post.toName}
                  </span>
                </p>
              ) : post.authorRole === 'vendor' && post.storeName && !post.wallPost ? (
                <span
                  className="font-bold text-sm cursor-pointer hover:text-brand-gold transition-colors"
                  onClick={async () => {
                    if (!post.storeId || !onViewStore) return;
                    const snap = await getDoc(doc(db, 'stores', post.storeId));
                    if (snap.exists()) onViewStore({ id: snap.id, ...snap.data() } as StoreProfile);
                  }}
                >
                  {post.storeName}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <span
                    className="font-bold text-sm cursor-pointer hover:text-brand-gold transition-colors"
                    onClick={handleAvatarClick}
                  >
                    {authorProfile?.name || post.authorName}
                  </span>
                  <StreakBadge streak={authorProfile?.streak} />
                </span>
              )}
            </div>
            <p className="text-[10px] text-brand-navy/40 font-medium">
              {post.createdAt ? format(post.createdAt.toDate(), 'MMM d · h:mm a') : 'Just now'}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {post.postType === 'poll' && (
              <div className="w-7 h-7 bg-brand-gold/10 rounded-lg flex items-center justify-center">
                <BarChart2 size={14} className="text-brand-gold" />
              </div>
            )}
            <div className="relative">
              <button
                onClick={() => setShowMenu(v => !v)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-brand-navy/30 hover:text-brand-navy/70 hover:bg-brand-bg transition-all"
              >
                <MoreVertical size={16} />
              </button>
              <AnimatePresence>
                {showMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -4 }}
                    className="absolute right-0 top-8 z-50 bg-white rounded-2xl shadow-xl border border-black/8 overflow-hidden min-w-[150px]"
                    onMouseLeave={() => setShowMenu(false)}
                  >
                    {isOwn && (
                      <button
                        onClick={() => { setShowMenu(false); onDelete?.(post); }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={15} /> Delete
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        setShowMenu(false);
                        if (!currentUser) return;
                        await addDoc(collection(db, 'reports'), {
                          postId: post.id,
                          reportedBy: currentUser.uid,
                          reason: 'User report',
                          createdAt: serverTimestamp(),
                        });
                        setReportSent(true);
                        setTimeout(() => setReportSent(false), 3000);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-bold text-brand-navy/60 hover:bg-brand-bg transition-colors"
                    >
                      <Flag size={15} /> {reportSent ? 'Reported!' : 'Report'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {post.postType === 'review' && (
          <div className="flex items-center gap-0.5">
            {[1,2,3,4,5].map(s => (
              <Star key={s} size={13} className={s <= (post.rating || 5) ? "text-brand-gold fill-brand-gold" : "text-brand-navy/20"} />
            ))}
            <span className="ml-1.5 text-xs text-brand-navy/40 font-medium">review for <span className="font-bold text-brand-gold">{post.storeName}</span></span>
          </div>
        )}
        {post.content && (
          <p className="text-sm text-brand-navy leading-relaxed">{post.content}</p>
        )}

        {post.postType === 'poll' && post.pollOptions && (
          <div className="space-y-2 pt-1">
            {post.pollOptions.map((opt, i) => {
              const voteCount = (post.pollVotes?.[String(i)] || []).length;
              const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
              const voted = userVoteKey === String(i);
              return (
                <button
                  key={i}
                  onClick={() => onVote(post, i)}
                  className={cn(
                    "w-full text-left rounded-xl overflow-hidden border-2 transition-all active:scale-[0.98]",
                    voted ? "border-brand-gold" : "border-black/6 hover:border-brand-gold/40"
                  )}
                >
                  <div className="relative px-4 py-2.5 min-h-[42px] flex items-center">
                    <div
                      className={cn(
                        "absolute left-0 top-0 bottom-0 rounded-[10px] transition-all duration-500",
                        voted ? "bg-brand-gold/20" : "bg-brand-navy/5"
                      )}
                      style={{ width: `${Math.max(pct, 4)}%` }}
                    />
                    <div className="relative flex items-center justify-between w-full gap-2">
                      <div className="flex items-center gap-2">
                        {voted && <CheckCircle2 size={14} className="text-brand-gold shrink-0" />}
                        <span className={cn("text-sm font-medium", voted && "font-bold")}>{opt.text}</span>
                      </div>
                      <span className={cn("text-xs font-bold shrink-0", voted ? "text-brand-gold" : "text-brand-navy/40")}>{pct}%</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Interactions bar */}
      <div className="px-5 pb-3 border-t border-black/5 pt-3">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onLike(post)}
            className={cn(
              "flex items-center gap-1.5 transition-all active:scale-95 text-sm font-bold",
              isLiked ? "text-brand-gold" : "text-brand-navy/30 hover:text-brand-gold"
            )}
          >
            <Heart size={17} className={cn("transition-all", isLiked ? "fill-brand-gold scale-110" : "")} />
            <span>{likesCount}</span>
          </button>

          <button
            onClick={() => setShowAllComments(v => !v)}
            className="flex items-center gap-1.5 text-sm font-bold text-brand-navy/30 hover:text-brand-navy/60 transition-colors"
          >
            <MessageCircle size={17} />
            <span>{comments.length}</span>
          </button>

          {post.postType === 'poll' && (
            <div className="flex items-center gap-1.5 text-brand-navy/30 text-sm font-bold">
              <BarChart2 size={17} />
              <span>{totalVotes}</span>
            </div>
          )}
        </div>
      </div>

      {/* Comments thread — toggled by the chat icon */}
      {(comments.length > 0 || showAllComments) && (
        <div className="px-5 pb-3 border-t border-black/5 pt-3 space-y-3">
          {visibleComments.map(comment => {
            const commentLiked = currentUser ? (comment.likedBy || []).includes(currentUser.uid) : false;
            return (
              <div key={comment.id} className="flex gap-2.5">
                <button onClick={() => handleViewCommentAuthor(comment.fromUid)} className="shrink-0 mt-0.5 hover:opacity-80 transition-opacity">
                  <div className="w-7 h-7 rounded-full overflow-hidden border border-black/5 bg-indigo-50 flex items-center justify-center">
                    <LivePixelAvatar uid={comment.fromUid} size={28} view="head" />
                  </div>
                </button>
                <div className="flex-1 min-w-0">
                  <div className="bg-brand-bg rounded-2xl px-3 py-2">
                    <div className="flex items-center gap-1 mb-0.5">
                      <button onClick={() => handleViewCommentAuthor(comment.fromUid)} className="text-xs font-bold text-brand-navy hover:text-brand-gold transition-colors">{comment.fromName}</button>
                      <StreakBadge streak={comment.fromStreak} />
                    </div>
                    <p className="text-xs text-brand-navy/70 leading-relaxed">{comment.content}</p>
                  </div>
                  <div className="flex items-center gap-3 mt-1 px-1">
                    <button
                      onClick={() => handleLikeComment(comment)}
                      className={cn("flex items-center gap-1 text-[10px] font-bold transition-colors", commentLiked ? "text-brand-gold" : "text-brand-navy/30 hover:text-brand-gold")}
                    >
                      <Heart size={10} className={commentLiked ? "fill-current" : ""} />
                      {comment.likesCount > 0 && <span>{comment.likesCount}</span>}
                    </button>
                    <span className="text-[10px] text-brand-navy/20">
                      {comment.createdAt ? format(comment.createdAt.toDate(), 'MMM d') : ''}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {comments.length > 2 && (
            <button
              onClick={() => setShowAllComments(v => !v)}
              className="flex items-center gap-1 text-xs font-bold text-brand-navy/40 hover:text-brand-gold transition-colors"
            >
              <ChevronDown size={14} className={cn("transition-transform", showAllComments && "rotate-180")} />
              {showAllComments ? 'Show less' : `View all ${comments.length} comments`}
            </button>
          )}
        </div>
      )}

      {/* Comment input — always visible for logged-in users */}
      {currentUser && (
        <div className="px-5 pb-4 border-t border-black/5 pt-3 flex gap-2">
          <div className="w-7 h-7 rounded-full overflow-hidden border border-black/5 shrink-0 bg-indigo-50 flex items-center justify-center">
            <LivePixelAvatar uid={currentUser.uid} size={28} view="head" />
          </div>
          <div className="flex-1 flex gap-2">
            <input
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitComment(); } }}
              placeholder="Add a comment…"
              className="flex-1 bg-brand-bg rounded-2xl px-3 py-2 text-xs border-none focus:outline-none focus:ring-2 focus:ring-brand-gold/20"
            />
            <button
              onClick={handleSubmitComment}
              disabled={!newComment.trim() || isCommenting}
              className="w-8 h-8 rounded-xl bg-brand-gold text-white flex items-center justify-center disabled:opacity-40 transition-opacity shrink-0"
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function CreatePostModal({ onClose, user, profile }: { onClose: () => void, user: FirebaseUser, profile: UserProfile | null }) {
  const [content, setContent] = useState('');
  const [isPoll, setIsPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [isPosting, setIsPosting] = useState(false);
  const [vendorStore, setVendorStore] = useState<StoreProfile | null>(null);

  useEffect(() => {
    if (profile?.role === 'vendor') {
      const q = query(collection(db, 'stores'), where('ownerUid', '==', user.uid), limit(1));
      getDocs(q).then(snap => {
        if (!snap.empty) setVendorStore({ id: snap.docs[0].id, ...snap.docs[0].data() } as StoreProfile);
      });
    }
  }, [profile?.role, user.uid]);

  const handleAddOption = () => setPollOptions(prev => [...prev, '']);
  const handleOptionChange = (i: number, val: string) => {
    setPollOptions(prev => prev.map((o, idx) => idx === i ? val : o));
  };
  const handleRemoveOption = (i: number) => {
    if (pollOptions.length <= 2) return;
    setPollOptions(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async () => {
    if (!content.trim() && !isPoll) return;
    if (isPoll && pollOptions.filter(o => o.trim()).length < 2) return;
    setIsPosting(true);
    try {
      const initialVotes: { [key: string]: string[] } = {};
      const options = pollOptions.filter(o => o.trim()).map(text => ({ text }));
      options.forEach((_, i) => { initialVotes[String(i)] = []; });

      await addDoc(collection(db, 'global_posts'), {
        authorUid: user.uid,
        authorName: profile?.name || user.displayName || 'User',
        authorPhoto: profile?.photoURL || user.photoURL || '',
        authorRole: profile?.role || 'consumer',
        storeId: vendorStore?.id || null,
        storeName: vendorStore?.name || null,
        content: content.trim(),
        postType: isPoll ? 'poll' : 'post',
        pollOptions: isPoll ? options : null,
        pollVotes: isPoll ? initialVotes : null,
        createdAt: serverTimestamp(),
        likesCount: 0,
        likedBy: []
      });
      onClose();
    } catch (err) {
      console.error("Create post error:", err);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-md bg-white rounded-t-[2.5rem] p-6 pb-10 space-y-5 shadow-2xl"
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-brand-navy/10 rounded-full mx-auto" />

        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-lg">New Post</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPoll(p => !p)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                isPoll ? "bg-brand-gold text-white shadow-md" : "bg-brand-navy/5 text-brand-navy/50 hover:bg-brand-navy/10"
              )}
            >
              <BarChart2 size={14} />
              Poll
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-brand-navy/5 text-brand-navy/40">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-brand-navy/10 bg-indigo-50 flex items-center justify-center">
            <PixelAvatar config={profile?.avatar} uid={profile?.uid} size={40} view="head" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-bold text-sm">{profile?.name || user.displayName}</p>
              {profile?.role === 'vendor' && vendorStore && (
                <span className="text-[10px] text-brand-navy/40">• {vendorStore.name}</span>
              )}
            </div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={isPoll ? "Ask a question..." : "What's on your mind?"}
              rows={3}
              className="w-full text-sm resize-none bg-transparent border-none outline-none text-brand-navy placeholder:text-brand-navy/30 leading-relaxed"
              autoFocus
            />
          </div>
        </div>

        {isPoll && (
          <div className="space-y-2 ml-13 pl-[52px]">
            {pollOptions.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 bg-brand-bg rounded-xl px-4 py-2.5 border border-brand-navy/8">
                  <span className="w-5 h-5 rounded-full border-2 border-brand-navy/20 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-brand-navy/40">{i + 1}</span>
                  </span>
                  <input
                    value={opt}
                    onChange={e => handleOptionChange(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-brand-navy/30"
                  />
                </div>
                {pollOptions.length > 2 && (
                  <button onClick={() => handleRemoveOption(i)} className="text-brand-navy/20 hover:text-red-400 transition-colors">
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
            {pollOptions.length < 5 && (
              <button
                onClick={handleAddOption}
                className="flex items-center gap-2 text-brand-gold text-xs font-bold hover:opacity-80 transition-opacity"
              >
                <Plus size={14} />
                Add option
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-brand-navy/5">
          <button
            onClick={handleSubmit}
            disabled={isPosting || (!content.trim() && !isPoll) || (isPoll && pollOptions.filter(o => o.trim()).length < 2)}
            className="px-6 py-2.5 gradient-red text-white rounded-xl font-bold text-sm disabled:opacity-40 transition-all active:scale-95 shadow-md shadow-blue-500/20"
          >
            {isPosting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function NotificationsPanel({ notifications, onClose }: { notifications: Notification[], onClose: () => void }) {
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { isRead: true });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-brand-bg shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/5">
          <div>
            <h2 className="font-display text-xl font-bold">Notifications</h2>
            {unreadCount > 0 && (
              <p className="text-xs text-brand-gold font-bold">{unreadCount} unread</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-2xl bg-brand-navy/5 flex items-center justify-center hover:bg-brand-navy/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {notifications.map(notif => (
            <div
              key={notif.id}
              onClick={() => { if (!notif.isRead) markAsRead(notif.id); }}
              className={cn(
                "bg-white rounded-[1.5rem] p-4 flex items-center gap-3 transition-all",
                !notif.isRead ? "ring-2 ring-brand-gold/30 cursor-pointer shadow-sm" : "opacity-75"
              )}
            >
              <div className="w-11 h-11 rounded-xl overflow-hidden border border-brand-navy/5 relative bg-brand-gold/10 flex items-center justify-center shrink-0">
                {notif.type === 'broadcast' ? (
                  notif.storeLogoUrl
                    ? <img src={notif.storeLogoUrl} alt="" className="w-full h-full object-cover" />
                    : <Store size={18} className="text-brand-navy/60" />
                ) : notif.fromUid ? (
                  <LivePixelAvatar uid={notif.fromUid} size={44} view="head" />
                ) : (
                  <Sparkles size={18} className="text-brand-gold" />
                )}
                <div className={cn("absolute -bottom-1 -right-1 p-1 rounded-md border-2 border-white", notif.type === 'like' ? "bg-red-400" : notif.type === 'comment' ? "bg-blue-400" : notif.type === 'message' ? "bg-brand-navy" : notif.type === 'broadcast' ? "bg-brand-navy" : "bg-brand-gold")}>
                  {notif.type === 'follow' ? <UserPlus size={9} className="text-white" /> : notif.type === 'like' ? <Heart size={9} className="text-white fill-white" /> : notif.type === 'comment' || notif.type === 'message' ? <MessageCircle size={9} className="text-white" /> : notif.type === 'broadcast' ? <Send size={9} className="text-white" /> : <Bell size={9} className="text-white" />}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                {notif.type === 'broadcast' ? (
                  <>
                    <p className="text-sm leading-snug">
                      <span className="font-bold">{notif.storeName}</span>
                      {notif.title && <span className="text-brand-navy/70"> · {notif.title}</span>}
                    </p>
                    {notif.message && <p className="text-xs text-brand-navy/50 line-clamp-2 mt-0.5">{notif.message}</p>}
                  </>
                ) : (
                  <p className="text-sm line-clamp-2 leading-snug">
                    {notif.type === 'system'
                      ? notif.message
                      : <><span className="font-bold">{notif.fromName}</span> {notif.type === 'follow' ? 'started following you!' : notif.message}</>
                    }
                  </p>
                )}
                <p className="text-[10px] text-brand-navy/40 font-bold uppercase tracking-widest mt-0.5">
                  {notif.createdAt ? format(notif.createdAt.toDate(), 'MMM d, h:mm a') : 'Just now'}
                </p>
              </div>
              <button
                onClick={async e => { e.stopPropagation(); await deleteDoc(doc(db, 'notifications', notif.id)); }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-brand-navy/20 hover:text-red-400 hover:bg-red-50 transition-all shrink-0"
              >
                <X size={13} />
              </button>
            </div>
          ))}
          {notifications.length === 0 && (
            <div className="py-24 text-center text-brand-navy/20">
              <Bell size={48} className="mx-auto mb-4 opacity-10" />
              <p className="font-bold">All caught up!</p>
              <p className="text-sm mt-1">No notifications yet</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

const DEAL_COLORS = ['#EF4444', '#14B8A6', '#3B82F6', '#22C55E', '#F97316', '#A855F7', '#EAB308', '#10B981'];

function FeedVendorPostCard({ item }: { item: any }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 rounded-[2rem] space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full overflow-hidden border border-brand-navy/5 shrink-0">
          <img src={item.authorPhoto || `https://picsum.photos/seed/${item.authorUid}/40`} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-sm truncate">{item.authorName}</p>
            <span className="px-2 py-0.5 bg-brand-gold/10 rounded-full text-[9px] font-bold text-brand-gold uppercase shrink-0">Store</span>
          </div>
          <p className="text-[10px] text-brand-navy/40">{item.createdAt ? format(item.createdAt.toDate(), 'MMM d, h:mm a') : 'Just now'}</p>
        </div>
      </div>
      <p className="text-sm text-brand-navy/90 leading-relaxed">{item.content}</p>
    </motion.div>
  );
}

function FeedLoadingSpinner() {
  return (
    <div className="flex justify-center py-12">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
        <Sparkles className="w-8 h-8 text-brand-gold" />
      </motion.div>
    </div>
  );
}

// --- Deals Screen ---
const REWARD_TAG_COLORS: Record<string, string[]> = {
  experience: ['#5B21B6', '#4C1D95'],
  service: ['#0369A1', '#075985'],
  product: ['#065F46', '#064E3B'],
};

function DealSliderSection({ title, icon, challenges, onViewStore, onViewChallenge, stores, showAll, onToggleAll }: {
  title: string; icon: React.ReactNode; challenges: Challenge[]; onViewStore?: (s: StoreProfile) => void; onViewChallenge?: (c: Challenge) => void; stores?: StoreProfile[]; showAll: boolean; onToggleAll: () => void;
}) {
  if (challenges.length === 0) return null;
  const visible = showAll ? challenges : challenges.slice(0, 8);
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3 px-1">
        {icon}
        <h3 className="font-extrabold text-brand-navy text-sm flex-1">{title}</h3>
        {challenges.length > 5 && (
          <button onClick={onToggleAll} className="text-[10px] font-bold text-brand-navy/40 flex items-center gap-0.5">
            {showAll ? 'Less' : `All ${challenges.length}`} <ChevronDown size={10} className={cn('transition-transform', showAll && 'rotate-180')} />
          </button>
        )}
      </div>
      <div className={cn('pb-2', showAll ? 'grid grid-cols-2 gap-3' : 'flex gap-3 overflow-x-auto')} style={!showAll ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}}>
        {visible.map((c, i) => {
          const colors = REWARD_TAG_COLORS[c.rewardTag || 'product'];
          const vendorStore = stores?.find(s => c.vendorIds?.[0] === s.id);
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
              className={cn('rounded-[1.5rem] overflow-hidden flex flex-col relative cursor-pointer active:scale-[0.97] transition-transform', showAll ? '' : 'shrink-0 w-36')}
              style={{ background: `linear-gradient(145deg, ${colors[0]}dd, ${colors[1]}bb)`, backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', border: '1px solid rgba(255,255,255,0.18)', height: '160px' }}
              onClick={() => onViewChallenge?.(c)}
            >
              {c.imageUrl && (
                <div className="absolute inset-0">
                  <img src={c.imageUrl} alt="" className="w-full h-full object-cover opacity-30" />
                  <div className="absolute inset-0" style={{ background: `linear-gradient(145deg, ${colors[0]}99, ${colors[1]}77)` }} />
                </div>
              )}
              <div className="relative z-10 flex flex-col h-full p-3">
                <div className="w-8 h-8 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center mb-2 shrink-0">
                  {c.rewardTag === 'experience' ? <Star size={14} className="text-white" />
                    : c.rewardTag === 'service' ? <Tag size={14} className="text-white" />
                    : <Package size={14} className="text-white" />}
                </div>
                <p className="font-extrabold text-white text-xs leading-tight line-clamp-2 mb-1">{c.reward}</p>
                <div className="mt-auto">
                  <p className="text-white/60 text-[9px] font-medium line-clamp-1">{c.title}</p>
                  {c.endsAt && (
                    <p className="text-white/40 text-[8px] font-medium mt-0.5 flex items-center gap-0.5">
                      <Clock size={7} className="shrink-0" />
                      <CountdownTimer endsAt={c.endsAt} />
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function StoreDealsSection({ stores, onViewStore, showAll, onToggleAll }: {
  stores: StoreProfile[]; onViewStore?: (s: StoreProfile) => void; showAll: boolean; onToggleAll: () => void;
}) {
  if (stores.length === 0) return null;
  const visible = showAll ? stores : stores.slice(0, 8);
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3 px-1">
        <Gift size={15} className="text-brand-rose" />
        <h3 className="font-extrabold text-brand-navy text-sm flex-1">Hot Deals</h3>
        {stores.length > 5 && (
          <button onClick={onToggleAll} className="text-[10px] font-bold text-brand-navy/40 flex items-center gap-0.5">
            {showAll ? 'Less' : `All ${stores.length}`} <ChevronDown size={10} className={cn('transition-transform', showAll && 'rotate-180')} />
          </button>
        )}
      </div>
      <div className={cn('pb-2', showAll ? 'grid grid-cols-2 gap-3' : 'flex gap-3 overflow-x-auto')} style={!showAll ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}}>
        {visible.map((store, i) => {
          const dealColor = DEAL_COLORS[i % DEAL_COLORS.length];
          const finalReward = store.rewardTiers?.length
            ? [...store.rewardTiers].sort((a, b) => b.stamps - a.stamps)[0]?.reward
            : store.reward;
          return (
            <motion.div
              key={store.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
              className={cn('rounded-[1.5rem] overflow-hidden flex flex-col cursor-pointer active:scale-[0.97] transition-transform', showAll ? '' : 'shrink-0 w-36')}
              style={{ height: '160px' }}
              onClick={() => onViewStore && onViewStore(store)}
            >
              {/* Top half — logo */}
              <div className="flex-1 bg-white/10 overflow-hidden relative">
                {store.logoUrl
                  ? <img src={store.logoUrl} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center bg-brand-navy/5"><Building2 size={24} className="text-brand-navy/30" /></div>}
              </div>
              {/* Bottom half — gradient-logo-blue */}
              <div className="gradient-logo-blue px-3 py-2 flex flex-col justify-center relative overflow-hidden" style={{ height: '72px' }}>
                <span className="shine-ray" aria-hidden="true" />
                <p className="font-extrabold text-white text-xs leading-tight line-clamp-2 relative z-10">
                  {finalReward || `${store.stamps_required_for_reward} stamps reward`}
                </p>
                <p className="text-white/60 text-[9px] font-medium line-clamp-1 mt-0.5 relative z-10">{store.name}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function DealsScreen({ currentUser, currentProfile, onViewStore, onViewChallenge, userCards = [] }: {
  currentUser?: FirebaseUser; currentProfile?: UserProfile | null; onViewStore?: (s: StoreProfile) => void; onViewChallenge?: (c: Challenge) => void; userCards?: Card[];
}) {
  const [allStores, setAllStores] = useState<StoreProfile[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [showAllHot, setShowAllHot] = useState(false);
  const [showAllExp, setShowAllExp] = useState(false);
  const [showAllSvc, setShowAllSvc] = useState(false);
  const [showAllProd, setShowAllProd] = useState(false);

  useEffect(() => {
    return onSnapshot(collection(db, 'stores'), snap =>
      setAllStores(snap.docs.map(d => ({ id: d.id, ...d.data() } as StoreProfile)))
    , () => {});
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'challenges'), where('type', '==', 'standard'), where('status', '==', 'active'));
    return onSnapshot(q, snap =>
      setChallenges(snap.docs.map(d => ({ id: d.id, ...d.data() } as Challenge)))
    , () => {});
  }, []);

  const storeDeals = allStores.filter(s => s.reward || s.stamps_required_for_reward);
  const experiences = challenges.filter(c => c.rewardTag === 'experience');
  const services = challenges.filter(c => c.rewardTag === 'service');
  const products = challenges.filter(c => c.rewardTag === 'product');

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-brand-navy">Deals</h1>
        <p className="text-brand-navy/50 text-sm mt-0.5">Rewards waiting for you</p>
      </div>

      <StoreDealsSection
        stores={storeDeals}
        onViewStore={onViewStore}
        showAll={showAllHot}
        onToggleAll={() => setShowAllHot(v => !v)}
      />

      <DealSliderSection
        title="Experiences"
        icon={<Star size={15} className="text-purple-500" />}
        challenges={experiences}
        stores={allStores}
        onViewChallenge={onViewChallenge}
        showAll={showAllExp}
        onToggleAll={() => setShowAllExp(v => !v)}
      />

      <DealSliderSection
        title="Services"
        icon={<Tag size={15} className="text-sky-500" />}
        challenges={services}
        stores={allStores}
        onViewChallenge={onViewChallenge}
        showAll={showAllSvc}
        onToggleAll={() => setShowAllSvc(v => !v)}
      />

      <DealSliderSection
        title="Products"
        icon={<Package size={15} className="text-emerald-500" />}
        challenges={products}
        stores={allStores}
        onViewChallenge={onViewChallenge}
        showAll={showAllProd}
        onToggleAll={() => setShowAllProd(v => !v)}
      />

      {storeDeals.length === 0 && experiences.length === 0 && services.length === 0 && products.length === 0 && (
        <div className="py-20 text-center text-brand-navy/20">
          <Gift size={64} className="mx-auto mb-4 opacity-20" />
          <p className="font-bold">No deals yet</p>
          <p className="text-sm">Check back soon for rewards and challenges</p>
        </div>
      )}
    </div>
  );
}

function ForYouScreen({ onViewUser, onViewStore, onViewChallenges, currentUser, currentProfile, userCards = [] }: { onViewUser: (u: UserProfile) => void, onViewStore?: (s: StoreProfile) => void, onViewChallenges?: () => void, currentUser?: FirebaseUser, currentProfile?: UserProfile | null, userCards?: Card[] }) {
  const [globalPosts, setGlobalPosts] = useState<GlobalPost[]>([]);
  const [vendorPosts, setVendorPosts] = useState<any[]>([]);
  const [followingUids, setFollowingUids] = useState<Set<string>>(new Set());
  const [followingStoreIds, setFollowingStoreIds] = useState<Set<string>>(new Set());
  const [hotStores, setHotStores] = useState<StoreProfile[]>([]);
  const [storeDistances, setStoreDistances] = useState<Map<string, number>>(new Map());
  const [joiningStoreId, setJoiningStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'discovery' | 'following'>('discovery');
  const [showAllDeals, setShowAllDeals] = useState(false);
  const [feedChallenges, setFeedChallenges] = useState<Challenge[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [dailyWheelOpen, setDailyWheelOpen] = useState(false);
  const [spinTimeLeft, setSpinTimeLeft] = useState('');
  const [spinWiggle, setSpinWiggle] = useState(false);
  const [lbPeriod, setLbPeriod] = useState<'alltime' | 'weekly'>('alltime');
  const [lbCategory, setLbCategory] = useState<'stamps' | 'rewards' | 'challenges' | 'streak' | 'monopoly'>('stamps');
  const [lbUsers, setLbUsers] = useState<UserProfile[]>([]);
  const [challengeCounts, setChallengeCounts] = useState<Map<string, number>>(new Map());
  const [lbLoading, setLbLoading] = useState(false);
  const [challengeIdx, setChallengeIdx] = useState(0);
  const lastDocRef = useRef<any>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const PAGE_SIZE = 10;

  const loadInitial = () => {
    setLoading(true);
    return onSnapshot(
      query(collection(db, 'global_posts'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE)),
      (snap) => {
        setGlobalPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as GlobalPost)));
        lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
        setHasMore(snap.docs.length === PAGE_SIZE);
        setLoading(false);
      },
      (err) => { console.error("global_posts:", err); setLoading(false); }
    );
  };

  const loadMoreRef = useRef(false);

  const loadMore = async () => {
    if (loadMoreRef.current || !hasMore || !lastDocRef.current) return;
    loadMoreRef.current = true;
    setLoadingMore(true);
    try {
      const snap = await getDocs(query(collection(db, 'global_posts'), orderBy('createdAt', 'desc'), startAfter(lastDocRef.current), limit(PAGE_SIZE)));
      setGlobalPosts(prev => [...prev, ...snap.docs.map(d => ({ id: d.id, ...d.data() } as GlobalPost))]);
      lastDocRef.current = snap.docs[snap.docs.length - 1] ?? lastDocRef.current;
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err) { console.error("load more:", err); }
    loadMoreRef.current = false;
    setLoadingMore(false);
  };

  useEffect(() => { return loadInitial(); }, []);

  // Re-observe whenever posts change so sentinel is re-checked after each page loads
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) loadMore(); }, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [globalPosts.length, hasMore]);

  useEffect(() => {
    const unsubVendor = onSnapshot(
      query(collectionGroup(db, 'posts'), orderBy('createdAt', 'desc'), limit(20)),
      (snap) => setVendorPosts(snap.docs.map(d => ({ id: d.id, _type: 'vendor', storeId: d.ref.parent.parent?.id, ...d.data() }))),
      (err) => console.error("vendor posts:", err)
    );
    return () => unsubVendor();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'follows'), where('followerUid', '==', currentUser.uid));
    return onSnapshot(q, (snap) => {
      setFollowingUids(new Set(snap.docs.map(d => d.data().followingUid as string)));
    });
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'store_follows'), where('followerUid', '==', currentUser.uid));
    return onSnapshot(q, (snap) => {
      setFollowingStoreIds(new Set(snap.docs.map(d => d.data().storeId as string)));
    }, () => {});
  }, [currentUser?.uid]);

  const geocodeCache = useRef<Map<string, { lat: number; lng: number } | null>>(new Map());

  const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    if (geocodeCache.current.has(address)) return geocodeCache.current.get(address)!;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      const result = data[0] ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
      geocodeCache.current.set(address, result);
      return result;
    } catch {
      geocodeCache.current.set(address, null);
      return null;
    }
  };

  const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const [allStores, setAllStores] = useState<StoreProfile[]>([]);

  useEffect(() => {
    return onSnapshot(collection(db, 'stores'), (snap) => {
      setAllStores(snap.docs.map(d => ({ id: d.id, ...d.data() } as StoreProfile)));
    }, () => {});
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'challenges'), where('type', '==', 'standard'), where('status', '==', 'active'));
    return onSnapshot(q, snap =>
      setFeedChallenges(snap.docs.map(d => ({ id: d.id, ...d.data() } as Challenge)))
    , () => {});
  }, []);

  useEffect(() => {
    if (feedChallenges.length <= 1) return;
    const t = setInterval(() => setChallengeIdx(i => (i + 1) % feedChallenges.length), 2800);
    return () => clearInterval(t);
  }, [feedChallenges.length]);

  useEffect(() => {
    if (!showLeaderboard || lbUsers.length > 0) return;
    setLbLoading(true);
    (async () => {
      try {
        const [usersSnap, entriesSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'challenge_entries')),
        ]);
        const counts = new Map<string, number>();
        for (const d of entriesSnap.docs) {
          const uid = d.data().uid;
          if (uid) counts.set(uid, (counts.get(uid) || 0) + 1);
        }
        setChallengeCounts(counts);
        setLbUsers(usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
      } catch (e) { console.error(e); }
      setLbLoading(false);
    })();
  }, [showLeaderboard]);

  useEffect(() => {
    const userLoc = currentProfile?.location as { lat: number; lng: number } | undefined;
    if (!userLoc?.lat) { setHotStores(allStores); return; }

    // Sort stores so nearby ones appear first; always include all stores so the
    // slider is never empty just because nothing is within the proximity radius.
    let cancelled = false;
    (async () => {
      const nearby: StoreProfile[] = [];
      const rest: StoreProfile[] = [];
      const distances = new Map<string, number>();
      for (const store of allStores) {
        let coords: { lat: number; lng: number } | null = null;
        if (store.lat && store.lng) {
          coords = { lat: store.lat, lng: store.lng };
        } else {
          const addr = store.address || store.location;
          if (addr) coords = await geocodeAddress(addr);
          if (allStores.indexOf(store) < allStores.length - 1) {
            await new Promise(r => setTimeout(r, 1100)); // Nominatim rate limit: 1 req/s
          }
        }
        if (coords) {
          const km = haversineKm(userLoc.lat, userLoc.lng, coords.lat, coords.lng);
          distances.set(store.id, km);
          if (km <= 15) nearby.push(store); else rest.push(store);
        } else {
          rest.push(store);
        }
      }
      if (!cancelled) { setHotStores([...nearby, ...rest]); setStoreDistances(distances); }
    })();
    return () => { cancelled = true; };
  }, [allStores, currentProfile?.location]);

  const handleJoinStore = async (store: StoreProfile) => {
    if (!currentUser) return;
    setJoiningStoreId(store.id);
    try {
      const cardId = `${currentUser.uid}_${store.id}`;
      const cardRef = doc(db, 'cards', cardId);
      const cardSnap = await getDoc(cardRef);
      if (!cardSnap.exists() || cardSnap.data()?.isArchived) {
        const userName = currentProfile?.name || currentUser.displayName || 'Loyal Customer';
        const userPhoto = currentProfile?.photoURL || currentUser.photoURL || '';
        await setDoc(cardRef, {
          user_id: currentUser.uid,
          store_id: store.id,
          current_stamps: 0,
          total_completed_cycles: 0,
          stamps_required: store.stamps_required_for_reward || 10,
          last_tap_timestamp: serverTimestamp(),
          isArchived: false,
          isRedeemed: false,
          userName,
          userPhoto,
        });
        await updateDoc(doc(db, 'users', currentUser.uid), { total_cards_held: increment(1) });
      }
      if (onViewStore) onViewStore(store);
    } catch (err) { console.error(err); }
    setJoiningStoreId(null);
  };

  const handleLike = async (post: GlobalPost) => {
    if (!currentUser) return;
    const ref = doc(db, 'global_posts', post.id);
    const alreadyLiked = (post.likedBy || []).includes(currentUser.uid);
    await updateDoc(ref, {
      likedBy: alreadyLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
      likesCount: alreadyLiked ? Math.max(0, post.likesCount - 1) : post.likesCount + 1
    });
    if (!alreadyLiked && post.authorUid !== currentUser.uid) {
      // Fetch fresh profile to avoid stale/null currentProfile
      const senderSnap = await getDoc(doc(db, 'users', currentUser.uid)).catch(() => null);
      const senderData = senderSnap?.exists() ? senderSnap.data() : null;
      const senderName = senderData?.name || currentProfile?.name || currentUser.displayName || 'Someone';
      const senderPhoto = senderData?.photoURL || currentProfile?.photoURL || currentUser.photoURL || '';
      addDoc(collection(db, 'notifications'), {
        toUid: post.authorUid,
        fromUid: currentUser.uid,
        fromName: senderName,
        fromPhoto: senderPhoto,
        type: 'like',
        message: 'liked your post',
        isRead: false,
        createdAt: serverTimestamp(),
      }).catch(() => {});
    }
  };

  const handleVote = async (post: GlobalPost, optionIndex: number) => {
    if (!currentUser) return;
    const ref = doc(db, 'global_posts', post.id);
    const votes = post.pollVotes || {};
    const currentVoteKey = Object.keys(votes).find(k => (votes[k] || []).includes(currentUser.uid));
    const updates: any = {};
    if (currentVoteKey !== undefined) {
      updates[`pollVotes.${currentVoteKey}`] = arrayRemove(currentUser.uid);
    }
    if (currentVoteKey !== String(optionIndex)) {
      updates[`pollVotes.${optionIndex}`] = arrayUnion(currentUser.uid);
    }
    if (Object.keys(updates).length > 0) await updateDoc(ref, updates);
  };

  const sortedFeed = [...globalPosts, ...vendorPosts].sort((a, b) => {
    const tA = a.createdAt?.toMillis?.() || 0;
    const tB = b.createdAt?.toMillis?.() || 0;
    return tB - tA;
  });

  const displayFeed = sortedFeed;

  const followingFeed = sortedFeed.filter(item => {
    if (!item._type) return followingUids.has(item.authorUid);
    return followingStoreIds.has(item.storeId || '');
  });

  const totalActivePlayers = new Set(feedChallenges.flatMap(c => c.participantUids || [])).size;
  const storeParticipantMap = new Map<string, number>();
  for (const ch of feedChallenges) {
    const sids = ch.vendorIds?.length ? ch.vendorIds : allStores.map(s => s.id);
    const cnt = ch.participantUids?.length || 0;
    for (const sid of sids) storeParticipantMap.set(sid, (storeParticipantMap.get(sid) || 0) + cnt);
  }
  const topVendors = [...allStores]
    .filter(s => storeParticipantMap.has(s.id))
    .sort((a, b) => (storeParticipantMap.get(b.id) || 0) - (storeParticipantMap.get(a.id) || 0))
    .slice(0, 3);

  const today = new Date().toISOString().slice(0, 10);
  const alreadySpun = currentProfile?.avatar?.lastWheelSpin === today;
  const spinsAvailable = alreadySpun ? 0 : 1;

  // Countdown timer to midnight
  useEffect(() => {
    if (!alreadySpun) { setSpinTimeLeft(''); return; }
    const tick = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setSpinTimeLeft(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [alreadySpun]);

  // Button wiggle animation every 4s when spin is available
  useEffect(() => {
    if (alreadySpun) return;
    const id = setInterval(() => {
      setSpinWiggle(true);
      setTimeout(() => setSpinWiggle(false), 700);
    }, 4000);
    return () => clearInterval(id);
  }, [alreadySpun]);

  return (
    <div className="space-y-5 pb-20">
      {/* Daily wheel modal */}
      <AnimatePresence>
        {dailyWheelOpen && currentUser && currentProfile && (
          <DailyWheelModal
            inventory={currentProfile.avatar?.inventory ?? []}
            lastSpin={currentProfile.avatar?.lastWheelSpin}
            onClose={() => setDailyWheelOpen(false)}
            onWin={async (itemId) => {
              const d = new Date().toISOString().slice(0, 10);
              await updateDoc(doc(db, 'users', currentUser.uid), {
                'avatar.inventory': arrayUnion(itemId),
                'avatar.lastWheelSpin': d,
              });
              bumpStreak(currentUser.uid).catch(console.error);
            }}
            timerLabel={alreadySpun ? spinTimeLeft : undefined}
          />
        )}
      </AnimatePresence>

      {/* Tab bar + spin button */}
      <div className="relative flex justify-center items-center gap-6">
        {(['discovery', 'following'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={cn(
              "pb-0.5 text-[11px] font-semibold tracking-widest uppercase transition-all border-b",
              activeSubTab === tab ? "text-gray-500 border-gray-400" : "text-gray-300 border-transparent"
            )}
          >
            {tab === 'discovery' ? 'Discovery' : 'Following'}
          </button>
        ))}

        {/* Spin button — top right */}
        <div className="absolute right-0 flex flex-col items-center gap-0.5">
          <div className="relative">
            <motion.button
              onClick={() => setDailyWheelOpen(true)}
              animate={spinWiggle ? { rotate: [0, -25, 25, -15, 15, 0] } : { rotate: 0 }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-lg shadow-sm transition-all active:scale-90",
                alreadySpun ? "bg-gray-100" : "bg-brand-gold/15"
              )}
            >
              🎡
            </motion.button>
            {spinsAvailable > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand-gold text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {spinsAvailable}
              </span>
            )}
          </div>
          {alreadySpun && spinTimeLeft ? (
            <span className="text-[9px] text-gray-300 font-mono leading-none">{spinTimeLeft}</span>
          ) : null}
        </div>
      </div>

      {activeSubTab === 'following' ? (
        loading ? <FeedLoadingSpinner /> : (
          <div className="space-y-4">
            {followingFeed.map((item) =>
              !item._type
                ? <FeedPostCard key={`gp-${item.id}`} post={item as GlobalPost} currentUser={currentUser} currentProfile={currentProfile} onViewUser={onViewUser} onViewStore={onViewStore} onLike={handleLike} onVote={handleVote} onDelete={async (p) => { await deleteDoc(doc(db, 'global_posts', p.id)); }} />
                : <React.Fragment key={`vp-${item.id}`}><FeedVendorPostCard item={item} /></React.Fragment>
            )}
            {followingFeed.length === 0 && (
              <div className="py-20 text-center text-brand-navy/20">
                <Compass size={64} className="mx-auto mb-4 opacity-10" />
                <p className="font-bold">No posts from people you follow</p>
                <p className="text-sm">Follow people to see their posts here</p>
              </div>
            )}
          </div>
        )
      ) : (
        <>
          {/* Total savings widget */}
          {(currentProfile?.totalSaved ?? 0) > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4 rounded-[1.5rem] bg-emerald-50 border border-emerald-200 px-5 py-4"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 shadow-sm">
                <span className="text-white text-xl font-black">£</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Total Saved with Linq</p>
                <CountUpValue value={currentProfile!.totalSaved!} prefix="£" className="font-display text-2xl font-black text-emerald-600" />
              </div>
            </motion.div>
          )}

          {/* Challenges card + Leaderboard button — side by side */}
          {(feedChallenges.length > 0 || true) && (
            <div className="flex gap-3 items-stretch">

              {/* Single cycling challenges card with confetti */}
              {feedChallenges.length > 0 && (
                <div
                  className="flex-1 relative rounded-[1.5rem] overflow-hidden cursor-pointer active:scale-[0.97] transition-transform"
                  style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 55%, #C084FC 100%)', minHeight: '148px' }}
                  onClick={() => onViewChallenges?.()}
                >
                  {/* Challenge image background */}
                  <AnimatePresence mode="wait">
                    {feedChallenges[challengeIdx % feedChallenges.length]?.imageUrl && (
                      <motion.div
                        key={`img-${challengeIdx}`}
                        className="absolute inset-0"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                      >
                        <img src={feedChallenges[challengeIdx % feedChallenges.length].imageUrl} alt="" className="w-full h-full object-cover" style={{ opacity: 0.45 }} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {/* Confetti particles */}
                  {[
                    { x: 8,  y: 18, color: '#FFD700', size: 6, delay: 0,   dur: 2.2 },
                    { x: 28, y: 72, color: '#FF6B6B', size: 4, delay: 0.4, dur: 1.8 },
                    { x: 50, y: 35, color: '#4ADE80', size: 5, delay: 0.8, dur: 2.5 },
                    { x: 72, y: 62, color: '#60A5FA', size: 4, delay: 0.2, dur: 2.0 },
                    { x: 88, y: 22, color: '#F9A8D4', size: 6, delay: 0.6, dur: 1.9 },
                    { x: 62, y: 82, color: '#FFD700', size: 3, delay: 1.0, dur: 2.3 },
                    { x: 18, y: 55, color: '#4ADE80', size: 4, delay: 1.2, dur: 2.1 },
                    { x: 92, y: 48, color: '#FF6B6B', size: 5, delay: 0.5, dur: 1.7 },
                    { x: 40, y: 88, color: '#60A5FA', size: 3, delay: 0.9, dur: 2.4 },
                    { x: 78, y: 10, color: '#F9A8D4', size: 4, delay: 0.3, dur: 2.0 },
                  ].map((p, i) => (
                    <motion.div
                      key={i}
                      className="absolute rounded-sm pointer-events-none"
                      style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, background: p.color }}
                      animate={{ y: [-4, -14, -4], rotate: [0, 180, 360], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
                    />
                  ))}

                  {/* Content */}
                  <div className="relative z-10 p-4 h-full flex flex-col justify-between" style={{ minHeight: '148px' }}>
                    <div>
                      <p className="text-white/70 text-[9px] font-black uppercase tracking-widest mb-1.5">Win</p>
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={challengeIdx}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.35 }}
                        >
                          <p className="text-white font-black text-base leading-snug line-clamp-2">
                            {feedChallenges[challengeIdx % feedChallenges.length]?.reward}
                          </p>
                          <p className="text-white/50 text-[10px] mt-1 line-clamp-1">
                            {feedChallenges[challengeIdx % feedChallenges.length]?.title}
                          </p>
                        </motion.div>
                      </AnimatePresence>
                    </div>
                    {/* Dot indicators */}
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-white/50 text-[9px] font-bold">{feedChallenges.length} prizes</p>
                      <div className="flex gap-1 items-center">
                        {feedChallenges.slice(0, Math.min(feedChallenges.length, 5)).map((_, i) => (
                          <div key={i} className={cn('rounded-full transition-all duration-300', i === (challengeIdx % feedChallenges.length) ? 'w-3 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/30')} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Leaderboard square button */}
              <button
                onClick={() => {
                  setShowLeaderboard(true);
                  confetti({ particleCount: 80, spread: 60, startVelocity: 30, gravity: 0.8, scalar: 0.9, origin: { y: 0.6 }, zIndex: 9999, colors: ['#FFD700', '#FFC200', '#FFE566', '#FFAA00', '#FFF8DC'] });
                }}
                className="relative rounded-[1.5rem] overflow-hidden active:scale-[0.97] transition-transform shrink-0"
                style={{ background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 50%, #3B82F6 100%)', width: feedChallenges.length > 0 ? '136px' : '100%', minHeight: '148px' }}
              >
                {/* Medal top-left */}
                <div className="absolute top-3 left-3 text-lg leading-none">🥇</div>
                {/* Rotating sparkle that fades in and out */}
                <motion.div
                  className="absolute top-3 right-3"
                  animate={{ rotate: [0, 360], opacity: [0, 1, 1, 1, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
                >
                  <Sparkles size={13} className="text-yellow-300" />
                </motion.div>
                {/* Golden confetti overlay */}
                {[
                  { x: 12, y: 20, color: '#FFD700', size: 5, delay: 0,   dur: 2.1 },
                  { x: 75, y: 65, color: '#FFC200', size: 4, delay: 0.5, dur: 1.8 },
                  { x: 45, y: 40, color: '#FFE566', size: 6, delay: 0.9, dur: 2.4 },
                  { x: 85, y: 25, color: '#FFAA00', size: 3, delay: 0.3, dur: 2.0 },
                  { x: 25, y: 75, color: '#FFD700', size: 4, delay: 0.7, dur: 1.9 },
                  { x: 60, y: 85, color: '#FFF8DC', size: 5, delay: 1.1, dur: 2.3 },
                  { x: 90, y: 50, color: '#FFC200', size: 3, delay: 0.2, dur: 2.2 },
                  { x: 35, y: 55, color: '#FFE566', size: 4, delay: 0.8, dur: 1.7 },
                ].map((p, i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-sm pointer-events-none"
                    style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, background: p.color }}
                    animate={{ y: [-4, -14, -4], rotate: [0, 180, 360], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
                  />
                ))}

                {/* Avatar + name + label */}
                <div className="relative z-10 h-full flex flex-col items-center justify-center gap-1.5 px-2 py-4" style={{ minHeight: '148px' }}>
                  <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-white/30 bg-indigo-50 flex items-center justify-center">
                    <PixelAvatar config={currentProfile?.avatar} uid={currentProfile?.uid || ''} size={48} view="head" />
                  </div>
                  <p className="text-white font-bold text-[10px] text-center leading-tight line-clamp-2 w-full px-1">
                    {currentProfile?.name || 'You'}
                  </p>
                  <p className="text-white/60 text-[8px] font-bold uppercase tracking-wider">Leaderboard</p>
                </div>
              </button>
            </div>
          )}

          {/* Leaderboard popup modal */}
          <AnimatePresence>
            {showLeaderboard && (() => {
              const getLbScore = (u: UserProfile) => {
                switch (lbCategory) {
                  case 'stamps': return u.totalStamps || 0;
                  case 'rewards': return u.totalRedeemed || 0;
                  case 'challenges': return challengeCounts.get(u.uid) || 0;
                  case 'streak': return u.streak || 0;
                  case 'monopoly': return u.total_cards_held || 0;
                }
              };
              const lbCategoryLabel = { stamps: 'Stamps', rewards: 'Rewards', challenges: 'Challenges', streak: 'Streak', monopoly: 'Monopoly' }[lbCategory];
              const lbCategoryUnit = { stamps: 'stamps', rewards: 'redeemed', challenges: 'entries', streak: 'day streak', monopoly: 'stores' }[lbCategory];
              const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
              const periodUsers = lbPeriod === 'weekly'
                ? lbUsers.filter(u => u.lastStreakDate && u.lastStreakDate >= sevenDaysAgo)
                : lbUsers;
              const allSorted = [...periodUsers].sort((a, b) => getLbScore(b) - getLbScore(a)).filter(u => getLbScore(u) > 0);
              const sorted = allSorted.slice(0, 10);
              const myRankIdx = allSorted.findIndex(u => u.uid === currentProfile?.uid);
              const myRank = myRankIdx >= 0 ? myRankIdx + 1 : null;
              const myRankInTopTen = myRank !== null && myRank <= 10;
              const podium = [sorted[1], sorted[0], sorted[2]];
              const podiumHeights = ['h-20', 'h-28', 'h-16'];
              const podiumColors = ['bg-brand-navy/10', 'bg-brand-gold/30', 'bg-brand-navy/5'];
              const podiumMedals = ['🥈', '🥇', '🥉'];
              const podiumIndexes = [1, 0, 2];
              return (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-end max-w-md mx-auto"
                  onClick={() => setShowLeaderboard(false)}
                >
                  <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="w-full bg-brand-bg rounded-t-[3rem] p-6 pb-12 space-y-4 max-h-[88vh] overflow-y-auto"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🏆</span>
                        <h3 className="font-display font-bold text-xl">Leaderboard</h3>
                      </div>
                      <button onClick={() => setShowLeaderboard(false)} className="p-2 rounded-full bg-brand-navy/8 active:scale-95 transition-all">
                        <X size={18} className="text-brand-navy" />
                      </button>
                    </div>

                    {/* Period tabs */}
                    <div className="flex gap-2 p-1 bg-white rounded-2xl border border-brand-navy/5">
                      {(['alltime', 'weekly'] as const).map(p => (
                        <button key={p} onClick={() => setLbPeriod(p)}
                          className={cn('flex-1 py-2 rounded-xl text-xs font-bold transition-all', lbPeriod === p ? 'gradient-red text-white shadow' : 'text-brand-navy/40')}>
                          {p === 'alltime' ? 'All Time' : 'This Week'}
                        </button>
                      ))}
                    </div>

                    {/* Category pills */}
                    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                      {([
                        { key: 'stamps', label: 'Stamps', icon: '🏷️' },
                        { key: 'rewards', label: 'Rewards', icon: '🎁' },
                        { key: 'challenges', label: 'Challenges', icon: '🏆' },
                        { key: 'streak', label: 'Streak', icon: '🔥' },
                        { key: 'monopoly', label: 'Monopoly', icon: '🎯' },
                      ] as const).map(({ key, label, icon }) => (
                        <button key={key} onClick={() => setLbCategory(key)}
                          className={cn('shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all', lbCategory === key ? 'gradient-red text-white shadow' : 'bg-white border border-brand-navy/10 text-brand-navy/50')}>
                          <span>{icon}</span>{label}
                        </button>
                      ))}
                    </div>

                    {lbLoading ? (
                      <div className="flex justify-center py-8">
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
                          <Sparkles className="w-6 h-6 text-brand-gold/60" />
                        </motion.div>
                      </div>
                    ) : sorted.length === 0 ? (
                      <div className="py-10 text-center text-brand-navy/30">
                        <Trophy size={40} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-bold">No data yet</p>
                      </div>
                    ) : (
                      <>
                        <div className="glass-card rounded-[2rem] p-4 pt-6">
                          <p className="text-center text-[10px] font-bold text-brand-navy/30 uppercase tracking-widest mb-4">{lbCategoryLabel} Leaders</p>
                          <div className="flex items-end justify-center gap-3 mb-2">
                            {podium.map((u, col) => {
                              const rank = podiumIndexes[col];
                              if (!u) return <div key={col} className="w-[30%]" />;
                              return (
                                <div key={u.uid} className="flex flex-col items-center w-[30%]" onClick={() => { setShowLeaderboard(false); onViewUser(u); }} style={{ cursor: 'pointer' }}>
                                  <span className="text-lg mb-0.5">{podiumMedals[col]}</span>
                                  <div className={cn('w-12 h-12 rounded-2xl overflow-hidden border-2 bg-indigo-50 flex items-center justify-center mb-1', rank === 0 ? 'border-brand-gold shadow-lg shadow-brand-gold/30' : 'border-brand-navy/10')}>
                                    <PixelAvatar config={u.avatar} uid={u.uid} size={48} view="head" />
                                  </div>
                                  <p className="text-[10px] font-bold text-brand-navy text-center leading-tight line-clamp-1 w-full">{u.name}</p>
                                  <p className={cn('text-[11px] font-black mt-0.5', rank === 0 ? 'text-brand-gold' : 'text-brand-navy/50')}>{getLbScore(u)}</p>
                                  <div className={cn('w-full rounded-t-xl mt-1', podiumColors[col], podiumHeights[col])} />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        {sorted.length > 3 && (
                          <div className="space-y-2">
                            {sorted.slice(3).map((u, i) => (
                              <div key={u.uid} onClick={() => { setShowLeaderboard(false); onViewUser(u); }} className="glass-card p-3 rounded-2xl flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform">
                                <div className="w-6 font-display font-bold text-brand-navy/30 text-sm text-center">#{i + 4}</div>
                                <div className="w-8 h-8 rounded-xl overflow-hidden bg-indigo-50 flex items-center justify-center shrink-0">
                                  <PixelAvatar config={u.avatar} uid={u.uid} size={32} view="head" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1"><p className="font-bold text-xs truncate">{u.name}</p><StreakBadge streak={u.streak} /></div>
                                </div>
                                <p className="font-black text-sm text-brand-navy/70 shrink-0">{getLbScore(u)} <span className="text-[10px] font-medium text-brand-navy/30">{lbCategoryUnit}</span></p>
                              </div>
                            ))}
                          </div>
                        )}
                        {!myRankInTopTen && myRank !== null && currentProfile && (
                          <div className="mt-1 space-y-1">
                            <p className="text-center text-[10px] text-brand-navy/30 font-bold uppercase tracking-widest">Your position</p>
                            <div className="glass-card p-3 rounded-2xl flex items-center gap-3 border border-brand-gold/20 bg-brand-gold/5">
                              <div className="w-6 font-display font-bold text-brand-gold text-sm text-center">#{myRank}</div>
                              <div className="w-8 h-8 rounded-xl overflow-hidden bg-indigo-50 flex items-center justify-center shrink-0">
                                <PixelAvatar config={currentProfile.avatar} uid={currentProfile.uid} size={32} view="head" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1"><p className="font-bold text-xs truncate">{currentProfile.name}</p><StreakBadge streak={currentProfile.streak} /></div>
                              </div>
                              <p className="font-black text-sm text-brand-navy/70 shrink-0">{getLbScore(currentProfile)} <span className="text-[10px] font-medium text-brand-navy/30">{lbCategoryUnit}</span></p>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </motion.div>
                </motion.div>
              );
            })()}
          </AnimatePresence>

          {/* Main mixed feed */}
          {loading ? <FeedLoadingSpinner /> : (
            <div className="space-y-4">
              {displayFeed.map((item) =>
                !item._type
                  ? <FeedPostCard key={`gp-${item.id}`} post={item as GlobalPost} currentUser={currentUser} currentProfile={currentProfile} onViewUser={onViewUser} onViewStore={onViewStore} onLike={handleLike} onVote={handleVote} onDelete={async (p) => { await deleteDoc(doc(db, 'global_posts', p.id)); }} />
                  : <React.Fragment key={`vp-${item.id}`}><FeedVendorPostCard item={item} /></React.Fragment>
              )}
              {displayFeed.length === 0 && (
                <div className="py-20 text-center text-brand-navy/20">
                  <Compass size={64} className="mx-auto mb-4 opacity-10" />
                  <p className="font-bold">Nothing posted yet</p>
                  <p className="text-sm">Be the first to post!</p>
                </div>
              )}
              <div ref={sentinelRef} className="h-4" />
              {loadingMore && (
                <div className="flex justify-center py-4">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
                    <Sparkles className="w-5 h-5 text-brand-gold/50" />
                  </motion.div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* All Deals modal */}
      {showAllDeals && (
        <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="flex-1 overflow-y-auto bg-[#f8f9fc] rounded-t-3xl mt-12">
            <div className="sticky top-0 bg-[#f8f9fc] z-10 px-5 pt-5 pb-3 flex items-center justify-between border-b border-brand-navy/5">
              <div>
                <h2 className="font-extrabold text-brand-navy text-lg">All Deals Near You</h2>
                <p className="text-brand-navy/40 text-xs mt-0.5">{(hotStores.length > 0 ? hotStores : allStores).length} businesses</p>
              </div>
              <button onClick={() => setShowAllDeals(false)} className="w-9 h-9 rounded-full bg-brand-navy/10 flex items-center justify-center active:scale-95 transition-transform">
                <X size={16} className="text-brand-navy" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4 pb-10">
              {(hotStores.length > 0 ? hotStores : allStores).map((store, i) => {
                const dealColor = DEAL_COLORS[i % DEAL_COLORS.length];
                const joined = userCards.some(c => c.store_id === store.id && !c.isArchived);
                const isJoining = joiningStoreId === store.id;
                return (
                  <motion.div
                    key={store.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="rounded-[1.75rem] overflow-hidden flex flex-col cursor-pointer active:scale-[0.97] transition-transform"
                    style={{ height: '160px' }}
                    onClick={() => { onViewStore && onViewStore(store); setShowAllDeals(false); }}
                  >
                    {/* Top half — logo */}
                    <div className="flex-1 overflow-hidden relative bg-white/10">
                      {store.logoUrl
                        ? <img src={store.logoUrl} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center bg-brand-navy/5"><Building2 size={24} className="text-brand-navy/30" /></div>}
                      {store.isVerified && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-white/80 rounded-full flex items-center justify-center shadow">
                          <Sparkles size={11} className="text-brand-navy" />
                        </div>
                      )}
                    </div>
                    {/* Bottom half — gradient-logo-blue */}
                    <div className="gradient-logo-blue px-3 py-2.5 flex flex-col justify-between relative overflow-hidden" style={{ height: '80px' }}>
                      <span className="shine-ray" aria-hidden="true" />
                      <div className="relative z-10">
                        <p className="font-extrabold text-white text-xs leading-tight line-clamp-2">
                          {store.reward || `${store.stamps_required_for_reward} stamps to reward`}
                        </p>
                        <p className="text-white/60 text-[9px] font-medium mt-0.5 line-clamp-1">{store.name}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (!joined) handleJoinStore(store); else { onViewStore && onViewStore(store); setShowAllDeals(false); } }}
                        disabled={isJoining}
                        className={cn(
                          "w-full py-1.5 rounded-xl text-[10px] font-bold transition-all active:scale-95 flex items-center justify-center gap-1 relative z-10",
                          joined ? "bg-white/20 text-white/80" : "bg-white text-brand-navy shadow"
                        )}
                      >
                        {isJoining
                          ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Sparkles size={11} /></motion.div>
                          : joined ? <><UserCheck size={11} /> Joined</> : <><Plus size={11} /> Join</>}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessagesScreen({ currentUser, currentProfile, activeChatId, setActiveChatId, onViewUser, vendorStore, storeCards = [] }: { currentUser: FirebaseUser, currentProfile: UserProfile | null, activeChatId: string | null, setActiveChatId: (id: string | null) => void, onViewUser: (u: UserProfile) => void, vendorStore?: StoreProfile | null, storeCards?: Card[] }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [olderMessages, setOlderMessages] = useState<ChatMessage[]>([]);
  const [msgHasMore, setMsgHasMore] = useState(false);
  const [msgLoadingMore, setMsgLoadingMore] = useState(false);
  const msgLastDocRef = useRef<any>(null);
  const msgLoadingMoreRef = useRef(false);
  const [newMessage, setNewMessage] = useState('');
  const [chatPartner, setChatPartner] = useState<UserProfile | null>(null);
  const [activeChatBusinessInfo, setActiveChatBusinessInfo] = useState<{ businessName: string; businessLogoUrl: string } | null>(null);
  const [activeBroadcastChat, setActiveBroadcastChat] = useState<{ storeName: string; storeLogoUrl: string } | null>(null);
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [storeCustomers, setStoreCustomers] = useState<UserProfile[]>([]);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'chats'),
      where('uids', 'array-contains', currentUser.uid),
      orderBy('lastActivity', 'desc')
    );
    return onSnapshot(q, (snap) => {
      setChats(snap.docs.map(d => ({ id: d.id, ...d.data() } as Chat)));
    });
  }, [currentUser.uid]);

  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      setOlderMessages([]);
      setMsgHasMore(false);
      msgLastDocRef.current = null;
      setChatPartner(null);
      setActiveChatBusinessInfo(null);
      setActiveBroadcastChat(null);
      return;
    }
    setOlderMessages([]);
    setMsgHasMore(false);
    msgLastDocRef.current = null;
    setActiveChatBusinessInfo(null);
    setActiveBroadcastChat(null);

    // Fetch partner — poll briefly if doc not yet created (race with background creation)
    const loadPartner = async (retries = 5) => {
      try {
        const chatSnap = await getDoc(doc(db, 'chats', activeChatId));
        if (!chatSnap.exists()) {
          if (retries > 0) { setTimeout(() => loadPartner(retries - 1), 600); }
          return;
        }
        const chatData = chatSnap.data();
        const unreadCount = chatData.unreadCount || {};
        if (unreadCount[currentUser.uid]) {
          updateDoc(doc(db, 'chats', activeChatId), { [`unreadCount.${currentUser.uid}`]: 0 }).catch(() => {});
        }
        if (chatData.isBroadcast) {
          setActiveBroadcastChat({ storeName: chatData.storeName || 'Business', storeLogoUrl: chatData.storeLogoUrl || '' });
          return;
        }
        if (chatData.businessName) {
          setActiveChatBusinessInfo({ businessName: chatData.businessName, businessLogoUrl: chatData.businessLogoUrl || '' });
        }
        const partnerUid = (chatData.uids as string[]).find(id => id !== currentUser.uid);
        if (!partnerUid) return;
        let userSnap = await getDoc(doc(db, 'users', partnerUid));
        if (!userSnap.exists()) userSnap = await getDoc(doc(db, 'vendors', partnerUid));
        if (userSnap.exists()) {
          const partnerData = { uid: userSnap.id, ...userSnap.data() } as UserProfile;
          setChatPartner(partnerData);
          // Backfill businessName for existing chats where partner is a vendor
          if (partnerData.role === 'vendor' && !chatData.businessName) {
            const storeSnap = await getDocs(query(collection(db, 'stores'), where('ownerUid', '==', partnerUid)));
            if (!storeSnap.empty) {
              const store = storeSnap.docs[0].data();
              const biz = { businessName: store.name as string, businessLogoUrl: (store.logoUrl || '') as string };
              setActiveChatBusinessInfo(biz);
              updateDoc(doc(db, 'chats', activeChatId), biz).catch(() => {});
            }
          }
        }
      } catch { /* ignore permission errors on retry */ }
    };
    loadPartner();

    const q = query(
      collection(db, 'chats', activeChatId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(15)
    );
    return onSnapshot(q, (snap) => {
      const latest = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)).reverse();
      setMessages(latest);
      // The last doc in desc order is the oldest in this window — cursor for loading older
      if (snap.docs.length === 15) {
        msgLastDocRef.current = snap.docs[snap.docs.length - 1];
        setMsgHasMore(true);
      }
    });
  }, [activeChatId, currentUser.uid]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    let cancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) el.scrollTop = el.scrollHeight;
      });
    });
    return () => { cancelled = true; };
  }, [messages, activeChatId]);

  const loadOlderMessages = async () => {
    if (!activeChatId || msgLoadingMoreRef.current || !msgHasMore || !msgLastDocRef.current) return;
    msgLoadingMoreRef.current = true;
    setMsgLoadingMore(true);
    const el = scrollContainerRef.current;
    const prevScrollHeight = el?.scrollHeight ?? 0;
    try {
      const snap = await getDocs(query(
        collection(db, 'chats', activeChatId, 'messages'),
        orderBy('createdAt', 'desc'),
        startAfter(msgLastDocRef.current),
        limit(15)
      ));
      const older = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)).reverse();
      setOlderMessages(prev => [...older, ...prev]);
      msgLastDocRef.current = snap.docs.length === 15 ? snap.docs[snap.docs.length - 1] : null;
      setMsgHasMore(snap.docs.length === 15);
      // Restore scroll so content doesn't jump
      if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight - prevScrollHeight; });
    } catch { /* ignore */ }
    msgLoadingMoreRef.current = false;
    setMsgLoadingMore(false);
  };

  const handleMsgScroll = () => {
    const el = scrollContainerRef.current;
    if (el && el.scrollTop < 60) loadOlderMessages();
  };

  useEffect(() => {
    if (!vendorStore) return;
    const q = query(
      collection(db, 'cards'),
      where('store_id', '==', vendorStore.id),
      where('isArchived', '==', false)
    );
    const unsub = onSnapshot(q, async (snap) => {
      const userIds = [...new Set(snap.docs.map(d => d.data().user_id as string))];
      const profiles = await Promise.all(
        userIds.map(uid => getDoc(doc(db, 'users', uid)).then(s => s.exists() ? { uid: s.id, ...s.data() } as UserProfile : null))
      );
      setStoreCustomers(profiles.filter(Boolean) as UserProfile[]);
    });
    return unsub;
  }, [vendorStore]);

  const handleStartCustomerChat = async (customer: UserProfile) => {
    const chatId = [currentUser.uid, customer.uid].sort().join('_');
    setShowCustomerPicker(false);
    setActiveChatId(chatId);
    try {
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);
      const businessFields = vendorStore
        ? { businessName: vendorStore.name, businessLogoUrl: vendorStore.logoUrl || '' }
        : {};
      if (!chatSnap.exists()) {
        await setDoc(chatRef, {
          uids: [currentUser.uid, customer.uid],
          lastActivity: serverTimestamp(),
          lastMessage: '',
          createdAt: serverTimestamp(),
          ...businessFields,
        });
      } else if (vendorStore && !chatSnap.data()?.businessName) {
        await updateDoc(chatRef, businessFields);
      }
    } catch (err) {
      console.error('Chat create error:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeChatId) return;
    const text = newMessage;
    setNewMessage('');

    try {
      const messageData = {
        chatId: activeChatId,
        senderUid: currentUser.uid,
        senderName: currentProfile?.name || currentUser.displayName || 'Me',
        text,
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'chats', activeChatId, 'messages'), messageData);
      
      const partnerUid = chatPartner?.uid;
      await updateDoc(doc(db, 'chats', activeChatId), {
        lastMessage: text,
        lastActivity: serverTimestamp(),
        ...(partnerUid ? { [`unreadCount.${partnerUid}`]: increment(1) } : {})
      });

      // Send notification to partner
      if (partnerUid) {
        await addDoc(collection(db, 'notifications'), {
          toUid: partnerUid,
          fromUid: currentUser.uid,
          fromName: currentProfile?.name || currentUser.displayName || 'Friend',
          fromPhoto: currentProfile?.photoURL || currentUser.photoURL || '',
          type: 'message',
          message: `New message: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`,
          isRead: false,
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error("Send message error:", err);
    }
  };

  if (activeChatId && activeBroadcastChat) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="fixed inset-0 bg-brand-bg z-[100] flex flex-col max-w-md mx-auto"
      >
        <header className="glass-panel px-6 py-4 flex items-center gap-4">
          <button onClick={() => setActiveChatId(null)} className="p-2 -ml-2 text-brand-navy/60">
            <ArrowLeft size={24} />
          </button>
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-white shadow-sm bg-brand-navy/5 flex items-center justify-center shrink-0">
              {activeBroadcastChat.storeLogoUrl
                ? <img src={activeBroadcastChat.storeLogoUrl} alt="" className="w-full h-full object-cover" />
                : <Store size={18} className="text-brand-navy/50" />}
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight">{activeBroadcastChat.storeName}</h3>
              <p className="text-[10px] text-brand-navy/40 font-bold uppercase tracking-widest">Broadcast</p>
            </div>
          </div>
        </header>
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto py-4 space-y-3 px-4" onScroll={handleMsgScroll}>
          {msgLoadingMore && (
            <div className="flex justify-center py-2">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
                <Sparkles className="w-4 h-4 text-brand-gold/50" />
              </motion.div>
            </div>
          )}
          {[...olderMessages, ...messages].map(msg => (
            <div key={msg.id} className="bg-white rounded-2xl p-4 border border-black/5 shadow-sm">
              {msg.title && <p className="font-bold text-sm text-brand-navy mb-1">{msg.title}</p>}
              <p className="text-sm text-brand-navy/80 leading-relaxed">{msg.text}</p>
              <p className="text-[10px] text-brand-navy/30 mt-2 font-bold uppercase tracking-widest">
                {msg.createdAt?.toDate ? format(msg.createdAt.toDate(), 'MMM d, h:mm a') : 'Just now'}
              </p>
            </div>
          ))}
          {messages.length === 0 && (
            <div className="text-center py-16 text-brand-navy/30">
              <Send size={32} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-bold">No messages yet</p>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  if (activeChatId && (chatPartner || activeChatBusinessInfo)) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="fixed inset-0 bg-brand-bg z-[100] flex flex-col max-w-md mx-auto"
      >
        <header className="glass-panel px-6 py-4 flex items-center gap-4">
          <button onClick={() => setActiveChatId(null)} className="p-2 -ml-2 text-brand-navy/60">
            <ArrowLeft size={24} />
          </button>
          <div className="flex items-center gap-3 flex-1">
            {activeChatBusinessInfo ? (
              <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-white shadow-sm bg-brand-navy/5 flex items-center justify-center shrink-0">
                {activeChatBusinessInfo.businessLogoUrl
                  ? <img src={activeChatBusinessInfo.businessLogoUrl} alt="" className="w-full h-full object-cover" />
                  : <Store size={18} className="text-brand-navy/50" />}
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-sm cursor-pointer bg-indigo-50 flex items-center justify-center" onClick={() => chatPartner && onViewUser(chatPartner)}>
                <PixelAvatar config={chatPartner?.avatar} uid={chatPartner?.uid} size={40} view="head" />
              </div>
            )}
            <div>
              <h3 className="font-bold text-sm leading-tight">{activeChatBusinessInfo ? activeChatBusinessInfo.businessName : (chatPartner?.name ?? '')}</h3>
              <p className="text-[10px] text-brand-navy/40 font-bold uppercase tracking-widest">{activeChatBusinessInfo ? 'Business' : 'Online'}</p>
            </div>
          </div>
          <button className="p-2 text-brand-navy/60">
            <MoreVertical size={20} />
          </button>
        </header>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto py-4 space-y-2" onClick={() => setSelectedMsgId(null)} onScroll={handleMsgScroll}>
          {msgLoadingMore && (
            <div className="flex justify-center py-2">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
                <Sparkles className="w-4 h-4 text-brand-gold/50" />
              </motion.div>
            </div>
          )}
          {[...olderMessages, ...messages].map((msg, idx, all) => {
            const isMe = msg.senderUid === currentUser.uid;
            const showName = idx === 0 || all[idx-1].senderUid !== msg.senderUid;
            const isSelected = selectedMsgId === msg.id;
            return (
              <div key={msg.id} className="w-full px-2">
                {showName && !isMe && <span className="text-[10px] font-bold text-brand-navy/40 mb-1 ml-1 block">{msg.senderName}</span>}
                <div
                  className={cn("flex items-end gap-2 w-full", isMe ? "flex-row-reverse" : "flex-row")}
                  onClick={e => { e.stopPropagation(); if (isMe) setSelectedMsgId(isSelected ? null : msg.id); }}
                >
                  <div className={cn(
                    "flex-1 px-4 py-3 rounded-2xl text-sm shadow-sm",
                    isMe ? "gradient-red text-white" : "glass-card text-brand-navy"
                  )}>
                    {msg.text}
                  </div>
                  <AnimatePresence>
                    {isSelected && isMe && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.7 }}
                        onClick={async e => {
                          e.stopPropagation();
                          await deleteDoc(doc(db, 'chats', activeChatId!, 'messages', msg.id));
                          setSelectedMsgId(null);
                        }}
                        className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0 mb-0.5"
                      >
                        <Trash2 size={13} className="text-red-500" />
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-6 bg-white border-t border-brand-navy/5">
          <div className="flex gap-2">
            <input 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type a message..."
              className="flex-1 px-6 py-4 rounded-2xl bg-brand-bg border-none focus:ring-2 focus:ring-brand-gold/20 text-sm"
            />
            <button 
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className="p-4 gradient-red text-white rounded-2xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  if (showCustomerPicker && vendorStore) {
    return (
      <div className="space-y-6">
        <header className="flex items-center gap-4">
          <button onClick={() => setShowCustomerPicker(false)} className="p-2 -ml-2 text-brand-navy/60">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="font-display text-2xl font-bold">Message a Customer</h2>
            <p className="text-brand-navy/60 text-sm">{storeCustomers.length} active cardholders</p>
          </div>
        </header>
        <div className="space-y-3">
          {storeCustomers.length === 0 && (
            <div className="glass-card p-10 rounded-[2.5rem] text-center">
              <p className="text-brand-navy/60 font-bold">No customers yet</p>
              <p className="text-xs text-brand-navy/40 mt-1">Customers will appear here once they join your loyalty program.</p>
            </div>
          )}
          {storeCustomers.map(customer => (
            <button
              key={customer.uid}
              onClick={() => handleStartCustomerChat(customer)}
              className="w-full bg-white p-4 rounded-2xl flex items-center gap-4 border border-brand-navy/5 hover:border-brand-gold/20 transition-all text-left"
            >
              <div className="w-14 h-14 rounded-2xl overflow-hidden border border-brand-navy/5 bg-indigo-50 flex items-center justify-center">
                <PixelAvatar config={customer.avatar} uid={customer.uid} size={56} view="head" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm truncate">{customer.name}</h4>
                <p className="text-xs text-brand-navy/40">{customer.email}</p>
              </div>
              <MessageCircle size={18} className="text-brand-navy/20 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Broadcast panel */}
      <AnimatePresence>
        {showBroadcast && vendorStore && (
          <VendorBroadcastPanel store={vendorStore} storeCards={storeCards} onClose={() => setShowBroadcast(false)} />
        )}
      </AnimatePresence>

      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold mb-1">Messages</h2>
          <p className="text-brand-navy/60 text-sm">Direct conversations with others.</p>
        </div>
        {vendorStore && (
          <button
            onClick={() => setShowCustomerPicker(true)}
            className="flex items-center gap-2 px-4 py-2.5 gradient-red text-white rounded-2xl text-xs font-bold shadow-lg active:scale-95 transition-all"
          >
            <MessageCircle size={14} />
            New
          </button>
        )}
      </header>

      {/* Broadcast button — vendors only, at the top */}
      {vendorStore && (
        <button
          onClick={() => setShowBroadcast(true)}
          className="w-full flex items-center gap-4 p-5 rounded-[2rem] gradient-red text-white shadow-md active:scale-95 transition-transform"
        >
          <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
            <Send size={18} />
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="font-bold text-sm">Broadcast Message</p>
            <p className="text-xs text-white/70">Send to all members &amp; manage automations</p>
          </div>
          <ChevronRight size={18} className="text-white/50 shrink-0" />
        </button>
      )}

      <div className="space-y-3">
        {chats.filter(c => !(c.isBroadcast && vendorStore && c.storeId === vendorStore.id)).map(chat => (
          <ChatListItem
            key={chat.id}
            chat={chat}
            currentUser={currentUser}
            onClick={() => setActiveChatId(chat.id)}
          />
        ))}

        {chats.length === 0 && (
          <div className="glass-card p-10 rounded-[2.5rem] border-2 border-dashed border-brand-rose/40 text-center">
            <div className="w-16 h-16 bg-brand-bg rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-8 h-8 text-brand-navy/20" />
            </div>
            <p className="text-brand-navy/60 mb-2 font-bold">No conversations</p>
            <p className="text-xs text-brand-navy/40">
              {vendorStore ? 'Tap "New" to message a customer.' : "Start a message from someone's profile!"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatListItem({ chat, currentUser, onClick }: { chat: Chat, currentUser: FirebaseUser, onClick: () => void, key?: React.Key }) {
  const [partner, setPartner] = useState<UserProfile | null>(null);
  const partnerUid = chat.isBroadcast ? null : chat.uids.find(id => id !== currentUser.uid);
  const unread = (chat.unreadCount?.[currentUser.uid] || 0);

  useEffect(() => {
    if (!partnerUid) return;
    getDoc(doc(db, 'users', partnerUid)).then(async snap => {
      if (snap.exists()) { setPartner({ uid: snap.id, ...snap.data() } as UserProfile); return; }
      const vsnap = await getDoc(doc(db, 'vendors', partnerUid));
      if (vsnap.exists()) setPartner({ uid: vsnap.id, ...vsnap.data() } as UserProfile);
    });
  }, [partnerUid]);

  if (!chat.isBroadcast && !chat.businessName && !partner) return null;

  const displayName = chat.isBroadcast
    ? (chat.storeName || 'Business')
    : chat.businessName
      ? chat.businessName
      : (partner?.name || '');

  const isBusinessStyle = chat.isBroadcast || !!chat.businessName;
  const businessLogo = chat.isBroadcast ? chat.storeLogoUrl : chat.businessLogoUrl;

  return (
    <button
      onClick={onClick}
      className="w-full bg-white p-4 rounded-2xl flex items-center gap-4 border border-brand-navy/5 hover:border-brand-gold/20 transition-all text-left"
    >
      <div className={cn("w-14 h-14 overflow-hidden border border-brand-navy/5 bg-brand-navy/5 flex items-center justify-center shrink-0", isBusinessStyle ? "rounded-2xl" : "rounded-full")}>
        {isBusinessStyle
          ? (businessLogo
              ? <img src={businessLogo} alt="" className="w-full h-full object-cover" />
              : <Store size={22} className="text-brand-navy/40" />)
          : <PixelAvatar config={partner?.avatar} uid={partner?.uid} size={56} view="head" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <h4 className="font-bold text-sm truncate">{displayName}</h4>
          <div className="flex items-center gap-2 shrink-0">
            {unread > 0 && (
              <span className="w-5 h-5 rounded-full bg-brand-gold text-brand-navy text-[10px] font-bold flex items-center justify-center">
                {unread}
              </span>
            )}
            <span className="text-[10px] text-brand-navy/40 uppercase font-bold">
              {chat.lastActivity?.toDate ? format(chat.lastActivity.toDate(), 'HH:mm') : '...'}
            </span>
          </div>
        </div>
        <p className="text-xs text-brand-navy/60 truncate">{chat.lastMessage || 'Tap to view'}</p>
      </div>
    </button>
  );
}

function CommunityScreen({ onViewUser, currentUser }: { onViewUser: (u: UserProfile) => void, currentUser: FirebaseUser, key?: React.Key }) {
  const [activeSubTab, setActiveSubTab] = useState<'leaderboard' | 'discover'>('leaderboard');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [followingUids, setFollowingUids] = useState<Set<string>>(new Set());

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'consumer'), orderBy('totalStamps', 'desc'), limit(20));
    const unsubscribe = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
      setLoading(false);
    }, (error) => {
      console.error("Community leaderboard error:", error);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'follows'), where('followerUid', '==', currentUser.uid));
    return onSnapshot(q, (snap) => {
      setFollowingUids(new Set(snap.docs.map(d => d.data().followingUid as string)));
    });
  }, [currentUser.uid]);

  const handleToggleFollow = async (targetUid: string) => {
    const followId = `${currentUser.uid}_${targetUid}`;
    if (followingUids.has(targetUid)) {
      await deleteDoc(doc(db, 'follows', followId));
    } else {
      await setDoc(doc(db, 'follows', followId), {
        followerUid: currentUser.uid,
        followingUid: targetUid,
        createdAt: serverTimestamp()
      });
    }
  };

  const filteredUsers = users.filter(u => u.uid !== currentUser.uid && (u.name || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-display text-3xl font-bold mb-4">Community</h2>
        <div className="flex gap-2 bg-white p-1 rounded-2xl border border-brand-navy/5">
          {(['leaderboard', 'discover'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={cn(
                "flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all",
                activeSubTab === tab ? "bg-brand-navy text-white shadow-lg" : "text-brand-navy/40 hover:bg-brand-bg"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-12">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
            <Sparkles className="w-8 h-8 text-brand-gold" />
          </motion.div>
        </div>
      ) : (
        <>
          {activeSubTab === 'leaderboard' && (
            <div className="space-y-4">
              <div className="bg-brand-navy p-6 rounded-[2.5rem] text-white flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-brand-gold shrink-0 bg-indigo-100 flex items-center justify-center">
                    {users[0]
                      ? <PixelAvatar config={users[0].avatar} uid={users[0].uid} size={48} view="head" />
                      : <div className="w-full h-full bg-brand-gold flex items-center justify-center"><Trophy className="w-6 h-6 text-brand-navy" /></div>}
                  </div>
                  <div>
                    <p className="text-xs text-white/60 font-bold uppercase tracking-widest">Top Collector</p>
                    <p className="text-lg font-bold">{users[0]?.name || '---'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-brand-gold">{users[0]?.totalStamps || 0}</p>
                  <p className="text-[10px] text-white/40 font-bold uppercase">Stamps</p>
                </div>
              </div>

              <div className="space-y-2">
                {users.map((u, i) => (
                  <div 
                    key={`leaderboard-${u.uid}`} 
                    onClick={() => onViewUser(u)}
                    className="glass-card p-4 rounded-2xl flex items-center gap-4 hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className="w-8 font-display font-bold text-brand-navy/20">#{i + 1}</div>
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-brand-navy/5 bg-indigo-50 flex items-center justify-center">
                      <PixelAvatar config={u.avatar} uid={u.uid} size={40} view="head" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1"><p className="font-bold text-sm">{u.name}</p><StreakBadge streak={u.streak} /></div>
                      <p className="text-xs text-brand-navy/40">{u.totalStamps} stamps</p>
                    </div>
                    {i < 3 && <Sparkles className="w-4 h-4 text-brand-gold" />}
                  </div>
                ))}
                {users.length === 0 && (
                  <div className="py-12 text-center text-brand-navy/20">
                    <Trophy size={48} className="mx-auto mb-4 opacity-10" />
                    <p className="text-sm font-bold">No collectors yet. Be the first!</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSubTab === 'discover' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-navy/40" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search users..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-brand-navy/5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/20"
                />
              </div>
              <div className="space-y-2">
                {filteredUsers.map(u => {
                  const isFollowing = followingUids.has(u.uid);
                  return (
                    <div key={u.uid} className="glass-card p-4 rounded-2xl flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-brand-navy/5 cursor-pointer bg-indigo-50 flex items-center justify-center" onClick={() => onViewUser(u)}>
                        <PixelAvatar config={u.avatar} uid={u.uid} size={40} view="head" />
                      </div>
                      <div className="flex-1 cursor-pointer" onClick={() => onViewUser(u)}>
                        <div className="flex items-center gap-1"><p className="font-bold text-sm">{u.name}</p><StreakBadge streak={u.streak} /></div>
                        <p className="text-xs text-brand-navy/40">{u.role}</p>
                      </div>
                      <button
                        onClick={() => handleToggleFollow(u.uid)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                          isFollowing
                            ? "bg-brand-navy/10 text-brand-navy/60 hover:bg-red-50 hover:text-red-400"
                            : "bg-brand-gold text-brand-navy hover:bg-brand-gold/80"
                        )}
                      >
                        {isFollowing ? 'Following' : 'Follow'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AdminStoreEditModal({ store, onClose }: { store: StoreProfile; onClose: () => void }) {
  const [name, setName] = useState(store.name || '');
  const [category, setCategory] = useState<Category>(store.category || 'Food');
  const [description, setDescription] = useState(store.description || '');
  const [location, setLocation] = useState(store.location || store.address || '');
  const [phone, setPhone] = useState(store.phone || '');
  const [logoUrl, setLogoUrl] = useState(store.logoUrl || '');
  const [coverUrl, setCoverUrl] = useState(store.coverUrl || '');
  const [logoUploading, setLogoUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isVerified, setIsVerified] = useState(store.isVerified || false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const uploadImage = async (file: File, path: string) => {
    const r = storageRef(storage, path);
    await uploadBytes(r, file);
    return getDownloadURL(r);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'stores', store.id), {
        name, category, description, location, address: location, phone,
        logoUrl, coverUrl, isVerified,
      });
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 800);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 bg-brand-bg z-[300] flex flex-col max-w-md mx-auto overflow-y-auto"
    >
      <header className="glass-panel px-5 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onClose} className="p-2 -ml-2 text-brand-navy/60"><ArrowLeft size={22} /></button>
        <div className="flex-1">
          <p className="text-[10px] font-bold text-brand-navy/40 uppercase tracking-widest">Admin</p>
          <h2 className="font-bold text-brand-navy text-base">Edit Business Profile</h2>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 gradient-logo-blue text-white text-xs font-bold rounded-2xl active:scale-95 transition-all disabled:opacity-60"
        >
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save'}
        </button>
      </header>

      <div className="px-5 py-4 space-y-5">
        {/* Logo */}
        <div>
          <p className="text-xs font-bold text-brand-navy/50 mb-2">Logo</p>
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-brand-navy/5 border border-brand-navy/10 shrink-0">
              {logoUrl ? <img src={logoUrl} alt="" className="w-full h-full object-cover" /> : <Building2 size={24} className="m-auto mt-4 text-brand-navy/20" />}
            </div>
            <label className="flex-1 py-2.5 px-4 rounded-2xl bg-brand-navy/5 text-xs font-bold text-brand-navy/60 text-center cursor-pointer active:scale-95 transition-all">
              {logoUploading ? 'Uploading…' : 'Upload Logo'}
              <input type="file" accept="image/*" className="hidden" onChange={async e => {
                const f = e.target.files?.[0]; if (!f) return;
                setLogoUploading(true);
                setUploadError('');
                try { setLogoUrl(await uploadImage(f, `store_logos/${store.id}/logo_${Date.now()}`)); }
                catch (err: any) { setUploadError('Logo upload failed: ' + (err?.message || 'Storage permission denied')); }
                finally { setLogoUploading(false); }
              }} />
            </label>
          </div>
        </div>

        {/* Cover */}
        <div>
          <p className="text-xs font-bold text-brand-navy/50 mb-2">Cover Image</p>
          <div className="relative w-full h-24 rounded-2xl overflow-hidden bg-brand-navy/5 border border-brand-navy/10">
            {coverUrl && <img src={coverUrl} alt="" className="w-full h-full object-cover" />}
            <label className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer active:scale-95">
              <span className="text-white text-xs font-bold">{coverUploading ? 'Uploading…' : 'Upload Cover'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={async e => {
                const f = e.target.files?.[0]; if (!f) return;
                setCoverUploading(true);
                setUploadError('');
                try { setCoverUrl(await uploadImage(f, `store_logos/${store.id}/cover_${Date.now()}`)); }
                catch (err: any) { setUploadError('Cover upload failed: ' + (err?.message || 'Storage permission denied')); }
                finally { setCoverUploading(false); }
              }} />
            </label>
          </div>
        </div>

        {uploadError && (
          <p className="text-xs font-semibold text-red-500 bg-red-50 px-4 py-2 rounded-2xl">{uploadError}</p>
        )}

        {/* Fields */}
        <div className="space-y-3">
          {([
            { label: 'Business Name', value: name, set: setName },
            { label: 'Location / Address', value: location, set: setLocation },
            { label: 'Phone', value: phone, set: setPhone },
          ] as { label: string; value: string; set: (v: string) => void }[]).map(({ label, value, set }) => (
            <div key={label}>
              <p className="text-xs font-bold text-brand-navy/50 mb-1">{label}</p>
              <input
                value={value}
                onChange={e => set(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-white border border-brand-navy/10 text-sm text-brand-navy outline-none focus:border-brand-navy/30"
              />
            </div>
          ))}

          <div>
            <p className="text-xs font-bold text-brand-navy/50 mb-1">Category</p>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as Category)}
              className="w-full px-4 py-3 rounded-2xl bg-white border border-brand-navy/10 text-sm text-brand-navy outline-none"
            >
              {(['Food','Beauty','Gym','Barber','Retail','Coffee','Other'] as Category[]).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-xs font-bold text-brand-navy/50 mb-1">Description</p>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-2xl bg-white border border-brand-navy/10 text-sm text-brand-navy outline-none focus:border-brand-navy/30 resize-none"
            />
          </div>

          <label className="flex items-center gap-3 px-4 py-3 bg-white rounded-2xl border border-brand-navy/10 cursor-pointer">
            <input type="checkbox" checked={isVerified} onChange={e => setIsVerified(e.target.checked)} className="w-4 h-4 accent-blue-500" />
            <span className="text-sm font-bold text-brand-navy">Verified badge</span>
          </label>
        </div>

        {/* Card builder section */}
        <div>
          <p className="text-xs font-bold text-brand-navy/50 mb-3 uppercase tracking-widest">Stamp Card Settings</p>
          <CardBuilder store={store} />
        </div>
      </div>
    </motion.div>
  );
}

function StoreProfileView({ store, onBack, user, profile, onViewUser, onMessage }: { store: StoreProfile, onBack: () => void, user: FirebaseUser, profile: UserProfile | null, onViewUser: (u: UserProfile) => void, onMessage?: (chatId: string) => void, key?: React.Key }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [vendorGlobalPosts, setVendorGlobalPosts] = useState<GlobalPost[]>([]);
  const [storeReviews, setStoreReviews] = useState<any[]>([]);
  const [visibleReviewCount, setVisibleReviewCount] = useState(10);
  const reviewSentinelRef = useRef<HTMLDivElement>(null);
  const [activeStoreTab, setActiveStoreTab] = useState<'posts' | 'reviews'>('posts');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  // leaderboard computed from allStoreCards — no separate query needed
  const [leaderboardProfiles, setLeaderboardProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [newPost, setNewPost] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [showAdminEdit, setShowAdminEdit] = useState(false);
  const [card, setCard] = useState<Card | null>(null);
  const [isFollowingStore, setIsFollowingStore] = useState(false);
  const [allStoreCards, setAllStoreCards] = useState<Card[]>([]);

  useEffect(() => {
    const cardId = `${user.uid}_${store.id}`;
    return onSnapshot(doc(db, 'cards', cardId), (snap) => {
      if (snap.exists() && !snap.data()?.isArchived) {
        setCard({ id: snap.id, ...snap.data() } as Card);
      } else {
        setCard(null);
      }
    }, (err) => console.error("Card detail listener:", err));
  }, [user.uid, store.id]);

  useEffect(() => {
    const q = query(collection(db, 'cards'), where('store_id', '==', store.id));
    return onSnapshot(q, snap => setAllStoreCards(snap.docs.map(d => ({ id: d.id, ...d.data() } as Card))), () => {});
  }, [store.id]);

  // Fetch current user profiles for leaderboard display whenever the card list changes
  useEffect(() => {
    const uids = [...new Set<string>(allStoreCards.filter(c => !c.isArchived).map(c => c.user_id))];
    if (uids.length === 0) return;
    Promise.all(uids.map(uid => getDoc(doc(db, 'users', uid)))).then(snaps => {
      const map = new Map<string, UserProfile>();
      snaps.filter(s => s.exists()).forEach(s => map.set(s.id, { uid: s.id, ...s.data() } as UserProfile));
      setLeaderboardProfiles(map);
    });
  }, [allStoreCards]);


  useEffect(() => {
    const q = query(collection(db, 'stores', store.id, 'posts'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Post)));
    }, (error) => {
      console.error("Store feed error:", error);
    });
  }, [store.id]);

  useEffect(() => {
    if (!store.ownerUid) return;
    const q = query(collection(db, 'global_posts'), where('authorUid', '==', store.ownerUid), where('authorRole', '==', 'vendor'), orderBy('createdAt', 'desc'), limit(30));
    return onSnapshot(q, snap => setVendorGlobalPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as GlobalPost))), () => {});
  }, [store.ownerUid]);

  useEffect(() => {
    const q = query(collection(db, 'store_reviews'), where('storeId', '==', store.id));
    return onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      docs.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      setStoreReviews(docs);
    }, (err) => console.error('store_reviews listener:', err));
  }, [store.id]);

  useEffect(() => {
    const followId = `${user.uid}_${store.id}`;
    return onSnapshot(doc(db, 'store_follows', followId), (snap) => {
      setIsFollowingStore(snap.exists());
    }, () => {});
  }, [user.uid, store.id]);

  const handleFollowStore = async () => {
    const followId = `${user.uid}_${store.id}`;
    if (isFollowingStore) {
      await deleteDoc(doc(db, 'store_follows', followId));
    } else {
      await setDoc(doc(db, 'store_follows', followId), {
        followerUid: user.uid,
        storeId: store.id,
        createdAt: serverTimestamp(),
      });
    }
  };

  const handleMessageStore = async () => {
    if (!onMessage || !store.ownerUid || store.ownerUid === user.uid) return;
    const chatId = [user.uid, store.ownerUid].sort().join('_');
    // Navigate immediately — don't block on Firestore
    onMessage(chatId);
    // Create chat doc in background if it doesn't exist
    try {
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);
      if (!chatSnap.exists()) {
        await setDoc(chatRef, {
          uids: [user.uid, store.ownerUid],
          lastActivity: serverTimestamp(),
          lastMessage: '',
          createdAt: serverTimestamp(),
          businessName: store.name,
          businessLogoUrl: store.logoUrl || '',
        });
      } else if (!chatSnap.data()?.businessName) {
        await updateDoc(chatRef, { businessName: store.name, businessLogoUrl: store.logoUrl || '' });
      }
    } catch (err) {
      console.error('Chat create error:', err);
    }
  };

  const handleJoinStore = async () => {
    const cardId = `${user.uid}_${store.id}`;
    const userName = profile?.name || user.displayName || user.email?.split('@')[0] || 'Loyal Customer';
    const userPhoto = profile?.photoURL || user.photoURL || '';
    await setDoc(doc(db, 'cards', cardId), {
      user_id: user.uid,
      store_id: store.id,
      current_stamps: 0,
      total_completed_cycles: 0,
      stamps_required: store.stamps_required_for_reward || 10,
      last_tap_timestamp: serverTimestamp(),
      isArchived: false,
      userName,
      userPhoto,
    });
    await updateDoc(doc(db, 'users', user.uid), { total_cards_held: increment(1) });
  };

  const handleCreatePost = async () => {
    if (!newPost.trim() || !profile) return;
    setIsPosting(true);
    try {
      const content = newPost.trim();
      const authorName = profile.name || profile.email?.split('@')[0] || 'Anonymous';
      const authorPhoto = profile.photoURL || '';

      // Write to store subcollection for the business wall
      await addDoc(collection(db, 'stores', store.id, 'posts'), {
        store_id: store.id,
        authorUid: profile.uid,
        authorName,
        authorPhoto,
        content,
        storeName: store.name,
        wallPost: true,
        createdAt: serverTimestamp(),
        likesCount: 0
      });

      // Also publish to global_posts so followers see it in their feed
      await addDoc(collection(db, 'global_posts'), {
        authorUid: profile.uid,
        authorName,
        authorPhoto,
        authorRole: profile.role || 'consumer',
        storeId: store.id,
        storeName: store.name,
        wallPost: true,
        content,
        postType: 'post',
        createdAt: serverTimestamp(),
        likesCount: 0,
        likedBy: [],
      });

      setNewPost('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsPosting(false);
    }
  };

  const myReview = storeReviews.find(r => r.authorUid === user.uid);
  const avgRating = storeReviews.length ? storeReviews.reduce((s, r) => s + (r.rating || 5), 0) / storeReviews.length : null;
  const visibleReviews = storeReviews.slice(0, visibleReviewCount);

  useEffect(() => {
    const el = reviewSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisibleReviewCount(c => c + 10);
    }, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [storeReviews.length]);

  const handleSubmitReview = async () => {
    if (!reviewText.trim() || myReview) return;
    setIsSubmittingReview(true);
    try {
      const authorName = profile?.name || user.displayName || 'Anonymous';
      const authorPhoto = profile?.photoURL || user.photoURL || '';
      const content = reviewText.trim();

      const reviewRef = await addDoc(collection(db, 'store_reviews'), {
        storeId: store.id,
        authorUid: user.uid,
        authorName,
        authorPhoto,
        rating: reviewRating,
        content,
        createdAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'global_posts'), {
        authorUid: user.uid,
        authorName,
        authorPhoto,
        authorRole: 'consumer',
        storeId: store.id,
        storeName: store.name,
        postType: 'review',
        rating: reviewRating,
        content,
        storeReviewId: reviewRef.id,
        createdAt: serverTimestamp(),
        likesCount: 0,
        likedBy: [],
      });

      setReviewText('');
      setReviewRating(5);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Public stats (respect visibility settings)
  const vis = store.visibilitySettings;
  const stampsReq = store.stamps_required_for_reward || 10;
  const totalMembers = new Set(allStoreCards.map(c => c.user_id)).size;
  const totalStampsGiven = allStoreCards.reduce((sum, c) => sum + (c.current_stamps || 0) + ((c.total_completed_cycles || 0) * stampsReq), 0);
  const activeCards = allStoreCards.filter(c => !c.isArchived).length;
  const returningUsers = allStoreCards.filter(c => (c.total_completed_cycles || 0) > 0).length;
  const returnRate = totalMembers > 0 ? Math.round((returningUsers / totalMembers) * 100) : 0;
  const showStats = vis ? Object.values(vis).some(Boolean) : true;
  // Leaderboard: lifetime stamps per customer = current progress + completed cycles × stamps required.
  // Sorted client-side so redemptions don't knock customers off the board.
  const leaderboard = allStoreCards
    .filter(c => !c.isArchived)
    .map(c => ({ ...c, lifetimeStamps: (c.current_stamps || 0) + (c.total_completed_cycles || 0) * stampsReq }))
    .sort((a, b) => b.lifetimeStamps - a.lifetimeStamps)
    .slice(0, 5);
  const storeTiersPublic = store.rewardTiers?.length || Math.max(...allStoreCards.map(c => c.tiersCompleted || 0), 1);
  const publicStoreRewards = Math.max(
    allStoreCards.filter(c => !c.isArchived).reduce((sum, c) => sum + (c.total_completed_cycles || 0), 0) * storeTiersPublic,
    allStoreCards.filter(c => c.isArchived && c.isRedeemed).length * storeTiersPublic,
    store.rewardsGiven || 0
  );

  const tiers = store.rewardTiers?.length
    ? [...store.rewardTiers].sort((a, b) => a.stamps - b.stamps)
    : store.reward ? [{ stamps: store.stamps_required_for_reward || 10, reward: store.reward }] : [];
  const [tierSlideIdx, setTierSlideIdx] = React.useState(0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="space-y-5"
    >
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-brand-navy/60 font-bold text-sm hover:text-brand-navy transition-colors">
          <ArrowLeft size={18} />
          Back
        </button>
        {(user.email === ADMIN_EMAIL || profile?.email === ADMIN_EMAIL) && (
          <button
            onClick={() => setShowAdminEdit(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl gradient-logo-blue text-white text-xs font-bold active:scale-95 transition-all"
          >
            <Edit3 size={12} /> Edit Profile
          </button>
        )}
      </div>

      <AnimatePresence>
        {showAdminEdit && (
          <AdminStoreEditModal store={store} onClose={() => setShowAdminEdit(false)} />
        )}
      </AnimatePresence>

      {/* Logo + name */}
      <div className="flex flex-col items-center text-center gap-3 pt-2">
        <div className="w-24 h-24 rounded-3xl overflow-hidden border-4 border-white shadow-lg bg-white">
          {store.logoUrl
            ? <img src={store.logoUrl} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center bg-brand-navy/5 text-3xl">{store.name?.[0]}</div>
          }
        </div>
        <div>
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-2xl font-bold text-brand-navy">{store.name}</h2>
            {store.isVerified && <CheckCircle2 size={18} className="text-blue-400" />}
          </div>
          <p className="text-sm text-brand-navy/50 mt-0.5">{store.category}{store.location || store.address ? ` · ${store.location || store.address}` : ''}</p>
          {avgRating !== null && (
            <div className="flex items-center justify-center gap-1.5 mt-1.5">
              <div className="flex items-center gap-0.5">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} size={12} className={s <= Math.round(avgRating) ? "text-brand-gold fill-brand-gold" : "text-brand-navy/20"} />
                ))}
              </div>
              <span className="text-brand-navy font-bold text-xs">{avgRating.toFixed(1)}</span>
              <span className="text-brand-navy/40 text-xs">({storeReviews.length})</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      {showStats && (
        <div className="grid grid-cols-3 gap-3">
          {(vis?.members !== false) && (
            <div className="glass-card p-4 rounded-3xl text-center">
              <p className="text-lg font-bold text-brand-navy">{totalMembers}</p>
              <p className="text-[10px] text-brand-navy/40 font-bold uppercase tracking-widest mt-0.5">Members</p>
            </div>
          )}
          {store.ownerUid !== user.uid && (vis?.stamps !== false) && (
            <div className="glass-card p-4 rounded-3xl text-center">
              <p className="text-lg font-bold text-brand-navy">{totalStampsGiven}</p>
              <p className="text-[10px] text-brand-navy/40 font-bold uppercase tracking-widest mt-0.5">Stamps</p>
            </div>
          )}
          {store.ownerUid !== user.uid && (
            <div className="glass-card p-4 rounded-3xl text-center">
              <p className="text-lg font-bold text-brand-navy">{publicStoreRewards}</p>
              <p className="text-[10px] text-brand-navy/40 font-bold uppercase tracking-widest mt-0.5">Rewards</p>
            </div>
          )}
        </div>
      )}

      {/* Reward tiers slider */}
      {tiers.length > 0 && (
        <div className="glass-card p-5 rounded-[2rem] space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40">
            {tiers.length > 1 ? `Reward ${tierSlideIdx + 1} of ${tiers.length}` : 'Reward'}
          </p>
          <div className="overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={tierSlideIdx}
                initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-brand-gold/15 flex items-center justify-center shrink-0">
                  <Gift size={22} className="text-brand-gold" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-brand-navy text-base leading-tight">{tiers[tierSlideIdx].reward}</p>
                  <p className="text-xs text-brand-navy/40 mt-0.5">after {tiers[tierSlideIdx].stamps} stamps</p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          {tiers.length > 1 && (
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setTierSlideIdx(i => Math.max(0, i - 1))}
                disabled={tierSlideIdx === 0}
                className="p-1.5 rounded-xl bg-brand-navy/8 disabled:opacity-20 active:scale-90 transition-all"
              >
                <ChevronLeft size={16} className="text-brand-navy" />
              </button>
              <div className="flex gap-1.5">
                {tiers.map((_, i) => (
                  <button key={i} onClick={() => setTierSlideIdx(i)}
                    className={cn('h-1.5 rounded-full transition-all', i === tierSlideIdx ? 'w-4 bg-brand-navy' : 'w-1.5 bg-brand-navy/20')}
                  />
                ))}
              </div>
              <button
                onClick={() => setTierSlideIdx(i => Math.min(tiers.length - 1, i + 1))}
                disabled={tierSlideIdx === tiers.length - 1}
                className="p-1.5 rounded-xl bg-brand-navy/8 disabled:opacity-20 active:scale-90 transition-all"
              >
                <ChevronRight size={16} className="text-brand-navy" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      {store.ownerUid !== user.uid && (
        <div className="flex gap-2">
          {onMessage && store.ownerUid && (
            <button onClick={handleMessageStore} className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl gradient-red text-white font-bold text-xs shadow active:scale-95 transition-all">
              <MessageCircle size={14} /> Message
            </button>
          )}
          <button
            onClick={handleFollowStore}
            className={cn("flex items-center gap-1.5 px-4 py-2.5 rounded-2xl font-bold text-xs transition-all shadow active:scale-95", isFollowingStore ? "bg-brand-navy/8 text-brand-navy border border-brand-navy/15" : "gradient-red text-white")}
          >
            {isFollowingStore ? <UserCheck size={14} /> : <UserPlus size={14} />}
            {isFollowingStore ? 'Following' : 'Follow'}
          </button>
          <button
            onClick={card ? undefined : handleJoinStore}
            className={cn("flex items-center gap-1.5 px-4 py-2.5 rounded-2xl font-bold text-xs transition-all shadow active:scale-95", card ? "bg-green-50 text-green-600 border border-green-200 cursor-default" : "gradient-red text-white")}
          >
            {card ? <><UserCheck size={14} /> Member</> : <><Plus size={14} /> Join</>}
          </button>
        </div>
      )}

      {/* Top collectors */}
      <div className="glass-card p-5 rounded-[2rem] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Top Collectors</h3>
          <Trophy size={18} className="text-brand-gold" />
        </div>
        <div className="space-y-3">
          {leaderboard.map((entry, index) => {
            const lbProfile = leaderboardProfiles.get(entry.user_id);
            const displayName = lbProfile?.name || entry.userName || 'Loyal Customer';
            return (
              <div
                key={`lb-${entry.id}`}
                onClick={() => lbProfile && onViewUser(lbProfile)}
                className="flex items-center justify-between p-3 rounded-2xl hover:bg-brand-bg transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 flex items-center justify-center font-bold text-xs text-brand-navy/40">#{index + 1}</div>
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-brand-navy/5 bg-indigo-50 flex items-center justify-center">
                    <PixelAvatar config={lbProfile?.avatar} uid={lbProfile?.uid ?? entry.user_id} size={40} view="head" />
                  </div>
                  <div>
                    <p className="font-bold text-sm group-hover:text-brand-gold transition-colors">{displayName}</p>
                    <p className="text-[10px] text-brand-navy/40 font-bold uppercase tracking-widest">{entry.total_completed_cycles || 0} Rewards Earned</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-brand-navy">{entry.lifetimeStamps} Stamps</p>
                </div>
              </div>
            );
          })}
          {leaderboard.length === 0 && (
            <p className="text-center py-4 text-xs text-brand-navy/40 font-bold uppercase tracking-widest">No collectors yet</p>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex p-1 glass-card rounded-2xl">
        {(['posts', 'reviews'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveStoreTab(tab)}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5",
              activeStoreTab === tab ? "bg-brand-navy text-white shadow-lg" : "text-brand-navy/40"
            )}
          >
            {tab === 'posts' ? <><MessageSquare size={13} /> Posts</> : <><Star size={13} /> Reviews {storeReviews.length > 0 && `(${storeReviews.length})`}</>}
          </button>
        ))}
      </div>

      {activeStoreTab === 'posts' && (() => {
        const merged = [
          ...vendorGlobalPosts.map(p => ({ _type: 'global' as const, _ts: p.createdAt?.toMillis?.() ?? 0, data: p as any })),
          ...posts.map(p => ({ _type: 'wall' as const, _ts: (p as any).createdAt?.toMillis?.() ?? 0, data: p as any })),
        ].sort((a, b) => b._ts - a._ts);
        return (
          <div className="space-y-4">
            {/* Post box for consumers */}
            {store.ownerUid !== user.uid && (
              <div className="glass-card p-4 rounded-3xl space-y-4">
                <textarea
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="Share your experience..."
                  className="w-full p-4 rounded-2xl bg-brand-bg border-none focus:ring-2 focus:ring-brand-gold/20 text-sm resize-none h-24"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleCreatePost}
                    disabled={isPosting || !newPost.trim()}
                    className="bg-brand-navy text-white px-6 py-2 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50 transition-all"
                  >
                    <Send size={16} /> Post
                  </button>
                </div>
              </div>
            )}
            {merged.map(item =>
              item._type === 'global' ? (
                <FeedPostCard key={item.data.id} post={item.data} currentUser={user} onViewUser={onViewUser}
                  onLike={async (p) => { const ref = doc(db, 'global_posts', p.id); const liked = (p.likedBy || []).includes(user.uid); await updateDoc(ref, { likedBy: liked ? arrayRemove(user.uid) : arrayUnion(user.uid), likesCount: liked ? Math.max(0, p.likesCount - 1) : p.likesCount + 1 }); }}
                  onVote={async (p, idx) => { const ref = doc(db, 'global_posts', p.id); const votes = p.pollVotes || {}; const oldKey = Object.keys(votes).find(k => (votes[k] || []).includes(user.uid)); const updates: any = { [`pollVotes.${idx}`]: arrayUnion(user.uid) }; if (oldKey !== undefined && oldKey !== String(idx)) updates[`pollVotes.${oldKey}`] = arrayRemove(user.uid); await updateDoc(ref, updates); }}
                />
              ) : (() => {
                const isOwnerPost = item.data.authorUid === store.ownerUid;
                const displayName = isOwnerPost ? store.name : item.data.authorName;
                return (
                  <div key={item.data.id} className="glass-card p-5 rounded-[2rem] space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full overflow-hidden border border-brand-navy/5 shrink-0 bg-indigo-50 flex items-center justify-center">
                        {isOwnerPost
                          ? <img src={store.logoUrl || ''} alt="" className="w-full h-full object-cover" />
                          : <PixelAvatar uid={item.data.authorUid} size={36} view="head" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm">{displayName}</p>
                        {!isOwnerPost && (
                          <p className="text-[10px] text-brand-navy/40">on <span className="font-bold text-brand-gold">{store.name}</span></p>
                        )}
                        <p className="text-[10px] text-brand-navy/40 font-medium">{item.data.createdAt ? format(item.data.createdAt.toDate(), 'MMM d · h:mm a') : 'Just now'}</p>
                      </div>
                    </div>
                    <p className="text-sm text-brand-navy/80 leading-relaxed">{item.data.content}</p>
                  </div>
                );
              })()
            )}
            {merged.length === 0 && <div className="py-12 text-center text-brand-navy/20"><MessageSquare size={40} className="mx-auto mb-2 opacity-10" /><p className="font-bold text-sm">No posts yet</p></div>}
          </div>
        );
      })()}

      {activeStoreTab === 'reviews' && (
        <div className="space-y-4">
          {/* Leave a review — only if not already reviewed */}
          {store.ownerUid !== user.uid && (
            myReview ? (
              <div className="glass-card p-4 rounded-3xl text-center text-sm text-brand-navy/40 font-medium">
                You've already left a review
              </div>
            ) : (
              <div className="glass-card p-5 rounded-3xl space-y-4">
                <p className="font-bold text-sm">Leave a Review</p>
                {/* Star picker */}
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(s => (
                    <button key={s} onClick={() => setReviewRating(s)}>
                      <Star size={24} className={s <= reviewRating ? "text-brand-gold fill-brand-gold" : "text-brand-navy/20"} />
                    </button>
                  ))}
                </div>
                <textarea
                  value={reviewText}
                  onChange={e => setReviewText(e.target.value)}
                  placeholder="Write your review..."
                  className="w-full p-4 rounded-2xl bg-brand-bg border-none focus:ring-2 focus:ring-brand-gold/20 text-sm resize-none h-24"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleSubmitReview}
                    disabled={isSubmittingReview || !reviewText.trim()}
                    className="bg-brand-navy text-white px-6 py-2 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50 transition-all"
                  >
                    <Send size={14} /> Submit
                  </button>
                </div>
              </div>
            )
          )}
          {/* Average rating summary */}
          {avgRating !== null && (
            <div className="glass-card p-5 rounded-[2rem] flex items-center gap-4">
              <div className="text-center">
                <p className="text-4xl font-extrabold text-brand-navy">{avgRating.toFixed(1)}</p>
                <div className="flex items-center gap-0.5 mt-1 justify-center">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} size={13} className={s <= Math.round(avgRating) ? "text-brand-gold fill-brand-gold" : "text-brand-navy/20"} />
                  ))}
                </div>
              </div>
              <div className="text-sm text-brand-navy/50">
                <p className="font-bold text-brand-navy">{storeReviews.length} {storeReviews.length === 1 ? 'review' : 'reviews'}</p>
                <p>Based on customer ratings</p>
              </div>
            </div>
          )}

          {/* Review list */}
          {visibleReviews.map(review => (
            <div key={review.id} className="glass-card p-5 rounded-[2rem] space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full overflow-hidden border border-brand-navy/5 shrink-0 bg-indigo-50 flex items-center justify-center">
                  <PixelAvatar uid={review.authorUid || review.id} size={36} view="head" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{review.authorName}</p>
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} size={11} className={s <= (review.rating || 5) ? "text-brand-gold fill-brand-gold" : "text-brand-navy/20"} />
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-brand-navy/40">{review.createdAt ? format(review.createdAt.toDate(), 'MMM d') : ''}</p>
              </div>
              <p className="text-sm text-brand-navy/70 leading-relaxed">{review.content}</p>
            </div>
          ))}
          {visibleReviewCount < storeReviews.length && <div ref={reviewSentinelRef} className="py-4 text-center text-xs text-brand-navy/30">Loading more...</div>}
          {storeReviews.length === 0 && <div className="py-12 text-center text-brand-navy/20"><Star size={40} className="mx-auto mb-2 opacity-10" /><p className="font-bold text-sm">No reviews yet</p></div>}
        </div>
      )}
    </motion.div>
  );
}


function PublicUserProfile({ targetUser: initialTargetUser, onBack, currentUser, currentProfile, onViewStore, onViewUser, onMessage }: { targetUser: UserProfile, onBack: () => void, currentUser: FirebaseUser, currentProfile: UserProfile | null, onViewStore: (s: StoreProfile) => void, onViewUser: (u: UserProfile) => void, onMessage?: (uid: string) => void, key?: React.Key }) {
  const [targetUser, setTargetUser] = useState<UserProfile>(initialTargetUser);
  const [cards, setCards] = useState<Card[]>([]);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [stores, setStores] = useState<StoreProfile[]>([]);
  const [vendorStore, setVendorStore] = useState<StoreProfile | null>(null);
  const [transactionHistory, setTransactionHistory] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [newReview, setNewReview] = useState('');
  const [rating, setRating] = useState(5);
  const [isPosting, setIsPosting] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [profileTab, setProfileTab] = useState<'wall' | 'posts'>('wall');
  const [userPosts, setUserPosts] = useState<GlobalPost[]>([]);
  const [targetFollowers, setTargetFollowers] = useState(0);
  const [targetFollowing, setTargetFollowing] = useState(0);
  const [allBadges, setAllBadges] = useState<AppBadge[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<AppBadge | null>(null);
  const [publicChallenges, setPublicChallenges] = useState<Challenge[]>([]);
  const [publicEntries, setPublicEntries] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    return onSnapshot(collection(db, 'badges'), snap =>
      setAllBadges(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppBadge)))
    );
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'challenges'), where('type', '==', 'standard'), where('status', '==', 'active'));
    return onSnapshot(q, snap => setPublicChallenges(snap.docs.map(d => ({ id: d.id, ...d.data() } as Challenge))));
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'challenge_entries'), where('uid', '==', initialTargetUser.uid));
    return onSnapshot(q, snap => {
      const m = new Map<string, any>();
      snap.docs.forEach(d => m.set(d.data().challengeId, { id: d.id, ...d.data() }));
      setPublicEntries(m);
    });
  }, [initialTargetUser.uid]);

  useEffect(() => {
    // Listen to target user profile for real-time updates — check users then vendors
    let unsubProfile = () => {};
    getDoc(doc(db, 'users', initialTargetUser.uid)).then(snap => {
      const ref = snap.exists()
        ? doc(db, 'users', initialTargetUser.uid)
        : doc(db, 'vendors', initialTargetUser.uid);
      unsubProfile = onSnapshot(ref, (d) => {
        if (d.exists()) setTargetUser({ uid: d.id, ...d.data() } as UserProfile);
      });
    });

    // Fetch all stores to match with cards
    getDocs(collection(db, 'stores')).then(snap => {
      setStores(snap.docs.map(d => ({ id: d.id, ...d.data() } as StoreProfile)));
    });

    const q = query(collection(db, 'cards'), where('user_id', '==', initialTargetUser.uid), where('isArchived', '==', false));
    const unsubCards = onSnapshot(q, (snap) => {
      setCards(snap.docs.map(d => ({ id: d.id, ...d.data() } as Card)));
    }, (error) => {
      console.error("Public profile cards error:", error);
    });

    // Fetch all cards (including archived) for lifetime stamp count
    const allQ = query(collection(db, 'cards'), where('user_id', '==', initialTargetUser.uid));
    const unsubAllCards = onSnapshot(allQ, (snap) => {
      setAllCards(snap.docs.map(d => ({ id: d.id, ...d.data() } as Card)));
    });

    const hq = query(collection(db, 'transactions'), where('user_id', '==', initialTargetUser.uid), orderBy('completed_at', 'desc'), limit(10));
    const unsubHistory = onSnapshot(hq, (snap) => {
      setTransactionHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const rq = query(collection(db, 'user_reviews'), where('toUid', '==', initialTargetUser.uid), orderBy('createdAt', 'desc'));
    const unsubReviews = onSnapshot(rq, (snap) => {
      setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Follow listener
    const followId = `${currentUser.uid}_${initialTargetUser.uid}`;
    const unsubFollow = onSnapshot(doc(db, 'follows', followId), (snap) => {
      setIsFollowing(snap.exists());
    });

    // Target user follower/following counts
    const unsubTargetFollowers = onSnapshot(
      query(collection(db, 'follows'), where('followingUid', '==', initialTargetUser.uid)),
      (snap) => setTargetFollowers(snap.size)
    );
    const unsubTargetFollowing = onSnapshot(
      query(collection(db, 'follows'), where('followerUid', '==', initialTargetUser.uid)),
      (snap) => setTargetFollowing(snap.size)
    );

    let unsubStore = () => {};
    if (initialTargetUser.role === 'vendor') {
      const bq = query(collection(db, 'stores'), where('ownerUid', '==', initialTargetUser.uid), limit(1));
      unsubStore = onSnapshot(bq, (snap) => {
        if (!snap.empty) {
          setVendorStore({ id: snap.docs[0].id, ...snap.docs[0].data() } as StoreProfile);
        }
      });
    }

    const postsQ = query(
      collection(db, 'global_posts'),
      where('authorUid', '==', initialTargetUser.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsubPosts = onSnapshot(postsQ, (snap) => {
      setUserPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as GlobalPost)));
    }, () => {});

    return () => {
      unsubProfile();
      unsubCards();
      unsubAllCards();
      unsubStore();
      unsubHistory();
      unsubReviews();
      unsubTargetFollowers();
      unsubTargetFollowing();
      unsubFollow();
      unsubPosts();
    };
  }, [initialTargetUser.uid, initialTargetUser.role, currentUser.uid]);

  const handleMessageClick = async () => {
    const chatId = [currentUser.uid, targetUser.uid].sort().join('_');
    // Navigate immediately — don't block on Firestore
    if (onMessage) onMessage(chatId);
    // Create chat doc in background if it doesn't exist
    try {
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);
      if (!chatSnap.exists()) {
        await setDoc(chatRef, {
          uids: [currentUser.uid, targetUser.uid],
          lastActivity: serverTimestamp(),
          lastMessage: '',
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error('Chat create error:', err);
    }
  };

  const handleFollowClick = async () => {
    const followId = `${currentUser.uid}_${targetUser.uid}`;
    try {
      if (isFollowing) {
        await deleteDoc(doc(db, 'follows', followId));
      } else {
        await setDoc(doc(db, 'follows', followId), {
          followerUid: currentUser.uid,
          followingUid: targetUser.uid,
          createdAt: serverTimestamp()
        });
        await addDoc(collection(db, 'notifications'), {
          toUid: targetUser.uid,
          fromUid: currentUser.uid,
          fromName: currentProfile?.name || currentUser.displayName || 'Anonymous',
          fromPhoto: currentProfile?.photoURL || currentUser.photoURL || '',
          type: 'follow',
          message: `${currentProfile?.name || 'Someone'} started following you!`,
          isRead: false,
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error("Follow error:", err);
    }
  };

  const handlePostReview = async () => {
    if (!newReview.trim()) return;
    setIsPosting(true);
    try {
      // Fetch fresh author profile for accurate name/photo
      const authorSnap = await getDoc(doc(db, 'users', currentUser.uid)).catch(() => null);
      const authorData = authorSnap?.exists() ? authorSnap.data() : null;
      const authorName = authorData?.name || currentUser.displayName || currentUser.email?.split('@')[0] || 'Anonymous';
      const authorPhoto = authorData?.photoURL || currentUser.photoURL || '';
      const authorRole = authorData?.role || 'consumer';

      const reviewRef = await addDoc(collection(db, 'user_reviews'), {
        fromUid: currentUser.uid,
        fromName: authorName,
        fromPhoto: authorPhoto,
        toUid: targetUser.uid,
        content: newReview,
        likesCount: 0,
        createdAt: serverTimestamp()
      });

      // Cross-post to global feed so all users can see it; store reviewId to allow linked deletion
      await addDoc(collection(db, 'global_posts'), {
        authorUid: currentUser.uid,
        authorName,
        authorPhoto,
        authorRole,
        toUid: targetUser.uid,
        toName: targetUser.name,
        toPhoto: targetUser.photoURL || '',
        wallPost: true,
        userReviewId: reviewRef.id,
        content: newReview,
        postType: 'post',
        likesCount: 0,
        likedBy: [],
        createdAt: serverTimestamp()
      });

      setNewReview('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsPosting(false);
    }
  };

  const pubStoreMap = new Map<string, StoreProfile>(stores.map(s => [s.id!, s]));
  const pubTiersByStore = new Map<string, number>();
  allCards.forEach(c => {
    if ((c.tiersCompleted || 0) > (pubTiersByStore.get(c.store_id) || 0))
      pubTiersByStore.set(c.store_id, c.tiersCompleted as number);
  });
  const pubStagesFor = (sid: string) => {
    const s = pubStoreMap.get(sid);
    if (s) return s.rewardTiers?.length || 1;
    return pubTiersByStore.get(sid) || 1;
  };
  const publicUserRewards = Math.max(
    allCards.filter(c => !c.isArchived).reduce((sum, c) => sum + (c.total_completed_cycles || 0) * pubStagesFor(c.store_id), 0),
    allCards.filter(c => c.isArchived && c.isRedeemed).reduce((sum, c) => sum + pubStagesFor(c.store_id), 0),
    targetUser.totalRedeemed || 0
  );
  const publicUserStamps = Math.max(
    targetUser.totalStamps || 0,
    allCards.reduce((acc, c) => acc + (c.current_stamps || 0), 0)
  );

  const pubBadgeMetrics: Record<BadgeMetric, number> = {
    stamps: publicUserStamps,
    cards_completed: publicUserRewards,
    challenges_joined: publicEntries.size,
    memberships: cards.length,
    followers: targetFollowers,
    following: targetFollowing,
    posts: userPosts.length,
    charity_animals: targetUser.charityAnimals || 0,
    charity_trees: targetUser.charityTrees || 0,
    charity_total: (targetUser.charityAnimals || 0) + (targetUser.charityTrees || 0),
  };
  const earnedBadges = allBadges.filter(b => (pubBadgeMetrics[b.metric] ?? 0) >= b.threshold);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6 pb-20 text-brand-navy"
    >
      <button onClick={onBack} className="flex items-center gap-2 text-brand-navy/60 font-bold text-sm hover:text-brand-navy transition-colors">
        <ArrowLeft size={18} />
        Back
      </button>

      <div className="glass-card p-6 rounded-[3rem] relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-24 bg-brand-gold/10" />
        <div className="relative z-10">
          {/* Row: photo left, info right */}
          <div className="flex items-start gap-4 mb-4">
            <div className="bg-gradient-to-b from-indigo-50 to-purple-50 rounded-[1.5rem] p-3 border-4 border-white shadow-xl shrink-0">
              <PixelAvatar config={targetUser.avatar} uid={targetUser.uid} size={64} view="full" />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold leading-tight">{targetUser.name}</h2>
                <StreakBadge streak={targetUser.streak} size="lg" />
              </div>
              <p className="text-brand-gold font-bold text-xs uppercase tracking-[0.2em]">@{targetUser.handle || targetUser.email?.split('@')[0]}</p>
              <div className="flex items-center gap-3 mt-2 text-sm">
                <span className="flex items-center gap-1 font-bold">
                  <span>{targetFollowing}</span>
                  <span className="text-brand-navy/40 font-normal">Following</span>
                </span>
                <span className="text-brand-navy/20">•</span>
                <span className="flex items-center gap-1 font-bold">
                  <span>{targetFollowers}</span>
                  <span className="text-brand-navy/40 font-normal">Followers</span>
                </span>
              </div>
            </div>
          </div>

          {/* Stats — centered */}
          <div className="flex gap-2">
            {[
              { val: publicUserStamps,  label: 'Stamps'  },
              { val: cards.length,      label: 'Cards'   },
              { val: publicUserRewards, label: 'Rewards' },
            ].map(s => (
              <div key={s.label} className="flex-1 rounded-2xl px-3 py-2.5 flex flex-col items-center gap-0.5"
                   style={{ background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 50%, #3B82F6 100%)' }}>
                <p className="font-bold text-sm leading-none text-white">{s.val}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-white/60">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Follow / Message buttons */}
          {currentUser && currentUser.uid !== targetUser.uid && (
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleFollowClick}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all active:scale-95",
                  isFollowing ? "bg-brand-navy/8 text-green-600 hover:bg-red-50 hover:text-red-500" : "bg-brand-navy/8 text-brand-gold hover:bg-brand-gold/10"
                )}
              >
                {isFollowing ? <><UserCheck size={18} />Following</> : <><UserPlus size={18} />Follow</>}
              </button>
              <button
                onClick={handleMessageClick}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-brand-navy/8 text-brand-gold font-bold text-sm transition-all active:scale-95 hover:bg-brand-gold/10"
              >
                <MessageCircle size={18} />
                Message
              </button>
            </div>
          )}
        </div>
      </div>


      {/* Badges swipe row */}
      {earnedBadges.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40 mb-2.5 text-center">Badges</p>
          <BadgeSwipeRow badges={earnedBadges} onSelectBadge={setSelectedBadge} />
        </div>
      )}

      <AnimatePresence>
        {selectedBadge && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-end max-w-md mx-auto"
            onClick={() => setSelectedBadge(null)}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              className="w-full bg-brand-bg rounded-t-3xl p-6 pb-10 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-[1.25rem] flex items-center justify-center text-3xl shadow-lg shrink-0"
                  style={{ background: `linear-gradient(135deg, ${selectedBadge.color}ee, ${selectedBadge.color}99)` }}
                >{selectedBadge.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-brand-navy text-lg leading-tight">{selectedBadge.name}</p>
                  <p className="text-xs text-brand-navy/50 mt-1">{BADGE_METRIC_LABELS[selectedBadge.metric]} ≥ {selectedBadge.threshold}</p>
                </div>
              </div>
              {selectedBadge.description && (
                <p className="text-sm text-brand-navy/70 leading-relaxed">{selectedBadge.description}</p>
              )}
              <button onClick={() => setSelectedBadge(null)} className="w-full py-3 rounded-2xl bg-brand-navy/8 text-brand-navy font-bold text-sm active:scale-[0.98] transition-all">Close</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {targetUser.role === 'vendor' && vendorStore && (
        <div className="bg-brand-navy p-6 rounded-[2.5rem] text-white space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl overflow-hidden border border-white/10">
                <img src={vendorStore.logoUrl} alt="" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Business Owner</p>
                <p className="font-bold">{vendorStore.name}</p>
              </div>
            </div>
            <button 
              onClick={() => onViewStore(vendorStore)}
              className="bg-brand-gold text-brand-navy px-4 py-2 rounded-xl text-xs font-bold shadow-lg"
            >
              View Shop
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="font-display text-xl font-bold px-2">Active Cards</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {cards.map(card => {
            const store = stores.find(s => s.id === card.store_id);
            if (!store) return null;
            const theme = store.theme || '#3a6fcc';
            const filled = Math.round((card.current_stamps / store.stamps_required_for_reward) * 5);
            return (
              <div
                key={card.id}
                onClick={() => onViewStore(store)}
                className="p-4 rounded-2xl flex items-center justify-between cursor-pointer transition-all group"
                style={{ background: `${theme}12`, border: `1.5px solid ${theme}30` }}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm shrink-0" style={{ borderColor: `${theme}40`, borderWidth: 2, borderStyle: 'solid' }}>
                    <img src={store.logoUrl} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate transition-colors" style={{ color: theme }}>{store.name}</p>
                    <p className="text-[10px] text-brand-navy/40 uppercase font-bold tracking-widest leading-none">{card.current_stamps} / {store.stamps_required_for_reward} Stamps</p>
                  </div>
                </div>
                <div className="flex gap-0.5 shrink-0 ml-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i < filled ? theme : `${theme}25` }} />
                  ))}
                </div>
              </div>
            );
          })}
          {cards.length === 0 && (
            <div className="col-span-1 sm:col-span-2 py-8 text-center text-brand-navy/20 bg-white/50 rounded-2xl border border-dashed border-brand-navy/5">
              <p className="text-xs font-bold uppercase tracking-widest italic">No active loyalty cards</p>
            </div>
          )}
        </div>
      </div>

      {/* Challenges */}
      {(() => {
        const theirChallenges = publicChallenges.filter(c => (c.participantUids || []).includes(initialTargetUser.uid));
        if (theirChallenges.length === 0) return null;
        return (
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40 px-1">Challenges</p>
            {theirChallenges.map(c => {
              const entry = publicEntries.get(c.id);
              let progress = 0;
              if (entry) {
                if (c.vendorIds?.length) {
                  progress = Math.min(c.goal, entry.count || 0);
                } else {
                  progress = Math.max(0, Math.min(c.goal, (targetUser.totalStamps || 0) - (entry.totalStampsAtJoin || 0)));
                }
              }
              const pct = c.goal > 0 ? Math.min(100, Math.round((progress / c.goal) * 100)) : 0;
              const done = pct >= 100;
              return (
                <div key={c.id} className="rounded-2xl px-4 py-3 gradient-logo-blue overflow-hidden relative">
                  <span className="shine-ray" aria-hidden="true" />
                  <div className="flex items-center justify-between mb-1.5 gap-2 relative z-10">
                    <p className="text-xs font-bold leading-tight line-clamp-1 flex-1 text-white">{c.title}</p>
                    <span className={cn('text-[10px] font-bold shrink-0', done ? 'text-green-300' : 'text-white/80')}>{done ? '✓ Done' : `${pct}%`}</span>
                  </div>
                  <div className="h-1.5 bg-white/20 rounded-full overflow-hidden relative z-10">
                    <motion.div
                      className={cn('h-full rounded-full', done ? 'bg-green-400' : 'bg-white')}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                  <p className="text-[9px] mt-1.5 font-medium text-white/60 relative z-10">{progress} / {c.goal} {c.unit} · 🎁 {c.reward}</p>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Tab switcher */}
      <div className="flex p-1 glass-card rounded-2xl">
        <button
          onClick={() => setProfileTab('wall')}
          className={cn("flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5", profileTab === 'wall' ? "bg-brand-navy text-white shadow" : "text-brand-navy/40")}
        >
          <MessageSquare size={13} />
          Wall
        </button>
        <button
          onClick={() => setProfileTab('posts')}
          className={cn("flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5", profileTab === 'posts' ? "bg-brand-navy text-white shadow" : "text-brand-navy/40")}
        >
          <Zap size={13} />
          Posts {userPosts.length > 0 && `(${userPosts.length})`}
        </button>
      </div>

      {profileTab === 'wall' ? (
        <div className="space-y-4">
          {targetUser.uid !== currentUser.uid && (
            <div className="glass-card p-6 rounded-[2.5rem] space-y-4">
              <textarea
                value={newReview}
                onChange={(e) => setNewReview(e.target.value)}
                placeholder={`Write on ${targetUser.name}'s wall...`}
                className="w-full p-4 rounded-2xl bg-brand-bg border-none focus:ring-2 focus:ring-brand-gold/20 text-sm h-24 resize-none"
              />
              <button
                onClick={handlePostReview}
                disabled={isPosting || !newReview.trim()}
                className="w-full bg-brand-navy text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-brand-navy/10"
              >
                <Send size={18} />
                Post to Wall
              </button>
            </div>
          )}
          <div className="space-y-4">
            {reviews.map(review => (
              <WallPostItem key={review.id} post={review} currentUser={currentUser} wallOwnerUid={targetUser.uid} onViewUser={onViewUser} />
            ))}
            {reviews.length === 0 && (
              <p className="text-center py-12 text-xs text-brand-navy/20 font-bold uppercase tracking-widest italic">No wall posts yet</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {userPosts.map(post => (
            <FeedPostCard
              key={post.id}
              post={post}
              currentUser={currentUser}
              currentProfile={currentProfile}
              onViewUser={onViewUser}
              onLike={async (p) => {
                const ref = doc(db, 'global_posts', p.id);
                const alreadyLiked = (p.likedBy || []).includes(currentUser.uid);
                await updateDoc(ref, {
                  likedBy: alreadyLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
                  likesCount: alreadyLiked ? Math.max(0, p.likesCount - 1) : p.likesCount + 1,
                });
              }}
              onVote={async (p, optionIndex) => {
                const ref = doc(db, 'global_posts', p.id);
                const votes = p.pollVotes || {};
                const currentVoteKey = Object.keys(votes).find(k => (votes[k] || []).includes(currentUser.uid));
                const updates: any = {};
                if (currentVoteKey !== undefined) updates[`pollVotes.${currentVoteKey}`] = arrayRemove(currentUser.uid);
                if (currentVoteKey !== String(optionIndex)) updates[`pollVotes.${optionIndex}`] = arrayUnion(currentUser.uid);
                if (Object.keys(updates).length > 0) await updateDoc(ref, updates);
              }}
            />
          ))}
          {userPosts.length === 0 && (
            <p className="text-center py-12 text-xs text-brand-navy/20 font-bold uppercase tracking-widest italic">No posts yet</p>
          )}
        </div>
      )}
    </motion.div>
  );
}
