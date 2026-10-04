import type {
  AssetFile,
  SceneShotPlanVideoGenerations,
} from '@gorenku/studio-core/client';

export type StudioShotPlanVideoAssetFile = AssetFile & { browserUrl: string };

export type StudioSceneShotPlanVideoGenerations = Omit<
  SceneShotPlanVideoGenerations,
  'groups'
> & {
  groups: Array<
    | {
        kind: 'shotPlan';
        shotPlan: { id: string; title: string };
        assetFiles: StudioShotPlanVideoAssetFile[];
      }
    | {
        kind: 'miscellaneous';
        assetFiles: StudioShotPlanVideoAssetFile[];
      }
  >;
};
