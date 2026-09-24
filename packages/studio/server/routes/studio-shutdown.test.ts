import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStudioShutdownRoute } from './studio-shutdown.js';

describe('Studio shutdown route', () => {
  afterEach(() => vi.useRealTimers());

  it('requires the private CLI token before requesting shutdown', async () => {
    vi.useFakeTimers();
    const requestShutdown = vi.fn();
    const route = createStudioShutdownRoute({
      cliNotificationToken: 'studio-token',
      requestShutdown,
    });

    const rejected = await route.request('/', { method: 'POST' });
    expect(rejected.status).toBe(403);
    await vi.runAllTimersAsync();
    expect(requestShutdown).not.toHaveBeenCalled();

    const accepted = await route.request('/', {
      method: 'POST',
      headers: { 'X-Renku-Studio-Notification-Token': 'studio-token' },
    });
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toEqual({ stopping: true });
    await vi.runAllTimersAsync();
    expect(requestShutdown).toHaveBeenCalledOnce();
  });
});
