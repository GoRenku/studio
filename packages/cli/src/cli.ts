#!/usr/bin/env node
import {
  createDiagnosticError,
  isStructuredError,
  StructuredError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import meow from 'meow';
import { runAboutCommand } from './commands/about-command.js';
import { runAssetCommand } from './commands/asset-command.js';
import { runCastCommand } from './commands/cast-command.js';
import { runCreateCommand } from './commands/create-project-command.js';
import { runDirectorCommand } from './commands/director-command.js';
import { runGenerationCommand } from './commands/generation-command.js';
import { runGenerationPlanCommand } from './commands/generation-plan-command.js';
import { runInitCommand } from './commands/initialize-config-command.js';
import { runInspirationCommand } from './commands/inspiration-command.js';
import { runLookbookCommand } from './commands/lookbook-command.js';
import { runLocationCommand } from './commands/location-command.js';
import { runMediaCommand } from './commands/media-command.js';
import { runProjectInformationCommand } from './commands/project-information-command.js';
import { runProjectSelectionCommand } from './commands/project-selection-command.js';
import { runProductionCommand } from './commands/production-command.js';
import { runProductionDesignCommand } from './commands/production-design-command.js';
import { runScreenplayCommand } from './commands/screenplay-command.js';
import { runStudioCommand } from './commands/studio-command.js';

export interface RenkuCliIo {
  stdout: Pick<typeof console, 'log'>;
  stderr: Pick<typeof console, 'error'>;
}

export interface RunRenkuCliOptions {
  io?: RenkuCliIo;
  homeDir?: string;
}

const defaultIo: RenkuCliIo = {
  stdout: {
    log: (message: string) => {
      process.stdout.write(`${message}\n`);
    },
  },
  stderr: {
    error: (message: string) => {
      process.stderr.write(`${message}\n`);
    },
  },
};

const helpText = `
Usage
  $ renku <command>

Commands
  create <project-name>           Create a clean movie project
  init <storage-root>  Create or inspect the global Renku config
  about                Show Renku CLI package information
  asset                Register, list, and select assets
  cast                 Author cast facts and Cast Design documents
  director context     Show director readiness for the current movie project
  location             Author location facts
  production-design    Author Location Design documents
  production export    Export selected production assets
  info show            Show project information
  info set             Update project information
  info clear           Clear optional project information fields
  info language        Add, update, remove, or set base languages
  inspiration          Manage Inspiration folders and analysis
  generation           Gather media context, inspect models, estimate cost, and run generation
  lookbook             Manage Lookbooks and Lookbook images
  media                Import media files for a purpose
  project current      Show the current authoring project
  project open         Set the current authoring project
  project close        Clear the current authoring project
  project select       Request Studio to select a project
  project migrate      Apply pending project database migrations
  screenplay           Inspect, validate, create, and revise screenplay JSON
  studio current       Show current Studio focus and context
  studio server status Show canonical local Studio server status

Options
  --file               JSON input file for screenplay commands
  --storage-root       Override configured storage root for this command
  --project            Project name for project information commands
  --target             Asset attachment target
  --purpose            Media purpose key
  --reference-name     Relationship-scoped Renku reference name
  --reference-purpose  Relationship-scoped asset purpose text
  --source             Project-relative source file for media import
  --type               Asset type
  --media-kind         Asset media kind
  --provider           Generation provider
  --model              Generation model
  --spec               Media Generation Spec id
  --approval-token     Binding token returned by generation estimate
  --allow-unpriced-cost
                       Approve running generation when no model price is configured
  --receipt            Generation Receipt JSON file
  --role               Asset relationship role
  --file-role          Asset file role
  --order              Selection order
  --locale             Project locale id
  --cast               Cast member id for cast commands
  --voice              Cast Voice id or reference name
  --location           Location id for location and production-design commands
  --design             Cast Design or Location Design id
  --act                Act id for screenplay sequence list
  --analysis           Screenplay Analysis id
  --revision           Screenplay revision id
  --scene              Scene id for scene-owned commands
  --dialogue           Scene dialogue id
  --take               Scene Dialogue Audio take id
  --shot-list          Scene Shot List id
  --shots              Comma-separated shot ids for shot video take generation
  --production-group   Shot video take production group id
  --intent             Shot video take input mode id
  --input              Shot video take reusable input id
  --kind               Shot video take input kind
  --subject-kind       Shot video take input subject kind
  --subject-id         Shot video take input subject id
  --selection          Media import selection: select or take
                       Director context selection: Studio selection JSON
  --include-visual-references
                       Include selected visual references in shot-list context
  --sequence           Sequence id for screenplay scene list
  --folder             Inspiration folder id
  --lookbook           Lookbook id
  --image              Lookbook image id
  --name               Inspiration folder name
  --sections           Comma-separated Lookbook section keys
  --all-locales        Export every locale with production selects
  --all                Apply command to all eligible items
  --dry-run            Report production export operations without writing
  --simulate           Run generation without calling a paid provider
  --fresh              Rebuild production export manifest
  --title              Project title
  --aspect-ratio       Project aspect ratio
  --logline            Project logline
  --summary            Project summary
  --display-name       Language display name
  --base               Mark language as base
  --audio, --no-audio  Toggle language audio support
  --subtitles, --no-subtitles
  --json               Print machine-readable JSON
  --help, -h           Show help
  --version            Show version

Examples
  $ renku create urban-basilica --title "Urban Basilica"
  $ renku init ~/Movies/renku
  $ renku init /Volumes/Media/Renku --json
`;

function createCliFlags() {
  return {
    json: {
      type: 'boolean',
      default: false,
    },
    file: {
      type: 'string',
    },
    storageRoot: {
      type: 'string',
    },
    project: {
      type: 'string',
    },
    title: {
      type: 'string',
    },
    target: {
      type: 'string',
    },
    purpose: {
      type: 'string',
    },
    referenceName: {
      type: 'string',
    },
    referencePurpose: {
      type: 'string',
    },
    source: {
      type: 'string',
    },
    type: {
      type: 'string',
    },
    mediaKind: {
      type: 'string',
    },
    provider: {
      type: 'string',
    },
    model: {
      type: 'string',
    },
    spec: {
      type: 'string',
    },
    approvalToken: {
      type: 'string',
    },
    allowUnpricedCost: {
      type: 'boolean',
      default: false,
    },
    receipt: {
      type: 'string',
    },
    role: {
      type: 'string',
    },
    fileRole: {
      type: 'string',
    },
    order: {
      type: 'number',
    },
    locale: {
      type: 'string',
    },
    cast: {
      type: 'string',
    },
    voice: {
      type: 'string',
    },
    registration: {
      type: 'string',
    },
    location: {
      type: 'string',
    },
    design: {
      type: 'string',
    },
    act: {
      type: 'string',
    },
    analysis: {
      type: 'string',
    },
    revision: {
      type: 'string',
    },
    scene: {
      type: 'string',
    },
    dialogue: {
      type: 'string',
    },
    take: {
      type: 'string',
    },
    shotList: {
      type: 'string',
    },
    shots: {
      type: 'string',
    },
    productionGroup: {
      type: 'string',
    },
    intent: {
      type: 'string',
    },
    input: {
      type: 'string',
    },
    kind: {
      type: 'string',
    },
    subjectKind: {
      type: 'string',
    },
    subjectId: {
      type: 'string',
    },
    selection: {
      type: 'string',
    },
    includeVisualReferences: {
      type: 'boolean',
      default: false,
    },
    active: {
      type: 'boolean',
      default: false,
    },
    sequence: {
      type: 'string',
    },
    folder: {
      type: 'string',
    },
    lookbook: {
      type: 'string',
    },
    image: {
      type: 'string',
    },
    name: {
      type: 'string',
    },
    sections: {
      type: 'string',
    },
    allLocales: {
      type: 'boolean',
      default: false,
    },
    all: {
      type: 'boolean',
      default: false,
    },
    dryRun: {
      type: 'boolean',
      default: false,
    },
    simulate: {
      type: 'boolean',
      default: false,
    },
    fresh: {
      type: 'boolean',
      default: false,
    },
    aspectRatio: {
      type: 'string',
    },
    logline: {
      type: 'string',
    },
    summary: {
      type: 'string',
    },
    displayName: {
      type: 'string',
    },
    base: {
      type: 'boolean',
    },
    audio: {
      type: 'boolean',
    },
    noAudio: {
      type: 'boolean',
    },
    subtitles: {
      type: 'boolean',
    },
    noSubtitles: {
      type: 'boolean',
    },
    help: {
      type: 'boolean',
      shortFlag: 'h',
      default: false,
    },
  } as const;
}

export async function runRenkuCli(
  argv = process.argv.slice(2),
  options: RunRenkuCliOptions = {}
): Promise<number> {
  const io = options.io ?? defaultIo;
  const cliFlags = createCliFlags();
  const cli = meow(helpText, {
    importMeta: import.meta,
    argv,
    autoHelp: false,
    flags: cliFlags,
  });

  const unknownFlags = findUnknownFlags(argv, cli.flags, Object.keys(cliFlags));
  if (!cli.flags.help && unknownFlags.length > 0) {
    writeStructuredError(
      new StructuredError({
        code: 'CLI005',
        message: 'Unknown CLI flag.',
        issues: unknownFlags.map((flag) =>
          createDiagnosticError(
            'CLI005',
            `Unknown flag: ${flag}.`,
            { path: ['arguments', flag], context: 'renku CLI arguments' },
            'Run renku --help to see supported flags.'
          )
        ),
      }),
      cli.flags.json,
      io
    );
    return 1;
  }

  if (cli.flags.help || cli.input[0] === 'help' || cli.input.length === 0) {
    io.stdout.log(cli.help);
    return 0;
  }

  const [command, ...input] = cli.input;

  try {
    switch (command) {
      case 'create':
        return await runCreateCommand({
          input,
          file: cli.flags.file,
          title: cli.flags.title,
          aspectRatio: cli.flags.aspectRatio,
          logline: cli.flags.logline,
          summary: cli.flags.summary,
          storageRoot: cli.flags.storageRoot,
          json: cli.flags.json,
          io,
          homeDir: options.homeDir,
        });
      case 'init':
        return await runInitCommand({
          input,
          json: cli.flags.json,
          io,
          homeDir: options.homeDir,
        });
      case 'about':
        return await runAboutCommand({ io });
      case 'asset':
        return await runAssetCommand({
          input,
          flags: {
            project: cli.flags.project,
            target: cli.flags.target,
            type: cli.flags.type,
            mediaKind: cli.flags.mediaKind,
            role: cli.flags.role,
            fileRole: cli.flags.fileRole,
            file: cli.flags.file,
            title: cli.flags.title,
            summary: cli.flags.summary,
            referenceName: cli.flags.referenceName,
            referencePurpose: cli.flags.referencePurpose,
            locale: cli.flags.locale,
            order: cli.flags.order,
          },
          json: cli.flags.json,
          io,
          homeDir: options.homeDir,
        });
      case 'cast':
        return await runCastCommand({
          input,
          flags: {
            file: cli.flags.file,
            project: cli.flags.project,
            cast: cli.flags.cast,
            voice: cli.flags.voice,
            registration: cli.flags.registration,
            approvalToken: cli.flags.approvalToken,
            simulate: cli.flags.simulate,
            design: cli.flags.design,
            active: cli.flags.active,
            dryRun: cli.flags.dryRun,
          },
          json: cli.flags.json,
          io,
          homeDir: options.homeDir,
        });
      case 'director':
        return await runDirectorCommand({
          input,
          flags: {
            selection: cli.flags.selection,
          },
          json: cli.flags.json,
          io,
          homeDir: options.homeDir,
        });
      case 'info':
        return await runProjectInformationCommand({
          input,
          flags: {
            project: cli.flags.project,
            title: cli.flags.title,
            aspectRatio: cli.flags.aspectRatio,
            logline: cli.flags.logline,
            summary: cli.flags.summary,
            displayName: cli.flags.displayName,
            base: cli.flags.base,
            audio: cli.flags.audio,
            noAudio: cli.flags.noAudio,
            subtitles: cli.flags.subtitles,
            noSubtitles: cli.flags.noSubtitles,
          },
          json: cli.flags.json,
          io,
          homeDir: options.homeDir,
        });
      case 'production':
        return await runProductionCommand({
          input,
          flags: {
            project: cli.flags.project,
            locale: cli.flags.locale,
            allLocales: cli.flags.allLocales,
            dryRun: cli.flags.dryRun,
            fresh: cli.flags.fresh,
          },
          json: cli.flags.json,
          io,
          homeDir: options.homeDir,
        });
      case 'production-design':
        return await runProductionDesignCommand({
          input,
          flags: {
            file: cli.flags.file,
            location: cli.flags.location,
            design: cli.flags.design,
            active: cli.flags.active,
          },
          json: cli.flags.json,
          io,
          homeDir: options.homeDir,
        });
      case 'inspiration':
        return await runInspirationCommand({
          input,
          flags: {
            file: cli.flags.file,
            folder: cli.flags.folder,
            name: cli.flags.name,
            project: cli.flags.project,
          },
          json: cli.flags.json,
          io,
          homeDir: options.homeDir,
        });
      case 'generation':
        if (input[0] === 'plan') {
          return await runGenerationPlanCommand({
            input,
            flags: {
              project: cli.flags.project,
              purpose: cli.flags.purpose,
              target: cli.flags.target,
              model: cli.flags.model,
              shotList: cli.flags.shotList,
              shots: cli.flags.shots,
              productionGroup: cli.flags.productionGroup,
              intent: cli.flags.intent,
            },
            json: cli.flags.json,
            io,
            homeDir: options.homeDir,
          });
        }
        return await runGenerationCommand({
          input,
          flags: {
            project: cli.flags.project,
            purpose: cli.flags.purpose,
            target: cli.flags.target,
            mediaKind: cli.flags.mediaKind,
            provider: cli.flags.provider,
            model: cli.flags.model,
            file: cli.flags.file,
            spec: cli.flags.spec,
            shotList: cli.flags.shotList,
            shots: cli.flags.shots,
            productionGroup: cli.flags.productionGroup,
            intent: cli.flags.intent,
            input: cli.flags.input,
            kind: cli.flags.kind,
            subjectKind: cli.flags.subjectKind,
            subjectId: cli.flags.subjectId,
            approvalToken: cli.flags.approvalToken,
            allowUnpricedCost: cli.flags.allowUnpricedCost,
            simulate: cli.flags.simulate,
          },
          json: cli.flags.json,
          io,
          homeDir: options.homeDir,
        });
      case 'lookbook':
        return await runLookbookCommand({
          input,
          flags: {
            file: cli.flags.file,
            image: cli.flags.image,
            lookbook: cli.flags.lookbook,
            name: cli.flags.name,
            project: cli.flags.project,
            sections: cli.flags.sections,
          },
          json: cli.flags.json,
          io,
          homeDir: options.homeDir,
        });
      case 'media':
        return await runMediaCommand({
          input,
          flags: {
            project: cli.flags.project,
            purpose: cli.flags.purpose,
            target: cli.flags.target,
            file: cli.flags.file,
            source: cli.flags.source,
            title: cli.flags.title,
            summary: cli.flags.summary,
            referenceName: cli.flags.referenceName,
            referencePurpose: cli.flags.referencePurpose,
            sections: cli.flags.sections,
            receipt: cli.flags.receipt,
            shotList: cli.flags.shotList,
            shots: cli.flags.shots,
            selection: cli.flags.selection,
          },
          json: cli.flags.json,
          io,
          homeDir: options.homeDir,
        });
      case 'location':
        return await runLocationCommand({
          input,
          flags: {
            file: cli.flags.file,
            location: cli.flags.location,
            dryRun: cli.flags.dryRun,
          },
          json: cli.flags.json,
          io,
          homeDir: options.homeDir,
        });
      case 'project':
        return await runProjectSelectionCommand({
          input,
          storageRoot: cli.flags.storageRoot,
          json: cli.flags.json,
          io,
          homeDir: options.homeDir,
        });
      case 'screenplay':
        return await runScreenplayCommand({
          input,
          flags: {
            file: cli.flags.file,
            act: cli.flags.act,
            active: cli.flags.active,
            analysis: cli.flags.analysis,
            revision: cli.flags.revision,
            scene: cli.flags.scene,
            shotList: cli.flags.shotList,
            includeVisualReferences: cli.flags.includeVisualReferences,
            sequence: cli.flags.sequence,
            dryRun: cli.flags.dryRun,
          },
          json: cli.flags.json,
          io,
          homeDir: options.homeDir,
        });
      case 'studio':
        return await runStudioCommand({
          input,
          json: cli.flags.json,
          io,
          homeDir: options.homeDir,
        });
      case 'visual-language':
        throw new StructuredError({
          code: 'CLI091',
          message: 'The visual-language command has been removed.',
          issues: [
            createDiagnosticError(
              'CLI091',
              'The visual-language command has been removed.',
              { path: ['visual-language'] },
              'Use top-level `renku inspiration ...` and `renku lookbook ...` commands.'
            ),
          ],
          suggestion:
            'Use top-level `renku inspiration ...` and `renku lookbook ...` commands.',
        });
      default:
        io.stderr.error(`Unknown command: ${command}`);
        io.stderr.error('Run `renku --help` to see available commands.');
        return 1;
    }
  } catch (error) {
    if (isStructuredError(error)) {
      writeStructuredError(error, cli.flags.json, io);
      return 1;
    }
    io.stderr.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function findUnknownFlags(
  argv: string[],
  receivedFlags: Record<string, unknown>,
  knownFlags: string[]
): string[] {
  const knownFlagSet = new Set(knownFlags);
  const unknownFlagSet = new Set(
    Object.keys(receivedFlags).filter((flag) => !knownFlagSet.has(flag))
  );
  const unknownTokens = argv
    .slice(0, argv.indexOf('--') === -1 ? argv.length : argv.indexOf('--'))
    .filter((argument) => unknownFlagSet.has(normalizeFlagToken(argument)));

  if (unknownTokens.length > 0) {
    return Array.from(new Set(unknownTokens));
  }

  return Array.from(unknownFlagSet, formatUnknownFlagName);
}

function normalizeFlagToken(argument: string): string {
  if (!argument.startsWith('-') || argument === '-') {
    return '';
  }
  const flagName = argument.replace(/^-+/, '').split('=')[0] ?? '';
  return toCamelCase(flagName.startsWith('no-') ? flagName.slice(3) : flagName);
}

function formatUnknownFlagName(flagName: string): string {
  return `--${flagName.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

function toCamelCase(flagName: string): string {
  return flagName.replace(/-([a-zA-Z0-9])/g, (_match, letter: string) =>
    letter.toUpperCase()
  );
}

function writeStructuredError(
  error: StructuredError,
  json: boolean,
  io: RenkuCliIo
): void {
  if (json) {
    io.stderr.error(
      JSON.stringify(
        {
          valid: false,
          error: {
            code: error.code,
            message: error.message,
            suggestion: error.suggestion,
          },
          issues: error.issues,
          errors: error.issues.filter((issue) => issue.severity === 'error'),
          warnings: error.issues.filter((issue) => issue.severity === 'warning'),
        },
        null,
        2
      )
    );
  } else {
    io.stderr.error(formatStructuredError(error));
  }
}

function formatStructuredError(error: {
  code: string;
  message: string;
  issues: DiagnosticIssue[];
  suggestion?: string;
}): string {
  const lines = [`[${error.code}] ${error.message}`];
  for (const issue of error.issues) {
    lines.push(formatDiagnosticIssue(issue));
  }
  if (error.suggestion) {
    lines.push(`Suggestion: ${error.suggestion}`);
  }
  return lines.join('\n');
}

export function formatDiagnosticIssue(issue: DiagnosticIssue): string {
  const location = formatDiagnosticLocation(issue.location.path);
  const suggestion = issue.suggestion ? ` Suggestion: ${issue.suggestion}` : '';
  return `[${issue.code}] ${issue.severity.toUpperCase()} ${location}: ${issue.message}${suggestion}`;
}

function formatDiagnosticLocation(path: string[]): string {
  if (path.length === 0) {
    return '<root>';
  }
  return path.reduce((label, segment) => {
    if (/^\d+$/.test(segment)) {
      return `${label}[${segment}]`;
    }
    return label ? `${label}.${segment}` : segment;
  }, '');
}

const isEntrypoint = process.argv[1]?.endsWith('/cli.js') ?? false;

if (isEntrypoint) {
  runRenkuCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
