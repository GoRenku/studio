import { Input } from '@/ui/input';
import { Switch } from '@/ui/switch';
import { Textarea } from '@/ui/textarea';
import type { MediaGenerationConfigurationNode } from './media-generation-configuration-projection';

export function MediaGenerationConfigurationControl({
  node,
}: {
  node: Extract<MediaGenerationConfigurationNode, { kind: 'value' | 'empty' | 'json' }>;
}) {
  if (node.kind === 'json') {
    return (
      <Textarea
        aria-label={node.label}
        value={node.value}
        readOnly
        className='min-h-32 resize-none bg-input/30 font-mono text-xs leading-relaxed shadow-xs'
      />
    );
  }
  if (node.kind === 'empty') {
    return (
      <Input
        aria-label={node.label}
        value='No values'
        readOnly
        className='bg-input/30 text-muted-foreground shadow-xs'
      />
    );
  }
  if (node.valueKind === 'boolean') {
    return (
      <div className='flex h-9 items-center'>
        <Switch aria-label={node.label} checked={node.value === true} disabled />
      </div>
    );
  }
  return (
    <Input
      aria-label={node.label}
      type={node.valueKind === 'number' ? 'number' : 'text'}
      value={node.valueKind === 'null' ? 'Not set' : String(node.value)}
      readOnly
      className='bg-input/30 shadow-xs'
    />
  );
}
