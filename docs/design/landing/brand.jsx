// Brand assets + iconography for SmartDiscovery AI.

const SDLogo = ({ size = 28, accent }) => (
  <div style={{
    width: size, height: size, borderRadius: size * 0.28,
    background: `linear-gradient(135deg, ${accent} 0%, ${shade(accent, -18)} 100%)`,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: `0 1px 0 rgba(255,255,255,0.4) inset, 0 4px 12px ${accent}33`,
    flexShrink: 0,
  }}>
    <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
      {/* Compass + spark mark */}
      <circle cx="11" cy="11" r="6.5" stroke="white" strokeWidth="1.7" fill="none" opacity="0.95"/>
      <path d="M14.5 14.5 L19 19" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M11 7.5 L12.2 10.3 L15 11 L12.2 11.7 L11 14.5 L9.8 11.7 L7 11 L9.8 10.3 Z"
            fill="white"/>
    </svg>
  </div>
);

const SDWordmark = ({ accent, sub = true }) => (
  <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
    <span style={{ fontWeight: 650, fontSize: 14.5, letterSpacing: '-0.012em', color: '#1a1a1a' }}>
      SmartDiscovery <span style={{ color: accent, fontWeight: 700 }}>AI</span>
    </span>
    {sub && <span style={{ fontSize: 11, color: '#6d7175', marginTop: 2 }}>by Field & Form</span>}
  </div>
);

// Lighten/darken a hex color by percent (-100..100)
function shade(hex, percent) {
  const h = hex.replace('#', '');
  const num = parseInt(h.length === 3
    ? h.split('').map(c => c + c).join('')
    : h, 16);
  let r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
  const t = percent / 100;
  r = Math.round(r + (t > 0 ? (255 - r) : r) * t);
  g = Math.round(g + (t > 0 ? (255 - g) : g) * t);
  b = Math.round(b + (t > 0 ? (255 - b) : b) * t);
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Convert hex → rgba string with alpha
function rgba(hex, alpha) {
  const h = hex.replace('#', '');
  const num = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

Object.assign(window, { SDLogo, SDWordmark, shade, rgba });
