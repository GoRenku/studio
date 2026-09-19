import path from 'node:path';
import type { MediaModelIdentity, MediaModelLibraryQuery, PersonalMediaModelMutation } from './contracts.js';
import { libraryError, parseMediaModelRoute, routeIdentity } from './document.js';
import { mutatePersonalLibrary, readPersonalLibrary, sha256, withLibraryIo } from './file-store.js';
import { readBundledRoutes, resolveMediaModels } from './resolution.js';

export async function listMediaModels(input: MediaModelLibraryQuery = {}) {
  return withLibraryIo(async () => {
    const personal = await readPersonalLibrary(input);
    const bundled = await readBundledRoutes(input.bundledRouteIndexPaths ?? []);
    const effective = resolveMediaModels(bundled, personal.entries);
    return { revision: personal.revision, libraryPath: personal.libraryPath,
      routeCatalogSha256: effective.routeCatalogSha256,
      routes: effective.routes.filter((route) => input.provider === undefined || route.provider === input.provider) };
  });
}

export async function readMediaModel(input: MediaModelLibraryQuery & MediaModelIdentity) {
  parseMediaModelRoute({ provider: input.provider, apiId: input.apiId, name: input.apiId });
  const result = await listMediaModels(input);
  return { revision: result.revision, libraryPath: result.libraryPath,
    route: result.routes.find((route) => routeIdentity(route) === routeIdentity(input)) ?? null,
    personalGuidePath: path.join(path.dirname(result.libraryPath), 'guides', `${sha256(routeIdentity(input))}.md`) };
}

export async function importPersonalMediaModel(input: PersonalMediaModelMutation & {
  route: unknown;
  providerIds: readonly string[];
}) {
  const route = parseMediaModelRoute(input.route);
  if (!input.providerIds.includes(route.provider)) {
    throw libraryError('CORE_MEDIA_MODEL_PROVIDER_UNSUPPORTED', `Provider ${route.provider} is not registered in the installed media engine.`);
  }
  return withLibraryIo(async () => {
    const report = await mutatePersonalLibrary(input, (entries) => [
      ...entries.filter((entry) => routeIdentity(entry) !== routeIdentity(route)), route,
    ]);
    return { ...report, provider: route.provider, apiId: route.apiId };
  });
}

export async function removePersonalMediaModel(input: PersonalMediaModelMutation & MediaModelIdentity) {
  parseMediaModelRoute({ provider: input.provider, apiId: input.apiId, name: input.apiId });
  return withLibraryIo(async () => {
    const report = await mutatePersonalLibrary(input, (entries) => {
      const remaining = entries.filter((entry) => routeIdentity(entry) !== routeIdentity(input));
      if (remaining.length === entries.length) {
        throw libraryError('CORE_MEDIA_MODEL_NOT_FOUND', `No personal route exists for ${input.provider}/${input.apiId}.`);
      }
      return remaining;
    });
    return { ...report, provider: input.provider, apiId: input.apiId };
  });
}
