import type { ReactNode } from 'react';
import type {
  ColorSwatch,
  StoryboardLineAndFinishSection,
  StoryboardLookbookDefinition,
  StoryboardMark,
  StoryboardStyleBriefSection,
  StoryboardValueAndAccentSection,
} from '@gorenku/studio-core/client';
import { Ban, Check, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import type { PreviewImage } from '@/ui/image-preview-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/ui/tooltip';
import {
  EvidenceGrid,
} from './lookbook-report-shared';
import {
  imagesForSection,
  readableImageTitle,
  type LookbookReportSource,
  type ReportImage,
} from './lookbook-report-images';

interface StoryboardLookbookReportProps {
  projectName: string;
  sections: StoryboardLookbookDefinition;
  source: LookbookReportSource;
  onOpenImage: (image: PreviewImage) => void;
  onRequestDeleteImage?: (image: ReportImage) => void;
}

export function StoryboardLookbookReport({
  projectName,
  sections,
  source,
  onOpenImage,
  onRequestDeleteImage,
}: StoryboardLookbookReportProps) {
  const styleBriefImages = imagesForSection(projectName, source, 'styleBrief');
  const heroImage = styleBriefImages[0];
  const supportingStyleBriefImages = styleBriefImages.slice(1);
  const lineAndFinishImages = imagesForSection(
    projectName,
    source,
    'lineAndFinish'
  );
  const valueAndAccentImages = imagesForSection(
    projectName,
    source,
    'valueAndAccent'
  );
  const guardrailImages = imagesForSection(projectName, source, 'guardrails');

  return (
    <>
      <StoryboardSection number='01' title='Style brief'>
        {heroImage ? (
          <StoryboardHero
            image={heroImage}
            onOpen={() =>
              onOpenImage({
                src: heroImage.src,
                alt: heroImage.alt,
                title: readableImageTitle(heroImage),
              })
            }
            onRequestDelete={
              heroImage.lookbookImageId && onRequestDeleteImage
                ? () => onRequestDeleteImage(heroImage)
                : undefined
            }
          />
        ) : null}
        <StyleBriefWidget
          section={sections.styleBrief}
          className={heroImage ? 'mt-6' : undefined}
        />
        {supportingStyleBriefImages.length ? (
          <div className='mt-6'>
            <EvidenceGrid
              images={supportingStyleBriefImages}
              size='feature'
              onOpenImage={onOpenImage}
              onRequestDeleteImage={onRequestDeleteImage}
            />
          </div>
        ) : null}
      </StoryboardSection>
      <StoryboardSection number='02' title='Line and finish'>
        <StoryboardWidgetAndProof
          widget={<LineAndFinishWidget section={sections.lineAndFinish} />}
          images={lineAndFinishImages}
          onOpenImage={onOpenImage}
          onRequestDeleteImage={onRequestDeleteImage}
        />
        <StoryboardProse className='mt-5' text={sections.lineAndFinish.text} />
      </StoryboardSection>
      <StoryboardSection number='03' title='Value and accent'>
        <StoryboardWidgetAndProof
          widget={<ValueAndAccentWidget section={sections.valueAndAccent} />}
          images={valueAndAccentImages}
          onOpenImage={onOpenImage}
          onRequestDeleteImage={onRequestDeleteImage}
        />
        <StoryboardProse className='mt-5' text={sections.valueAndAccent.text} />
      </StoryboardSection>
      <StoryboardSection number='04' title='Guardrails'>
        <GuardrailChips
          forbidden={sections.guardrails.forbidden}
          favored={sections.guardrails.favored}
        />
        {guardrailImages.length ? (
          <div className='mt-5'>
            <EvidenceGrid
              images={guardrailImages}
              size='feature'
              onOpenImage={onOpenImage}
              onRequestDeleteImage={onRequestDeleteImage}
            />
          </div>
        ) : null}
        <StoryboardProse className='mt-5' text={sections.guardrails.text} />
      </StoryboardSection>
    </>
  );
}

function StoryboardSection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className='border-t border-border/40 py-8'>
      <header className='mb-5 flex items-baseline gap-3'>
        <span className='font-mono text-xs text-muted-foreground'>{number}</span>
        <h2 className='text-xl font-black uppercase tracking-tight text-foreground sm:text-2xl'>
          {title}
        </h2>
      </header>
      {children}
    </section>
  );
}

function StoryboardProse({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'max-w-[820px] text-sm leading-7 text-foreground/80',
        className
      )}
    >
      {text}
    </p>
  );
}

function StoryboardWidgetAndProof({
  widget,
  images,
  onOpenImage,
  onRequestDeleteImage,
}: {
  widget: ReactNode;
  images: ReportImage[];
  onOpenImage: (image: PreviewImage) => void;
  onRequestDeleteImage?: (image: ReportImage) => void;
}) {
  if (!images.length) {
    return <>{widget}</>;
  }
  if (!widget) {
    return (
      <EvidenceGrid
        images={images}
        size='feature'
        onOpenImage={onOpenImage}
        onRequestDeleteImage={onRequestDeleteImage}
      />
    );
  }
  return (
    <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'>
      <div>{widget}</div>
      <div>
        <EvidenceGrid
          images={images}
          size='feature'
          onOpenImage={onOpenImage}
          onRequestDeleteImage={onRequestDeleteImage}
        />
      </div>
    </div>
  );
}

function StoryboardHero({
  image,
  onOpen,
  onRequestDelete,
}: {
  image: ReportImage;
  onOpen: () => void;
  onRequestDelete?: () => void;
}) {
  return (
    <figure
      className='group relative overflow-hidden rounded-md border border-border/40 bg-card shadow-[0_18px_45px_rgba(0,0,0,0.3)]'
      title={image.title}
    >
      <Button
        type='button'
        variant='ghost'
        className='block h-auto w-full rounded-none p-0 hover:bg-transparent'
        onClick={onOpen}
      >
        <span className='block aspect-[16/7]'>
          <img
            src={image.src}
            alt={image.alt}
            className='h-full w-full object-cover'
          />
        </span>
      </Button>
      <figcaption className='pointer-events-none absolute bottom-2 left-2 flex justify-start'>
        <span className='rounded-sm border border-border/20 bg-panel-bg/70 px-2 py-1 text-[10px] font-medium leading-4 text-foreground/70 shadow-sm backdrop-blur-sm'>
          Overall style
        </span>
      </figcaption>
      {onRequestDelete ? (
        <span className='absolute right-1.5 top-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type='button'
                size='icon'
                variant='ghost'
                className='h-7 w-7 bg-black/50 text-white shadow-sm hover:bg-destructive hover:text-destructive-foreground'
                aria-label='Delete hero image'
                onClick={onRequestDelete}
              >
                <Trash2 className='h-3.5 w-3.5' />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete image</TooltipContent>
          </Tooltip>
        </span>
      ) : null}
    </figure>
  );
}

function StyleBriefWidget({
  section,
  className,
}: {
  section: StoryboardStyleBriefSection;
  className?: string;
}) {
  const hasWidgets = Boolean(
    section.styleKind || section.palette?.length || section.tags?.length
  );
  if (!hasWidgets) {
    return <StoryboardProse className={className} text={section.text} />;
  }
  return (
    <div
      className={cn(
        'grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]',
        className
      )}
    >
      <div className='space-y-5'>
        {section.styleKind ? <StyleKindBadge value={section.styleKind} /> : null}
        {section.palette?.length ? (
          <SwatchStrip swatches={section.palette} />
        ) : null}
        {section.tags?.length ? <TagRow tags={section.tags} /> : null}
      </div>
      <StoryboardProse text={section.text} />
    </div>
  );
}

function LineAndFinishWidget({
  section,
}: {
  section: StoryboardLineAndFinishSection;
}) {
  if (!section.marks?.length && !section.hatching) {
    return null;
  }
  return (
    <div className='space-y-4'>
      {section.marks?.length ? <MarkSpecimen marks={section.marks} /> : null}
      {section.hatching ? (
        <WidgetNote label='Hatching' value={section.hatching} />
      ) : null}
    </div>
  );
}

function ValueAndAccentWidget({
  section,
}: {
  section: StoryboardValueAndAccentSection;
}) {
  if (!section.valueSteps?.length && !section.accents?.length) {
    return null;
  }
  return (
    <div className='space-y-4'>
      {section.valueSteps?.length ? (
        <ValueRamp steps={section.valueSteps} contrast={section.contrast} />
      ) : null}
      {section.accents?.length ? (
        <SwatchStrip swatches={section.accents} label='Accents' />
      ) : null}
    </div>
  );
}

function StyleKindBadge({ value }: { value: string }) {
  return (
    <span className='inline-flex items-center rounded-full border border-border/50 bg-muted/50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-foreground/80'>
      {value}
    </span>
  );
}

function TagRow({ tags }: { tags: string[] }) {
  return (
    <div className='flex flex-wrap gap-2'>
      {tags.map((tag) => (
        <span
          key={tag}
          className='rounded-full border border-border/50 bg-muted/40 px-3 py-1 text-xs font-semibold text-foreground/75'
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function WidgetNote({ label, value }: { label: string; value: string }) {
  return (
    <p className='text-xs leading-6 text-muted-foreground'>
      <span className='font-semibold uppercase tracking-wide text-foreground/70'>
        {label}:
      </span>{' '}
      {value}
    </p>
  );
}

function SwatchStrip({
  swatches,
  label,
}: {
  swatches: ColorSwatch[];
  label?: string;
}) {
  return (
    <div className='space-y-2'>
      {label ? (
        <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
          {label}
        </p>
      ) : null}
      <div className='grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2'>
        {swatches.map((swatch) => (
          <div key={`${swatch.hex}-${swatch.name}`} title={swatch.meaning}>
            <div
              className='h-10 rounded-md border border-border/40'
              style={{ backgroundColor: swatch.hex }}
            />
            <p className='mt-1 truncate text-[11px] font-medium text-foreground/80'>
              {swatch.name}
            </p>
            <p className='font-mono text-[10px] text-muted-foreground'>
              {swatch.hex}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ValueRamp({ steps, contrast }: { steps: string[]; contrast?: string }) {
  return (
    <div className='space-y-2'>
      <div className='flex h-10 overflow-hidden rounded-md border border-border/40'>
        {steps.map((step, index) => (
          <span
            key={`${step}-${index}`}
            className='flex-1'
            style={{ backgroundColor: step }}
          />
        ))}
      </div>
      <div className='flex items-center justify-between text-[11px] text-muted-foreground'>
        <span>Light</span>
        <span>
          {steps.length}-value{contrast ? ` · ${contrast}` : ''}
        </span>
        <span>Dark</span>
      </div>
    </div>
  );
}

function MarkSpecimen({ marks }: { marks: StoryboardMark[] }) {
  const sorted = [...marks].sort((a, b) => b.thickness - a.thickness);
  const maxThickness = Math.max(...sorted.map((mark) => mark.thickness), 1);
  return (
    <div className='space-y-3 rounded-md border border-border/40 bg-card/80 p-4'>
      {sorted.map((mark) => {
        const weight = Math.max(
          1,
          Math.round((mark.thickness / maxThickness) * 6)
        );
        return (
          <div key={mark.label} className='flex items-center gap-3'>
            <span
              className='flex-1 rounded-full bg-foreground'
              style={{ height: `${weight}px` }}
            />
            <span className='w-24 shrink-0 text-[11px] text-muted-foreground'>
              {mark.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function GuardrailChips({
  forbidden,
  favored,
}: {
  forbidden?: string[];
  favored?: string[];
}) {
  if (!forbidden?.length && !favored?.length) {
    return null;
  }
  return (
    <div className='space-y-3'>
      {forbidden?.length ? (
        <div className='flex flex-wrap gap-2'>
          {forbidden.map((item) => (
            <span
              key={item}
              className='inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive'
            >
              <Ban className='h-3.5 w-3.5' />
              {item}
            </span>
          ))}
        </div>
      ) : null}
      {favored?.length ? (
        <div className='flex flex-wrap gap-2'>
          {favored.map((item) => (
            <span
              key={item}
              className='inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary'
            >
              <Check className='h-3.5 w-3.5' />
              {item}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
