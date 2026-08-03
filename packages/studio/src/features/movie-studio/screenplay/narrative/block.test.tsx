// @vitest-environment jsdom
import React from 'react';
import type { ScreenplayBlock } from '@gorenku/studio-core/client';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SceneDialogueAudioWorkspaceWithUrls } from '@/services/screenplay';
import { NarrativeBlock } from './block';

describe('NarrativeBlock', () => {
  it('renders the complete block union and keeps Dual Dialogue audio actions independent', () => {
    const onOpenAudio = vi.fn<(turnId: string) => void>();
    const blocks: ScreenplayBlock[] = [
      ...(['action', 'transition', 'shot', 'lyrics', 'castList', 'note',
        'specialHeading', 'titleCard', 'super'] as const).map((type) => ({
        id: `block_${type}`,
        type,
        text: `Text for ${type}`,
      })),
      {
        id: 'turn_single',
        type: 'dialogue',
        characterName: 'SARA',
        extensions: ['V.O.'],
        parts: [
          { id: 'part_direction', type: 'parenthetical', text: 'quietly' },
          { id: 'part_speech', type: 'speech', text: 'Hold the line.' },
        ],
      },
      {
        id: 'block_dual',
        type: 'dualDialogue',
        left: {
          id: 'turn_left',
          characterName: 'ANA',
          extensions: [],
          parts: [{ id: 'part_left', type: 'speech', text: 'Now.' }],
        },
        right: {
          id: 'turn_right',
          characterName: 'MARA',
          extensions: [],
          parts: [{ id: 'part_right', type: 'speech', text: 'Wait.' }],
        },
      },
    ];

    render(
      <div>
        {blocks.map((block) => (
          <NarrativeBlock
            key={block.id}
            projectName='basilica'
            block={block}
            references={[]}
            audio={emptyAudioWorkspace()}
            selectedTurnId={null}
            textPreviews={{}}
            onOpenAudio={onOpenAudio}
            onSelect={() => undefined}
          />
        ))}
      </div>
    );

    for (const type of ['action', 'transition', 'shot', 'lyrics', 'castList',
      'note', 'specialHeading', 'titleCard', 'super']) {
      expect(screen.getByText(`Text for ${type}`)).not.toBeNull();
    }
    expect(screen.getByText('quietly').parentElement?.textContent).toBe('(quietly)');
    expect(screen.getByRole('region', { name: 'Dual Dialogue' })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'ANA' }));
    fireEvent.click(screen.getByRole('button', { name: 'MARA' }));
    expect(onOpenAudio.mock.calls).toEqual([['turn_left'], ['turn_right']]);
  });
});

function emptyAudioWorkspace(): SceneDialogueAudioWorkspaceWithUrls {
  return {
    purpose: 'scene.dialogue-audio',
    target: { kind: 'scene', sceneId: 'scene_one' },
    project: { projectName: 'basilica', title: 'Basilica', baseLanguageCode: 'en' },
    scene: { id: 'scene_one', heading: 'INT. ROOM - DAY' },
    dialogues: [],
    castMemberLabels: {},
    castVoicesByCastMemberId: {},
    audioByTurnId: {},
    models: [],
    defaults: {
      modelChoice: 'elevenlabs/eleven_v3',
      outputFormat: 'mp3_44100_128',
      languageCode: 'en',
      voiceSettings: {},
    },
    resourceKeys: [],
  };
}
