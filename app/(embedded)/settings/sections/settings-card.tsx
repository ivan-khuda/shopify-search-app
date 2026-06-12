'use client';

/**
 * Settings-redesign — shared section chrome.
 *
 * Pixel reference: design handoff settings.jsx `SettingsCard` (lines 368–383)
 * and `inputStyle` (416–420). Every section (Tasks 10–13) renders an
 * 18px-padded white card with a 650-weight title and muted description, and
 * shares the same input treatment.
 */
import type { ReactNode } from 'react';

export function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-3 rounded-xl border border-[#e1e3e5] bg-white px-[18px] py-4">
      <div className="mb-[3px] text-sm font-[650] text-[#202223]">{title}</div>
      <div className="mb-3 text-[12.5px] leading-[1.45] text-[#6d7175]">
        {description}
      </div>
      {children}
    </div>
  );
}

/** Prototype section header (h2 + sub copy) shared by all five sections. */
export function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-[18px]">
      <h2 className="m-0 text-lg font-[650] tracking-[-0.01em] text-[#202223]">
        {title}
      </h2>
      <p className="m-0 mt-1 text-[13px] leading-normal text-[#5c5f62]">
        {description}
      </p>
    </div>
  );
}

/** Prototype `inputStyle` (settings.jsx 416–420) as Tailwind utilities. */
export const INPUT_CLASS =
  'w-full rounded-lg border border-[#c9ccd0] bg-white px-3 py-2 text-[13px] text-[#202223] outline-none';

/** Dark primary button shared by the section save rows. */
export const SAVE_BUTTON_CLASS =
  'cursor-pointer rounded-lg border-none bg-[#202223] px-4 py-2.5 text-[13.5px] font-semibold text-white disabled:cursor-default disabled:opacity-50';
