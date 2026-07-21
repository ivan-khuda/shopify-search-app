export interface ChatProduct {
  id: string;
  title: string;
  price: string;
  description: string;
  image?: string;
  handle?: string;
  category?: string;
  vendor?: string;
  type?: string;
  tags?: string[];
}

export interface ChatHistoryItem {
  id: string;
  query: string;
  timestamp: string;
  productCount: number;
}
