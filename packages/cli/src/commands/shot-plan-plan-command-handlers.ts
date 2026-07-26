import {
  requiredFlag,
  type CliCommandHandler,
} from './structured-command.js';
import {
  readShotPlanAuthoringDocument,
  requireDocumentKind,
} from './shot-plan-command-documents.js';
import type {
  ShotPlanCommandFlags,
  ShotPlanCommandRuntime,
} from './shot-plan-command-handlers.js';

type Handler = CliCommandHandler<
  ShotPlanCommandFlags,
  ShotPlanCommandRuntime
>;

export const shotPlanPlanCommandHandlers: readonly Handler[] = [
  {
    path: ['list'],
    run: ({ flags, runtime }) =>
      runtime.projectDataService.listSceneShotPlans({
        projectName: runtime.projectName,
        homeDir: runtime.homeDir,
        sceneId: requiredFlag(flags.scene, '--scene'),
      }),
  },
  {
    path: ['show'],
    run: ({ flags, runtime }) =>
      runtime.projectDataService.readShotPlan({
        projectName: runtime.projectName,
        homeDir: runtime.homeDir,
        shotPlanId: requiredFlag(flags.shotPlan, '--shot-plan'),
      }),
  },
  {
    path: ['validate'],
    async run({ flags, runtime }) {
      const document = await readShotPlanAuthoringDocument(
        requiredFlag(flags.file, '--file')
      );
      return runtime.projectDataService.validateShotPlanDocument({ document });
    },
  },
  {
    path: ['create'],
    async run({ flags, runtime }) {
      const validation =
        await runtime.projectDataService.validateShotPlanDocument({
          document: await readShotPlanAuthoringDocument(
            requiredFlag(flags.file, '--file')
          ),
        });
      const document = requireDocumentKind(
        validation.document,
        'shotPlanCreate'
      );
      return runtime.projectDataService.createShotPlan({
        projectName: runtime.projectName,
        homeDir: runtime.homeDir,
        sceneId: document.sceneId,
        title: document.title,
        coverage: document.coverage,
        shots: document.shots,
      });
    },
  },
  {
    path: ['update'],
    async run({ flags, runtime }) {
      const validation =
        await runtime.projectDataService.validateShotPlanDocument({
          document: await readShotPlanAuthoringDocument(
            requiredFlag(flags.file, '--file')
          ),
        });
      const document = requireDocumentKind(
        validation.document,
        'shotPlanUpdate'
      );
      return runtime.projectDataService.updateShotPlanDetails({
        projectName: runtime.projectName,
        homeDir: runtime.homeDir,
        shotPlanId: requiredFlag(flags.shotPlan, '--shot-plan'),
        title: document.title,
        coverage: document.coverage,
      });
    },
  },
  {
    path: ['copy'],
    run: ({ flags, runtime }) =>
      runtime.projectDataService.copyShotPlan({
        projectName: runtime.projectName,
        homeDir: runtime.homeDir,
        shotPlanId: requiredFlag(flags.shotPlan, '--shot-plan'),
      }),
  },
  {
    path: ['delete'],
    run: ({ flags, runtime }) =>
      runtime.projectDataService.deleteShotPlan({
        projectName: runtime.projectName,
        homeDir: runtime.homeDir,
        shotPlanId: requiredFlag(flags.shotPlan, '--shot-plan'),
      }),
  },
];
