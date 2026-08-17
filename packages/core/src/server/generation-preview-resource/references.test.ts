import { describe, expect, it } from 'vitest';
import type {
  GenerationPreview,
  GenerationReferenceCatalogItem,
  GenerationReferenceGuideSlot,
  ShotPlanVideoInputMode,
} from '../../client/generation.js';
import type { ProjectRelativePath } from '../../client/project/index.js';
import { projectGenerationPreviewReferences } from './references.js';

describe('projectGenerationPreviewReferences', () => {
  it('projects only first and last frame slots for first-last-frame video', () => {
    const preview = videoPreview('first-last-frame', [
      guideSlot('method-references', 'first-frame', 'First Frame'),
      guideSlot('method-references', 'last-frame', 'Last Frame'),
      guideSlot('method-references', 'video-storyboard', 'Video Storyboard'),
      guideSlot('cast', 'character-sheet', 'Urban', {
        kind: 'castMember',
        id: 'cast_urban',
      }),
      guideSlot('dialogue-audio', 'dialogue-audio', 'Dialogue Audio', {
        kind: 'sceneDialogue',
        id: 'dialogue_1',
      }, 'audio'),
      guideSlot('lookbook', 'lookbook-sheet', 'Lookbook Sheet'),
    ]);

    expect(
      projectGenerationPreviewReferences(preview).slots.map((slot) => slot.label)
    ).toEqual(['First Frame', 'Last Frame']);
  });

  it('projects entity placeholders and available compatible media for reference video', () => {
    const dialogueAudio = catalogItem({
      id: 'dialogue-audio',
      title: 'Urban opening line',
      mediaKind: 'audio',
      role: 'dialogue-audio',
    });
    const constantineSheet = catalogItem({
      id: 'constantine-sheet',
      title: 'Constantine Character Sheet',
      mediaKind: 'image',
      role: 'character-sheet',
    });
    const lookbookSheet = catalogItem({
      id: 'lookbook-sheet',
      title: 'Production Lookbook Sheet',
      mediaKind: 'image',
      role: 'lookbook-sheet',
    });
    const preview = videoPreview('reference', [
      guideSlot('method-references', 'first-frame', 'First Frame'),
      guideSlot('method-references', 'last-frame', 'Last Frame'),
      guideSlot('method-references', 'video-storyboard', 'Video Storyboard'),
      guideSlot('cast', 'character-sheet', 'Urban', {
        kind: 'castMember',
        id: 'cast_urban',
      }),
      guideSlot('cast', 'character-sheet', 'Constantine XI', {
        kind: 'castMember',
        id: 'cast_constantine',
      }, 'image', [constantineSheet]),
      guideSlot('location', 'location-sheet', 'Blachernae Palace', {
        kind: 'location',
        id: 'location_palace',
      }),
      guideSlot('dialogue-audio', 'dialogue-audio', 'Dialogue Audio', {
        kind: 'sceneDialogue',
        id: 'dialogue_empty',
      }, 'audio'),
      guideSlot('dialogue-audio', 'dialogue-audio', 'Dialogue Audio', {
        kind: 'sceneDialogue',
        id: 'dialogue_available',
      }, 'audio', [dialogueAudio]),
      guideSlot(
        'lookbook',
        'lookbook-sheet',
        'Lookbook Sheet',
        undefined,
        'image',
        [lookbookSheet],
      ),
    ]);

    expect(
      projectGenerationPreviewReferences(preview).slots.map((slot) => ({
        label: slot.label,
        mediaKind: slot.mediaKind,
        candidateCount: slot.eligibleCandidates.length,
      }))
    ).toEqual([
      { label: 'Urban', mediaKind: 'image', candidateCount: 0 },
      { label: 'Constantine XI', mediaKind: 'image', candidateCount: 1 },
      { label: 'Blachernae Palace', mediaKind: 'image', candidateCount: 0 },
      { label: 'Dialogue Audio', mediaKind: 'audio', candidateCount: 1 },
      { label: 'Lookbook Sheet', mediaKind: 'image', candidateCount: 1 },
    ]);
  });

  it('omits optional media kinds that the selected reference model does not accept', () => {
    const preview = videoPreview('reference', [
      guideSlot('cast', 'character-sheet', 'Urban', {
        kind: 'castMember',
        id: 'cast_urban',
      }),
      guideSlot('dialogue-audio', 'dialogue-audio', 'Dialogue Audio', {
        kind: 'sceneDialogue',
        id: 'dialogue_urban',
      }, 'audio', [catalogItem({
        id: 'dialogue-audio',
        title: 'Urban opening line',
        mediaKind: 'audio',
        role: 'dialogue-audio',
      })]),
    ]);
    preview.models![0]!.fields = [mediaField('image_urls', ['image'])];

    expect(
      projectGenerationPreviewReferences(preview).slots.map((slot) => slot.label)
    ).toEqual(['Urban']);
  });

  it('keeps an exact persisted incompatible slot visible for removal', () => {
    const persisted = catalogItem({
      id: 'persisted-character-sheet',
      title: 'Persisted Character Sheet',
      mediaKind: 'image',
      role: 'character-sheet',
    });
    const preview = videoPreview('first-last-frame', [
      guideSlot('method-references', 'first-frame', 'First Frame'),
      guideSlot('method-references', 'last-frame', 'Last Frame'),
      guideSlot('cast', 'character-sheet', 'Urban', {
        kind: 'castMember',
        id: 'cast_urban',
      }, 'image', [persisted]),
    ]);
    preview.spec.references = [{
      placement: {
        kind: 'slot',
        sectionId: 'cast',
        slotId: 'character-sheet',
        subject: {
          kind: 'castMember',
          id: 'cast_urban',
        },
      },
      reference: persisted.reference,
    }];
    preview.references = [{
      ...preview.spec.references[0]!,
      resolved: persisted,
    }];

    expect(
      projectGenerationPreviewReferences(preview).slots.map((slot) => slot.label)
    ).toEqual(['Urban', 'First Frame', 'Last Frame']);
  });

  it('keeps project-file storage paths out of reference presentation metadata', () => {
    const preview = videoPreview('reference', []);
    const projectRelativePath =
      'references/raw-storage-filename.png' as ProjectRelativePath;
    preview.spec.references = [{
      placement: { kind: 'additional' },
      reference: { kind: 'project-file', projectRelativePath },
      promptMention: '@Reference1',
    }];
    preview.references = [{
      ...preview.spec.references[0]!,
      resolved: {
        reference: { kind: 'project-file', projectRelativePath },
        oneLineSummary: null,
        referenceName: null,
        tags: [],
        mediaKind: 'image',
        mimeType: 'image/png',
        sizeBytes: 100,
        width: null,
        height: null,
        durationSeconds: null,
        owner: null,
        role: 'project-file',
        provenance: { origin: 'project-file' },
        projectRelativePath,
      },
    }];

    const [projected] = projectGenerationPreviewReferences(preview).additional;
    expect(projected).toMatchObject({
      kind: 'image',
      role: 'project-file',
      promptMention: '@Reference1',
      identity: { kind: 'project-file', projectRelativePath },
    });
    expect(projected).not.toHaveProperty('title');
  });
});

function videoPreview(
  inputMode: ShotPlanVideoInputMode,
  slots: Array<{
    sectionId: string;
    sectionLabel: string;
    slot: GenerationReferenceGuideSlot;
  }>,
): GenerationPreview {
  const sections = new Map<
    string,
    GenerationPreview['referenceGuide']['sections'][number]
  >();
  for (const entry of slots) {
    const section = sections.get(entry.sectionId) ?? {
      id: entry.sectionId,
      label: entry.sectionLabel,
      slots: [],
    };
    section.slots.push(entry.slot);
    sections.set(entry.sectionId, section);
  }
  return {
    spec: {
      purpose: 'shot-plan.video-generation',
      target: { kind: 'project', id: 'project' },
      authoredFrom: { kind: 'shotPlan', id: 'shot_plan_test' },
      shotPlanVideoInputMode: inputMode,
      executionKind: 'renku-managed',
      model: {
        provider: 'fal-ai',
        model: 'video/reference',
      },
      values: { prompt: 'Generate the shot.' },
      references: [],
    },
    referenceGuide: {
      sections: [...sections.values()],
      notices: [],
    },
    references: [],
    diagnostics: [],
    models: [{
      provider: 'fal-ai',
      model: 'video/reference',
      label: 'Reference video',
      mediaKind: 'video',
      fields: [
        mediaField('image_urls', ['image']),
        mediaField('video_urls', ['video']),
        mediaField('audio_urls', ['audio']),
      ],
    }],
  };
}

function guideSlot(
  sectionId: string,
  id: string,
  label: string,
  subject?: { kind: string; id: string },
  mediaKind: 'image' | 'audio' | 'video' = 'image',
  eligibleCandidates: GenerationReferenceCatalogItem[] = [],
) {
  return {
    sectionId,
    sectionLabel: sectionId,
    slot: {
      id,
      label,
      mediaKind,
      ...(subject ? { subject } : {}),
      eligibleCandidates,
    },
  };
}

function catalogItem(input: {
  id: string;
  title: string;
  mediaKind: 'image' | 'audio' | 'video';
  role: string;
}): GenerationReferenceCatalogItem {
  return {
    reference: {
      kind: 'asset-file',
      assetId: `asset_${input.id}`,
      assetFileId: `asset_file_${input.id}`,
    },
    title: input.title,
    oneLineSummary: null,
    referenceName: null,
    tags: [],
    mediaKind: input.mediaKind,
    mimeType: null,
    sizeBytes: null,
    width: null,
    height: null,
    durationSeconds: null,
    owner: null,
    role: input.role,
    provenance: { origin: 'generated' },
    projectRelativePath: `references/${input.id}` as ProjectRelativePath,
  };
}

function mediaField(
  name: string,
  acceptedKinds: Array<'image' | 'audio' | 'video'>,
) {
  const mediaKind = acceptedKinds[0];
  return {
    name,
    label: name,
    kind: 'array',
    semantic: {
      kind: 'media' as const,
      role: mediaKind === 'video'
        ? 'source-video' as const
        : mediaKind === 'audio'
          ? 'audio' as const
          : 'reference-image' as const,
    },
    required: false,
    media: {
      acceptedKinds,
      cardinality: 'many' as const,
      minimum: 0,
      maximum: null,
    },
  };
}
