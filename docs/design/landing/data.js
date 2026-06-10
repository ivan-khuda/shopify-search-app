// Demo catalog for "Field & Form" — a ceramics + home goods store.
// Curated mix of ceramics, plants, textiles, and small homewares.

const CATALOG = [
  {
    id: 'p1', title: 'Stoneware Mug',
    price: 32, currency: 'USD',
    vendor: 'Field & Form Studio', type: 'Ceramics',
    tags: ['handmade', 'coffee', 'mug', 'matte', 'speckled', 'cream'],
    description: 'A handthrown stoneware mug with a speckled matte glaze. Holds 12oz. Dishwasher safe.',
    image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600&q=80',
    variants: [{ id: 'v1', title: 'Cream' }, { id: 'v2', title: 'Sand' }],
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

// Models for the picker. Pricing in $/1M tokens.
const MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google',
    contextK: 1000, inPrice: 0.075, outPrice: 0.30,
    bestFor: 'Balanced default — fast, cheap, great for product Q&A',
    badge: 'Recommended' },
  { id: 'gpt-4o-mini', name: 'GPT-4o mini', provider: 'OpenAI',
    contextK: 128, inPrice: 0.15, outPrice: 0.60,
    bestFor: 'Conversational chat, follow-ups, friendly tone' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'Anthropic',
    contextK: 200, inPrice: 0.25, outPrice: 1.25,
    bestFor: 'Polished writing, nuanced product descriptions' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google',
    contextK: 2000, inPrice: 1.25, outPrice: 5.00,
    bestFor: 'Highest quality reasoning, longer conversations',
    badge: 'Premium' },
  { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', provider: 'Meta',
    contextK: 128, inPrice: 0.20, outPrice: 0.20,
    bestFor: 'Open-weights, fast, good for high volume' },
];

// Suggested prompts shown in chat empty states
const SUGGESTED_PROMPTS = [
  { icon: '☕', text: 'Something to drink coffee out of' },
  { icon: '🌿', text: 'A low-maintenance plant for my office' },
  { icon: '🍽️', text: 'Dinnerware for four — neutral, modern' },
  { icon: '🎁', text: 'Hostess gift under $50' },
];

// Sample fake assistant replies (per prompt, used for streaming simulation)
const SAMPLE_REPLIES = {
  'Something to drink coffee out of':
    "Great — I found a few options from your ceramics line. The Stoneware Mug is our most popular pick at $32 and pairs nicely with the cereal bowl. If you're after something more statement-y, the speckled set works for both coffee and matcha.",
  'A low-maintenance plant for my office':
    "Two solid picks: the Snake Plant tolerates low light and goes weeks between waterings, and the Pampas Grass bundle is fully dried — no water at all. Both ship in their planters and arrive within 5 days.",
  'Dinnerware for four — neutral, modern':
    "The Ceramic Dinner Plate Set is exactly that — a four-piece matte stoneware set in cream. You could pair it with the speckled cereal bowls and the stoneware mugs for a coherent table. Total runs about $290 for a full setting.",
  'Hostess gift under $50':
    "A few thoughtful options under $50: the Stoneware Mug ($32), the Cotton Tea Towel Set ($28), or the Olive Wood Spoon ($24). The tea towels arrive gift-wrapped automatically.",
  default:
    "I searched your catalog and found a few products that match. Let me know if you'd like to narrow by price, color, or material.",
};

// Map a prompt to the product IDs that should accompany the reply
const PROMPT_TO_PRODUCTS = {
  'Something to drink coffee out of': ['p1', 'p13', 'p8'],
  'A low-maintenance plant for my office': ['p3', 'p14', 'p9'],
  'Dinnerware for four — neutral, modern': ['p8', 'p13', 'p1'],
  'Hostess gift under $50': ['p1', 'p10', 'p11'],
};

// Fuzzy fallback matcher for free-form queries
function searchCatalog(query) {
  const q = query.toLowerCase();
  if (PROMPT_TO_PRODUCTS[query]) {
    return PROMPT_TO_PRODUCTS[query].map(id => CATALOG.find(p => p.id === id));
  }
  const words = q.split(/\s+/).filter(w => w.length > 2);
  const scored = CATALOG.map(p => {
    const hay = [p.title, p.description, p.type, ...(p.tags || [])].join(' ').toLowerCase();
    const score = words.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0);
    return { p, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter(s => s.score > 0).slice(0, 3).map(s => s.p);
  return top.length ? top : CATALOG.slice(0, 3);
}

window.CATALOG = CATALOG;
window.MODELS = MODELS;
window.SUGGESTED_PROMPTS = SUGGESTED_PROMPTS;
window.SAMPLE_REPLIES = SAMPLE_REPLIES;
window.searchCatalog = searchCatalog;
