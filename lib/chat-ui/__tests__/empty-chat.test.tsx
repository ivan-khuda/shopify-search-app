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
