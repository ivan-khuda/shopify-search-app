import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { InfoCards } from '../onboarding/info-cards';

describe('InfoCards', () => {
  it('renders the "What gets synced" card with its items', () => {
    const { getByTestId, getByText } = render(<InfoCards />);
    expect(getByTestId('info-synced')).toBeInTheDocument();
    expect(getByText('What gets synced')).toBeInTheDocument();
    expect(getByText('Title, description, tags, vendor, product type')).toBeInTheDocument();
    expect(getByText('Variants, options, prices')).toBeInTheDocument();
    expect(getByText('Featured images')).toBeInTheDocument();
    expect(getByText('Updates from Shopify in real time via webhooks')).toBeInTheDocument();
  });

  it('renders the "What happens next" card with its items', () => {
    const { getByTestId, getByText } = render(<InfoCards />);
    expect(getByTestId('info-next')).toBeInTheDocument();
    expect(getByText('What happens next')).toBeInTheDocument();
    expect(getByText(/embed each product/i)).toBeInTheDocument();
    expect(getByText(/semantic \+ full-text search indexes/i)).toBeInTheDocument();
    expect(getByText(/email when the first sync completes/i)).toBeInTheDocument();
    expect(getByText(/App Embed block in your theme/i)).toBeInTheDocument();
  });
});
