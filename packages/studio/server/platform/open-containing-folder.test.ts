import { describe, expect, it, vi } from 'vitest';
import { openContainingFolder } from './open-containing-folder.js';

describe('server containing folder launch', () => {
  it.each([
    ['darwin', '/usr/bin/open'], ['win32', 'explorer.exe'], ['linux', 'xdg-open'],
  ])('passes one literal directory argument on %s', async (platform, command) => {
    const launch = vi.fn().mockResolvedValue(undefined);
    await openContainingFolder('/tmp/notes & $(echo nope)/résumé.txt', { platform, launch });
    expect(launch).toHaveBeenCalledWith(command, ['/tmp/notes & $(echo nope)']);
  });
  it('reports unsupported platforms and launcher failure', async () => {
    await expect(openContainingFolder('/tmp/a.txt', { platform: 'unknown' }))
      .rejects.toMatchObject({ code: 'STUDIO_FOLDER_OPEN_UNAVAILABLE' });
    await expect(openContainingFolder('/tmp/a.txt', { platform: 'linux', launch: vi.fn().mockRejectedValue(new Error('No desktop')) }))
      .rejects.toMatchObject({ code: 'STUDIO_FOLDER_OPEN_FAILED' });
  });
});
