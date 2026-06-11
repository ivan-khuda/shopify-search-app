'use client';

import { Heart } from 'lucide-react';
import type { ChatProduct } from '@/types/product';
import type { CardDensity } from '../appearance';
import { ProductCard } from './product-card';

interface SavedProductsPanelProps {
  products: ChatProduct[];
  onToggleSave: (product: ChatProduct) => void;
  density?: CardDensity;
}

export function SavedProductsPanel({
  products,
  onToggleSave,
  density = 'standard',
}: SavedProductsPanelProps) {
  const gridClass =
    density === 'compact'
      ? 'grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5'
      : 'grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4';
  // hero density renders standard cards in the standard grid (prototype line 821)
  const cardDensity: CardDensity = density === 'hero' ? 'standard' : density;

  return (
    <div className="mx-auto w-full max-w-[1020px] p-6">
      <div className="mb-4">
        <h2 className="m-0 text-base font-semibold text-[#202223]">Saved products</h2>
        <p className="m-0 mt-[3px] text-[12.5px] text-[#6d7175]">
          {products.length} item{products.length === 1 ? '' : 's'} bookmarked from this
          preview
        </p>
      </div>

      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e1e3e5] bg-white px-6 py-10 text-center">
          <div className="mx-auto mb-2.5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#f1f2f4] text-[#8c9196]">
            <Heart size={22} aria-hidden="true" />
          </div>
          <div className="mb-1 text-sm font-semibold text-[#202223]">Nothing saved</div>
          <div className="text-[12.5px] text-[#6d7175]">
            Tap the heart on any product to save it for later.
          </div>
        </div>
      ) : (
        <div className={gridClass}>
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              density={cardDensity}
              isSaved
              onSave={() => onToggleSave(product)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
