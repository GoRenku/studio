import { openBetterSqliteStudioStorage } from './index.js';

describe('better-sqlite studio storage', () => {
  it('exposes an async storage boundary over the synchronous sqlite driver', async () => {
    let storage: Awaited<ReturnType<typeof openBetterSqliteStudioStorage>>;

    try {
      storage = await openBetterSqliteStudioStorage({ path: ':memory:' });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Could not locate the bindings file')
      ) {
        console.warn('Skipping better-sqlite3 runtime assertion because native bindings are not built.');
        return;
      }

      throw error;
    }

    try {
      const created = await storage.upsertProject({
        id: 'project-1',
        name: 'Campaign Film',
      });

      expect(created).toMatchObject({
        id: 'project-1',
        kind: 'renku.movie',
        name: 'Campaign Film',
      });

      const updated = await storage.upsertProject({
        id: 'project-1',
        name: 'Campaign Film Revised',
      });

      expect(updated.createdAt).toBe(created.createdAt);
      expect(updated.updatedAt >= created.updatedAt).toBe(true);
      await expect(storage.getProject('project-1')).resolves.toMatchObject({
        id: 'project-1',
        name: 'Campaign Film Revised',
      });
      await expect(storage.listProjects()).resolves.toHaveLength(1);
    } finally {
      await storage.close();
    }
  });
});
