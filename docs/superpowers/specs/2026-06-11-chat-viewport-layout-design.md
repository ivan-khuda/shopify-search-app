# Chat Page Viewport Layout — Design

**Date:** 2026-06-11
**Status:** Approved

## Problem

The embedded `/chat` page grows with its content: the messages list pushes the
page taller than the admin iframe, the whole page scrolls, and the composer
scrolls out of view. Heights are guessed with magic numbers
(`h-[calc(100vh-100px)]` in `chat-shell.tsx`, `h-[calc(100%-180px)]` on the
chat `TabsContent`) and the flex height chain is broken in several places, so
`overflow-auto` on the messages list never engages.

## Requirement

The page is exactly window height. Banner, header, and tab bar stay fixed.
Messages scroll inside the pane. The composer is always visible at the bottom.
History and Saved tabs scroll internally the same way.

## Design

Build an unbroken flex height chain from the viewport down to the messages
list. No `calc()` offsets.

1. **`app/(embedded)/chat/page.tsx`** — root: `flex h-dvh flex-col
   overflow-hidden`; banner: `shrink-0`; ChatShell area: `flex-1 min-h-0`.
2. **`app/(embedded)/chat/chat-shell.tsx`** — root: `h-full flex flex-col`
   (delete `h-[calc(100vh-100px)]`); `Tabs`: `flex-1 min-h-0`;
   `TabsContents`: `flex-1 min-h-0`; chat `TabsContent`: `h-full` (delete
   `h-[calc(100%-180px)]`); History/Saved `TabsContent`: `h-full
   overflow-y-auto`.
3. **`components/ui/tabs.tsx`** — the slide-animation `motion.div` and the
   per-slide wrapper divs inside `TabsContents` get `h-full` so height
   survives the animation layer. `chat-shell.tsx` is the only consumer of this
   primitive.
4. **`lib/chat-ui/components/chat-pane.tsx`** — root: `h-full` (delete bogus
   `stretch` class); messages list: `flex-1 min-h-0 overflow-y-auto`; composer
   wrapper: `shrink-0` (delete `size-full`, which competed for height).

## Alternatives Rejected

- **Tuned `calc()` offsets** — brittle; breaks whenever banner/header/tab bar
  height changes. That brittleness is the current bug.
- **Sticky-bottom composer with natural page scroll** — page would still grow
  beyond the window; violates the requirement.

## Testing

Class-invariant smoke tests (jsdom cannot measure real scroll): chat-shell
renders without `calc()` heights and with the flex chain classes; chat-pane
messages container has `overflow-y-auto`/`min-h-0`/`flex-1` and composer is
`shrink-0`. Visual confirmation in the embedded admin.
