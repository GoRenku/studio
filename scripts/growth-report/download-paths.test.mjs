import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyDownloadPath } from './download-paths.mjs';

test('installers and the release manifest have their own kinds', () => {
  assert.deepEqual(classifyDownloadPath('/install.sh'), { download_kind: 'installer_macos' });
  assert.deepEqual(classifyDownloadPath('/install.ps1'), { download_kind: 'installer_windows' });
  assert.deepEqual(classifyDownloadPath('/studio/channels/beta/release.json'), { download_kind: 'release_manifest' });
});

test('immutable release archives carry version and target', () => {
  assert.deepEqual(classifyDownloadPath('/studio/releases/0.1.26/darwin-arm64/renku-0.1.26-darwin-arm64.tar.gz'), {
    download_kind: 'release_archive',
    release_version: '0.1.26',
    release_target: 'darwin-arm64',
  });
});

test('beta channel archives carry channel and target', () => {
  assert.deepEqual(classifyDownloadPath('/studio/channels/beta/win32-x64/renku-win32-x64.zip'), {
    download_kind: 'release_archive',
    release_channel: 'beta',
    release_target: 'win32-x64',
  });
});

test('checksums and unknown paths are not reported', () => {
  assert.equal(classifyDownloadPath('/studio/releases/0.1.26/darwin-arm64/renku.tar.gz.sha256'), null);
  assert.equal(classifyDownloadPath('/studio/channels/beta/win32-x64/renku.zip.sha256'), null);
  assert.equal(classifyDownloadPath('/wp-login.php'), null);
  assert.equal(classifyDownloadPath('/'), null);
  assert.equal(classifyDownloadPath('/studio/releases/0.1.26/renku.tar.gz'), null);
});
