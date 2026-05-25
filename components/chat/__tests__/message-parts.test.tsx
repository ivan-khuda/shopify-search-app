// Phase 4 RED scaffold for D-06 / ADM-06. Implementation target: components/chat/message-parts.tsx (extended in plan 04-05).
// Until 04-05 lands, the tool-searchCatalog switch branch does not exist; these tests fail by finding no matching elements in the DOM.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MessageParts } from '@/components/chat/message-parts';
import type { ChatProduct } from '@/types/product';
import type { UIMessage } from 'ai';

const sampleProducts: ChatProduct[] = [
  {
    id: '1',
    title: 'Test Sneakers',
    price: '$89.00 – $129.00',
    description: 'A test product.',
  },
];

function renderParts(parts: unknown[], onToggleSave: ReturnType<typeof vi.fn> = vi.fn()) {
  return render(
    <MessageParts
      parts={parts as UIMessage['parts']}
      messageId="m1"
      savedProductIds={new Set<string>()}
      onToggleSave={onToggleSave}
    />,
  );
}

describe('MessageParts — tool-searchCatalog', () => {
  it("renders 'Searching your catalog…' inline pill when part.state === 'input-streaming'", () => {
    renderParts([
      {
        type: 'tool-searchCatalog',
        state: 'input-streaming',
        input: { query: 'shoes' },
        toolCallId: 't1',
      },
    ]);
    const status = screen.getByRole('status');
    expect(status.textContent ?? '').toMatch(/Searching your catalog/i);
  });

  it("renders 'Searching your catalog…' inline pill when part.state === 'input-available'", () => {
    renderParts([
      {
        type: 'tool-searchCatalog',
        state: 'input-available',
        input: { query: 'shoes' },
        toolCallId: 't1',
      },
    ]);
    const status = screen.getByRole('status');
    expect(status.textContent ?? '').toMatch(/Searching your catalog/i);
  });

  // Locks the grid's aria-label="1 matching products" contract (UI-SPEC.md a11y).
  it("renders ProductCard <ul role=\"list\"> when state === 'output-available' with products[].length > 0", () => {
    renderParts([
      {
        type: 'tool-searchCatalog',
        state: 'output-available',
        output: sampleProducts,
        input: { query: 'shoes' },
        toolCallId: 't1',
      },
    ]);
    const list = screen.getByRole('list');
    expect(list).toBeDefined();
    expect(list.getAttribute('aria-label')).toBe('1 matching products');
    expect(screen.getByText('Test Sneakers')).toBeDefined();
  });

  it("renders zero-results affordance when state === 'output-available' with empty output", () => {
    renderParts([
      {
        type: 'tool-searchCatalog',
        state: 'output-available',
        output: [],
        input: { query: 'unobtainium' },
        toolCallId: 't1',
      },
    ]);
    expect(screen.getByText(/No matching products/i)).toBeDefined();
    expect(
      screen.getByText(/broader description|remove the price filter/i),
    ).toBeDefined();
  });

  it("renders quiet error affordance when state === 'output-error'", () => {
    renderParts([
      {
        type: 'tool-searchCatalog',
        state: 'output-error',
        errorText: 'boom',
        input: { query: 'shoes' },
        toolCallId: 't1',
      },
    ]);
    expect(screen.getByText(/Couldn(?:'|&apos;)t fetch results/i)).toBeDefined();
    expect(screen.getByText(/try that search again/i)).toBeDefined();
  });

  it('the ProductCard grid <ul> uses role="list" and aria-live="polite" (a11y from UI-SPEC.md)', () => {
    renderParts([
      {
        type: 'tool-searchCatalog',
        state: 'output-available',
        output: sampleProducts,
        input: { query: 'shoes' },
        toolCallId: 't1',
      },
    ]);
    const list = screen.getByRole('list');
    expect(list.getAttribute('aria-live')).toBe('polite');
  });

  it('the tool-running pill uses role="status" (a11y from UI-SPEC.md)', () => {
    renderParts([
      {
        type: 'tool-searchCatalog',
        state: 'input-streaming',
        input: { query: 'shoes' },
        toolCallId: 't1',
      },
    ]);
    const status = screen.getByRole('status');
    expect(status).toBeDefined();
  });

  it('clicking the heart on a product card invokes onToggleSave with the product', () => {
    const onToggleSave = vi.fn();
    renderParts(
      [
        {
          type: 'tool-searchCatalog',
          state: 'output-available',
          output: sampleProducts,
          input: { query: 'shoes' },
          toolCallId: 't1',
        },
      ],
      onToggleSave,
    );
    fireEvent.click(screen.getByRole('button', { name: /save product/i }));
    expect(onToggleSave).toHaveBeenCalledWith(sampleProducts[0]);
  });

  it('does not render anything for tool-searchCatalog parts with unknown state', () => {
    renderParts([
      {
        type: 'tool-searchCatalog',
        state: 'approval-requested',
        input: { query: 'shoes' },
        toolCallId: 't1',
      },
    ]);
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText(/No matching products/i)).toBeNull();
    expect(screen.queryByText(/Couldn(?:'|&apos;)t fetch results/i)).toBeNull();
  });

  it('still renders text parts unchanged (regression check)', () => {
    renderParts([{ type: 'text', text: 'hello world' }]);
    expect(screen.getByText('hello world')).toBeDefined();
  });
});
