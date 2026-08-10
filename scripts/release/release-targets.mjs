export const RELEASE_TARGETS = Object.freeze([
  Object.freeze({ id: 'darwin-arm64', platform: 'darwin', arch: 'arm64', archive: 'tar.gz' }),
  Object.freeze({ id: 'darwin-x64', platform: 'darwin', arch: 'x64', archive: 'tar.gz' }),
  Object.freeze({ id: 'win32-x64', platform: 'win32', arch: 'x64', archive: 'zip' }),
]);

export const NODE_FLAVORS = Object.freeze([
  'node22',
  'node24',
  'bundled-node24',
]);

export const SUPPORTED_NODE_RANGE = '^22.12.0 || ^24.0.0';

export function requireReleaseTarget(id) {
  const target = RELEASE_TARGETS.find((candidate) => candidate.id === id);
  if (!target) {
    throw new Error(`RELEASE001 Unsupported release target: ${id}`);
  }
  return target;
}

export function requireNodeFlavor(value) {
  if (!NODE_FLAVORS.includes(value)) {
    throw new Error(`RELEASE002 Unsupported Node flavor: ${value}`);
  }
  return value;
}
