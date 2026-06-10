// app/__tests__/page.test.tsx
import { render, screen } from '@testing-library/react';
import Home from '../page';

vi.mock('next/font/google', () => ({
  Inter: () => ({ variable: '--font-inter' }),
  DM_Serif_Display: () => ({ variable: '--font-dm-serif' }),
}));

describe('landing page', () => {
  it('assembles all sections in order', () => {
    const { container } = render(<Home />);
    expect(screen.getByText('Your shoppers describe it.')).toBeInTheDocument();
    expect(container.querySelector('#how')).toBeTruthy();
    expect(container.querySelector('#features')).toBeTruthy();
    expect(container.querySelector('#pricing')).toBeTruthy();
    expect(container.querySelector('#faq')).toBeTruthy();
    expect(screen.getByText(/© 2026 SmartDiscovery AI/)).toBeInTheDocument();
  });
  it('wraps content in .sd-landing scope', () => {
    const { container } = render(<Home />);
    expect(container.querySelector('.sd-landing')).toBeTruthy();
  });
});
