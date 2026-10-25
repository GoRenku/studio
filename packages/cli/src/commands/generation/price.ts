import type { RoutePrice } from '@gorenku/studio-engines';
import type { GenerationCommandInput } from './command.js';
import { createEngineContext } from './engine-context.js';
import { throwEngineError } from './engine-errors.js';
import { createRenkuMediaEngine } from './provider-registry.js';
import { requiredFlag } from '../structured-command.js';
import { readJsonInput } from '../command-io.js';

/** Prints the saved price estimates use for one route, its source and how old it is. */
export async function showGenerationPrice(input: GenerationCommandInput) {
  const route = readRoute(input);
  try {
    const price = await (input.runtime.mediaEngine ?? createRenkuMediaEngine())
      .readRoutePrice(route.provider, route.model, await routeContext(input, route.provider));
    return { ...route, price: describe(price) };
  } catch (error) {
    throwEngineError(error);
  }
}

/** Stores an agent-researched price entry in the provider metadata cache; it does not expire. */
export async function recordGenerationPrice(input: GenerationCommandInput) {
  const route = readRoute(input);
  const file = Array.isArray(input.flags.file) ? input.flags.file.at(-1) : input.flags.file;
  const price = await readJsonInput(requiredFlag(file, '--file'));
  try {
    const recorded = await (input.runtime.mediaEngine ?? createRenkuMediaEngine())
      .recordRoutePrice(route.provider, route.model, price, await routeContext(input, route.provider));
    return { ...route, recorded: describe(recorded) };
  } catch (error) {
    throwEngineError(error);
  }
}

function readRoute(input: GenerationCommandInput) {
  return {
    provider: requiredFlag(input.flags.provider, '--provider'),
    model: requiredFlag(input.flags.model, '--model'),
  };
}

function routeContext(input: GenerationCommandInput, provider: string) {
  return (input.runtime.createProviderContext ?? createEngineContext)({
    provider,
    homeDir: input.runtime.homeDir,
    signal: new AbortController().signal,
  });
}

function describe(price: RoutePrice | null) {
  if (!price) {
    return null;
  }
  const ageHours = Math.max(0, (Date.now() - Date.parse(price.source.observedAt)) / 3_600_000);
  return {
    price,
    ageHours: Math.round(ageHours * 10) / 10,
  };
}
