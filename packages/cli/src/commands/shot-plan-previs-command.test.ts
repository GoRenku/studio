import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createProjectDataService } from '@gorenku/studio-core/server';
import { runShotPlanCommand } from './shot-plan-command.js';
import { appendStudioResourceChangedEvent } from './studio-resource-event-command.js';

vi.mock('@gorenku/studio-core/server', () => ({ createProjectDataService: vi.fn() }));
vi.mock('./studio-resource-event-command.js', () => ({ appendStudioResourceChangedEvent: vi.fn() }));

describe('Previs CLI', () => {
  it('forwards registration paths and exact plan, while show remains read-only', async () => {
    const report = { project: { projectName: 'basilica', projectFolder: '/movie' },
      shotPlanId: 'plan_one', sourceDirectory: 'scenes/03/01-shot-plan/previs/source', revisions: [], resourceKeys: ['scene:plans'] };
    const readShotPlanPrevis = vi.fn(async () => report);
    const registerShotPlanPrevis = vi.fn(async () => report);
    vi.mocked(createProjectDataService).mockReturnValue({ readShotPlanPrevis, registerShotPlanPrevis } as never);
    const output: string[] = [];
    const io = { stdout: { log: (value: string) => output.push(value) }, stderr: { error: vi.fn() } };
    const flags = { project: 'basilica', shotPlan: 'plan_one' };
    await runShotPlanCommand({ input: ['previs', 'show'], flags, json: true, io });
    expect(readShotPlanPrevis).toHaveBeenCalledWith({ projectName: 'basilica', shotPlanId: 'plan_one', homeDir: undefined });
    expect(appendStudioResourceChangedEvent).not.toHaveBeenCalled();
    expect(JSON.parse(output[0]!)).toEqual(report);
    const file = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'previs-cli-')), 'register.json');
    await fs.writeFile(file, JSON.stringify({ sourceDirectory: 'tmp/candidate', renderPath: 'tmp/previs.mp4', title: 'Approach' }));
    await runShotPlanCommand({ input: ['previs', 'register'], flags: { ...flags, file }, json: true, io });
    expect(registerShotPlanPrevis).toHaveBeenCalledWith({
      projectName: 'basilica', shotPlanId: 'plan_one', homeDir: undefined,
      sourceDirectory: 'tmp/candidate', renderPath: 'tmp/previs.mp4', title: 'Approach',
    });
    expect(appendStudioResourceChangedEvent).toHaveBeenCalledOnce();
  });
});
