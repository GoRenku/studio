export const PROJECT_KIND = 'renku.project' as const;

export type ProjectKind = typeof PROJECT_KIND;

export interface StudioCorePackageInfo {
  packageName: '@gorenku/studio-core';
  purpose: 'renku-studio-domain';
}

export function getStudioCorePackageInfo(): StudioCorePackageInfo {
  return {
    packageName: '@gorenku/studio-core',
    purpose: 'renku-studio-domain',
  };
}
