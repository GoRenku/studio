import type { ReactNode } from 'react';
import type {
  ColorSwatch,
  StoryboardLineAndFinishSection,
  StoryboardLookbookDefinition,
  StoryboardMark,
  StoryboardStyleBriefSection,
  StoryboardValueAndAccentSection,
} from '@gorenku/studio-core/client';
import { Ban, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PreviewImage } from '@/ui/image-preview-dialog';
import { MediaCard } from '@/ui/media-card/media-card';
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
  onDeleteImage?: (image: ReportImage) => Promise<void>;
}

export function StoryboardLookbookReport({
  projectName,
  sections,
  source,
  onOpenImage,
  onDeleteImage,
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
          <MediaCard
            media={{
              kind: 'image',
              src: heroImage.src,
              alt: heroImage.alt,
              fit: 'cover',
              effect: 'none',
            }}
            frame={{ kind: 'intrinsic' }}
            presentation={{
              kind: 'evidence',
              copy: { kind: 'label', label: 'Overall style' },
            }}
            activation={{
              label: readableImageTitle(heroImage),
              onActivate: () =>
                onOpenImage({
                  src: heroImage.src,
                  alt: heroImage.alt,
                  title: readableImageTitle(heroImage),
                }),
            }}
            deleteAction={
              heroImage.lookbookImageId && onDeleteImage
                ? {
                    label: 'Delete hero image',
                    confirmationTitle: 'Delete Image?',
                    confirmationMessage:
                      'Remove this image from the lookbook. This cannot be undone.',
                    onDelete: () => onDeleteImage(heroImage),
                  }
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
              onDeleteImage={onDeleteImage}
            />
          </div>
        ) : null}
      </StoryboardSection>
      <StoryboardSection number='02' title='Line and finish'>
        <StoryboardSpecimenBody
          widget={
            sections.lineAndFinish.marks?.length ||
            sections.lineAndFinish.hatching ? (
              <LineAndFinishWidget section={sections.lineAndFinish} />
            ) : null
          }
          text={sections.lineAndFinish.text}
          images={lineAndFinishImages}
          onOpenImage={onOpenImage}
          onDeleteImage={onDeleteImage}
        />
      </StoryboardSection>
      <StoryboardSection number='03' title='Value and accent'>
        <StoryboardSpecimenBody
          widget={
            sections.valueAndAccent.valueSteps?.length ||
            sections.valueAndAccent.accents?.length ? (
              <ValueAndAccentWidget section={sections.valueAndAccent} />
            ) : null
          }
          text={sections.valueAndAccent.text}
          images={valueAndAccentImages}
          onOpenImage={onOpenImage}
          onDeleteImage={onDeleteImage}
        />
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
              onDeleteImage={onDeleteImage}
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

function StoryboardSpecimenBody({
  widget,
  text,
  images,
  onOpenImage,
  onDeleteImage,
}: {
  widget: ReactNode | null;
  text: string;
  images: ReportImage[];
  onOpenImage: (image: PreviewImage) => void;
  onDeleteImage?: (image: ReportImage) => Promise<void>;
}) {
  return (
    <>
      {widget ? (
        <div className='grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:gap-8'>
          <div>{widget}</div>
          <StoryboardProse text={text} />
        </div>
      ) : (
        <StoryboardProse text={text} />
      )}
      {images.length ? (
        <EvidenceGrid
          images={images}
          size='feature'
          className='mt-6'
          onOpenImage={onOpenImage}
          onDeleteImage={onDeleteImage}
        />
      ) : null}
    </>
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
