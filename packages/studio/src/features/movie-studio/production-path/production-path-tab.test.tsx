// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProductionPathResource } from '@gorenku/studio-core/client';
import { readProductionPath } from '@/services/studio-production-path-api';
import { ProductionPathTab } from './production-path-tab';

vi.mock('@/services/studio-production-path-api', () => ({
  readProductionPath: vi.fn(),
}));

describe('ProductionPathTab', () => {
  afterEach(cleanup);

  it('lists the steps in order and shows only the next step’s request', async () => {
    vi.mocked(readProductionPath).mockResolvedValue(resource());
    render(<ProductionPathTab projectName='night-ferry' projectTitle='Night Ferry' />);

    const steps = within(await screen.findByRole('list', { name: 'Production steps' })).getAllByRole('listitem');
    expect(steps.map((step) => step.querySelector('.font-semibold')?.textContent)).toEqual([
      'Screenplay',
      'Story analysis',
      'Cast, locations and props',
      'Look of the film',
      'Portraits and set images',
      'Beats and storyboards',
      'Shot plans',
      'Video clips',
    ]);
    expect(within(steps[0]!).getByText('12 scenes')).toBeTruthy();
    expect(within(steps[1]!).getByText('Next')).toBeTruthy();
    expect(within(steps[1]!).getByText('Analyze my screenplay.')).toBeTruthy();
    expect(within(steps[5]!).getByText('3 of 12')).toBeTruthy();
    expect(screen.getAllByText('Ask your agent')).toHaveLength(2);
  });

  it('expands a later step’s request on demand', async () => {
    vi.mocked(readProductionPath).mockResolvedValue(resource());
    render(<ProductionPathTab projectName='night-ferry' projectTitle='Night Ferry' />);

    const steps = within(await screen.findByRole('list', { name: 'Production steps' })).getAllByRole('listitem');
    fireEvent.click(within(steps[6]!).getByRole('button', { name: 'Show request' }));

    expect(within(steps[6]!).getByText('Plan the shots for every scene that has beats.')).toBeTruthy();
  });
});

function resource(): ProductionPathResource {
  return {
    stages: [
      { id: 'screenplay', status: 'complete', progress: { done: 12, total: 12 } },
      { id: 'screenplayAnalysis', status: 'notStarted', progress: null },
      { id: 'castAndSets', status: 'complete', progress: null },
      { id: 'visualLanguage', status: 'started', progress: null },
      { id: 'castAndSetVisuals', status: 'notStarted', progress: { done: 0, total: 8 } },
      { id: 'sceneBeats', status: 'started', progress: { done: 3, total: 12 } },
      { id: 'shotPlans', status: 'notStarted', progress: { done: 0, total: 12 } },
      { id: 'videoTakes', status: 'notStarted', progress: { done: 0, total: 0 } },
    ],
    nextStageId: 'screenplayAnalysis',
  };
}
