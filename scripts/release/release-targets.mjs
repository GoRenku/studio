import path from 'node:path';

export const RELEASE_TARGETS = Object.freeze([
  Object.freeze({ id: 'darwin-arm64', platform: 'darwin', arch: 'arm64', archive: 'tar.gz' }),
  Object.freeze({ id: 'darwin-x64', platform: 'darwin', arch: 'x64', archive: 'tar.gz' }),
  Object.freeze({ id: 'win32-x64', platform: 'win32', arch: 'x64', archive: 'zip' }),
]);

export const SUPPORTED_NODE_RANGE = '^22.12.0 || ^24.0.0';
export const BUNDLED_NODE_VERSION = '24.16.0';

export function requireReleaseTarget(id) {
  const target = RELEASE_TARGETS.find((candidate) => candidate.id === id);
  if (!target) {
    throw new Error(`RELEASE001 Unsupported release target: ${id}`);
  }
  return target;
}

export function requireHostReleaseTarget() {
  const target = RELEASE_TARGETS.find(
    (candidate) => candidate.platform === process.platform && candidate.arch === process.arch
  );
  if (!target) {
    throw new Error(
      `RELEASE087 Local releases are not supported from ${process.platform}-${process.arch}.`
    );
  }
  return target;
}

export function isHostReleaseTarget(target) {
  return target.platform === process.platform && target.arch === process.arch;
}

export function targetNodeExecutable(root, target) {
  return target.platform === 'win32'
    ? path.join(root, 'node.exe')
    : path.join(root, 'bin', 'node');
}
