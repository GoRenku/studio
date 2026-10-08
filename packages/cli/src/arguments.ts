import meow from 'meow';
import { createDiagnosticError, StructuredError } from '@gorenku/studio-diagnostics';

const helpText = `
Usage
  $ renku <command>

Commands
  create <project-name>           Create a clean movie project
  init <storage-root>  Create or inspect the global Renku config
  about                Show Renku CLI package information
  asset                Import, list, update, and select retained files
  cast                 Author cast facts and Cast Design documents
  director context     Show director readiness for the current movie project
  location             Author location facts and generate 3D Worlds
  prop                 Author Prop facts
  production-design    Author Location and Prop Design documents
  info show            Show project information
  info set             Update project information
  info clear           Clear optional project information fields
  info language        Add, update, remove, or set base languages
  settings show        Show the complete Project Settings document
  settings set         Replace Project Settings from a complete JSON document
  credentials status   Show which provider API keys are saved
  inspiration          Manage Inspiration folders and analysis
  generation           Discover models, read context/schema, cache visuals, validate, preview, execute, or recover
  lookbook             Manage Lookbooks and Lookbook images
  media                Import media files for a purpose
  project current      Show the current authoring project
  project open         Set the current authoring project
  project close        Clear the current authoring project
  project select       Request Studio to select a project
  project migrate      Apply pending project database migrations
  screenplay           Inspect, import, create, and revise screenplay content
  shot-plan            Author and inspect Shot List and Previs plans
  shot-plan previs show     Read source paths and rendered revisions
  shot-plan previs register Register a completed render and source snapshot
  shot-plan reference import Register --source image/video/audio with --media-kind, --title and exact --shot-plan; Previs requires --previs-revision
  shot-plan clip list      Read numbered raw clips for --shot-plan and --previs-revision
  shot-plan clip create    Add a raw clip slot to the specified Previs revision
  shot-plan clip take add  Assign --asset-file to --clip; optional --title/--source-take
  shot-plan clip take resolve Resolve --number 1.1 in the specified plan/revision
  shot-plan clip take select Select --take for --clip
  shot-plan clip take clear Clear the selected take for --clip
  shot-plan clip take update Set the short --title of --take
  media import --clip      Atomically attach and register a raw take; optional --take-title/--source-take
  studio current       Show current Studio focus and context
  studio start         Start the local Renku Studio web application
  studio stop          Stop the local Renku Studio server
  update               Update Renku and its Claude/Codex plugins
  update skills        Update Renku's Claude/Codex plugins
  studio server status Show canonical local Studio server status
  trash                List, restore, preview, and empty Trash

Options
  --file               Input document or generation visualization cache descriptor
  --storage-root       Override configured storage root for this command
  --project            Project name for project information commands
  --owner              Asset owner for Asset listing
  --limit              Maximum Asset rows to return in one page
  --cursor             Opaque cursor from the previous Asset listing page
  --target             Generation target or Asset selection target
  --purpose            Media purpose key
  --reference-name     Asset reference name
  --tag                 Repeatable Asset intended-use tag
  --clear-tags          Clear all Asset intended-use tags
  --source             Project-relative source file for media import
  --turns              Dialogue turn number or inclusive range for Shot Plan Audio
  --previs-revision    Exact registered Previs revision for a Shot Plan video
  --resource           Studio resource key for notify-refresh
  --source-sheet       Source Location Sheet asset id for Location Hero import
  --type               Asset type
  --media-kind         Asset media kind
  --output             Provider output directory, schema snapshot, or visualization HTML path
  --request-id         Provider request id for generation recovery
  --expected-request-sha256  Request digest returned by generation prepare or validate
  --provider           Provider id for generation schema or model discovery
  --model              Exact provider-native model id
  --route-index        Bundled route index for generation models (repeatable)
  --query              Match generation model identities and display names
  --if-revision        Personal library SHA-256 revision, or absent
  --schema             Provider schema JSON for generation visualization cache updates
  --template           HTML fragment for generation visualization cache updates
  --payload            Fresh request payload JSON for generation visualization preparation
  --provenance         Media Generation Provenance JSON file
  --locale             Project locale id
  --cast               Cast member id for cast commands
  --voice              Cast Voice id or reference name
  --location           Location id for location and production-design commands
  --prop               Prop id for prop and production-design commands
  --design             Cast, Location, or Prop Design id
  --act                Act id for screenplay sequence list
  --analysis           Screenplay Analysis id
  --revision           Screenplay revision id
  --scene              Scene id for scene-owned commands
  --number             Production scene number for scene-number resolve
  --revision           Scene Beats revision id
  --shot-plan          Shot Plan id
  --shot               Shot id
  --asset-file         Retained file id
  --position           One-based Shot position
  --placement          Shot add placement: start, end, before, or after
  --beats              Comma-separated Beat ids for storyboard imports
  --beat               Repeatable Beat id for generation context
  --kind               Lookbook role
  --selection          Media import selection: select or take
                       Director context selection: Studio selection JSON
  --replace-selected   Replace the currently selected prepared input in the same slot
  --select             Select an imported canonical Asset
  --include-visual-references
                       Include selected visual references in Scene Beats revision context
  --sequence           Sequence id for screenplay scene list
  --folder             Inspiration folder id
  --lookbook           Lookbook id
  --image              Lookbook image id
  --trash-item         Trash item id to restore
  --confirmation-token Empty Trash confirmation token from preview
  --older-than-iso     ISO timestamp cutoff for Empty Trash preview/run
  --name               Inspiration folder name
  --sections           Comma-separated Lookbook section keys
  --anchor             Production Lookbook point id for Lookbook image placement
  --dry-run            Validate an operation without writing
  --no-browser         Do not open a browser when starting Studio
  --title              Project title
  --aspect-ratio       Project aspect ratio
  --logline            Project logline
  --synopsis           Project synopsis
  --premise            Project premise
  --intended-audience  Intended audience
  --format             Project format
  --target-runtime-minutes
                       Intended finished runtime in minutes
  --primary-genre      Primary genre
  --secondary-genres   Comma-separated secondary genres
  --tones              Comma-separated tones
  --content-rating-intent
                       Content rating intent
  --creative-boundaries
                       Comma-separated creative boundaries
  --central-conflict   Central conflict
  --dramatic-question  Dramatic question
  --themes             Comma-separated themes
  --historical-basis   Comma-separated historical basis notes
  --dramatized-elements
                       Comma-separated dramatized elements
  --screenplay-draft-status
                       Screenplay draft status
  --research-sources   Comma-separated research sources
  --assumptions        Comma-separated assumptions
  --open-questions     Comma-separated open questions
  --next-steps         Comma-separated next steps
  --display-name       Language display name
  --base               Mark language as base
  --audio, --no-audio  Toggle language audio support
  --subtitles, --no-subtitles
  --json               Print machine-readable JSON
  --help, -h           Show help
  --version            Show version

Examples
  $ renku create midnight-crossing --title "Midnight Crossing"
  $ renku init ~/Movies/Renku
  $ renku init /Volumes/Media/Renku --json
  $ renku generation preview show --file tmp/operations/media-generation/sheet-1.json --project midnight-crossing --json
  $ renku screenplay supporting-material import --file /absolute/path/to/research.pdf --project midnight-crossing --json
`;

function createCliFlags() {
  return {
    json: {
      type: 'boolean',
      default: false,
    },
    file: {
      type: 'string',
      isMultiple: true,
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
    tag: {
      type: 'string',
      isMultiple: true,
    },
    clearTags: {
      type: 'boolean',
      default: false,
    },
    source: {
      type: 'string',
    },
    turns: {
      type: 'string',
    },
    clip: { type: 'string' },
    sourceTake: { type: 'string' },
    takeTitle: { type: 'string' },
    previsRevision: {
      type: 'string',
    },
    resource: {
      type: 'string',
      isMultiple: true,
    },
    type: {
      type: 'string',
    },
    mediaKind: {
      type: 'string',
    },
    output: {
      type: 'string',
    },
    requestId: {
      type: 'string',
    },
    expectedRequestSha256: {
      type: 'string',
    },
    provider: {
      type: 'string',
    },
    model: {
      type: 'string',
    },
    schema: {
      type: 'string',
    },
    template: {
      type: 'string',
    },
    payload: {
      type: 'string',
    },
    routeIndex: {
      type: 'string',
      isMultiple: true,
    },
    query: {
      type: 'string',
    },
    ifRevision: {
      type: 'string',
    },
    provenance: {
      type: 'string',
    },
    sourceSheet: {
      type: 'string',
    },
    owner: {
      type: 'string',
    },
    limit: {
      type: 'number',
    },
    cursor: {
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
    location: {
      type: 'string',
    },
    prop: {
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
    scene: {
      type: 'string',
    },
    number: {
      type: 'string',
    },
    dialogue: {
      type: 'string',
    },
    take: {
      type: 'string',
    },
    revision: {
      type: 'string',
    },
    shotPlan: {
      type: 'string',
    },
    shot: {
      type: 'string',
    },
    assetFile: {
      type: 'string',
    },
    position: {
      type: 'number',
    },
    placement: {
      type: 'string',
    },
    beats: {
      type: 'string',
    },
    beat: {
      type: 'string',
      isMultiple: true,
    },
    kind: {
      type: 'string',
    },
    selection: {
      type: 'string',
    },
    replaceSelected: {
      type: 'boolean',
      default: false,
    },
    select: {
      type: 'boolean',
      default: false,
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
    trashItem: {
      type: 'string',
    },
    confirmationToken: {
      type: 'string',
    },
    olderThanIso: {
      type: 'string',
    },
    name: {
      type: 'string',
    },
    sections: {
      type: 'string',
    },
    anchor: {
      type: 'string',
    },
    dryRun: {
      type: 'boolean',
      default: false,
    },
    browser: {
      type: 'boolean',
      default: true,
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
    synopsis: {
      type: 'string',
    },
    premise: {
      type: 'string',
    },
    intendedAudience: {
      type: 'string',
    },
    format: {
      type: 'string',
    },
    targetRuntimeMinutes: {
      type: 'string',
    },
    primaryGenre: {
      type: 'string',
    },
    secondaryGenres: {
      type: 'string',
    },
    tones: {
      type: 'string',
    },
    contentRatingIntent: {
      type: 'string',
    },
    creativeBoundaries: {
      type: 'string',
    },
    centralConflict: {
      type: 'string',
    },
    dramaticQuestion: {
      type: 'string',
    },
    themes: {
      type: 'string',
    },
    historicalBasis: {
      type: 'string',
    },
    dramatizedElements: {
      type: 'string',
    },
    screenplayDraftStatus: {
      type: 'string',
    },
    researchSources: {
      type: 'string',
    },
    assumptions: {
      type: 'string',
    },
    openQuestions: {
      type: 'string',
    },
    nextSteps: {
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

export function parseCliArguments(argv: string[]) {
  const flags = createCliFlags();
  const cli = meow(helpText, { importMeta: import.meta, argv, autoHelp: false, flags });
  return { cli, unknownFlags: findUnknownFlags(argv, cli.flags, Object.keys(flags)) };
}

export type CliFlags = ReturnType<typeof parseCliArguments>['cli']['flags'];

export function singleCommandFlagValue(
  values: readonly string[] | undefined,
  flagName: '--file'
): string | undefined {
  if (!values) {
    return undefined;
  }
  if (values.length > 1) {
    const suggestion = `Pass one ${flagName} value, or use generation preview show to review several requests together.`;
    throw new StructuredError({
      code: 'CLI154',
      message: `Repeated ${flagName} values are supported only by generation preview show.`,
      issues: [
        createDiagnosticError(
          'CLI154',
          `The ${flagName} flag was provided more than once for a scalar command.`,
          { path: ['arguments', flagName], context: 'renku CLI arguments' },
          suggestion
        ),
      ],
      suggestion,
    });
  }
  return values[0];
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
