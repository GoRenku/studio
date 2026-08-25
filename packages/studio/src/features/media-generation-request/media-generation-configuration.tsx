import type { JsonValue } from '@gorenku/studio-core/client';
import { MediaGenerationConfigurationControl } from './media-generation-configuration-control';
import {
  type MediaGenerationConfigurationNode,
  projectMediaGenerationConfiguration,
} from './media-generation-configuration-projection';

export function MediaGenerationConfiguration({
  provider,
  model,
  value,
}: {
  provider: string;
  model: string;
  value: JsonValue;
}) {
  const nodes = projectMediaGenerationConfiguration({
    provider,
    model,
    configuration: value,
  });
  return (
    <section
      aria-label='Saved media generation configuration'
      className='mx-auto grid w-full max-w-[538px] gap-[18px] pt-[38px] pb-12'
    >
      {nodes.map((node) => (
        <ConfigurationNode key={node.key} node={node} />
      ))}
    </section>
  );
}

function ConfigurationNode({ node }: { node: MediaGenerationConfigurationNode }) {
  if (node.kind === 'group') {
    return (
      <section aria-label={node.label} className='grid gap-[18px]'>
        <h3 className='text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground'>
          {node.label}
        </h3>
        {node.children.map((child) => (
          <ConfigurationNode key={child.key} node={child} />
        ))}
      </section>
    );
  }
  return (
    <div className='grid min-h-9 grid-cols-[150px_minmax(0,360px)] items-center gap-7'>
      <span className='text-xs font-medium text-muted-foreground'>{node.label}</span>
      <MediaGenerationConfigurationControl node={node} />
    </div>
  );
}
