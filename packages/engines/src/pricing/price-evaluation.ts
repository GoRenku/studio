import type { JsonValue } from '../media/contracts.js';
import type { PriceComponent, PriceQuantity, PriceTier, RoutePrice } from './contracts.js';
import { guessImageMegapixels } from './image-megapixels.js';

export type PriceEvaluation =
  | { kind: 'computed'; amountUsd: number; basis: string }
  | { kind: 'unpriced'; note: string };

/**
 * Evaluates a route price against one native request with the closed unit and
 * quantity vocabulary. Anything it cannot express stays unpriced.
 */
export function evaluateRoutePrice(price: RoutePrice, request: JsonValue): PriceEvaluation {
  if (price.components.length === 0) {
    return { kind: 'unpriced', note: price.notes[0] ?? 'This price cannot be computed for a request.' };
  }
  let amountUsd = 0;
  const parts: string[] = [];
  for (const component of price.components) {
    const evaluated = evaluateComponent(component, request);
    if (evaluated.kind === 'unpriced') {return evaluated;}
    amountUsd += evaluated.amountUsd;
    parts.push(evaluated.basis);
  }
  return { kind: 'computed', amountUsd: roundUsd(amountUsd), basis: parts.join(' + ') };
}

function evaluateComponent(component: PriceComponent, request: JsonValue): PriceEvaluation {
  const unitPriceUsd = component.tiers ? matchingTier(component.tiers, request)?.unitPriceUsd : component.unitPriceUsd;
  if (unitPriceUsd === undefined) {
    return { kind: 'unpriced', note: `No ${component.unit} price tier matches this request.` };
  }
  if (component.quantity.kind === 'imageMegapixels') {
    return evaluateImageMegapixels(component.quantity.countPointer, unitPriceUsd, request);
  }
  const quantity = readQuantity(component.quantity, request);
  if (quantity === undefined) {
    return { kind: 'unpriced', note: `The request does not say how many ${component.unit} units it uses.` };
  }
  return {
    kind: 'computed',
    amountUsd: quantity * unitPriceUsd,
    basis: `${quantity} ${component.unit}${quantity === 1 ? '' : 's'} × $${unitPriceUsd}`,
  };
}

/** The image size is a guess, so the basis says what it was guessed from. */
function evaluateImageMegapixels(countPointer: string | undefined, unitPriceUsd: number, request: JsonValue): PriceEvaluation {
  const guess = guessImageMegapixels(request);
  const count = countPointer ? readNumber(readPointer(request, countPointer)) ?? 1 : 1;
  const images = count === 1 ? '' : `${count} images × `;
  return {
    kind: 'computed',
    amountUsd: count * guess.megapixels * unitPriceUsd,
    basis: `${images}about ${guess.megapixels} megapixel${guess.megapixels === 1 ? '' : 's'} (${guess.basis}) × $${unitPriceUsd}`,
  };
}

function matchingTier(tiers: PriceTier[], request: JsonValue): PriceTier | undefined {
  return tiers.find((tier) => Object.entries(tier.when).every(([pointer, expected]) => sameValue(readPointer(request, pointer), expected)));
}

function readQuantity(quantity: Exclude<PriceQuantity, { kind: 'imageMegapixels' }>, request: JsonValue): number | undefined {
  if (quantity.kind === 'constant') {return quantity.value;}
  const value = readPointer(request, quantity.pointer);
  if (quantity.kind === 'characters') {
    if (typeof value === 'string') {return value.length;}
    if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
      return value.reduce((total, entry) => total + (entry as string).length, 0);
    }
    return undefined;
  }
  return readNumber(value) ?? quantity.default;
}

function readNumber(value: JsonValue | undefined): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {return value;}
  if (typeof value === 'string' && /^\d+(?:\.\d+)?s?$/.test(value.trim())) {return Number.parseFloat(value);}
  return undefined;
}

function sameValue(actual: JsonValue | undefined, expected: JsonValue): boolean {
  if (typeof actual === 'string' && typeof expected === 'string') {
    return actual.toLowerCase() === expected.toLowerCase();
  }
  return JSON.stringify(actual) === JSON.stringify(expected);
}

export function readPointer(value: JsonValue, pointer: string): JsonValue | undefined {
  let current: JsonValue | undefined = value;
  for (const segment of pointer.slice(1).split('/').map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))) {
    if (Array.isArray(current)) {
      current = /^\d+$/.test(segment) ? current[Number(segment)] : undefined;
    } else if (current !== null && typeof current === 'object') {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

function roundUsd(amount: number): number {
  return Math.round(amount * 1e6) / 1e6;
}
