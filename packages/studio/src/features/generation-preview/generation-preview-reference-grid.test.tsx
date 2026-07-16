// @vitest-environment jsdom
import React from 'react';
import type { GenerationPreviewResource } from '@gorenku/studio-core/client';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GenerationPreviewReferenceGrid } from './generation-preview-reference-grid';

describe('GenerationPreviewReferenceGrid', () => {
  it('shows only exact selected references when reference editing is disabled', () => {
    render(
      <GenerationPreviewReferenceGrid
        preview={previewFixture()}
        draft={{
          promptDraft: { authoredText: 'Edit the source image.' },
          slotSelections: [],
          genericReferences: [],
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
});

function previewFixture(): GenerationPreviewResource {
  return {
    kind: 'generationPreview',
    previewId: 'generation_preview_test',
    generationSpecId: 'generation_spec_test',
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
          placement: {
            kind: 'slot',
            sectionId: 'source',
            slotId: 'source-image',
          },
          current: {
            kind: 'image',
            role: 'source-image',
            label: 'Mara Character Sheet',
            assetId: 'asset_mara',
            assetFileId: 'asset_file_mara',
            selected: true,
            browserUrl: '/mara.png',
          },
          eligibleCandidates: [],
        },
        {
          label: 'Character Sheet',
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
              label: 'Constantine Character Sheet',
              assetId: 'asset_constantine',
              assetFileId: 'asset_file_constantine',
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
    diagnostics: [],
  };
}
