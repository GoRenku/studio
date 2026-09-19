import fs from 'node:fs/promises';
import type { MediaModelDiscoveryRoute, MediaModelRoute } from './contracts.js';
import { asObject, assertUniqueRoutes, libraryError, parseLibraryJson, parseMediaModelRoute, routeIdentity } from './document.js';
import { readLibraryFile, sha256 } from './file-store.js';

export async function readBundledRoutes(paths: readonly string[]): Promise<MediaModelRoute[]> {
  const routes: MediaModelRoute[] = [];
  for (const filePath of paths) {
    // Read-only Skill indexes may live beneath symlinked installation directories.
    const bytes = await readLibraryFile(await fs.realpath(filePath));
    if (bytes === null) {
      throw libraryError('CORE_MEDIA_MODEL_LIBRARY_IO_FAILED', `Bundled route index does not exist: ${filePath}.`);
    }
    const index = asObject(parseLibraryJson(bytes.toString('utf8')));
    if (!index || !Array.isArray(index.routes)) {
      throw libraryError('CORE_MEDIA_MODEL_LIBRARY_INVALID', `Invalid bundled route index: ${filePath}.`);
    }
    for (const value of index.routes) {
      const route = asObject(value);
      routes.push(parseMediaModelRoute({ provider: index.provider, apiId: route?.apiId, name: route?.name }));
    }
  }
  assertUniqueRoutes(routes);
  return routes;
}

export function resolveMediaModels(bundled: MediaModelRoute[], personal: MediaModelRoute[]) {
  const merged = new Map<string, MediaModelDiscoveryRoute>();
  for (const route of bundled) {
    merged.set(routeIdentity(route), { ...route, source: 'bundled', hasBundledEntry: true });
  }
  for (const route of personal) {
    const key = routeIdentity(route);
    merged.set(key, { ...route, source: 'personal', hasBundledEntry: merged.has(key) });
  }
  const routes = [...merged.values()].sort((a, b) =>
    compare(a.provider, b.provider) || compare(a.apiId, b.apiId));
  const routeCatalogSha256 = sha256(JSON.stringify(routes.map(({ provider, apiId, name }) =>
    ({ provider, apiId, name }))));
  return { routes, routeCatalogSha256 };
}

function compare(a: string, b: string): number {
  return a < b ? -1 : Number(a > b);
}
