'use client';

import { ExternalLink, Heart } from 'lucide-react';
import Image from 'next/image';
import type { ChatProduct } from '@/types/product';

interface ProductCardProps {
  product: ChatProduct;
  isSaved: boolean;
  onSave: () => void;
}

export function ProductCard({ product, isSaved, onSave }: ProductCardProps) {
  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-xl border border-[#e1e3e5] bg-white transition-shadow hover:shadow-md">
      <div className="relative aspect-square overflow-hidden bg-[#f6f6f7]">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.title}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            unoptimized
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            No image
          </div>
        )}
        <button
          type="button"
          aria-label={isSaved ? 'Remove saved product' : 'Save product'}
          onClick={onSave}
          className="absolute top-2 right-2 rounded-full bg-white/90 p-2 shadow-sm backdrop-blur hover:bg-white"
        >
          <Heart
            size={16}
            className={isSaved ? 'fill-red-500 text-red-500' : 'text-gray-400'}
          />
        </button>
      </div>
      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-1 text-sm font-semibold">{product.title}</h3>
        <p className="mb-3 flex-1 line-clamp-2 text-xs text-gray-500">
          {product.description}
        </p>
        <div className="mt-auto flex items-center justify-between">
          <span className="text-sm font-bold text-[#202223]">{product.price}</span>
          <button
            type="button"
            className="flex items-center gap-1 text-[10px] font-bold tracking-wider text-[#008060] uppercase hover:underline"
          >
            View <ExternalLink size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
