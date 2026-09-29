import { channel } from 'node:diagnostics_channel';
import { StructuredError, createDiagnosticError } from '@gorenku/studio-diagnostics';
import type { CliFlags } from '../arguments.js';
import type { RenkuCliIo } from '../cli.js';

interface CommandOptions {
  input: string[];
  flags: CliFlags;
  file: string | undefined;
  isGenerationPreview: boolean;
  io: RenkuCliIo;
  homeDir: string | undefined;
}

const performanceChannel = channel('renku.performance');

export async function loadCommand<T>(family: string, load: () => Promise<T>): Promise<T> {
  const start = performanceChannel.hasSubscribers ? performance.now() : undefined;
  let outcome = 'success';
  try {
    return await load();
  } catch (error) {
    outcome = 'failure';
    throw new StructuredError({
      code: 'CLI_COMMAND_LOAD_FAILED',
      message: `Could not load the ${family} command.`,
      issues: [createDiagnosticError('CLI_COMMAND_LOAD_FAILED',
        error instanceof Error ? error.message : String(error), { path: ['commands', family] })],
      suggestion: 'Repair the Renku installation and retry the command.',
    });
  } finally {
    if (start !== undefined) {
      performanceChannel.publish({ package: 'cli', phase: 'command-load', durationMs: performance.now() - start, outcome });
    }
  }
}

const commands: Record<string, (options: CommandOptions) => Promise<number>> = {
  'create': async ({ input, flags, file, io, homeDir }) => {
    const { runCreateCommand } = await loadCommand('create', () => import('./create-project-command.js'));
    return runCreateCommand({
      input,
      file,
      title: flags.title,
      aspectRatio: flags.aspectRatio,
      logline: flags.logline,
      synopsis: flags.synopsis,
      storageRoot: flags.storageRoot,
      json: flags.json,
      io,
      homeDir: homeDir,
    });
  },
  'init': async ({ input, flags, io, homeDir }) => {
    const { runInitCommand } = await loadCommand('init', () => import('./initialize-config-command.js'));
    return runInitCommand({
      input,
      json: flags.json,
      io,
      homeDir: homeDir,
    });
  },
  'about': async ({ io }) => {
    const { runAboutCommand } = await loadCommand('about', () => import('./about-command.js'));
    return runAboutCommand({ io });
  },
  'asset': async ({ input, flags, io, homeDir }) => {
    const { runAssetCommand } = await loadCommand('asset', () => import('./asset-command.js'));
    return runAssetCommand({
      input,
      flags: {
        project: flags.project,
        owner: flags.owner,
        target: flags.target,
        asset: flags.asset,
        type: flags.type,
        mediaKind: flags.mediaKind,
        title: flags.title,
        summary: flags.summary,
        referenceName: flags.referenceName,
        tag: flags.tag?.length ? flags.tag : undefined,
        clearTags: flags.clearTags,
        locale: flags.locale,
        limit: flags.limit,
        cursor: flags.cursor,
      },
      json: flags.json,
      io,
      homeDir: homeDir,
    });
  },
  'cast': async ({ input, flags, file, io, homeDir }) => {
    const { runCastCommand } = await loadCommand('cast', () => import('./cast-command.js'));
    return runCastCommand({
      input,
      flags: {
        file,
        project: flags.project,
        cast: flags.cast,
        voice: flags.voice,
        design: flags.design,
        active: flags.active,
        dryRun: flags.dryRun,
      },
      json: flags.json,
      io,
      homeDir: homeDir,
    });
  },
  'director': async ({ input, flags, io, homeDir }) => {
    const { runDirectorCommand } = await loadCommand('director', () => import('./director-command.js'));
    return runDirectorCommand({
      input,
      flags: {
        selection: flags.selection,
      },
      json: flags.json,
      io,
      homeDir: homeDir,
    });
  },
  'info': async ({ input, flags, io, homeDir }) => {
    const { runProjectInformationCommand } = await loadCommand('info', () => import('./project-information-command.js'));
    return runProjectInformationCommand({
      input,
      flags: {
        project: flags.project,
        title: flags.title,
        aspectRatio: flags.aspectRatio,
        logline: flags.logline,
        synopsis: flags.synopsis,
        premise: flags.premise,
        intendedAudience: flags.intendedAudience,
        format: flags.format,
        targetRuntimeMinutes: flags.targetRuntimeMinutes,
        primaryGenre: flags.primaryGenre,
        secondaryGenres: flags.secondaryGenres,
        tones: flags.tones,
        contentRatingIntent: flags.contentRatingIntent,
        creativeBoundaries: flags.creativeBoundaries,
        centralConflict: flags.centralConflict,
        dramaticQuestion: flags.dramaticQuestion,
        themes: flags.themes,
        historicalBasis: flags.historicalBasis,
        dramatizedElements: flags.dramatizedElements,
        screenplayDraftStatus: flags.screenplayDraftStatus,
        researchSources: flags.researchSources,
        assumptions: flags.assumptions,
        openQuestions: flags.openQuestions,
        nextSteps: flags.nextSteps,
        displayName: flags.displayName,
        base: flags.base,
        audio: flags.audio,
        noAudio: flags.noAudio,
        subtitles: flags.subtitles,
        noSubtitles: flags.noSubtitles,
      },
      json: flags.json,
      io,
      homeDir: homeDir,
    });
  },
  'settings': async ({ input, flags, file, io, homeDir }) => {
    const { runProjectSettingsCommand } = await loadCommand('settings', () => import('./project-settings-command.js'));
    return runProjectSettingsCommand({
      input,
      flags: {
        project: flags.project,
        file,
      },
      json: flags.json,
      io,
      homeDir: homeDir,
    });
  },
  'credentials': async ({ input, flags, io, homeDir }) => {
    const { runCredentialsCommand } = await loadCommand('credentials', () => import('./credentials-command.js'));
    return runCredentialsCommand({
      input,
      json: flags.json,
      io,
      homeDir: homeDir,
    });
  },
  'production-design': async ({ input, flags, file, io, homeDir }) => {
    const { runProductionDesignCommand } = await loadCommand('production-design', () => import('./production-design-command.js'));
    return runProductionDesignCommand({
      input,
      flags: {
        file,
        location: flags.location,
        prop: flags.prop,
        design: flags.design,
        active: flags.active,
      },
      json: flags.json,
      io,
      homeDir: homeDir,
    });
  },
  'inspiration': async ({ input, flags, file, io, homeDir }) => {
    const { runInspirationCommand } = await loadCommand('inspiration', () => import('./inspiration-command.js'));
    return runInspirationCommand({
      input,
      flags: {
        file,
        folder: flags.folder,
        name: flags.name,
        project: flags.project,
      },
      json: flags.json,
      io,
      homeDir: homeDir,
    });
  },
  'generation': async ({ input, flags, file, isGenerationPreview, io, homeDir }) => {
    const { runGenerationCommand } = await loadCommand('generation', () => import('./generation/command.js'));
    return runGenerationCommand({
      input,
      flags: {
        project: flags.project,
        file: isGenerationPreview ? flags.file : file,
        output: flags.output,
        requestId: flags.requestId,
        expectedRequestSha256: flags.expectedRequestSha256,
        purpose: flags.purpose,
        target: flags.target,
        revision: flags.revision,
        beat: flags.beat?.length ? flags.beat : undefined,
        provider: flags.provider,
        model: flags.model,
        schema: flags.schema,
        template: flags.template,
        routeIndex: flags.routeIndex,
        ifRevision: flags.ifRevision,
      },
      json: flags.json,
      io,
      homeDir: homeDir,
    });
  },
  'lookbook': async ({ input, flags, file, io, homeDir }) => {
    const { runLookbookCommand } = await loadCommand('lookbook', () => import('./lookbook-command.js'));
    return runLookbookCommand({
      input,
      flags: {
        anchor: flags.anchor,
        file,
        image: flags.image,
        lookbook: flags.lookbook,
        kind: flags.kind,
        project: flags.project,
        sections: flags.sections,
      },
      json: flags.json,
      io,
      homeDir: homeDir,
    });
  },
  'media': async ({ input, flags, file, io, homeDir }) => {
    const { runMediaCommand } = await loadCommand('media', () => import('./media-command.js'));
    return runMediaCommand({
      input,
      flags: {
        project: flags.project,
        purpose: flags.purpose,
        target: flags.target,
        file,
        source: flags.source,
        turns: flags.turns,
        previsRevision: flags.previsRevision,
        clip: flags.clip,
        sourceTake: flags.sourceTake,
        takeTitle: flags.takeTitle,
        title: flags.title,
        summary: flags.summary,
        referenceName: flags.referenceName,
        tag: flags.tag?.length ? flags.tag : undefined,
        sections: flags.sections,
        anchor: flags.anchor,
        provenance: flags.provenance,
        sourceSheet: flags.sourceSheet,
        revision: flags.revision,
        beats: flags.beats,
        take: flags.take,
        kind: flags.kind,
        select: flags.select,
        selection: flags.selection,
        replaceSelected: flags.replaceSelected,
      },
      json: flags.json,
      io,
      homeDir: homeDir,
    });
  },
  'location': async ({ input, flags, file, io, homeDir }) => {
    const { runLocationCommand } = await loadCommand('location', () => import('./location-command.js'));
    return runLocationCommand({
      input,
      flags: {
        file,
        location: flags.location,
        dryRun: flags.dryRun,
      },
      json: flags.json,
      io,
      homeDir: homeDir,
    });
  },
  'prop': async ({ input, flags, file, io, homeDir }) => {
    const { runPropCommand } = await loadCommand('prop', () => import('./prop-command.js'));
    return runPropCommand({
      input,
      flags: {
        file,
        prop: flags.prop,
        dryRun: flags.dryRun,
      },
      json: flags.json,
      io,
      homeDir: homeDir,
    });
  },
  'project': async ({ input, flags, io, homeDir }) => {
    const { runProjectSelectionCommand } = await loadCommand('project', () => import('./project-selection-command.js'));
    return runProjectSelectionCommand({
      input,
      storageRoot: flags.storageRoot,
      json: flags.json,
      io,
      homeDir: homeDir,
    });
  },
  'screenplay': async ({ input, flags, file, io, homeDir }) => {
    const { runScreenplayCommand } = await loadCommand('screenplay', () => import('./screenplay/index.js'));
    return runScreenplayCommand({
      input,
      flags: {
        file,
        active: flags.active,
        analysis: flags.analysis,
        revision: flags.revision,
        scene: flags.scene,
        number: flags.number,
        includeVisualReferences: flags.includeVisualReferences,
        dryRun: flags.dryRun,
        project: flags.project,
      },
      json: flags.json,
      io,
      homeDir: homeDir,
    });
  },
  'shot-plan': async ({ input, flags, file, io, homeDir }) => {
    const { runShotPlanCommand } = await loadCommand('shot-plan', () => import('./shot-plan-command.js'));
    return runShotPlanCommand({
      input,
      flags: {
        source: flags.source,
        mediaKind: flags.mediaKind,
        summary: flags.summary,
        project: flags.project,
        previsRevision: flags.previsRevision,
        clip: flags.clip,
        take: flags.take,
        assetFile: flags.assetFile,
        sourceTake: flags.sourceTake,
        title: flags.title,
        number: flags.number,
        file,
        scene: flags.scene,
        shotPlan: flags.shotPlan,
        shot: flags.shot,
        asset: flags.asset,
        position: flags.position,
        placement: flags.placement,
      },
      json: flags.json,
      io,
      homeDir: homeDir,
    });
  },
  'studio': async ({ input, flags, io, homeDir }) => {
    const { runStudioCommand } = await loadCommand('studio', () => import('./studio/index.js'));
    return runStudioCommand({
      input,
      project: flags.project,
      resource: flags.resource,
      noBrowser: !flags.browser,
      json: flags.json,
      io,
      homeDir: homeDir,
    });
  },
  'update': async ({ input, flags, io }) => {
    const { runUpdateCommand } = await loadCommand('update', () => import('./update.js'));
    return runUpdateCommand(input, flags.json, io);
  },
  'trash': async ({ input, flags, io, homeDir }) => {
    const { runTrashCommand } = await loadCommand('trash', () => import('./trash-command.js'));
    return runTrashCommand({
      input,
      flags: {
        confirmationToken: flags.confirmationToken,
        dryRun: flags.dryRun,
        olderThanIso: flags.olderThanIso,
        project: flags.project,
        trashItem: flags.trashItem,
      },
      json: flags.json,
      io,
      homeDir: homeDir,
    });
  },
};

export async function dispatchCommand(command: string, options: CommandOptions): Promise<number> {
  const handler = Object.hasOwn(commands, command) ? commands[command] : undefined;
  if (handler) {
    return handler(options);
  }
  options.io.stderr.error(`Unknown command: ${command}`);
  options.io.stderr.error('Run `renku --help` to see available commands.');
  return 1;
}
