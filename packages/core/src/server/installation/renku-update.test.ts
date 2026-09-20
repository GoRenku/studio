import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readRenkuInstallation } from './installation-paths.js';
import { isStudioRuntimeDescriptorUsable, readStudioRuntimeDescriptor } from '../studio-coordination/index.js';
import { updateRenku } from './renku-update.js';

vi.mock('node:child_process', () => ({ spawnSync: vi.fn() }));
vi.mock('./installation-paths.js', () => ({ readRenkuInstallation: vi.fn() }));
vi.mock('../studio-coordination/index.js', () => ({ readStudioRuntimeDescriptor: vi.fn(), isStudioRuntimeDescriptorUsable: vi.fn() }));

const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
beforeEach(() => {
  vi.resetAllMocks();
  Object.defineProperty(process, 'platform', { value: 'darwin' });
  vi.mocked(readRenkuInstallation).mockReturnValue({ productRoot: '/custom/product', installRoot: '/custom/root', binRoot: '/custom/bin', installer: '/custom/product/distribution/install.sh' });
  vi.mocked(readStudioRuntimeDescriptor).mockResolvedValue(null);
  vi.mocked(spawnSync).mockReturnValue({ status: 0 } as ReturnType<typeof spawnSync>);
});
afterEach(() => Object.defineProperty(process, 'platform', platform));

describe('Renku updates', () => {
  it('passes installed custom locations and the full-update scope to the bundled installer', async () => {
    await updateRenku('all');
    expect(spawnSync).toHaveBeenCalledWith('/bin/sh', ['/custom/product/distribution/install.sh'], expect.objectContaining({
      stdio: 'inherit', env: expect.objectContaining({ RENKU_UPDATE_SCOPE: 'all', RENKU_INSTALL_ROOT: '/custom/root', RENKU_BIN_ROOT: '/custom/bin', RENKU_INSTALLED_PRODUCT: '/custom/product' }),
    }));
  });
  it('allows skills-only updates without checking or stopping Studio', async () => {
    await updateRenku('skills');
    expect(readStudioRuntimeDescriptor).not.toHaveBeenCalled();
    expect(spawnSync).toHaveBeenCalledWith('/bin/sh', expect.any(Array), expect.objectContaining({ env: expect.objectContaining({ RENKU_UPDATE_SCOPE: 'skills' }) }));
  });
  it('blocks a full update while Studio is running', async () => {
    vi.mocked(readStudioRuntimeDescriptor).mockResolvedValue({} as NonNullable<Awaited<ReturnType<typeof readStudioRuntimeDescriptor>>>);
    vi.mocked(isStudioRuntimeDescriptorUsable).mockReturnValue(true);
    await expect(updateRenku('all')).rejects.toMatchObject({ code: 'UPDATE004' });
    expect(spawnSync).not.toHaveBeenCalled();
  });
  it('reports installer failures instead of claiming success', async () => {
    vi.mocked(spawnSync).mockReturnValue({ status: 1 } as ReturnType<typeof spawnSync>);
    await expect(updateRenku('skills')).rejects.toMatchObject({ code: 'UPDATE003' });
  });
  it('runs a Windows installer as a file without interpolating paths into shell code', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    await updateRenku('skills');
    expect(spawnSync).toHaveBeenCalledWith('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', '/custom/product/distribution/install.sh'], expect.any(Object));
  });
});
