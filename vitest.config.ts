import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const rootDir = fileURLToPath(new URL('./', import.meta.url));

export default defineConfig({
  root: rootDir,
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: [
      '**/*.{test,spec}.?(c|m)[jt]s?(x)',
      '**/*.integration-test.?(c|m)[jt]s?(x)',
    ],
  },
  resolve: {
    alias: {
      '@': rootDir,
    },
  },
});
