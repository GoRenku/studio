import type { JsonValue } from '../media/contracts.js';
import { EngineError } from '../shared/errors.js';
import { PRICE_UNITS, type PriceComponent, type PriceQuantity, type PriceTier, type RoutePrice } from './contracts.js';

/** Validates a recorded or provider-derived route price; every issue is reported together. */
export function parseRoutePrice(value: unknown, owner: { provider: string; model: string }): RoutePrice {
  const issues: string[] = [];
  if (!isRecord(value)) {
    throw invalidPrice(owner, ['The price must be a JSON object.']);
  }
  if (value.currency !== 'USD') {issues.push('currency must be "USD".');}
  if (!Array.isArray(value.components)) {issues.push('components must be an array.');}
  const components = Array.isArray(value.components)
    ? value.components.map((component, index) => readComponent(component, `components[${index}]`, issues))
    : [];
  const source = isRecord(value.source) ? value.source : undefined;
  if (!source || (source.kind !== 'providerApi' && source.kind !== 'recorded')) {issues.push('source.kind must be providerApi or recorded.');}
  if (!source || !isTimestamp(source.observedAt)) {issues.push('source.observedAt must be an ISO timestamp.');}
  if (source?.url !== undefined && typeof source.url !== 'string') {issues.push('source.url must be a string.');}
  if (!isTimestamp(value.expiresAt)) {issues.push('expiresAt must be an ISO timestamp.');}
  if (!Array.isArray(value.notes) || value.notes.some((note) => typeof note !== 'string')) {issues.push('notes must be an array of strings.');}
  if (issues.length > 0) {
    throw invalidPrice(owner, issues);
  }
  return {
    currency: 'USD',
    components: components as PriceComponent[],
    source: {
      kind: source!.kind as RoutePrice['source']['kind'],
      ...(typeof source!.url === 'string' ? { url: source!.url } : {}),
      observedAt: source!.observedAt as string,
    },
    expiresAt: value.expiresAt as string,
    notes: value.notes as string[],
  };
}

function readComponent(value: unknown, path: string, issues: string[]): PriceComponent | undefined {
  if (!isRecord(value)) {
    issues.push(`${path} must be an object.`);
    return undefined;
  }
  if (!PRICE_UNITS.includes(value.unit as never)) {issues.push(`${path}.unit must be one of ${PRICE_UNITS.join(', ')}.`);}
  if (!isPrice(value.unitPriceUsd)) {issues.push(`${path}.unitPriceUsd must be a non-negative number.`);}
  const quantity = readQuantity(value.quantity, `${path}.quantity`, issues);
  const tiers = value.tiers === undefined ? undefined : readTiers(value.tiers, `${path}.tiers`, issues);
  return {
    unit: value.unit as PriceComponent['unit'],
    unitPriceUsd: value.unitPriceUsd as number,
    quantity: quantity as PriceQuantity,
    ...(tiers ? { tiers } : {}),
  };
}

function readQuantity(value: unknown, path: string, issues: string[]): PriceQuantity | undefined {
  if (!isRecord(value)) {
    issues.push(`${path} must be an object.`);
    return undefined;
  }
  if (value.kind === 'constant' && isPrice(value.value)) {return { kind: 'constant', value: value.value };}
  if (value.kind === 'field' && isPointer(value.pointer) && (value.default === undefined || isPrice(value.default))) {
    return { kind: 'field', pointer: value.pointer, ...(value.default === undefined ? {} : { default: value.default as number }) };
  }
  if (value.kind === 'characters' && isPointer(value.pointer)) {return { kind: 'characters', pointer: value.pointer };}
  if (value.kind === 'imageMegapixels' && (value.countPointer === undefined || isPointer(value.countPointer))) {
    return { kind: 'imageMegapixels', ...(value.countPointer === undefined ? {} : { countPointer: value.countPointer as string }) };
  }
  issues.push(`${path} must be a constant, field, characters or imageMegapixels quantity with valid JSON Pointers.`);
  return undefined;
}

function readTiers(value: unknown, path: string, issues: string[]): PriceTier[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push(`${path} must be a non-empty array.`);
    return undefined;
  }
  return value.flatMap((tier, index) => {
    if (!isRecord(tier) || !isRecord(tier.when) || Object.keys(tier.when).length === 0
      || !Object.keys(tier.when).every(isPointer) || !isPrice(tier.unitPriceUsd)) {
      issues.push(`${path}[${index}] must have a non-empty when map of JSON Pointers and a non-negative unitPriceUsd.`);
      return [];
    }
    return [{ when: tier.when as Record<string, JsonValue>, unitPriceUsd: tier.unitPriceUsd }];
  });
}

function invalidPrice(owner: { provider: string; model: string }, issues: string[]): EngineError {
  return new EngineError('ENGINE_PRICE_INVALID', `The price for ${owner.provider}/${owner.model} is invalid: ${issues.join(' ')}`, {
    provider: owner.provider,
    model: owner.model,
    details: issues,
  });
}

function isPrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isPointer(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('/') && value.length > 1;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
