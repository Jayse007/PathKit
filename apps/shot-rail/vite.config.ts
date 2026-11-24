import { defineConfig } from 'vite';

// '../..' is the repository root, relative to apps/shot-rail (where Vite runs).
// It lets the dev server serve packages/pathkit/src from outside the app root.
export default defineConfig({
  base: '/PathKit/shot-rail/',
  server: {
    fs: {
      allow: ['../..'],
    },
  },
});
