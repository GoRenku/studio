import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../database/lifecycle/active-session.js', () => ({
  openProjectSession: vi.fn(),
}));

vi.mock('../../database/lifecycle/current-project.js', () => ({
  withCurrentProjectSession: vi.fn(),
}));

import { openProjectSession } from '../../database/lifecycle/active-session.js';
import { withCurrentProjectSession } from '../../database/lifecycle/current-project.js';
import {
  withMediaGenerationEstimationProjectSession,
  withMediaGenerationProjectSession,
} from './project-session.js';

const mockedOpenProjectSession = vi.mocked(openProjectSession);
const mockedWithCurrentProjectSession = vi.mocked(withCurrentProjectSession);

describe('media generation lifecycle project session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens a named project session and always closes it', async () => {
    const close = vi.fn();
    mockedOpenProjectSession.mockResolvedValueOnce({
      projectFolder: '/projects/movie',
      session: { close },
    } as never);

    await expect(
      withMediaGenerationProjectSession(
        { projectName: 'movie', homeDir: '/home' },
        ({ projectFolder, session }) => {
          expect(projectFolder).toBe('/projects/movie');
          expect(session).toEqual({ close });
          return 'ok';
        }
      )
    ).resolves.toBe('ok');

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('closes named project sessions when callbacks throw', async () => {
    const close = vi.fn();
    mockedOpenProjectSession.mockResolvedValueOnce({
      projectFolder: '/projects/movie',
      session: { close },
    } as never);

    await expect(
      withMediaGenerationProjectSession(
        { projectName: 'movie', homeDir: '/home' },
        () => {
          throw new Error('boom');
        }
      )
    ).rejects.toThrow('boom');

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('uses the current project session when no project name is supplied', async () => {
    mockedWithCurrentProjectSession.mockImplementationOnce(async (_input, fn) =>
      fn({
        currentProject: { projectFolder: '/projects/current' },
        session: { kind: 'current-session' },
      } as never)
    );

    await expect(
      withMediaGenerationProjectSession({ homeDir: '/home' }, ({ projectFolder }) =>
        projectFolder
      )
    ).resolves.toBe('/projects/current');
  });

  it('narrows estimation sessions to the database session handle', async () => {
    mockedWithCurrentProjectSession.mockImplementationOnce(async (_input, fn) =>
      fn({
        currentProject: { projectFolder: '/projects/current' },
        session: { kind: 'estimation-session' },
      } as never)
    );

    await expect(
      withMediaGenerationEstimationProjectSession({ homeDir: '/home' }, ({ session }) =>
        session
      )
    ).resolves.toEqual({ kind: 'estimation-session' });
  });
});
