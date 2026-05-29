// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SCREENPLAY_ANALYSIS_CRITERIA,
  type StoryArcResource,
} from '@gorenku/studio-core/client';
import { readStoryArcResource } from '@/services/studio-screenplay-api';
import { StoryArcPanel } from './story-arc-panel';

vi.mock('@/services/studio-screenplay-api', () => ({
  readStoryArcResource: vi.fn(),
}));

describe('StoryArcPanel', () => {
  beforeEach(() => {
    vi.mocked(readStoryArcResource).mockReset();
  });

  it('renders the empty analysis state without tabs or agent controls', async () => {
    vi.mocked(readStoryArcResource).mockResolvedValue(storyArcResource(null));

    const { container } = render(<StoryArcPanel projectName='constantinople' />);

    expect(await screen.findByText('No analysis yet')).not.toBeNull();
    expect(screen.getByText(/Ask the agent to analyze this screenplay/)).not.toBeNull();
    expect(screen.getAllByText('Hook').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Inciting Incident').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/Open analysis for scene:/)).toHaveLength(3);
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByText(/Export Analysis/i)).toBeNull();
    expect(screen.queryByText(/Normalize/i)).toBeNull();
    expect(screen.queryByText(/Ask AI/i)).toBeNull();
    // The ideal (expected) cadence renders even with no analysis; the measured
    // curve does not (no scene scores), so exactly the expected path is drawn.
    expect(container.querySelectorAll('svg[role="img"] path')).toHaveLength(1);
  });

  it('renders default criteria only, beat markers, and scene critique dialog', async () => {
    vi.mocked(readStoryArcResource).mockResolvedValue(
      storyArcResource({
        kind: 'screenplayAnalysis',
        structureModel: 'threeAct',
        title: 'Story pressure pass',
        summary: 'Urban gains momentum, then faces the cost of his craft.',
        criteria: [
          ...DEFAULT_SCREENPLAY_ANALYSIS_CRITERIA,
          {
            key: 'historicalClarity',
            label: 'Historical Clarity',
            description: 'How clearly the historical context is understood.',
          },
        ],
        acts: [],
        keyBeats: [
          {
            key: 'hook',
            label: 'Hook',
            actId: 'act_one',
            sequenceId: 'seq_offer',
            sceneId: 'scene_hook',
            synopsis: 'The cannon promise appears before the bargain.',
            scoreByCriterion: {
              dramaticEnergy: 45,
              stakes: 35,
              characterAgency: 28,
            },
            critique: {
              summary: 'The hook has a vivid image but the choice is delayed.',
              evidence: [{ sceneId: 'scene_hook', text: 'Urban presents the cannon.' }],
              suggestions: ['Give Urban an immediate tactical choice.'],
            },
          },
          {
            key: 'midpoint',
            label: 'Midpoint',
            actId: 'act_two',
            sequenceId: 'seq_patron',
            sceneId: 'scene_midpoint',
            synopsis: 'The weapon becomes possible.',
            scoreByCriterion: {
              dramaticEnergy: 72,
              stakes: 64,
              characterAgency: 50,
            },
            critique: {
              summary: 'The midpoint works.',
              evidence: [{ sceneId: 'scene_midpoint', text: 'Bronze finally holds.' }],
              suggestions: ['Keep the cost visible.'],
            },
          },
        ],
        sequences: [],
        scenes: [
          analyzedScene('scene_hook', 'seq_offer', 'act_one', 'The Sound That Opens Stone', {
            dramaticEnergy: 45,
            stakes: 35,
            characterAgency: 28,
            historicalClarity: 68,
          }),
          analyzedScene('scene_offer', 'seq_offer', 'act_one', 'The Emperor Without Coin', {
            dramaticEnergy: 32,
            stakes: 44,
            characterAgency: 40,
            historicalClarity: 74,
          }),
          analyzedScene('scene_midpoint', 'seq_patron', 'act_two', 'Bronze Remembers', {
            dramaticEnergy: 72,
            stakes: 64,
            characterAgency: 50,
            historicalClarity: 80,
          }),
        ],
        suggestedSceneAdditions: [
          {
            targetActId: 'act_one',
            targetSequenceId: 'seq_offer',
            placement: { afterSceneId: 'scene_hook' },
            title: 'The First Refusal',
            purpose: 'Make Urban choose between craft and loyalty.',
            synopsis: 'Urban refuses a safer commission before pursuing the cannon.',
            rationale: 'This gives his ambition a sharper dramatic cost.',
          },
        ],
      })
    );

    const { container } = render(<StoryArcPanel projectName='constantinople' />);

    // "Dramatic Energy" appears both as the focus-measure selector and the axis
    // label, so allow more than one match.
    expect((await screen.findAllByText('Dramatic Energy')).length).toBeGreaterThan(0);
    expect(screen.getByText('Stakes')).not.toBeNull();
    expect(screen.getByText('Character Agency')).not.toBeNull();
    expect(screen.queryByText('Historical Clarity')).toBeNull();
    expect(screen.getAllByText('Midpoint').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('svg[role="img"] path').length).toBeGreaterThan(0);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open analysis for scene: The Sound That Opens Stone',
      })
    );

    expect(await screen.findByText('Evidence')).not.toBeNull();
    expect(screen.getByText('Urban presents the cannon.')).not.toBeNull();
    expect(screen.getByText('The First Refusal')).not.toBeNull();
    expect(screen.getByText('Historical Clarity')).not.toBeNull();
  });

  it('refreshes when screenplay analysis resources change', async () => {
    vi.mocked(readStoryArcResource)
      .mockResolvedValueOnce(storyArcResource(null, 'Original Title'))
      .mockResolvedValueOnce(storyArcResource(null, 'Updated Title'));

    render(<StoryArcPanel projectName='constantinople' />);

    expect(await screen.findByText('Original Title')).not.toBeNull();

    act(() => {
      window.dispatchEvent(
        new CustomEvent('renku:studio-resource-changed', {
          detail: {
            projectName: 'constantinople',
            resourceKeys: ['screenplay-analysis'],
          },
        })
      );
    });

    await waitFor(() => {
      expect(vi.mocked(readStoryArcResource)).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('Updated Title')).not.toBeNull();
  });
});

function storyArcResource(
  activeAnalysis: StoryArcResource['activeAnalysis'],
  title = 'Basilica'
): StoryArcResource {
  return {
    screenplay: {
      title,
      logline:
        'A cannon founder sells his terrible invention and must face what his craft has done.',
      dramaticQuestion: 'Can Urban remain only a maker?',
      premiseOverview: 'A siege story about invention and responsibility.',
      centralConflict: 'Pride collides with consequence.',
      summary: 'Urban follows the greatest commission of his life.',
    },
    acts: [
      {
        id: 'act_one',
        title: 'The Offer',
        purpose: 'Open with the bargain.',
        sequenceCount: 1,
        sceneCount: 2,
        sequences: [
          {
            id: 'seq_offer',
            actId: 'act_one',
            number: 1,
            title: 'The Sound That Opens Stone',
            purpose: 'Begin with the siege consequence.',
            sceneCount: 2,
            scenes: [
              {
                id: 'scene_hook',
                sequenceId: 'seq_offer',
                title: 'The Sound That Opens Stone',
                setting: { locationIds: [] },
                storyFunction: ['Urban reveals the cannon and offers it to Byzantium.'],
              },
              {
                id: 'scene_offer',
                sequenceId: 'seq_offer',
                title: 'The Emperor Without Coin',
                setting: { locationIds: [] },
                storyFunction: ['The emperor cannot pay what Urban asks.'],
              },
            ],
          },
        ],
      },
      {
        id: 'act_two',
        title: 'The Patron',
        sequenceCount: 1,
        sceneCount: 1,
        sequences: [
          {
            id: 'seq_patron',
            actId: 'act_two',
            number: 2,
            title: 'Bronze Remembers',
            sceneCount: 1,
            scenes: [
              {
                id: 'scene_midpoint',
                sequenceId: 'seq_patron',
                title: 'Bronze Remembers',
                setting: { locationIds: [] },
                storyFunction: ['The cannon finally holds together.'],
              },
            ],
          },
        ],
      },
    ],
    activeAnalysis,
  };
}

function analyzedScene(
  sceneId: string,
  sequenceId: string,
  actId: string,
  title: string,
  scoreByCriterion: Record<string, number>
) {
  return {
    sceneId,
    sequenceId,
    actId,
    title,
    synopsis: `${title} synopsis.`,
    beatRole: sceneId === 'scene_hook' ? 'hook' as const : undefined,
    scoreByCriterion,
    critique: {
      summary: `${title} critique.`,
      strengths: ['The scene has a clear image.'],
      concerns: ['Opening interest drops before Urban makes an active choice.'],
      evidence: [{ sceneId, text: 'Urban presents the cannon.' }],
      suggestions: ['Give Urban a sharper choice.'],
    },
  };
}
