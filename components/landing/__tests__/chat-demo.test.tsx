// components/landing/__tests__/chat-demo.test.tsx
import { render, screen, act } from '@testing-library/react';
import { ChatDemo } from '../chat-demo';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('ChatDemo', () => {
  it('renders drawer header with store name and online status', () => {
    render(<ChatDemo />);
    expect(screen.getByText('Ask Field & Form')).toBeInTheDocument();
    expect(screen.getByText(/Online · powered by AI/)).toBeInTheDocument();
  });

  it('starts idle with prompt chips, then types the first query', () => {
    render(<ChatDemo />);
    expect(screen.getByText('What are you looking for? 👋')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(900 + 42 * 37 + 550 + 50); }); // idle → typing(42ms×37ch) → searching
    expect(
      screen.getAllByText(/A low-maintenance plant for my office/).length
    ).toBeGreaterThan(0);
  });

  it('eventually shows product results for the first scenario', () => {
    render(<ChatDemo />);
    // products appear at t≈4400ms, cycle resets at t≈12200ms — 10000ms lands safely in done phase
    act(() => { vi.advanceTimersByTime(10000); });
    expect(screen.getByText('Snake Plant in Terracotta')).toBeInTheDocument();
  });
});
