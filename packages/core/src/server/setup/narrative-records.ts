import type { ProjectCounts } from '../../client/index.js';
import {
  insertClipRecord,
  insertSceneRecord,
  insertSequenceRecord,
} from '../database/access/narrative.js';
import type { EntityIdPrefix } from '../entity-ids.js';
import type { ProjectSetupSequence } from './contracts.js';
import {
  addProjectSetupMarkdownAsset,
  type ProjectSetupMarkdownAsset,
} from './markdown-assets.js';
import { numberedSlug } from './slugs.js';

export interface ProjectSetupNarrativeRecords {
  sequenceRecords: Parameters<typeof insertSequenceRecord>[1][];
  sceneRecords: Parameters<typeof insertSceneRecord>[1][];
  clipRecords: Parameters<typeof insertClipRecord>[1][];
}

export function createProjectSetupNarrativeRecords(): ProjectSetupNarrativeRecords {
  return {
    sequenceRecords: [],
    sceneRecords: [],
    clipRecords: [],
  };
}

export function writeSetupSequences(input: {
  sequences: ProjectSetupSequence[];
  episodeId: string | null;
  ids: (prefix: EntityIdPrefix) => string;
  counts: ProjectCounts;
  now: string;
  baseLocaleId: string | null;
  markdownAssets: ProjectSetupMarkdownAsset[];
  records: ProjectSetupNarrativeRecords;
}): void {
  input.sequences.forEach((sequence) => {
    const sequenceId = input.ids('sequence');
    input.counts.sequences += 1;
    const sequenceSlug = numberedSlug(input.counts.sequences, sequence.title);
    input.records.sequenceRecords.push({
      id: sequenceId,
      episodeId: input.episodeId,
      title: sequence.title,
      shortTitle: sequence.shortTitle,
      oneLineSummary: undefined,
      position: input.counts.sequences,
      createdAt: input.now,
      updatedAt: input.now,
    });
    addProjectSetupMarkdownAsset(input.markdownAssets, input.ids, input.now, {
      content: sequence.summary,
      title: `${sequence.title} summary`,
      role: 'summary',
      localeId: input.baseLocaleId,
      pathTarget: { kind: 'sequence', sequenceSlug },
      fileName: 'sequence-summary.md',
      relationship: { kind: 'sequence', sequenceId },
    });

    (sequence.scenes ?? []).forEach((scene, sceneIndex) => {
      const sceneId = input.ids('scene');
      input.counts.scenes += 1;
      const sceneSlug = numberedSlug(sceneIndex + 1, scene.title);
      input.records.sceneRecords.push({
        id: sceneId,
        sequenceId,
        title: scene.title,
        oneLineSummary: undefined,
        position: sceneIndex + 1,
        createdAt: input.now,
        updatedAt: input.now,
      });
      addProjectSetupMarkdownAsset(input.markdownAssets, input.ids, input.now, {
        content: scene.summary,
        title: `${scene.title} summary`,
        role: 'summary',
        localeId: input.baseLocaleId,
        pathTarget: { kind: 'scene', sequenceSlug, sceneSlug },
        fileName: 'scene-summary.md',
        relationship: { kind: 'scene', sceneId },
      });

      (scene.clips ?? []).forEach((clip, clipIndex) => {
        input.counts.clips += 1;
        const clipId = input.ids('clip');
        const clipSlug = numberedSlug(clipIndex + 1, clip.title);
        input.records.clipRecords.push({
          id: clipId,
          sceneId,
          title: clip.title,
          oneLineSummary: undefined,
          position: clipIndex + 1,
          createdAt: input.now,
          updatedAt: input.now,
        });
        addProjectSetupMarkdownAsset(input.markdownAssets, input.ids, input.now, {
          content: clip.summary,
          title: `${clip.title} summary`,
          role: 'summary',
          localeId: input.baseLocaleId,
          pathTarget: { kind: 'clip', sequenceSlug, sceneSlug, clipSlug },
          fileName: 'clip-summary.md',
          relationship: { kind: 'clip', clipId },
        });
        addProjectSetupMarkdownAsset(input.markdownAssets, input.ids, input.now, {
          content: clip.visualIntent,
          title: `${clip.title} visual intent`,
          role: 'visual_intent',
          localeId: input.baseLocaleId,
          pathTarget: { kind: 'clip', sequenceSlug, sceneSlug, clipSlug },
          fileName: 'visual-intent.md',
          relationship: { kind: 'clip', clipId },
        });
      });
    });
  });
}
