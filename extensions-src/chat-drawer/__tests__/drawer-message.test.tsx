/**
 * DrawerMessage — compact message renderer (drawer-redesign Task 6).
 *
 * Pixel reference: /tmp/design-handoff3 storefront.jsx DrawerMessage (618–676).
 * Consumes UIMessage parts directly with the same tool-searchCatalog
 * discriminator narrowing documented in lib/chat-ui/components/message-parts.tsx.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { UIMessage } from 'ai';

import { DrawerMessage } from '@/extensions-src/chat-drawer/components/DrawerMessage';

const noSaved = new Set<string>();

function message(role: 'user' | 'assistant', parts: unknown[]): UIMessage {
  return { id: `${role}-1`, role, parts } as UIMessage;
}

describe('DrawerMessage — user', () => {
  it('renders the accent bubble right-aligned', () => {
    render(
      <DrawerMessage
        message={message('user', [{ type: 'text', text: 'red mug' }])}
        savedProductIds={noSaved}
        onToggleSave={vi.fn()}
      />,
    );

    const bubble = screen.getByText('red mug');
    expect(bubble.className).toContain('bg-[var(--sd-accent,#5B4FE9)]');
    expect(bubble.parentElement?.className).toContain('justify-end');
  });
});

describe('DrawerMessage — assistant tool states', () => {
  it('shows the searching spinner pill for input-streaming/input-available', () => {
    render(
      <DrawerMessage
        message={message('assistant', [
          { type: 'tool-searchCatalog', state: 'input-available', input: {}, toolCallId: 't1' },
        ])}
        savedProductIds={noSaved}
        onToggleSave={vi.fn()}
      />,
    );

    const pill = screen.getByRole('status');
    expect(pill).toHaveTextContent('Searching…');
    expect(pill.querySelector('[class*="sd-spin"]')).not.toBeNull();
  });

  it('renders product rows from tool output and threads save state', () => {
    const onToggleSave = vi.fn();
    render(
      <DrawerMessage
        message={message('assistant', [
          {
            type: 'tool-searchCatalog',
            state: 'output-available',
            toolCallId: 't1',
            input: {},
            output: [
              { id: 'p-1', title: 'Mug', price: '$24.00', description: '', handle: 'mug' },
              { id: 'p-2', title: 'Vase', price: '$48.00', description: '' },
            ],
          },
        ])}
        savedProductIds={new Set(['p-2'])}
        onToggleSave={onToggleSave}
      />,
    );

    expect(screen.getByText('Mug')).toBeInTheDocument();
    expect(screen.getByText('Vase')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Mug' })).toHaveAttribute('href', '/products/mug');
    // p-2 is saved → its heart offers removal.
    expect(screen.getByRole('button', { name: 'Remove saved product' })).toBeInTheDocument();
  });

  it('shows the no-results note for empty tool output', () => {
    render(
      <DrawerMessage
        message={message('assistant', [
          { type: 'tool-searchCatalog', state: 'output-available', toolCallId: 't1', input: {}, output: [] },
        ])}
        savedProductIds={noSaved}
        onToggleSave={vi.fn()}
      />,
    );

    expect(screen.getByText(/No matching products/)).toBeInTheDocument();
  });

  it('shows an error note for output-error', () => {
    render(
      <DrawerMessage
        message={message('assistant', [
          { type: 'tool-searchCatalog', state: 'output-error', toolCallId: 't1', input: {}, errorText: 'boom' },
        ])}
        savedProductIds={noSaved}
        onToggleSave={vi.fn()}
      />,
    );

    expect(screen.getByText(/Couldn.t fetch results/)).toBeInTheDocument();
  });
});

describe('DrawerMessage — assistant text', () => {
  it('renders text in the white bubble without a cursor when not streaming', () => {
    render(
      <DrawerMessage
        message={message('assistant', [{ type: 'text', text: 'Here are two picks.' }])}
        savedProductIds={noSaved}
        onToggleSave={vi.fn()}
      />,
    );

    const bubble = screen.getByText('Here are two picks.');
    expect(bubble.querySelector('[class*="sd-blink"]')).toBeNull();
  });

  it('appends the blink cursor to the last text part while streaming', () => {
    render(
      <DrawerMessage
        message={message('assistant', [{ type: 'text', text: 'Here are two' }])}
        savedProductIds={noSaved}
        onToggleSave={vi.fn()}
        isStreaming
      />,
    );

    const bubble = screen.getByText('Here are two');
    expect(bubble.querySelector('[class*="sd-blink"]')).not.toBeNull();
  });
});
