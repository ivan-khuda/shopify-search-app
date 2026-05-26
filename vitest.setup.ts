import '@testing-library/jest-dom/vitest';

// Node 25 ships an experimental native `localStorage` global that lacks `setItem`/`clear`
// unless `--localstorage-file` is supplied. That native global shadows jsdom's full
// localStorage implementation. Install an in-memory polyfill on `window` so jsdom-based
// tests can round-trip storage without a CLI flag.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  writable: true,
  value: new MemoryStorage(),
});
Object.defineProperty(window, 'sessionStorage', {
  configurable: true,
  writable: true,
  value: new MemoryStorage(),
});

// Polaris requires window.matchMedia which jsdom doesn't implement
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
