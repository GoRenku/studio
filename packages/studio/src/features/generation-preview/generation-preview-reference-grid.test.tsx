// @vitest-environment jsdom
import React from 'react';
import type { GenerationPreviewResource } from '@gorenku/studio-core/client';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GenerationRequestReferenceGrid } from '@/features/generation-request-editor/generation-request-reference-grid';

describe('GenerationPreviewReferenceGrid', () => {
  it('shows only exact selected references when reference editing is disabled', () => {
    render(
      <GenerationRequestReferenceGrid
        preview={previewFixture()}
        draft={{
          promptDraft: { authoredText: 'Edit the source image.' },
          modelFamilyId: 'gpt-image-2',
          parameterValues: {},
          authoredParameterNames: [],
          slotSelections: [],
        }}
        updating={false}
        editable={false}
      />,
    );

    expect(screen.getByText('Source Image')).toBeTruthy();
    expect(screen.getByAltText('Mara Character Sheet')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Mara Character Sheet' }),
    ).toBeNull();
    expect(screen.queryByText('Character Sheet')).toBeNull();
    expect(screen.queryByText('Additional Media')).toBeNull();
  });

  it('shows and toggles typed candidates directly without a made-up picker button', () => {
    const preview = previewFixture();
    const slot = preview.references.slots[1]!;
    const onReferenceChoose = vi.fn();
    render(
      <GenerationRequestReferenceGrid
        preview={preview}
        draft={{
          promptDraft: { authoredText: 'Create a character sheet.' },
          modelFamilyId: 'gpt-image-2',
          parameterValues: {},
          authoredParameterNames: [],
          slotSelections: [],
        }}
        updating={false}
        editable
        onReferenceChoose={onReferenceChoose}
      />
    );

    expect(screen.queryByText('None')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Choose Constantine XI' })
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Exclude Mara Character Sheet' })
    ).toBeNull();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Include Constantine Character Sheet',
      })
    );
    expect(onReferenceChoose).toHaveBeenCalledWith(
      slot,
      slot.eligibleCandidates[0]
    );
  });

  it('opens an image card in the shared large image preview', () => {
    render(
      <GenerationRequestReferenceGrid
        preview={previewFixture()}
        draft={{
          promptDraft: { authoredText: 'Create a character sheet.' },
          modelFamilyId: 'gpt-image-2',
          parameterValues: {},
          authoredParameterNames: [],
          slotSelections: [],
        }}
        updating={false}
        editable
        onReferenceChoose={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open Constantine Character Sheet preview',
      })
    );
    expect(
      screen.getByRole('img', { name: 'Constantine Character Sheet' })
    ).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('names missing character sheets by character and renders an empty media card', () => {
    const preview = previewFixture();
    preview.references.slots[1] = {
      ...preview.references.slots[1]!,
      label: 'Urban',
      current: null,
      eligibleCandidates: [],
    };
    const { container } = render(
      <GenerationRequestReferenceGrid
        preview={preview}
        draft={{
          promptDraft: { authoredText: 'Create a character sheet.' },
          modelFamilyId: 'gpt-image-2',
          parameterValues: {},
          authoredParameterNames: [],
          slotSelections: [],
        }}
        updating={false}
        editable
        onReferenceChoose={vi.fn()}
      />
    );

    expect(screen.getByText('Urban')).toBeTruthy();
    expect(
      screen.getByText('No character sheet exists for Urban.')
    ).toBeTruthy();
    expect(
      container.querySelector('[data-media-card-empty-state="image"]')
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Choose/ })).toBeNull();
  });

  it('renders dialogue audio as a selectable MediaCard', () => {
    const preview = previewFixture();
    preview.references.slots = [{
      label: 'Urban opening line',
      mediaKind: 'audio',
      locked: false,
      placement: {
        kind: 'slot',
        sectionId: 'dialogue-audio',
        slotId: 'dialogue-audio',
        subject: {
          kind: 'sceneDialogue',
          id: 'dialogue_urban',
        },
      },
      current: null,
      eligibleCandidates: [{
        kind: 'audio',
        role: 'dialogue-audio',
        title: 'Urban opening line',
        identity: {
          kind: 'asset-file',
          assetId: 'asset_dialogue',
          assetFileId: 'asset_file_dialogue',
        },
        selected: false,
        browserUrl: '/urban-opening-line.wav',
      }],
    }];
    const { container } = render(
      <GenerationRequestReferenceGrid
        preview={preview}
        draft={{
          promptDraft: { authoredText: 'Create a video.' },
          modelFamilyId: 'seedance-2',
          parameterValues: {},
          authoredParameterNames: [],
          slotSelections: [],
        }}
        updating={false}
        editable
        onReferenceChoose={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Urban opening line')).toBeTruthy();
    expect(
      container.querySelector('[data-media-card]')
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Include Urban opening line' })
    ).toBeTruthy();
  });

  it('shows agent-authored additional media without Studio add controls', () => {
    const preview = previewFixture();
    preview.references.additional = [{
      kind: 'image',
      role: 'additional',
      title: 'Costume study',
      identity: {
        kind: 'asset-file',
        assetId: 'asset_costume',
        assetFileId: 'asset_file_costume',
      },
      selected: true,
      browserUrl: '/costume.png',
    }];
    render(
      <GenerationRequestReferenceGrid
        preview={preview}
        draft={{
          promptDraft: { authoredText: 'Create a character sheet.' },
          modelFamilyId: 'gpt-image-2',
          parameterValues: {},
          authoredParameterNames: [],
          slotSelections: [],
        }}
        updating={false}
        editable
        onReferenceChoose={vi.fn()}
      />
    );

    expect(screen.getByText('Additional Media')).toBeTruthy();
    expect(screen.getByText('Costume study')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add Media' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Manage Media' })).toBeNull();
  });

  it('keeps untitled additional project files quiet without leaking filenames', () => {
    const preview = previewFixture();
    preview.references.additional = [{
      kind: 'image',
      role: 'project-file',
      identity: { kind: 'project-file' },
      selected: true,
      browserUrl:
        '/studio-api/projects/basilica/generation-reference-file?path=research%2Fraw-storage-filename.png',
    }];
    render(
      <GenerationRequestReferenceGrid
        preview={preview}
        draft={{
          promptDraft: { authoredText: 'Create a prop sheet.' },
          modelFamilyId: 'gpt-image-2',
          parameterValues: {},
          authoredParameterNames: [],
          slotSelections: [],
        }}
        updating={false}
        editable={false}
      />
    );

    expect(screen.getByText('Additional Media')).toBeTruthy();
    expect(screen.getByAltText('Additional image reference 1')).toBeTruthy();
    expect(screen.queryByText('raw-storage-filename.png')).toBeNull();
    expect(screen.queryByAltText('raw-storage-filename.png')).toBeNull();
    const openPreview = screen.getByRole('button', {
      name: 'Open Additional image reference 1 preview',
    });
    expect(openPreview.textContent).not.toContain('raw-storage-filename.png');
    fireEvent.click(openPreview);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

function previewFixture(): GenerationPreviewResource {
  return {
    kind: 'generationPreview',
    previewId: 'generation_preview_test',
    generationSpec: { id: 'generation_spec_test', frozenAt: null },
    purpose: 'image.edit',
    project: {
      id: 'project_test',
      name: 'urban-basilica',
    },
    target: {
      kind: 'asset',
      id: 'asset_mara',
    },
    title: 'Edit Mara',
    subject: {
      projectLabel: 'Basilica',
    },
    model: {
      provider: 'fal-ai',
      modelId: 'openai/gpt-image-2/edit',
      mediaKind: 'image',
    },
    finalPrompt: {
      authoredText: 'Edit the source image.',
      providerText: 'Edit the source image.',
    },
    references: {
      slots: [
        {
          label: 'Source Image',
          mediaKind: 'image',
          locked: true,
          placement: {
            kind: 'slot',
            sectionId: 'source',
            slotId: 'source-image',
          },
          current: {
            kind: 'image',
            role: 'source-image',
            title: 'Mara Character Sheet',
            identity: {
              kind: 'asset-file',
              assetId: 'asset_mara',
              assetFileId: 'asset_file_mara',
            },
            selected: true,
            browserUrl: '/mara.png',
          },
          eligibleCandidates: [],
        },
        {
          label: 'Constantine XI',
          mediaKind: 'image',
          locked: false,
          placement: {
            kind: 'slot',
            sectionId: 'cast',
            slotId: 'character-sheet',
            subject: {
              kind: 'castMember',
              id: 'cast_constantine',
            },
          },
          current: null,
          eligibleCandidates: [
            {
              kind: 'image',
              role: 'character-sheet',
              title: 'Constantine Character Sheet',
              identity: {
                kind: 'asset-file',
                assetId: 'asset_constantine',
                assetFileId: 'asset_file_constantine',
              },
              selected: false,
              browserUrl: '/constantine.png',
            },
          ],
        },
      ],
      additional: [],
    },
    configuration: {
      sections: [],
    },
    authoring: { kind: 'image', selectedModelFamilyId: '', modelFamilies: [], controls: [] },
    diagnostics: [],
  };
}
