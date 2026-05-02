import type { ChatProduct } from '@/types/product';

export const MOCK_PRODUCTS: ChatProduct[] = [
  {
    id: '1',
    title: 'Midnight Runner Sneakers',
    price: '$85.00',
    category: 'Footwear',
    description: 'Breathable mesh running shoes for night joggers.',
    tags: ['comfortable', 'black', 'running', 'sport'],
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80',
  },
  {
    id: '2',
    title: 'Arctic Down Parka',
    price: '$220.00',
    category: 'Apparel',
    description: 'Heavy duty winter jacket designed for extreme cold.',
    tags: ['winter', 'warm', 'blue', 'heavy'],
    image: 'https://images.unsplash.com/photo-1539533377285-b924260387d8?w=400&q=80',
  },
  {
    id: '3',
    title: 'Minimalist Leather Wallet',
    price: '$45.00',
    category: 'Accessories',
    description: 'Full-grain leather wallet with RFID protection.',
    tags: ['leather', 'brown', 'slim', 'essential'],
    image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=400&q=80',
  },
];
