import { StructuredError, createDiagnosticError } from '@gorenku/studio-diagnostics';
import type { AssetFileOwner, AssetFileSelectionTarget } from '@gorenku/studio-core/client';
import type { RunAssetFileCommandOptions, AssetFileCommandFlags } from './types.js';

export function parseAssetFileOwner(value: string): AssetFileOwner {
  if (value === 'project') {
    return { kind: 'project' };
  }
  const parts = value.split(':');
  if (parts[0] === 'beat' && parts.length === 3 && parts[1] && parts[2]) {
    return { kind: 'sceneBeat', sceneId: parts[1], beatId: parts[2] };
  }
  if (parts.length !== 2 || !parts[1]) {
    throw invalidOwner(value);
  }
  switch (parts[0]) {
    case 'inspirationFolder':
      return { kind: 'inspirationFolder', id: parts[1] };
    case 'cast':
      return { kind: 'castMember', id: parts[1] };
    case 'location':
      return { kind: 'location', id: parts[1] };
    case 'prop':
      return { kind: 'prop', id: parts[1] };
    case 'scene':
      return { kind: 'scene', id: parts[1] };
    case 'lookbook':
      return { kind: 'lookbook', id: parts[1] };
    case 'shot':
      return { kind: 'shot', id: parts[1] };
    default:
      throw invalidOwner(value);
  }
}

export function parseSelectionTarget(value: string): AssetFileSelectionTarget {
  if (value.startsWith('location-world:')) {
    const id = value.slice('location-world:'.length);
    if (id) {
      return { kind: 'locationWorld', id };
    }
  }
  const owner = parseAssetFileOwner(value);
  if (
    owner.kind === 'project'
    || owner.kind === 'castMember'
    || owner.kind === 'location'
    || owner.kind === 'prop'
    || owner.kind === 'lookbook'
    || owner.kind === 'shot'
    || owner.kind === 'sceneBeat'
  ) {
    return owner;
  }
  throw new StructuredError({
    code: 'CLI046',
    message: `Invalid Asset selection target: ${value}.`,
    issues: [
      createDiagnosticError(
        'CLI046',
        'Asset selection supports the Project, Cast Members, Locations, Location Worlds, Props, Lookbooks, Shots, and Scene Beats.',
        { path: ['--target'], context: 'renku CLI arguments' },
        'Use project, cast:<id>, location:<id>, location-world:<id>, prop:<id>, lookbook:<id>, shot:<id>, or beat:<scene-id>:<beat-id>.'
      ),
    ],
  });
}

export function readLocale(options: RunAssetFileCommandOptions): { localeId?: string } {
  return options.flags.locale ? { localeId: options.flags.locale } : {};
}

export function optionalTrimmed(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function requiredFlag(
  options: RunAssetFileCommandOptions,
  name: keyof AssetFileCommandFlags
): string {
  const value = options.flags[name];
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  throw new StructuredError({
    code: 'CLI041',
    message: `Missing required --${flagName(name)} option.`,
    issues: [
      createDiagnosticError(
        'CLI041',
        `Missing required --${flagName(name)} option.`,
        { path: [`--${flagName(name)}`], context: 'renku CLI arguments' },
        `Pass --${flagName(name)}.`
      ),
    ],
  });
}

export function requiredAssetFileId(assetFileId?: string): string {
  if (assetFileId?.trim()) {
    return assetFileId;
  }
  throw new StructuredError({
    code: 'CLI042',
    message: 'Missing required Asset id.',
    issues: [
      createDiagnosticError(
        'CLI042',
        'Asset update requires an Asset id.',
        { path: ['assetFile'], context: 'renku CLI arguments' },
        'Pass the Asset id as the final positional argument.'
      ),
    ],
  });
}

function invalidOwner(owner: string): StructuredError {
  return new StructuredError({
    code: 'CLI044',
    message: `Invalid Asset owner: ${owner}.`,
    issues: [
      createDiagnosticError(
        'CLI044',
        'Asset owner has an unsupported form.',
        { path: ['--owner'], context: 'renku CLI arguments' },
        'Use project, cast:<id>, location:<id>, sequence:<id>, scene:<id>, lookbook:<id>, shot:<id>, or beat:<scene-id>:<beat-id>.'
      ),
    ],
  });
}

function flagName(name: keyof AssetFileCommandFlags): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export function formatOwner(owner: AssetFileOwner): string {
  if (owner.kind === 'project') {
    return 'project';
  }
  if (owner.kind === 'sceneBeat') {
    return `beat:${owner.sceneId}:${owner.beatId}`;
  }
  return `${owner.kind}:${owner.id}`;
}
