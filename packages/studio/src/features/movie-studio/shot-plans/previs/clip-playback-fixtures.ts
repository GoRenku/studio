import type { StudioShotPlanClips } from '@/services/shot-plan-previs/contracts';

export function rawClipFixture(durations: number[]): StudioShotPlanClips {
  return {
    project: { projectName: 'movie' }, shotPlanId: 'plan', previsRevisionId: 'revision', sources: [], resourceKeys: [], unassignedAssetFiles: [],
    clips: durations.map((_, index) => ({
      id: `clip-${index}`, number: index + 1, previsRevisionId: 'revision', selectedTakeId: `take-${index}`,
      takes: [{ id: `take-${index}`, clipId: `clip-${index}`, number: 1, title: index === 0 ? 'Initial' : null, assetFileId: `file-${index}`, sourceTakeId: null, createdAt: '' }],
    })),
    assetFiles: durations.map((duration, index) => ({
      id: `file-${index}`, owner: { kind: 'project' }, localeId: null, type: 'shot_plan_video', availability: 'ready', mediaKind: 'video', title: 'Video',
      oneLineSummary: null, origin: 'external', referenceName: null, tags: [], generationProvenance: null, authoredFrom: null, createdAt: '', updatedAt: '',
      mimeType: 'video/mp4', url: `/clip-${index}.mp4`, sizeBytes: null, contentHash: null, width: null, height: null, durationSeconds: duration,
    })),
  };
}
