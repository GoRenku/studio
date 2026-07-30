import type {
  Asset,
  SceneShotPlanVideoGenerations,
} from '@gorenku/studio-core/client';

export type StudioShotPlanVideoAsset = Omit<Asset, 'files'> & {
  files: Array<Asset['files'][number] & { browserUrl: string }>;
};

export type StudioSceneShotPlanVideoGenerations = Omit<
  SceneShotPlanVideoGenerations,
  'groups'
> & {
  groups: Array<
    | {
        kind: 'shotPlan';
        shotPlan: { id: string; title: string };
        assets: StudioShotPlanVideoAsset[];
      }
    | {
        kind: 'miscellaneous';
        assets: StudioShotPlanVideoAsset[];
      }
  >;
};
