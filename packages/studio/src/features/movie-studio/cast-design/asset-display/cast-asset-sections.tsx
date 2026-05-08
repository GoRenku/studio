import { ChevronDown, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { cn } from '@/lib/utils';
import type { CastDesignAsset } from '../cast-design-types';
import { CastAssetTileGrid } from './cast-asset-tile-grid';

interface CastAssetSectionShellProps {
  title: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}

function CastAssetSectionShell({
  title,
  children,
  className,
  actions,
}: CastAssetSectionShellProps) {
  const [open, setOpen] = useState(true);

  return (
    <Card
      className={cn(
        'min-h-0 gap-0 overflow-hidden rounded-xl border border-border/40 bg-muted/20 py-0 shadow-lg',
        className,
        !open && 'flex-none'
      )}
    >
      <CardHeader className='flex h-[45px] flex-row items-center justify-between gap-3 border-b border-border/40 bg-panel-header-bg px-5 py-0 [.border-b]:pb-0'>
        <CardTitle className='text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
          {title}
        </CardTitle>
        <div className='flex items-center gap-2'>
          {actions}
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='h-7 w-7 text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-0'
            onClick={() => setOpen((current) => !current)}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${title}`}
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform',
                !open && '-rotate-90'
              )}
            />
          </Button>
        </div>
      </CardHeader>
      {open ? (
        <CardContent className='min-h-0 flex-1 px-0'>{children}</CardContent>
      ) : null}
    </Card>
  );
}

interface CastSelectedAssetSectionProps {
  assets: CastDesignAsset[];
  emptyMessage: string;
  onOpenDetails: (asset: CastDesignAsset) => void;
}

export function CastSelectedAssetSection({
  assets,
  emptyMessage,
  onOpenDetails,
}: CastSelectedAssetSectionProps) {
  return (
    <CastAssetSectionShell title='Selected Assets' className='shrink-0'>
      <div className='max-h-[280px] overflow-y-auto'>
        <CastAssetTileGrid
          assets={assets}
          emptyMessage={emptyMessage}
          selectedSection
          onOpenDetails={onOpenDetails}
        />
      </div>
    </CastAssetSectionShell>
  );
}

interface CastTakeSectionProps {
  assets: CastDesignAsset[];
  emptyMessage: string;
  newTakeEnabled?: boolean;
  onNewTake?: () => void;
  onOpenDetails: (asset: CastDesignAsset) => void;
}

export function CastTakeSection({
  assets,
  emptyMessage,
  newTakeEnabled = false,
  onNewTake,
  onOpenDetails,
}: CastTakeSectionProps) {
  const actions = newTakeEnabled ? (
    <Button
      type='button'
      variant='secondary'
      size='sm'
      className='h-7 gap-1.5 px-2.5 text-xs'
      onClick={onNewTake}
    >
      <Plus className='h-3.5 w-3.5' />
      New
    </Button>
  ) : null;

  return (
    <CastAssetSectionShell
      title='Takes'
      className='flex-1'
      actions={actions}
    >
      <CastAssetTileGrid
        assets={assets}
        emptyMessage={emptyMessage}
        onOpenDetails={onOpenDetails}
      />
    </CastAssetSectionShell>
  );
}
