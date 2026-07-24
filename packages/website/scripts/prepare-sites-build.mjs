import { mkdir, readdir, rename, writeFile } from 'node:fs/promises';

const distDirectory = new URL('../dist/', import.meta.url);
const clientDirectory = new URL('../dist/client/', import.meta.url);

await mkdir(clientDirectory, { recursive: true });

for (const entry of await readdir(distDirectory, { withFileTypes: true })) {
  if (entry.name === 'client' || entry.name === 'server') {
    continue;
  }

  await rename(
    new URL(entry.name, distDirectory),
    new URL(entry.name, clientDirectory),
  );
}

const workerSource = `export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
`;

await mkdir(new URL('../dist/server/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../dist/server/index.js', import.meta.url),
  workerSource,
  'utf8',
);
