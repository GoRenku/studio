import {
  PROJECT_KIND,
  getStudioCorePackageInfo,
} from './index.js';

describe('studio-core scaffold', () => {
  it('exports Renku Studio document kinds', () => {
    expect(PROJECT_KIND).toBe('renku.project');
  });

  it('identifies the new Renku Studio domain package', () => {
    expect(getStudioCorePackageInfo()).toEqual({
      packageName: '@gorenku/studio-core',
      purpose: 'renku-studio-domain',
    });
  });

  it('keeps the root module free of node-only imports', async () => {
    await expect(import('./index.js')).resolves.toHaveProperty('PROJECT_KIND');
  });
});
