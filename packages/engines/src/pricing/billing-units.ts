import type { PriceQuantity, PriceUnit } from './contracts.js';

/** How one provider billing unit is counted from a native request, and its share of a price unit. */
export interface BillingUnit {
  unit: PriceUnit;
  quantity: PriceQuantity;
  perUnit: number;
}

/**
 * The billing units providers publish, counted from common native request
 * fields. Provider pricing modules map their own unit names onto these keys.
 */
export const BILLING_UNITS = {
  image: { unit: 'image', quantity: { kind: 'field', pointer: '/num_images', default: 1 }, perUnit: 1 },
  request: { unit: 'request', quantity: { kind: 'constant', value: 1 }, perUnit: 1 },
  megapixel: { unit: 'megapixel', quantity: { kind: 'imageMegapixels', countPointer: '/num_images' }, perUnit: 1 },
  second: { unit: 'second', quantity: { kind: 'field', pointer: '/duration' }, perUnit: 1 },
  minute: { unit: 'second', quantity: { kind: 'field', pointer: '/duration' }, perUnit: 1 / 60 },
  character: { unit: 'character', quantity: { kind: 'characters', pointer: '/text' }, perUnit: 1 },
  thousandCharacters: { unit: 'character', quantity: { kind: 'characters', pointer: '/text' }, perUnit: 1 / 1000 },
} as const satisfies Record<string, BillingUnit>;

export type BillingUnitKey = keyof typeof BILLING_UNITS;
