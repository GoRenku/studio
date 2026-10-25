import type { GenerationLane } from './generation-lanes.js';
import type { JsonValue } from './json.js';

/** Model-neutral image detail, from the cheapest output size a route offers to the largest. */
export const IMAGE_DETAIL_LEVELS = ['lowest', 'mid', 'highest'] as const;
export type ImageDetailLevel = (typeof IMAGE_DETAIL_LEVELS)[number];

/** The image and image edit lanes, whose provider entries say what each detail level means. */
export const IMAGE_DETAIL_LANES = ['image', 'imageEdit'] as const satisfies readonly GenerationLane[];

/** A provider offering a model family, with the route the lane uses there. */
export interface DefaultModelListProvider {
  provider: string;
  /** The exact provider route for the lane's main operation; opaque Skill data, used to look up its price. */
  route: string;
  /**
   * Image lanes only: the native request fields that give each detail level on
   * this route, such as its output size. Opaque Skill data that Studio passes on
   * unread.
   */
  detail?: Record<ImageDetailLevel, Record<string, JsonValue>>;
}

/**
 * One trusted model family a user may pick as a lane default. Studio and Core
 * only list these; the Skill maps a family to the exact operation route.
 */
export interface DefaultModelListEntry {
  /** Skill model guide key. */
  model: string;
  name: string;
  providers: DefaultModelListProvider[];
  /** Providers for which this family is the Skill recommendation. */
  recommendedFor: string[];
}

export type DefaultModelListLanes = Record<GenerationLane, DefaultModelListEntry[]>;

export type DefaultModelListResource =
  | { state: 'notSynced' }
  | { state: 'synced'; syncedAt: string; lanes: DefaultModelListLanes };

export interface DefaultModelListSyncReport {
  changed: boolean;
  sha256: string;
  path: string;
}

/** The native fields of one detail level for a provider route in the image lanes, or undefined when the list has none. */
export function findImageDetailFields(
  lanes: DefaultModelListLanes,
  route: { provider: string; route: string },
  level: ImageDetailLevel,
): Record<string, JsonValue> | undefined {
  return IMAGE_DETAIL_LANES
    .flatMap((lane) => lanes[lane])
    .flatMap((entry) => entry.providers)
    .find((offered) => offered.provider === route.provider && offered.route === route.route)
    ?.detail?.[level];
}
