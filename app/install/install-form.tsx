'use client';
import { useState, type SubmitEvent } from 'react';
import { ACCENT, rgba } from '@/components/landing/tokens';
import { normalizeShopDomain } from '@/lib/shopify/normalize-shop-domain';

export function InstallForm({ accent = ACCENT }: { accent?: string }) {
  const [shopUrl, setShopUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState(false);

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();

    const shop = normalizeShopDomain(shopUrl);
    if (!shop) {
      setError('Enter a valid Shopify store URL, e.g. your-store.myshopify.com');
      return;
    }

    setError(null);
    setSubmitting(true);
    // Full-page navigation: OAuth begin responds with a redirect to Shopify
    window.location.href = `/api/auth?shop=${encodeURIComponent(shop)}`;
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label
        htmlFor="shop-url"
        style={{
          display: 'block',
          fontSize: 13.5,
          fontWeight: 600,
          color: 'var(--text-strong)',
          marginBottom: 8,
        }}
      >
        Store URL
      </label>
      <input
        id="shop-url"
        name="shop"
        type="text"
        autoComplete="off"
        autoFocus
        placeholder="your-store.myshopify.com"
        value={shopUrl}
        onChange={(e) => {
          setShopUrl(e.target.value);
          if (error) setError(null);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'shop-url-error' : undefined}
        disabled={submitting}
        style={{
          width: '100%',
          fontSize: 15,
          fontFamily: 'inherit',
          color: 'var(--text-strong)',
          background: '#fff',
          padding: '13px 14px',
          borderRadius: 11,
          border: `1px solid ${
            error ? '#d72c0d' : focused ? accent : 'var(--border)'
          }`,
          boxShadow: focused ? `0 0 0 3px ${rgba(accent, 0.18)}` : 'none',
          outline: 'none',
          transition: 'border-color .15s, box-shadow .15s',
          opacity: submitting ? 0.6 : 1,
        }}
      />
      {error && (
        <p
          id="shop-url-error"
          style={{ fontSize: 13, color: '#d72c0d', margin: '8px 0 0' }}
        >
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 9,
          width: '100%',
          marginTop: 14,
          fontWeight: 600,
          fontSize: 15,
          padding: '13px 22px',
          borderRadius: 11,
          border: '1px solid transparent',
          background: accent,
          color: '#fff',
          boxShadow: `0 1px 0 rgba(255,255,255,.25) inset, 0 8px 22px -8px ${rgba(accent, 0.7)}`,
          transition: 'transform .12s, box-shadow .2s, opacity .2s',
          cursor: submitting ? 'default' : 'pointer',
          opacity: submitting ? 0.7 : 1,
        }}
        onMouseEnter={(e) => {
          if (!submitting) e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        {submitting ? 'Redirecting to Shopify…' : 'Install app'}
      </button>
    </form>
  );
}
