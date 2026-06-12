import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmptyChat, SUGGESTED_PROMPTS } from '../components/empty-chat';

describe('EmptyChat', () => {
  it('cards variant shows greeting, prompts, and tip', () => {
    render(<EmptyChat variant="cards" onPick={vi.fn()} catalogCount={151} />);
    expect(screen.getByText(/hi there/i)).toBeInTheDocument();
    expect(screen.getByText(/151 products/)).toBeInTheDocument();
    expect(screen.getByText(/RRF/)).toBeInTheDocument();
  });

  it('minimal variant shows the centered heading', () => {
    render(<EmptyChat variant="minimal" onPick={vi.fn()} />);
    expect(screen.getByText(/ask anything about your catalog/i)).toBeInTheDocument();
  });

  it('hero variant shows the banner headline', () => {
    render(<EmptyChat variant="hero" onPick={vi.fn()} modelName="Gemini 2.5 Flash" />);
    expect(screen.getByText(/what are your customers/i)).toBeInTheDocument();
    expect(screen.getByText(/gemini 2.5 flash/i)).toBeInTheDocument();
  });

  it('clicking a prompt fires onPick with its text', () => {
    const onPick = vi.fn();
    render(<EmptyChat variant="cards" onPick={onPick} />);
    fireEvent.click(screen.getByText(SUGGESTED_PROMPTS[0].text));
    expect(onPick).toHaveBeenCalledWith(SUGGESTED_PROMPTS[0].text);
  });
});

describe('EmptyChat — merchant greeting and prompts (settings-redesign Task 6)', () => {
  const CUSTOM_PROMPTS = [
    { icon: '🧦', text: 'Wool socks for winter' },
    { icon: '🎄', text: 'Holiday table decor' },
  ];

  it('greeting overrides the cards headline', () => {
    render(<EmptyChat variant="cards" onPick={vi.fn()} greeting="Welcome to Acme!" />);
    expect(screen.getByText('Welcome to Acme!')).toBeInTheDocument();
    expect(screen.queryByText(/hi there/i)).not.toBeInTheDocument();
  });

  it('greeting overrides the minimal heading', () => {
    render(<EmptyChat variant="minimal" onPick={vi.fn()} greeting="Welcome to Acme!" />);
    expect(screen.getByText('Welcome to Acme!')).toBeInTheDocument();
    expect(screen.queryByText(/ask anything about your catalog/i)).not.toBeInTheDocument();
  });

  it('null greeting falls back to the built-in copy', () => {
    render(<EmptyChat variant="cards" onPick={vi.fn()} greeting={null} />);
    expect(screen.getByText(/hi there/i)).toBeInTheDocument();
  });

  it('non-empty prompts replace the built-ins', () => {
    render(<EmptyChat variant="cards" onPick={vi.fn()} prompts={CUSTOM_PROMPTS} />);
    expect(screen.getByText(CUSTOM_PROMPTS[0].text)).toBeInTheDocument();
    expect(screen.getByText(CUSTOM_PROMPTS[1].text)).toBeInTheDocument();
    expect(screen.queryByText(SUGGESTED_PROMPTS[0].text)).not.toBeInTheDocument();
  });

  it('clicking a custom prompt fires onPick with its text', () => {
    const onPick = vi.fn();
    render(<EmptyChat variant="minimal" onPick={onPick} prompts={CUSTOM_PROMPTS} />);
    fireEvent.click(screen.getByText(CUSTOM_PROMPTS[1].text));
    expect(onPick).toHaveBeenCalledWith(CUSTOM_PROMPTS[1].text);
  });

  it('empty prompts array falls back to the built-ins', () => {
    render(<EmptyChat variant="hero" onPick={vi.fn()} prompts={[]} />);
    expect(screen.getByText(SUGGESTED_PROMPTS[0].text)).toBeInTheDocument();
  });

  it('null prompts fall back to the built-ins', () => {
    render(<EmptyChat variant="cards" onPick={vi.fn()} prompts={null} />);
    expect(screen.getByText(SUGGESTED_PROMPTS[0].text)).toBeInTheDocument();
  });
});
