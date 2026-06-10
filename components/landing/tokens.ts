export const ACCENT = '#5B4FE9';

// Blend toward white (+) or black (−) by fraction of the distance; −100 = black, +100 = white.
export function shade(hex: string, percent: number): string {
  const h = hex.replace('#', '');
  const num = parseInt(
    h.length === 3 ? h.split('').map((c) => c + c).join('') : h,
    16
  );
  let r = (num >> 16) & 0xff,
    g = (num >> 8) & 0xff,
    b = num & 0xff;
  const t = percent / 100;
  r = Math.round(r + (t > 0 ? 255 - r : r) * t);
  g = Math.round(g + (t > 0 ? 255 - g : g) * t);
  b = Math.round(b + (t > 0 ? 255 - b : b) * t);
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Convert hex → rgba string with alpha
export function rgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const num = parseInt(
    h.length === 3 ? h.split('').map((c) => c + c).join('') : h,
    16
  );
  const r = (num >> 16) & 0xff,
    g = (num >> 8) & 0xff,
    b = num & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}
