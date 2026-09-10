import type { ShotPlanPrevisReport } from '@gorenku/studio-core/client';
import { toStudioAssetResponse } from './asset-responses.js';

export function toStudioPrevisResponse(projectName: string, report: ShotPlanPrevisReport) {
  return {
    shotPlanId: report.shotPlanId,
    resourceKeys: report.resourceKeys,
    revisions: report.revisions.map((revision) => ({
      id: revision.id,
      number: revision.number,
      createdAt: revision.createdAt,
      description: revision.description,
      warnings: revision.warnings,
      render: revision.render ? toStudioAssetResponse(projectName, revision.render) : null,
      generations: revision.generations.map((asset) => toStudioAssetResponse(projectName, asset)),
      playback: revision.playback ? {
        ...revision.playback,
        cues: revision.playback.cues.map((cue) => ({
          ...cue,
          ...(cue.kind === 'dialogue' && cue.audio ? { audio: {
            ...cue.audio,
            url: `/studio-api/projects/${encodeURIComponent(projectName)}/assets/${encodeURIComponent(cue.audio.assetId)}/files/${encodeURIComponent(cue.audio.assetFileId)}`,
          } } : {}),
        })),
      } : null,
    })),
  };
}
