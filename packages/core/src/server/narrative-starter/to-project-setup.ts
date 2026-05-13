import type { ProjectSetup } from '../setup/reader.js';
import type { NarrativeStarter } from './reader.js';

export function projectSetupFromNarrativeStarter(
  starter: NarrativeStarter
): ProjectSetup {
  return {
    kind: 'renku.projectSetup',
    version: '0.1.0',
    project: {
      name: starter.project.name,
      title: starter.project.title,
      type: starter.project.type,
      aspectRatio: starter.project.aspectRatio,
      logline: starter.project.logline,
      summary: starter.project.summary,
    },
    languages: starter.languages,
    visualLanguageCategories: starter.visualLanguageCategories,
    visualLanguage: starter.visualLanguage,
    cast: starter.cast,
    continuityReferences: starter.continuityReferences,
    sequences: starter.sequences.map((sequence) => ({
      title: sequence.title,
      shortTitle: sequence.shortTitle,
      summary: sequence.summary,
      scenes: (sequence.scenes ?? []).map((scene) => ({
        title: scene.title,
        summary: scene.summary,
        clips: (scene.clips ?? []).map((clip) => ({
          title: clip.title,
          summary: clip.summary,
          visualIntent: clip.visualIntent,
        })),
      })),
    })),
  };
}
