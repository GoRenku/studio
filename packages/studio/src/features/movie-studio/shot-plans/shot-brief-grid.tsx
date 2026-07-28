import {
  Aperture,
  Camera,
  Focus,
  Lightbulb,
  Move3d,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { ShotBrief } from '@gorenku/studio-core/client';
import {
  CAMERA_ANGLE_OPTIONS,
  getCameraAngleMedia,
  getShotMovementMedia,
  getShotSizeMedia,
  MOVEMENT_OPTIONS,
  SHOT_SIZE_OPTIONS,
} from '../shot-design/shot-design-media';
import { ShotBriefMotionMedia, ShotBriefStillMedia } from './shot-brief-media';
import { ShotDesignGlossaryDialog } from './shot-design-glossary-dialog';

const SHOT_BRIEF_CARD_WIDTH_PX = 199;

export function ShotBriefGrid({ brief }: { brief: ShotBrief }) {
  const framingImages = [
    brief.framing?.start
      ? {
          value: brief.framing.start,
          media: getShotSizeMedia(brief.framing.start),
          slot: 'Start',
        }
      : null,
    brief.framing?.end
      ? {
          value: brief.framing.end,
          media: getShotSizeMedia(brief.framing.end),
          slot: 'End',
        }
      : null,
  ].filter(
    (
      entry
    ): entry is {
      value: string;
      media: NonNullable<ReturnType<typeof getShotSizeMedia>>;
      slot: string;
    } => Boolean(entry?.media)
  );
  const cameraMedia = brief.camera?.angle
    ? getCameraAngleMedia(brief.camera.angle)
    : null;
  const motionMedia = brief.motion?.movement
    ? getShotMovementMedia(brief.motion.movement)
    : null;

  return (
    <div
      className='grid justify-start gap-3'
      style={{
        gridTemplateColumns: `repeat(auto-fill, ${SHOT_BRIEF_CARD_WIDTH_PX}px)`,
      }}
    >
      <BriefCard
        label='Framing'
        icon={<Focus className='h-3.5 w-3.5' />}
        media={
          framingImages.length ? (
            <ShotBriefStillMedia
              images={framingImages.map((entry) => ({
                src: entry.media.imageUrl,
                alt: `${entry.slot} framing: ${catalogLabel(SHOT_SIZE_OPTIONS, entry.value)}`,
                title: `${entry.slot} framing`,
              }))}
              slotLabels={framingImages.map((entry) => entry.slot)}
              label='Inspect Shot framing'
              className='relative h-full w-full overflow-hidden rounded-none p-0 hover:bg-transparent'
            />
          ) : null
        }
        help={
          <ShotDesignGlossaryDialog
            kind='framing'
            start={brief.framing?.start}
            end={brief.framing?.end}
          />
        }
      >
        {brief.framing?.start || brief.framing?.end ? (
          <>
            <BriefEyebrow>Authored relationship</BriefEyebrow>
            <BriefPrimary>
              {[brief.framing?.start, brief.framing?.end]
                .filter(Boolean)
                .map((value) =>
                  catalogLabel(SHOT_SIZE_OPTIONS, value as string)
                )
                .join(' → ')}
            </BriefPrimary>
          </>
        ) : null}
      </BriefCard>
      <BriefCard
        label='Camera'
        icon={<Camera className='h-3.5 w-3.5' />}
        media={
          cameraMedia && brief.camera?.angle ? (
            <ShotBriefStillMedia
              images={[
                {
                  src: cameraMedia.imageUrl,
                  alt: `Camera angle: ${catalogLabel(CAMERA_ANGLE_OPTIONS, brief.camera.angle)}`,
                  title: 'Camera angle',
                },
              ]}
              label='Inspect Camera angle'
              className='relative h-full w-full overflow-hidden rounded-none p-0 hover:bg-transparent'
            />
          ) : null
        }
        help={
          <ShotDesignGlossaryDialog
            kind='camera'
            current={brief.camera?.angle}
          />
        }
      >
        {brief.camera?.angle ? (
          <>
            <BriefEyebrow>Angle</BriefEyebrow>
            <BriefPrimary>
              {catalogLabel(CAMERA_ANGLE_OPTIONS, brief.camera.angle)}
            </BriefPrimary>
          </>
        ) : null}
      </BriefCard>
      <BriefCard
        label='Motion'
        icon={<Move3d className='h-3.5 w-3.5' />}
        media={
          motionMedia && brief.motion?.movement ? (
            <ShotBriefMotionMedia
              media={motionMedia}
              label={`Motion: ${catalogLabel(MOVEMENT_OPTIONS, brief.motion.movement)}`}
              className='relative h-full w-full overflow-hidden rounded-none p-0 hover:bg-transparent'
            />
          ) : null
        }
        help={
          <ShotDesignGlossaryDialog
            kind='motion'
            current={brief.motion?.movement}
          />
        }
      >
        {brief.motion?.movement ? (
          <>
            <BriefEyebrow>Movement</BriefEyebrow>
            <BriefPrimary>
              {catalogLabel(MOVEMENT_OPTIONS, brief.motion.movement)}
            </BriefPrimary>
          </>
        ) : null}
      </BriefCard>
      <BriefCard
        label='Optics'
        icon={<Aperture className='h-3.5 w-3.5' />}
      >
        {brief.optics?.intent ? (
          <>
            <BriefEyebrow>Intent</BriefEyebrow>
            <BriefPrimary>{brief.optics.intent}</BriefPrimary>
          </>
        ) : null}
        <div className='mt-auto flex flex-wrap gap-1.5 pt-4'>
          {brief.optics?.focalLengthMm !== undefined ? (
            <BriefChip>Lens {brief.optics.focalLengthMm} mm</BriefChip>
          ) : null}
          {brief.optics?.depthOfField ? (
            <BriefChip>Depth {brief.optics.depthOfField}</BriefChip>
          ) : null}
          {brief.optics?.focusTarget ? (
            <BriefChip>Focus {brief.optics.focusTarget}</BriefChip>
          ) : null}
        </div>
      </BriefCard>
      <BriefCard
        label='Lighting'
        icon={<Lightbulb className='h-3.5 w-3.5' />}
      >
        {brief.lighting?.intent ? (
          <>
            <BriefEyebrow>Intent</BriefEyebrow>
            <BriefPrimary>{brief.lighting.intent}</BriefPrimary>
          </>
        ) : null}
      </BriefCard>
    </div>
  );
}

function BriefCard({
  label,
  icon,
  media,
  help,
  children,
}: {
  label: string;
  icon: ReactNode;
  media?: ReactNode;
  help?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className='relative flex min-h-[284px] min-w-0 flex-col overflow-hidden rounded-lg border border-border/55 bg-card shadow-sm'>
      <header className='flex h-10 shrink-0 items-center gap-2 border-b border-border/45 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground'>
        <span className='text-primary'>{icon}</span>
        {label}
      </header>
      {media ? (
        <div className='h-28 shrink-0 overflow-hidden bg-muted'>
          {media}
        </div>
      ) : null}
      <div className='flex min-h-0 flex-1 flex-col p-3 pb-10'>{children}</div>
      {help}
    </section>
  );
}

function BriefEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className='text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
      {children}
    </p>
  );
}

function BriefPrimary({ children }: { children: ReactNode }) {
  return (
    <p className='mt-1 text-xs font-semibold leading-5 text-foreground'>
      {children}
    </p>
  );
}

function BriefChip({ children }: { children: ReactNode }) {
  return (
    <span className='rounded-full bg-muted px-2 py-1 text-[9px] text-muted-foreground'>
      {children}
    </span>
  );
}

function catalogLabel(
  options: Array<{ id: string; label: string }>,
  value: string
): string {
  return options.find((option) => option.id === value)?.label ?? value;
}
