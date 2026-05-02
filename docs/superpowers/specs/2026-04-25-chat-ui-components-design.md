# Chat UI Components Design

## Goal

Extract the pasted product card, history UI, and saved UI into separate reusable components and integrate them into the existing chat page without replacing the current AI chat flow.

## Chosen Approach

Use the existing `app/chat/page.tsx` tabs as the top-level shell and keep `components/chat/chat.tsx` responsible for live AI chat behavior. Add presentational components for the product card, history panel, saved products panel, and empty state. Manage lightweight shared UI state at the page level.

## Scope

This implementation pass includes:

- A reusable `ProductCard` component adapted from the pasted design
- A reusable history panel component with list and empty states
- A reusable saved products panel with grid and empty states
- Integration of those components into the current `app/chat/page.tsx`
- Wiring between `app/chat/page.tsx` and `components/chat/chat.tsx` so history and saved state can be updated from chat interactions
- Demo/mock product and history data flow where real product metadata is not yet available from the current AI response pipeline

This pass does not include:

- Replacing the current `useChat()` architecture
- Building a global store
- Reworking backend/API response shapes to return real product result payloads

## Component Design

### `components/chat/product-card.tsx`

Reusable product tile used in both chat results and the saved tab.

Responsibilities:

- Render product image, title, description, and price
- Show saved/unsaved heart state
- Expose `onSave` callback
- Support optional `View` action UI

### `components/chat/empty-state.tsx`

Shared empty state block used by history and saved tabs.

Responsibilities:

- Render icon, title, and description
- Keep history and saved states visually consistent

### `components/chat/history-panel.tsx`

History tab content adapted from the pasted UI.

Responsibilities:

- Render list of history entries
- Render a clear-all action
- Render an empty state when no history exists

### `components/chat/saved-products-panel.tsx`

Saved tab content adapted from the pasted UI.

Responsibilities:

- Render saved product grid using `ProductCard`
- Render empty state when no products are saved
- Reuse the same save toggle behavior as the chat view

## State and Data Flow

`app/chat/page.tsx` owns lightweight cross-tab UI state:

- `selectedTab`
- `history`
- `savedProducts`

`components/chat/chat.tsx` continues to own live conversation state from `useChat()`, but receives props/callbacks for cross-tab integration:

- `savedProducts`
- `onToggleSave(product)`
- `onHistoryAdd(entry)`

The chat view will render product cards beneath assistant responses using the new shared `ProductCard` component instead of embedding one-off card markup.

Because the current chat pipeline does not yet expose structured product results from the assistant response, the first pass will use demo/mock product records and lightweight history entries shaped after the pasted UI. The integration will keep boundaries clean so real data can replace the mock source later without redesigning the tabs.

## Visual Adaptation

The new components should stay close to the pasted layout and interaction patterns, but adapt to the current project conventions:

- Keep the existing tab shell in `app/chat/page.tsx`
- Reuse the existing Tailwind utility style approach already used in the repo
- Match the pasted card layout, spacing, empty states, and list structure where practical
- Avoid replacing current chat input and message components

## Error Handling

For this UI-only pass, error handling is intentionally light:

- Empty history should show the empty state instead of placeholder text
- Empty saved products should show the empty state instead of placeholder text
- Missing optional product fields should degrade safely in the product card

## Testing

Use focused verification rather than broad new test coverage for this pass:

- Confirm the chat tab still renders and sends messages
- Confirm assistant result areas can render product cards
- Confirm save/unsave updates both chat cards and saved tab state
- Confirm history tab renders list items and empty state correctly
- Confirm saved tab renders grid and empty state correctly

## Implementation Notes

- Prefer extracting UI into small focused files rather than growing `app/chat/page.tsx`
- Keep `ChatMessage` intact unless a minimal prop change is needed
- Avoid unrelated refactors while integrating the new components
