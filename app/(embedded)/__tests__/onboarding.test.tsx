import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppProvider } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import OnboardingPage from '../onboarding/page';

vi.mock('@shopify/polaris', async () => {
  const actual = await vi.importActual<typeof import('@shopify/polaris')>('@shopify/polaris');
  return actual;
});

global.fetch = vi.fn().mockResolvedValue({ ok: true });

describe('OnboardingPage', () => {
  it('renders welcome heading', () => {
    render(
      <AppProvider i18n={enTranslations}>
        <OnboardingPage />
      </AppProvider>
    );
    expect(screen.getByText('Welcome to SmartDiscovery AI')).toBeInTheDocument();
  });

  it('renders "How it works" card', () => {
    render(
      <AppProvider i18n={enTranslations}>
        <OnboardingPage />
      </AppProvider>
    );
    expect(screen.getByText('How it works')).toBeInTheDocument();
    expect(screen.getByText(/sync your product catalog/i)).toBeInTheDocument();
  });

  it('renders "What\'s synced" card', () => {
    render(
      <AppProvider i18n={enTranslations}>
        <OnboardingPage />
      </AppProvider>
    );
    expect(screen.getByText("What's synced")).toBeInTheDocument();
    expect(screen.getByText(/product titles/i)).toBeInTheDocument();
  });

  it('calls POST /api/shopify/sync when "Start sync" is clicked', async () => {
    render(
      <AppProvider i18n={enTranslations}>
        <OnboardingPage />
      </AppProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: /start sync/i }));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/shopify/sync', { method: 'POST' });
    });
  });
});
