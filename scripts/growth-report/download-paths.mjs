// The paths the release process publishes on downloads.gorenku.com
// (scripts/release/publish-r2.mjs). The first matching row wins; a row
// without a kind, or no matching row, means the request is not reported.
const DOWNLOAD_PATHS = [
  { pattern: /\.sha256$/ },
  { pattern: /^\/install\.sh$/, kind: 'installer_macos' },
  { pattern: /^\/install\.ps1$/, kind: 'installer_windows' },
  { pattern: /^\/studio\/channels\/beta\/release\.json$/, kind: 'release_manifest' },
  {
    pattern: /^\/studio\/releases\/(?<version>[^/]+)\/(?<target>[^/]+)\/[^/]+$/,
    kind: 'release_archive',
    properties: ({ version, target }) => ({ release_version: version, release_target: target }),
  },
  {
    pattern: /^\/studio\/channels\/(?<channel>beta)\/(?<target>[^/]+)\/[^/]+$/,
    kind: 'release_archive',
    properties: ({ channel, target }) => ({ release_channel: channel, release_target: target }),
  },
];

/** @returns {Record<string, string> | null} download_kind plus release properties, or null when not reported */
export function classifyDownloadPath(path) {
  for (const { pattern, kind, properties } of DOWNLOAD_PATHS) {
    const match = path.match(pattern);
    if (match) {
      return kind ? { download_kind: kind, ...properties?.(match.groups) } : null;
    }
  }
  return null;
}
