import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const root = path.dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string };
const codexAppEntries = ['generation-review', 'eleven-v4-dialogue-direction', 'seed-audio-dialogue-direction'];

export default defineConfig(({ mode }) => {
  if (!codexAppEntries.includes(mode)) {
    throw new Error(`Unknown Codex app entry "${mode}". Build with --mode set to one of: ${codexAppEntries.join(', ')}.`);
  }
  return {
    plugins: [react(), tailwindcss(), viteSingleFile()],
    publicDir: false,
    define: { 'import.meta.env.RENKU_RUNTIME_VERSION': JSON.stringify(version) },
    resolve: { alias: { '@': path.join(root, 'src') } },
    build: {
      outDir: 'codex-apps-dist',
      emptyOutDir: false,
      rollupOptions: {
        input: path.join(root, 'codex-apps', `${mode}.html`),
      },
    },
  };
});
