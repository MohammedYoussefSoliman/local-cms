import { resolve } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const libs = resolve(__dirname, '../../libs');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Array form with exact-match regexes: an object alias for '@cms/ui'
    // also swallows '@cms/ui/styles.css' and resolves it to a file that does
    // not exist.
    alias: [
      { find: '@/', replacement: `${resolve(__dirname, 'src')}/` },
      {
        find: '@cms/ui/styles.css',
        replacement: `${libs}/ui/src/styles/theme.css`,
      },
      { find: /^@cms\/ui$/, replacement: `${libs}/ui/src` },
      { find: /^@cms\/domain$/, replacement: `${libs}/domain/src` },
      { find: /^@cms\/contracts$/, replacement: `${libs}/contracts/src` },
    ],
  },
  server: { port: 4051 },
});
