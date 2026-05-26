'use client';

import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex h-64 flex-col items-center justify-center text-center">
      <div className="mb-4 text-gray-200">{icon}</div>
      <h3 className="text-base font-semibold text-[#202223]">{title}</h3>
      <p className="mx-auto mt-1 max-w-[200px] text-sm text-[#6d7175]">{description}</p>
    </div>
  );
}
