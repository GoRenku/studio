import { createHash } from 'node:crypto';

// Part of the event contract: changing it breaks merging with events already
// stored in PostHog.
const GROWTH_EVENT_NAMESPACE = '268ee6c6-e0d3-4c92-90b4-aca38b48d0b7';

/** RFC 9562 version 5 (SHA-1, name-based) UUID. */
export function uuidV5(namespace, name) {
  const namespaceBytes = Buffer.from(namespace.replaceAll('-', ''), 'hex');
  const hash = createHash('sha1').update(namespaceBytes).update(name, 'utf8').digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function growthEventUuid(keyParts) {
  return uuidV5(GROWTH_EVENT_NAMESPACE, JSON.stringify(keyParts));
}
