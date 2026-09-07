import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';

export type FdxUpdateStatus = { state: 'notApplicable' } | ({
  exportPath: string;
  acceptedSourceSha256: string;
} & (
  | { state: 'missing' | 'settling' }
  | { state: 'unavailable'; diagnostics: DiagnosticIssue[] }
  | { state: 'current' | 'pending'; sourceSha256: string }
));

export interface FdxSceneUpdateLabel {
  sceneId: string;
  heading: string;
  productionNumber?: string;
  title?: string;
}

export interface FdxSceneUpdateImpact extends FdxSceneUpdateLabel {
  activeSceneBeats: boolean;
  sceneBeatsRevisionCount: number;
  shotPlanCount: number;
  shotCount: number;
  dialogueAudioTakeCount: number;
}

export interface FdxUpdateReview {
  sourceSha256: string;
  reviewFingerprint: string;
  change: 'sourceOnly' | 'screenplay';
  beforeSceneCount: number;
  afterSceneCount: number;
  retainedSceneCount: number;
  survivingSceneOrderChanged: boolean;
  openingChanged: boolean;
  removedOrReplacedScenes: FdxSceneUpdateImpact[];
  newScenes: FdxSceneUpdateLabel[];
  analysisNeedsRefresh: boolean;
  diagnostics: DiagnosticIssue[];
}

const hash = { type: 'string', pattern: '^[0-9a-f]{64}$' } as const;
const text = { type: 'string' } as const;
const count = { type: 'integer', minimum: 0 } as const;
const boolean = { type: 'boolean' } as const;
const diagnostics = { type: 'array', items: {
  type: 'object', additionalProperties: false, required: ['code', 'message', 'severity', 'location'],
  properties: { code: text, message: text, severity: { enum: ['error', 'warning'] }, suggestion: text,
    location: { type: 'object', additionalProperties: false, required: ['path'], properties: {
      path: { type: 'array', items: text }, filePath: text, context: text,
    } },
  },
} } as const;
const labelProperties = { sceneId: text, heading: text, productionNumber: text, title: text } as const;
const label = { type: 'object', additionalProperties: false, required: ['sceneId', 'heading'], properties: labelProperties } as const;
const impact = { type: 'object', additionalProperties: false,
  required: ['sceneId', 'heading', 'activeSceneBeats', 'sceneBeatsRevisionCount', 'shotPlanCount', 'shotCount', 'dialogueAudioTakeCount'],
  properties: { ...labelProperties, activeSceneBeats: boolean, sceneBeatsRevisionCount: count,
    shotPlanCount: count, shotCount: count, dialogueAudioTakeCount: count },
} as const;

export const fdxUpdateStatusSchema = {
  oneOf: [
    { type: 'object', additionalProperties: false, required: ['state'], properties: { state: { const: 'notApplicable' } } },
    ...(['missing', 'settling', 'unavailable', 'current', 'pending'] as const).map((state) => ({
      type: 'object', additionalProperties: false,
      required: ['state', 'exportPath', 'acceptedSourceSha256',
        ...(state === 'unavailable' ? ['diagnostics'] : []),
        ...(['current', 'pending'].includes(state) ? ['sourceSha256'] : [])],
      properties: { state: { const: state }, exportPath: text, acceptedSourceSha256: hash,
        ...(state === 'unavailable' ? { diagnostics } : {}),
        ...(['current', 'pending'].includes(state) ? { sourceSha256: hash } : {}),
      },
    })),
  ],
} as const;

export const fdxUpdateReviewSchema = {
  type: 'object', additionalProperties: false,
  required: ['sourceSha256', 'reviewFingerprint', 'change', 'beforeSceneCount', 'afterSceneCount',
    'retainedSceneCount', 'survivingSceneOrderChanged', 'openingChanged', 'removedOrReplacedScenes',
    'newScenes', 'analysisNeedsRefresh', 'diagnostics'],
  properties: { sourceSha256: hash, reviewFingerprint: hash, change: { enum: ['sourceOnly', 'screenplay'] },
    beforeSceneCount: count, afterSceneCount: count, retainedSceneCount: count,
    survivingSceneOrderChanged: boolean, openingChanged: boolean,
    removedOrReplacedScenes: { type: 'array', items: impact }, newScenes: { type: 'array', items: label },
    analysisNeedsRefresh: boolean, diagnostics,
  },
} as const;
