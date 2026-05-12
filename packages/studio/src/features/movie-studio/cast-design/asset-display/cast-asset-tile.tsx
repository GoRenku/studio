import { Check, MoreHorizontal, Settings2, Trash2, X } from 'lucide-react';
import { Button } from '@/ui/button';
import { Card, CardContent, CardFooter } from '@/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { CastDesignAsset } from '../cast-design-types';

const tileWidthClasses: Record<CastDesignAsset['aspect'], string> = {
  portrait: 'w-[220px]',
  square: 'w-[260px]',
  sheet: 'w-[360px]',
  wide: 'w-[420px]',
  'ratio-4-3': 'w-[320px]',
  'ratio-9-16': 'w-[220px]',
  voice: 'w-[300px]',
  text: 'w-[520px]',
};

const compactTileWidthClasses: Record<CastDesignAsset['aspect'], string> = {
  portrait: 'w-[140px]',
  square: 'w-[150px]',
  sheet: 'w-[250px]',
  wide: 'w-[290px]',
  'ratio-4-3': 'w-[200px]',
  'ratio-9-16': 'w-[125px]',
  voice: 'w-[220px]',
  text: 'w-[400px]',
};

const previewAspectClasses: Record<CastDesignAsset['aspect'], string> = {
  portrait: 'aspect-[4/5]',
  square: 'aspect-square',
  sheet: 'aspect-[16/9]',
  wide: 'aspect-[2/1]',
  'ratio-4-3': 'aspect-[4/3]',
  'ratio-9-16': 'aspect-[9/16]',
  voice: 'aspect-[2.4/1]',
  text: 'aspect-[2.6/1]',
};

interface CastAssetTileProps {
  asset: CastDesignAsset;
  selectedSection?: boolean;
  onOpenDetails: (asset: CastDesignAsset) => void;
  onSelectAsset?: (asset: CastDesignAsset) => void;
  onUnselectAsset?: (asset: CastDesignAsset) => void;
}

export function CastAssetTile({
  asset,
  selectedSection = false,
  onOpenDetails,
  onSelectAsset,
  onUnselectAsset,
}: CastAssetTileProps) {
  return (
    <Card
      className={cn(
        'group shrink-0 gap-0 overflow-hidden rounded-xl border bg-card py-0 shadow-lg transition-all',
        'hover:-translate-y-1 hover:border-primary/70 hover:shadow-xl',
        selectedSection
          ? compactTileWidthClasses[asset.aspect]
          : tileWidthClasses[asset.aspect],
        asset.selected
          ? 'border-primary/70 ring-2 ring-primary/35'
          : 'border-border/40'
      )}
    >
      <CardContent className='p-3 pb-0'>
        <div
          className={cn(
            'flex items-center justify-center overflow-hidden rounded-lg bg-muted/70 dark:bg-black/65',
            previewAspectClasses[asset.aspect]
          )}
        >
          {asset.imageUrl ? (
            <img
              src={asset.imageUrl}
              alt=''
              className='h-full w-full rounded-lg object-contain transition-transform duration-300 group-hover:scale-[1.01]'
            />
          ) : asset.text ? (
            <div className='h-full w-full overflow-hidden p-5 text-left'>
              <pre className='h-full overflow-hidden whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground'>
                {asset.text}
              </pre>
            </div>
          ) : (
            <div className='flex h-full w-full items-center p-4 text-left text-xs leading-relaxed text-muted-foreground'>
              Controlled, formal, and restrained.
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className='mt-3 flex h-12 items-center justify-between gap-3 border-t border-border/60 bg-muted/45 px-4 py-0 [.border-t]:pt-0'>
        <div className='flex min-w-0 items-center gap-2'>
          {asset.selected && !selectedSection ? (
            <span className='flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground'>
              <Check className='h-3.5 w-3.5' />
            </span>
          ) : null}
          <span className='block truncate text-sm font-semibold leading-none'>
            {asset.title}
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground'
              aria-label={`${asset.title} actions`}
            >
              <MoreHorizontal className='h-4 w-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem onClick={() => onOpenDetails(asset)}>
              <Settings2 className='h-4 w-4' />
              Details
            </DropdownMenuItem>
            {selectedSection ? (
              <DropdownMenuItem onClick={() => onUnselectAsset?.(asset)}>
                <X className='h-4 w-4' />
                Unselect
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onSelectAsset?.(asset)}>
                <Check className='h-4 w-4' />
                Select
              </DropdownMenuItem>
            )}
            {!selectedSection ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className='text-destructive focus:text-destructive'>
                  <Trash2 className='h-4 w-4' />
                  Delete
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  );
}
