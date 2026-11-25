import { defineConfig } from 'vite';

// '../..' is the repository root, relative to apps/skeleton-bench (where Vite runs).
// It lets the dev server serve packages/pathkit/src from outside the app root.
export default defineConfig({
  base: '/PathKit/skeleton-bench/',
  server: {
    fs: {
      allow: ['../..'],
    },
  },
});
