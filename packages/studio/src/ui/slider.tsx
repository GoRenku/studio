import * as React from 'react';
import { Slider as SliderPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

type SliderSize = 'sm' | 'md' | 'lg';

interface SliderProps
  extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  showTicks?: boolean;
  tickCount?: number;
  sliderSize?: SliderSize;
}

const trackSizeClasses: Record<SliderSize, string> = {
  sm: 'h-1.5 data-[orientation=vertical]:w-1.5',
  md: 'h-2.5 data-[orientation=vertical]:w-2.5',
  lg: 'h-3.5 data-[orientation=vertical]:w-3.5',
};

const thumbSizeClasses: Record<SliderSize, string> = {
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-6',
};

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(
  (
    {
      className,
      showTicks = false,
      tickCount = 5,
      sliderSize = 'md',
      ...props
    },
    ref
  ) => {
    return (
      <div className='w-full'>
        <SliderPrimitive.Root
          ref={ref}
          className={cn(
            'relative flex w-full touch-none select-none items-center data-[orientation=vertical]:h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
            className
          )}
          {...props}
        >
          <SliderPrimitive.Track
            className={cn(
              'relative w-full grow overflow-hidden rounded-full bg-muted shadow-inner data-[orientation=vertical]:h-full data-[orientation=vertical]:w-auto',
              trackSizeClasses[sliderSize]
            )}
          >
            <SliderPrimitive.Range className='absolute h-full rounded-full bg-primary data-[orientation=vertical]:w-full' />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            className={cn(
              'block rounded-full border-2 border-primary bg-background shadow-md ring-offset-background transition hover:scale-105 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
              thumbSizeClasses[sliderSize]
            )}
          />
        </SliderPrimitive.Root>

        {showTicks ? (
          <div className='mt-3 flex justify-between px-1'>
            {Array.from({ length: tickCount }).map((_, index) => (
              <span
                key={index}
                className='h-1.5 w-1.5 rounded-full bg-muted-foreground/40'
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }
);

Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
