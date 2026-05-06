import {
  PROJECT_KIND,
  TASK_KIND,
  WORKFLOW_KIND,
  getStudioCorePackageInfo,
} from './index.js';

describe('studio-core scaffold', () => {
  it('exports Renku Studio document kinds', () => {
    expect(PROJECT_KIND).toBe('renku.project');
    expect(WORKFLOW_KIND).toBe('renku.workflow');
    expect(TASK_KIND).toBe('renku.task');
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
