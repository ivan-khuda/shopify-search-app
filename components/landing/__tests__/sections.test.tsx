// components/landing/__tests__/sections.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { LogoStrip, HowItWorks, Showcase, Features } from '../sections';
import { Testimonials, Pricing, FAQ, FinalCTA, Footer } from '../sections-lower';

describe('sections', () => {
  it('LogoStrip lists the trusted brands', () => {
    render(<LogoStrip />);
    expect(screen.getByText('Field & Form')).toBeInTheDocument();
    expect(screen.getByText('Loom & Field')).toBeInTheDocument();
  });
  it('HowItWorks renders 3 steps with anchor id', () => {
    const { container } = render(<HowItWorks />);
    expect(container.querySelector('#how')).toBeTruthy();
    expect(screen.getByText('Connect & sync')).toBeInTheDocument();
    expect(screen.getByText('Drop in the drawer')).toBeInTheDocument();
    expect(screen.getByText('Shoppers just ask')).toBeInTheDocument();
  });
  it('Showcase renders the example query and 3 product cards', () => {
    render(<Showcase />);
    expect(screen.getByText(/A low-maintenance plant for my office/)).toBeInTheDocument();
    expect(screen.getByText('Snake Plant in Terracotta')).toBeInTheDocument();
  });
  it('Features renders 6 feature cards with anchor id', () => {
    const { container } = render(<Features />);
    expect(container.querySelector('#features')).toBeTruthy();
    expect(screen.getByText('Bring your own model')).toBeInTheDocument();
    expect(screen.getByText('Anonymous-first')).toBeInTheDocument();
  });
  it('Testimonials renders 3 quotes with stats', () => {
    render(<Testimonials />);
    expect(screen.getByText('Maya Chen')).toBeInTheDocument();
    expect(screen.getByText('+31%')).toBeInTheDocument();
  });
  it('Pricing renders 3 tiers, Growth highlighted', () => {
    const { container } = render(<Pricing />);
    expect(container.querySelector('#pricing')).toBeTruthy();
    expect(screen.getByText('Most popular')).toBeInTheDocument();
    expect(screen.getByText('$29')).toBeInTheDocument();
  });
  it('FAQ items expand on click', () => {
    render(<FAQ />);
    const q = screen.getByRole('button', { name: /Does it edit my theme files\?/ });
    fireEvent.click(q);
    expect(screen.getByText(/Theme App Extension — an injected overlay/)).toBeInTheDocument();
  });
  it('FinalCTA and Footer render', () => {
    render(<FinalCTA />);
    expect(screen.getByText(/Give every shopper their/)).toBeInTheDocument();
    render(<Footer />);
    expect(screen.getByText(/© 2026 SmartDiscovery AI/)).toBeInTheDocument();
  });
});
