'use client';

import { Heart } from 'lucide-react';
import Image from 'next/image';
import type { ChatProduct } from '@/types/product';
import type { CardDensity } from '../appearance';

interface ProductCardProps {
  product: ChatProduct;
  isSaved: boolean;
  onSave: () => void;
  density?: CardDensity;
  productUrlBase?: string;
  linkTarget?: '_blank' | '_self';
}

function SaveButton({
  isSaved,
  onSave,
  small,
}: {
  isSaved: boolean;
  onSave: () => void;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={isSaved ? 'Remove saved product' : 'Save product'}
      onClick={onSave}
      className={`absolute top-1.5 right-1.5 flex items-center justify-center rounded-full bg-white/95 shadow-[0_1px_3px_rgba(0,0,0,0.12)] backdrop-blur ${small ? 'h-6 w-6' : 'h-7 w-7'}`}
    >
      <Heart
        size={small ? 12 : 14}
        className={isSaved ? 'fill-red-500 text-red-500' : 'text-[#6d7175]'}
      />
    </button>
  );
}

function CardImage({ product }: { product: ChatProduct }) {
  return product.image ? (
    <Image
      src={product.image}
      alt={product.title}
      fill
      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
      unoptimized
      className="object-cover"
    />
  ) : (
    <div className="flex h-full items-center justify-center text-sm text-gray-400">No image</div>
  );
}

export function ProductCard({ product, isSaved, onSave, density = 'standard', productUrlBase = '', linkTarget = '_self' }: ProductCardProps) {
  if (density === 'hero') {
    return (
      <div className="grid grid-cols-[200px_1fr] overflow-hidden rounded-[14px] border border-[#e1e3e5] bg-white">
        <div className="relative aspect-square bg-[#f6f6f7]">
          <CardImage product={product} />
          <SaveButton isSaved={isSaved} onSave={onSave} />
        </div>
        <div className="flex flex-col p-4">
          <div className="mb-1 text-[10px] font-bold tracking-[0.06em] text-[#6d7175] uppercase">
            {[product.vendor, product.type].filter(Boolean).join(' · ')}
          </div>
          <div className="mb-1.5 text-[15px] font-semibold text-[#202223]">{product.title}</div>
          <p className="m-0 flex-1 text-[12.5px] leading-normal text-[#5c5f62] line-clamp-3">
            {product.description}
          </p>
          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-[17px] font-semibold text-[#202223]">{product.price}</span>
            {product.handle ? (
              <a
                href={`${productUrlBase}/products/${product.handle}`}
                target={linkTarget}
                {...(linkTarget === '_blank' ? { rel: 'noopener noreferrer' } : {})}
                className="rounded-[7px] border-none bg-[var(--sd-accent,#5B4FE9)] px-3 py-1.5 text-xs font-semibold text-white no-underline"
              >
                View product →
              </a>
            ) : (
              <button
                type="button"
                className="rounded-[7px] border-none bg-[var(--sd-accent,#5B4FE9)] px-3 py-1.5 text-xs font-semibold text-white"
              >
                View product →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const compact = density === 'compact';
  return (
    <div
      className={`flex h-full flex-col overflow-hidden border border-[#e1e3e5] bg-white ${compact ? 'rounded-lg' : 'rounded-xl'}`}
    >
      <div className="relative aspect-square bg-[#f6f6f7]">
        <CardImage product={product} />
        <SaveButton isSaved={isSaved} onSave={onSave} small={compact} />
      </div>
      <div className={`flex flex-1 flex-col ${compact ? 'px-2.5 py-2' : 'px-3 py-2.5'}`}>
        {!compact && product.type && (
          <div className="mb-0.5 text-[9.5px] font-bold tracking-[0.06em] text-[#8c9196] uppercase">
            {product.type}
          </div>
        )}
        <div
          className={`truncate font-semibold text-[#202223] ${compact ? 'text-xs' : 'text-[13px]'}`}
        >
          {product.title}
        </div>
        {!compact && (
          <div className="mt-0.5 text-[11.5px] leading-snug text-[#6d7175] line-clamp-2">
            {product.description}
          </div>
        )}
        <div className={`flex items-center justify-between ${compact ? 'mt-1' : 'mt-2'}`}>
          <span className={`font-semibold text-[#202223] ${compact ? 'text-[13px]' : 'text-sm'}`}>
            {product.price}
          </span>
          {!compact && (
            product.handle ? (
              <a
                href={`${productUrlBase}/products/${product.handle}`}
                target={linkTarget}
                {...(linkTarget === '_blank' ? { rel: 'noopener noreferrer' } : {})}
                className="text-[10.5px] font-bold tracking-[0.04em] text-[var(--sd-accent,#5B4FE9)] no-underline"
              >
                VIEW →
              </a>
            ) : (
              <span className="text-[10.5px] font-bold tracking-[0.04em] text-[var(--sd-accent,#5B4FE9)]">
                VIEW →
              </span>
            )
          )}
        </div>
      </div>
    </div>
  );
}
