import type { ReactNode } from 'react';
import {
  screenplayEntityMentionRanges,
  type ScreenplayEntityMentionCatalog,
} from '../screenplay-entity-mentions';

export function ShotBriefMentionText({
  text,
  entityMentions,
}: {
  text: string;
  entityMentions: ScreenplayEntityMentionCatalog;
}) {
  const nodes: ReactNode[] = [];
  const ranges = screenplayEntityMentionRanges(text, entityMentions);
  let lastIndex = 0;
  for (const [index, range] of ranges.entries()) {
    if (range.from > lastIndex) {
      nodes.push(text.slice(lastIndex, range.from));
    }
    nodes.push(
      <span
        key={`${range.from}-${index}`}
        className='font-bold text-primary'
        aria-label={`${range.entity.label}, ${
          range.entity.kind === 'castMember' ? 'Cast Member' : 'Location'
        } mention`}
      >
        {range.entity.label}
      </span>
    );
    lastIndex = range.to;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return <>{nodes}</>;
}
