// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { usePrevis } from './use-previs';
import { readStudioShotPlanPrevis } from '@/services/shot-plan-previs/api';
import type { StudioPrevisRevision } from '@/services/shot-plan-previs/contracts';

vi.mock('@/services/shot-plan-previs/api');
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it('follows newly registered latest revisions while preserving deliberate history browsing', async () => {
  const revision = (number: number): StudioPrevisRevision => ({ id: String(number), number, createdAt: '', render: null, description: null, playback: null, clips: { project: { projectName: 'movie' }, shotPlanId: 'plan', previsRevisionId: 'revision', clips: [], assets: [], unassignedAssets: [], sources: [], resourceKeys: [] }, warnings: [] });
  let revisions = [revision(1), revision(2)];
  vi.mocked(readStudioShotPlanPrevis).mockImplementation(async () => ({ shotPlanId: 'plan', revisions, resourceKeys: [] }));
  const { result } = renderHook(() => usePrevis('movie', 'scene', 'plan'));
  await waitFor(() => expect(result.current.revision?.number).toBe(2));
  revisions = [...revisions, revision(3)];
  act(() => result.current.reload());
  await waitFor(() => expect(result.current.revision?.number).toBe(3));
  act(() => result.current.setRevisionId('1'));
  revisions = [...revisions, revision(4)];
  act(() => result.current.reload());
  await waitFor(() => expect(result.current.resource?.revisions).toHaveLength(4));
  expect(result.current.revision?.number).toBe(1);
});

it('refreshes attribution on source-scene selection and discard events without reloading unrelated scenes', async () => {
  const resourceKeys = ['surface:scene:scene:shot-plans', 'surface:scene:source-scene:shot-plans'];
  const source = { takeId: 'source-take', shotPlanId: 'source-plan', shotPlanTitle: 'Source', revisionNumber: 1, clipNumber: 1, takeNumber: 1, selectedTakeNumber: 1 as number | null };
  vi.mocked(readStudioShotPlanPrevis).mockImplementation(async () => ({
    shotPlanId: 'plan', resourceKeys, revisions: [{
      id: 'revision', number: 1, createdAt: '', render: null, description: null, playback: null, warnings: [],
      clips: { project: { projectName: 'movie' }, shotPlanId: 'plan', previsRevisionId: 'revision', clips: [], assets: [], unassignedAssets: [], sources: [{ ...source }], resourceKeys },
    }],
  }));
  const { result } = renderHook(() => usePrevis('movie', 'scene', 'plan'));
  await waitFor(() => expect(result.current.revision?.clips.sources[0]?.selectedTakeNumber).toBe(1));
  const emit = (scene: string, projectName = 'movie') => act(() => {
    window.dispatchEvent(new CustomEvent('renku:studio-resource-changed', { detail: { projectName, resourceKeys: [`surface:scene:${scene}:shot-plans`] } }));
  });
  emit('unrelated-scene');
  emit('source-scene', 'another-movie');
  expect(readStudioShotPlanPrevis).toHaveBeenCalledOnce();
  source.selectedTakeNumber = 2;
  emit('source-scene');
  await waitFor(() => expect(result.current.revision?.clips.sources[0]?.selectedTakeNumber).toBe(2));
  source.selectedTakeNumber = null;
  emit('source-scene');
  await waitFor(() => expect(result.current.revision?.clips.sources[0]?.selectedTakeNumber).toBeNull());
  expect(readStudioShotPlanPrevis).toHaveBeenCalledTimes(3);
});
