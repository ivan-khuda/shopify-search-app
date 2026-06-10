'use client';
import { useEffect, useState } from 'react';
import { ACCENT } from './tokens';
import { SDLogo } from './brand';
import { CTAButton } from './hero';

interface NavProps {
  accent?: string;
}

export function Nav({ accent = ACCENT }: NavProps) {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links: [string, string][] = [
    ['How it works', '#how'],
    ['Features', '#features'],
    ['Pricing', '#pricing'],
    ['FAQ', '#faq'],
  ];

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: solid ? 'rgba(255,255,255,.82)' : 'transparent',
        backdropFilter: solid ? 'blur(14px) saturate(160%)' : 'none',
        WebkitBackdropFilter: solid ? 'blur(14px) saturate(160%)' : 'none',
        borderBottom: solid ? '1px solid var(--border-sub)' : '1px solid transparent',
        transition: 'background .25s, border-color .25s',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '12px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: 22,
        }}
      >
        <a href="#top" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SDLogo size={32} accent={accent} />
          <span
            style={{
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: '-0.01em',
              color: 'var(--text-strong)',
            }}
          >
            SmartDiscovery <span style={{ color: accent }}>AI</span>
          </span>
        </a>
        <nav
          style={{ display: 'flex', gap: 4, marginLeft: 14 }}
          className="nav-links"
        >
          {links.map(([t, h]) => (
            <a
              key={t}
              href={h}
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--text)',
                padding: '7px 12px',
                borderRadius: 8,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = 'rgba(0,0,0,.04)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = 'transparent')
              }
            >
              {t}
            </a>
          ))}
        </nav>
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <a
            href="/api/auth"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text-strong)',
            }}
            className="nav-signin"
          >
            Sign in
          </a>
          <CTAButton accent={accent} kind="primary" href="/api/auth">
            Add to Shopify
          </CTAButton>
        </div>
      </div>
    </header>
  );
}
