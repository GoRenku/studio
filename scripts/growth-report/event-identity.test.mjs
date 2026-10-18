import assert from 'node:assert/strict';
import test from 'node:test';
import { growthEventUuid, uuidV5 } from './event-identity.mjs';

const DNS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const VERSION_5 = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('uuidV5 matches the published DNS example', () => {
  assert.equal(uuidV5(DNS_NAMESPACE, 'www.example.com'), '2ed6657d-e927-568b-95e1-2665a8aea6a2');
});

test('growth event ids are stable version 5 UUIDs', () => {
  const key = ['github_views_day', 'GoRenku/studio', '2026-10-17'];
  assert.match(growthEventUuid(key), VERSION_5);
  assert.equal(growthEventUuid(key), growthEventUuid([...key]));
});

test('every key part changes the id, including letter case', () => {
  const keys = [
    ['github_views_day', 'GoRenku/studio', '2026-10-17'],
    ['github_views_day', 'GoRenku/studio-skills', '2026-10-17'],
    ['github_views_day', 'GoRenku/studio', '2026-10-16'],
    ['github_star_week', 'GoRenku/studio', 1791676800],
    ['github_top_path', 'GoRenku/studio', '2026-10-18', '/GoRenku/studio'],
    ['github_top_path', 'GoRenku/studio', '2026-10-18', '/gorenku/studio'],
    ['download_requests_day', 'downloads.gorenku.com', '2026-10-17', '/install.sh', 'DE'],
    ['download_requests_day', 'downloads.gorenku.com', '2026-10-17', '/install.sh', 'US'],
  ];
  assert.equal(new Set(keys.map(growthEventUuid)).size, keys.length);
});
