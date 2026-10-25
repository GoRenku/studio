/** The first line of every Codex settings file Renku writes; a file without it belongs to the user. */
export const RENKU_CODEX_FILE_HEADER = '# Managed by Renku (`renku codex permissions`).';

/** The Renku folders the Codex permission profile grants. */
export interface RenkuCodexFolders {
  /** Renku's settings folder, holding provider API keys: read only. */
  configDir: string;
  /** Renku's state folder, holding saved provider data and the current Project: writable. */
  stateDir: string;
}

/**
 * The Codex settings file Renku keeps in the Project Library. Codex loads a
 * folder's `.codex/config.toml` only when it works in that trusted folder, so
 * the profile never changes the user's defaults elsewhere. Paths are TOML
 * basic strings, which JSON string syntax produces, so Windows paths are safe.
 */
export function renderRenkuCodexFile(folders: RenkuCodexFolders): string {
  return [
    RENKU_CODEX_FILE_HEADER,
    '# Codex applies these permissions only when it works in this folder.',
    '# Renku refreshes this file on updates; delete the first line to keep your own edits.',
    'default_permissions = "renku-studio"',
    '',
    '[permissions.renku-studio]',
    'description = "Renku: films, settings, state and Studio."',
    'extends = ":workspace"',
    '',
    '[permissions.renku-studio.filesystem]',
    `${JSON.stringify(folders.configDir)} = "read"`,
    `${JSON.stringify(folders.stateDir)} = "write"`,
    '',
    '[permissions.renku-studio.network]',
    'enabled = true',
    'allow_local_binding = true',
    '',
  ].join('\n');
}

export function isRenkuCodexFile(contents: string): boolean {
  return contents.startsWith(RENKU_CODEX_FILE_HEADER);
}
