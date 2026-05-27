'use client';

import { Heart } from 'lucide-react';
import type { ChatProduct } from '@/types/product';
import { EmptyState } from './empty-state';
import { ProductCard } from './product-card';

interface SavedProductsPanelProps {
  products: ChatProduct[];
  onToggleSave: (product: ChatProduct) => void;
}

export function SavedProductsPanel({
  products,
  onToggleSave,
}: SavedProductsPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="mb-6 text-lg font-bold">Saved Products</h2>
      {products.length === 0 ? (
        <EmptyState
          icon={<Heart size={48} />}
          title="No saved products"
          description="Heart items in the chat to save them for later."
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isSaved
              onSave={() => onToggleSave(product)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
