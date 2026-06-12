'use client';
/**
 * DrawerSaved — saved items pane (drawer-redesign Task 7).
 * Translated 1:1 from the design handoff (storefront.jsx DrawerSaved,
 * 802–826): kicker + saved DrawerProductRow list (always isSaved) or the
 * empty copy.
 */
import type { ChatProduct } from '@/types/product';
import { DrawerProductRow } from './DrawerProductRow';

interface DrawerSavedProps {
  products: ChatProduct[];
  onToggleSave: (product: ChatProduct) => void;
}

export function DrawerSaved({ products, onToggleSave }: DrawerSavedProps) {
  return (
    <div className="flex-1 overflow-auto bg-[#fafafa] p-3.5">
      <div className="mb-3 text-xs font-bold tracking-[0.06em] text-[#8c8c8c] uppercase">
        Your saved items
      </div>
      {products.length === 0 ? (
        <div className="px-5 py-10 text-center text-[13px] text-[#8c8c8c]">
          Tap the heart on a product to save it here.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {products.map((product) => (
            <DrawerProductRow
              key={product.id}
              product={product}
              isSaved
              onToggleSave={() => onToggleSave(product)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
