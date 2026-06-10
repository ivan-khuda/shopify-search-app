// components/landing/__tests__/hero-nav.test.tsx
import { render, screen } from '@testing-library/react';
import { HeroConversation } from '../hero';
import { Nav } from '../nav';

describe('HeroConversation', () => {
  it('renders headline, subhead, CTAs and trust line', () => {
    render(<HeroConversation />);
    expect(screen.getByText('Your shoppers describe it.')).toBeInTheDocument();
    expect(screen.getByText('Your store finds it.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Add to Shopify — free/ })).toHaveAttribute('href', '/api/auth');
    expect(screen.getByText('Installs in minutes')).toBeInTheDocument();
    expect(screen.getByText('No theme edits')).toBeInTheDocument();
  });
  it('mounts the chat demo', () => {
    render(<HeroConversation />);
    expect(screen.getByText('Ask Field & Form')).toBeInTheDocument();
  });
});

describe('Nav', () => {
  it('renders brand, anchor links and install CTA', () => {
    render(<Nav />);
    expect(screen.getByText(/SmartDiscovery/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'How it works' })).toHaveAttribute('href', '#how');
    expect(screen.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '#pricing');
    expect(screen.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '#faq');
  });
});
