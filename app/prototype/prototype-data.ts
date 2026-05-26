// import { MOCK_PRODUCTS } from '@/components/chat/mock-products';

export interface PrototypeProduct {
  id: string;
  title: string;
  price: number;
  currency: string;
  vendor: string;
  type: string;
  tags: string[];
  description: string;
  image: string;
}

export interface PrototypeModel {
  id: string;
  name: string;
  provider: 'Google' | 'OpenAI' | 'Anthropic' | 'Meta';
  contextK: number;
  inPrice: number;
  outPrice: number;
  bestFor: string;
  badge?: string;
}

export interface SuggestedPrompt {
  icon: string;
  text: string;
}

export interface PrototypeMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  products?: PrototypeProduct[];
  status?: 'searching' | 'streaming' | 'done';
}

export interface HistoryEntry {
  id: string;
  query: string;
  timestamp: string;
  productCount: number;
}

const VENDOR_BY_CATEGORY: Record<string, string> = {
  Footwear: 'Trail & Pace',
  Apparel: 'Nordic Outfit Co.',
  Accessories: 'Maker & Hide',
};

const parsePrice = (p: string): number => {
  const n = Number(p.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// export const CATALOG: PrototypeProduct[] = MOCK_PRODUCTS.map((p) => ({
//   id: p.id,
//   title: p.title,
//   price: parsePrice(p.price),
//   currency: 'USD',
//   vendor: VENDOR_BY_CATEGORY[p.category ?? ''] ?? 'House Brand',
//   type: p.category ?? 'Goods',
//   tags: p.tags ?? [],
//   description: p.description,
//   image: p.image ?? '',
// }));

export const CATALOG: PrototypeProduct[] = [
  {
    id: 'p1', title: 'Stoneware Mug',
    price: 32, currency: 'USD',
    vendor: 'Field & Form Studio', type: 'Ceramics',
    tags: ['handmade', 'coffee', 'mug', 'matte', 'speckled', 'cream'],
    description: 'A handthrown stoneware mug with a speckled matte glaze. Holds 12oz. Dishwasher safe.',
    image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600&q=80',
    // variants: [{ id: 'v1', title: 'Cream' }, { id: 'v2', title: 'Sand' }],
  },
  {
    id: 'p2', title: 'Linen Throw Blanket',
    price: 89, currency: 'USD',
    vendor: 'Loom & Field', type: 'Textiles',
    tags: ['linen', 'natural', 'living room', 'soft', 'throw', 'oatmeal'],
    description: 'Stonewashed Belgian linen throw with hand-tied fringe. 50" × 60".',
    image: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=600&q=80',
  },
  {
    id: 'p3', title: 'Snake Plant in Terracotta',
    price: 48, currency: 'USD',
    vendor: 'Greenhouse Co.', type: 'Plants',
    tags: ['indoor plant', 'low light', 'easy care', 'air purifier', 'sansevieria'],
    description: 'A mature Sansevieria in a 6" terracotta pot. Thrives on neglect.',
    image: 'https://images.unsplash.com/photo-1593482892290-f54927ae1bb6?w=600&q=80',
  },
  {
    id: 'p4', title: 'Hand-thrown Vase',
    price: 120, currency: 'USD',
    vendor: 'Field & Form Studio', type: 'Ceramics',
    tags: ['vase', 'sculptural', 'centerpiece', 'cream', 'matte'],
    description: 'A sculptural vessel hand-thrown in our Oakland studio. Each piece is one of a kind.',
    image: 'https://images.unsplash.com/photo-1578500351865-d6c3706f46bc?w=600&q=80',
  },
  {
    id: 'p5', title: 'Walnut Serving Board',
    price: 65, currency: 'USD',
    vendor: 'Heritage Wood', type: 'Kitchen',
    tags: ['walnut', 'cheese board', 'serving', 'wood', 'entertaining'],
    description: 'Solid walnut serving board with a hand-rubbed beeswax finish. 18" × 9".',
    image: 'https://images.unsplash.com/photo-1632498898141-c70f1c7c4ec0?w=600&q=80',
  },
  {
    id: 'p6', title: 'Brass Candle Holder Set',
    price: 58, currency: 'USD',
    vendor: 'North Foundry', type: 'Decor',
    tags: ['brass', 'candle', 'set of 3', 'tabletop', 'warm metal'],
    description: 'Set of three tapered brass holders in graduated heights. For standard taper candles.',
    image: 'https://images.unsplash.com/photo-1602523498321-9d0a7a2bc0d6?w=600&q=80',
  },
  {
    id: 'p7', title: 'Wool Floor Pillow',
    price: 145, currency: 'USD',
    vendor: 'Loom & Field', type: 'Textiles',
    tags: ['floor pillow', 'wool', 'meditation', 'large cushion', 'natural'],
    description: 'Oversized 26" floor pillow filled with natural wool. Hand-loomed cover.',
    image: 'https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=600&q=80',
  },
  {
    id: 'p8', title: 'Ceramic Dinner Plate Set',
    price: 180, currency: 'USD',
    vendor: 'Field & Form Studio', type: 'Ceramics',
    tags: ['dinner plates', 'set of 4', 'dinnerware', 'matte', 'ceramic'],
    description: 'A set of four matte stoneware dinner plates. 11" diameter. Microwave + dishwasher safe.',
    image: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=600&q=80',
  },
  {
    id: 'p9', title: 'Terracotta Planter',
    price: 36, currency: 'USD',
    vendor: 'Greenhouse Co.', type: 'Plants',
    tags: ['planter', 'terracotta', 'pot', 'small', 'natural clay'],
    description: 'Classic terracotta planter with drainage. 8" diameter. Plant not included.',
    image: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=600&q=80',
  },
  {
    id: 'p10', title: 'Cotton Tea Towel Set',
    price: 28, currency: 'USD',
    vendor: 'Loom & Field', type: 'Textiles',
    tags: ['tea towel', 'kitchen', 'cotton', 'set of 2', 'striped'],
    description: 'Two heavyweight cotton tea towels with woven stripes. Pre-washed.',
    image: 'https://images.unsplash.com/photo-1620735692151-26a7e0748429?w=600&q=80',
  },
  {
    id: 'p11', title: 'Olive Wood Spoon',
    price: 24, currency: 'USD',
    vendor: 'Heritage Wood', type: 'Kitchen',
    tags: ['utensil', 'olive wood', 'cooking', 'spoon', 'wood'],
    description: 'A long-handled olive wood spoon. Hand-carved in Tunisia. Each piece is unique.',
    image: 'https://images.unsplash.com/photo-1574226516831-e1dff420e562?w=600&q=80',
  },
  {
    id: 'p12', title: 'Linen Apron',
    price: 54, currency: 'USD',
    vendor: 'Loom & Field', type: 'Textiles',
    tags: ['apron', 'linen', 'kitchen', 'natural', 'pockets'],
    description: 'A crossback linen apron with deep front pockets. One size fits most.',
    image: 'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=600&q=80',
  },
  {
    id: 'p13', title: 'Speckled Cereal Bowl',
    price: 42, currency: 'USD',
    vendor: 'Field & Form Studio', type: 'Ceramics',
    tags: ['bowl', 'speckled', 'breakfast', 'cereal', 'ceramic'],
    description: 'A deep stoneware bowl perfect for breakfast or noodles. Holds 18oz.',
    image: 'https://images.unsplash.com/photo-1578991624414-276ef23a534f?w=600&q=80',
  },
  {
    id: 'p14', title: 'Pampas Grass Bundle',
    price: 32, currency: 'USD',
    vendor: 'Greenhouse Co.', type: 'Plants',
    tags: ['dried flowers', 'pampas', 'natural', 'arrangement', 'neutral'],
    description: 'A bundle of natural dried pampas plumes. Long-lasting, no water needed.',
    image: 'https://images.unsplash.com/photo-1604762524889-3e2fcc145683?w=600&q=80',
  },
  {
    id: 'p15', title: 'Glass Cloche',
    price: 68, currency: 'USD',
    vendor: 'North Foundry', type: 'Decor',
    tags: ['glass', 'display', 'cloche', 'dome', 'wood base'],
    description: 'Hand-blown glass dome on a turned oak base. Display anything beautifully.',
    image: 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=600&q=80',
  },
];

export const MODELS: PrototypeModel[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    contextK: 1000,
    inPrice: 0.075,
    outPrice: 0.3,
    bestFor: 'Balanced default — fast, cheap, great for product Q&A',
    badge: 'Recommended',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini',
    provider: 'OpenAI',
    contextK: 128,
    inPrice: 0.15,
    outPrice: 0.6,
    bestFor: 'Conversational chat, follow-ups, friendly tone',
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    contextK: 200,
    inPrice: 0.25,
    outPrice: 1.25,
    bestFor: 'Polished writing, nuanced product descriptions',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    contextK: 2000,
    inPrice: 1.25,
    outPrice: 5.0,
    bestFor: 'Highest quality reasoning, longer conversations',
    badge: 'Premium',
  },
  {
    id: 'llama-3.3-70b',
    name: 'Llama 3.3 70B',
    provider: 'Meta',
    contextK: 128,
    inPrice: 0.2,
    outPrice: 0.2,
    bestFor: 'Open-weights, fast, good for high volume',
  },
];

export const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  { icon: '👟', text: 'Comfortable shoes for night runs' },
  { icon: '🧥', text: 'Something warm for winter travel' },
  { icon: '💼', text: 'A minimalist wallet under $50' },
  { icon: '🎁', text: 'Gift idea under $100' },
];

export const SAMPLE_REPLIES: Record<string, string> = {
  'Comfortable shoes for night runs':
    "The Midnight Runner Sneakers are the obvious pick — breathable mesh, lightweight, designed for evening jogs. They run true to size and ship in three days.",
  'Something warm for winter travel':
    "Take a look at the Arctic Down Parka — heavy-duty insulation rated for extreme cold and packable into its own pouch. Pair it with the leather wallet for a clean travel kit.",
  'A minimalist wallet under $50':
    "The Minimalist Leather Wallet at $45 fits the brief: full-grain leather, RFID protection, slim profile. Available in brown only right now.",
  'Gift idea under $100':
    "Two solid picks under $100: the Midnight Runner Sneakers ($85) for someone active, or the Minimalist Leather Wallet ($45) as a clean everyday-carry gift.",
  default:
    "I searched your catalog and found a few products that match. Let me know if you want to narrow by price, color, or material.",
};

const PROMPT_TO_PRODUCTS: Record<string, string[]> = {
  'Comfortable shoes for night runs': ['1'],
  'Something warm for winter travel': ['2', '3'],
  'A minimalist wallet under $50': ['3'],
  'Gift idea under $100': ['1', '3'],
};

export function searchCatalog(query: string): PrototypeProduct[] {
  if (PROMPT_TO_PRODUCTS[query]) {
    return PROMPT_TO_PRODUCTS[query]
      .map((id) => CATALOG.find((p) => p.id === id))
      .filter((p): p is PrototypeProduct => Boolean(p));
  }
  const q = query.toLowerCase();
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  const scored = CATALOG.map((p) => {
    const hay = [p.title, p.description, p.type, ...p.tags].join(' ').toLowerCase();
    const score = words.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0);
    return { p, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter((s) => s.score > 0).slice(0, 3).map((s) => s.p);
  return top.length ? top : CATALOG.slice(0, 3);
}
