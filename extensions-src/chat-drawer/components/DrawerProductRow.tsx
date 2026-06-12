'use client';
/**
 * DrawerProductRow — compact product row (drawer-redesign Task 6).
 *
 * Translated 1:1 from the design handoff (storefront.jsx DrawerProduct,
 * 678–727): 64px image | kicker/title/price | heart + arrow column.
 *
 * Storefront context: links are SAME-ORIGIN relative `/products/{handle}`
 * (the drawer lives on the merchant's own domain). No handle → disabled
 * arrow button. Plain <img> (not next/image) keeps the storefront bundle
 * free of Next runtime coupling.
 */
import type { ChatProduct } from '@/types/product';

interface DrawerProductRowProps {
  product: ChatProduct;
  isSaved: boolean;
  onToggleSave: () => void;
}

function ArrowIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

export function DrawerProductRow({ product, isSaved, onToggleSave }: DrawerProductRowProps) {
  return (
    <div className="grid grid-cols-[64px_1fr_auto] items-center gap-2.5 rounded-[10px] border border-[#ededed] bg-white p-2">
      <div className="aspect-square overflow-hidden rounded-lg bg-[#f5f5f0]">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- storefront bundle: no Next image runtime
          <img src={product.image} alt={product.title} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0">
        {product.type ? (
          <div className="text-[9.5px] font-bold tracking-[0.05em] text-[#8c8c8c] uppercase">
            {product.type}
          </div>
        ) : null}
        <div className="mt-0.5 truncate text-[13px] font-semibold text-[#1a1a1a]">
          {product.title}
        </div>
        <div className="mt-0.5 text-xs font-semibold text-[#1a1a1a]">{product.price}</div>
      </div>
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          aria-label={isSaved ? 'Remove saved product' : 'Save product'}
          onClick={onToggleSave}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-[7px] border border-[#ededed] bg-white"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill={isSaved ? '#e53e3e' : 'none'}
            stroke={isSaved ? '#e53e3e' : '#8c8c8c'}
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M19 14c1.5-1.5 3-3.3 3-5.5A4.5 4.5 0 0017.5 4 5 5 0 0012 7a5 5 0 00-5.5-3A4.5 4.5 0 002 8.5c0 2.2 1.5 4 3 5.5l7 7Z" />
          </svg>
        </button>
        {product.handle ? (
          <a
            href={`/products/${product.handle}`}
            aria-label={`View ${product.title}`}
            className="flex h-7 w-7 items-center justify-center rounded-[7px] border-none bg-[var(--sd-accent,#5B4FE9)] text-white no-underline"
          >
            <ArrowIcon />
          </a>
        ) : (
          <button
            type="button"
            disabled
            aria-label={`View ${product.title}`}
            className="flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-[7px] border-none bg-[#d4d4d4] text-white"
          >
            <ArrowIcon />
          </button>
        )}
      </div>
    </div>
  );
}
