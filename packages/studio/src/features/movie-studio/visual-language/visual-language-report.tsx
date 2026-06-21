import { useState, type ReactNode } from 'react';
import type {
  CameraSection,
  ColorSwatch,
  InspiredBySection,
  LookbookImage,
  LookbookSection,
  Observation,
  PaletteSection,
  Pattern,
  PatternSection,
  StoryboardLookbookDefinition,
  StoryboardStyleBriefSection,
  StoryboardLineAndFinishSection,
  StoryboardValueAndAccentSection,
  StoryboardMark,
  TextureSection,
  ThesisSection,
  ToneMoodSection,
} from '@gorenku/studio-core/client';
import { Ban, Check, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import { DeleteConfirmDialog } from '@/ui/delete-confirm-dialog';
import {
  ImagePreviewDialog,
  type PreviewImage,
} from '@/ui/image-preview-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/ui/tooltip';
import {
  inspirationImageUrl,
  lookbookImageFileUrl,
} from './visual-language-image-urls';

interface ReportImage {
  id: string;
  src: string;
  title: string;
  alt: string;
  lookbookImageId?: string;
}

interface VisualLanguageReportProps {
  projectName: string;
  title?: string;
  headerMeta?: ReactNode;
  action?: ReactNode;
  onDeleteLookbookImage?: (imageId: string) => Promise<void>;
  sections: MovieVisualLanguageSections | StoryboardLookbookDefinition;
  source:
    | {
        kind: 'inspiration';
        folderId: string;
      }
    | {
        kind: 'lookbook';
        imagesBySection: Record<LookbookSection, LookbookImage[]>;
      };
}

interface MovieVisualLanguageSections {
    thesis: ThesisSection;
    palette: PaletteSection;
    toneMood: ToneMoodSection;
    composition: PatternSection;
    lighting: PatternSection;
    texture: TextureSection;
    camera?: CameraSection;
    inspiredBy?: InspiredBySection;
}

export function VisualLanguageReport({
  projectName,
  title,
  headerMeta,
  action,
  sections,
  source,
  onDeleteLookbookImage,
}: VisualLanguageReportProps) {
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(
    null
  );
  const [deleteImage, setDeleteImage] = useState<ReportImage | null>(null);
  const canDeleteLookbookImages =
    source.kind === 'lookbook' && Boolean(onDeleteLookbookImage);
  const hasHeader = Boolean(title || headerMeta || action);
  if (isStoryboardSections(sections)) {
    const onRequestDeleteImage = canDeleteLookbookImages
      ? setDeleteImage
      : undefined;
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
      <article
        className={cn(
          'min-h-full bg-panel-bg px-4 text-foreground',
          hasHeader ? 'py-5' : 'py-0'
        )}
      >
        {hasHeader ? (
          <header className='flex flex-col gap-5 pb-8'>
            <div className='flex flex-wrap items-end justify-between gap-5'>
              <div className='min-w-0'>
                {title ? (
                  <h1 className='max-w-[920px] text-3xl font-black leading-none text-foreground sm:text-4xl lg:text-5xl'>
                    {title}
                  </h1>
                ) : null}
              </div>
              {action ? <div className='shrink-0'>{action}</div> : null}
            </div>
            {headerMeta ? <div>{headerMeta}</div> : null}
          </header>
        ) : null}
        <StoryboardSection number='01' title='Style brief'>
          {heroImage ? (
            <StoryboardHero
              image={heroImage}
              onOpen={() =>
                setPreviewImage({
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
                onOpenImage={setPreviewImage}
                onRequestDeleteImage={onRequestDeleteImage}
              />
            </div>
          ) : null}
        </StoryboardSection>
        <StoryboardSection number='02' title='Line and finish'>
          <StoryboardWidgetAndProof
            widget={<LineAndFinishWidget section={sections.lineAndFinish} />}
            images={lineAndFinishImages}
            onOpenImage={setPreviewImage}
            onRequestDeleteImage={onRequestDeleteImage}
          />
          <StoryboardProse className='mt-5' text={sections.lineAndFinish.text} />
        </StoryboardSection>
        <StoryboardSection number='03' title='Value and accent'>
          <StoryboardWidgetAndProof
            widget={<ValueAndAccentWidget section={sections.valueAndAccent} />}
            images={valueAndAccentImages}
            onOpenImage={setPreviewImage}
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
                onOpenImage={setPreviewImage}
                onRequestDeleteImage={onRequestDeleteImage}
              />
            </div>
          ) : null}
          <StoryboardProse className='mt-5' text={sections.guardrails.text} />
        </StoryboardSection>
        <ImagePreviewDialog
          images={previewImage ? [previewImage] : []}
          currentIndex={0}
          onOpenChange={(open) => !open && setPreviewImage(null)}
        />
        <DeleteConfirmDialog
          open={Boolean(deleteImage)}
          onOpenChange={(open) => !open && setDeleteImage(null)}
          title='Delete Image?'
          message='Remove this image from the lookbook. This cannot be undone.'
          onDelete={async () => {
            if (!deleteImage?.lookbookImageId || !onDeleteLookbookImage) return;
            await onDeleteLookbookImage(deleteImage.lookbookImageId);
            setDeleteImage(null);
            if (previewImage?.src === deleteImage.src) {
              setPreviewImage(null);
            }
          }}
        />
      </article>
    );
  }
  const themeColors = sections.palette.colors.map((color) => color.hex);
  const thesisImages = imagesForSection(
    projectName,
    source,
    'thesis',
    sections.thesis.imageFiles
  );
  const toneImages = imagesForSection(
    projectName,
    source,
    'toneMood',
    sections.toneMood.imageFiles
  );

  return (
    <article
      className={cn(
        'min-h-full bg-panel-bg px-4 text-foreground',
        hasHeader ? 'py-5' : 'py-0'
      )}
    >
      {hasHeader ? (
        <header className='flex flex-col gap-5 pb-8'>
          <div className='flex flex-wrap items-end justify-between gap-5'>
            <div className='min-w-0'>
              {title ? (
                <h1 className='max-w-[920px] text-4xl font-black leading-none text-foreground sm:text-5xl lg:text-6xl'>
                  {title}
                </h1>
              ) : null}
            </div>
            {action ? <div className='shrink-0'>{action}</div> : null}
          </div>
          {headerMeta ? <div>{headerMeta}</div> : null}
        </header>
      ) : null}

          <ReportSection number='01' kicker='Core Idea' title='The thesis'>
            <p className='max-w-[820px] text-lg font-semibold leading-8 text-foreground lg:text-xl lg:leading-9'>
              {sections.thesis.statement}
            </p>
          </ReportSection>
          <SectionWideContent>
            <div className='space-y-8'>
              <EvidenceGrid
                images={thesisImages}
                size='feature'
                onOpenImage={setPreviewImage}
                onRequestDeleteImage={
                  canDeleteLookbookImages ? setDeleteImage : undefined
                }
              />
              {sections.thesis.principles.length ? (
                <PrincipleList principles={sections.thesis.principles} />
              ) : null}
            </div>
          </SectionWideContent>

          <ReportSection number='02' kicker='Colour' title='Palette'>
            <p className='max-w-[820px] text-base font-semibold leading-8 text-foreground lg:text-lg'>
              {sections.palette.description}
            </p>
          </ReportSection>
          <SectionWideContent>
            <div className='space-y-8'>
              <PaletteGrid colors={sections.palette.colors} />
              <ObservationDeck
                observations={sections.palette.observations}
                projectName={projectName}
                source={source}
                onOpenImage={setPreviewImage}
                onRequestDeleteImage={
                  canDeleteLookbookImages ? setDeleteImage : undefined
                }
              />
              <EvidenceGrid
                images={imagesForSection(projectName, source, 'palette')}
                size='feature'
                onOpenImage={setPreviewImage}
                onRequestDeleteImage={
                  canDeleteLookbookImages ? setDeleteImage : undefined
                }
              />
            </div>
          </SectionWideContent>

          <ReportSection number='03' kicker='Grade' title='Tone'>
            <div className='grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]'>
              <div className='space-y-4'>
                <p className='text-2xl font-black leading-tight text-foreground'>
                  {sections.toneMood.tone}
                </p>
                <div className='flex flex-wrap gap-2'>
                  {sections.toneMood.moodTags.map((tag) => (
                    <span
                      key={tag}
                      className='rounded-full border border-border/50 bg-muted/50 px-3 py-1 text-xs font-semibold text-foreground/75'
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <p className='max-w-[760px] text-base leading-8 text-foreground/80'>
                {sections.toneMood.description}
              </p>
            </div>
          </ReportSection>
          <SectionWideContent>
            <div className='space-y-8'>
              <ToneBand colors={themeColors} />
              <EvidenceGrid
                images={toneImages}
                size='feature'
                onOpenImage={setPreviewImage}
                onRequestDeleteImage={
                  canDeleteLookbookImages ? setDeleteImage : undefined
                }
              />
            </div>
          </SectionWideContent>

          <PatternReportSection
            number='04'
            kicker='Composition'
            title='Frames'
            sectionKey='composition'
            section={sections.composition}
            projectName={projectName}
            source={source}
            onOpenImage={setPreviewImage}
            onRequestDeleteImage={
              canDeleteLookbookImages ? setDeleteImage : undefined
            }
          />

          <PatternReportSection
            number='05'
            kicker='Light'
            title='Lighting'
            sectionKey='lighting'
            section={sections.lighting}
            projectName={projectName}
            source={source}
            onOpenImage={setPreviewImage}
            onRequestDeleteImage={
              canDeleteLookbookImages ? setDeleteImage : undefined
            }
          />

          <ReportSection number='06' kicker='Surface' title='Texture'>
            <p className='max-w-[820px] text-base font-semibold leading-8 text-foreground lg:text-lg'>
              {sections.texture.description}
            </p>
          </ReportSection>
          <SectionWideContent>
            <div className='space-y-8'>
              <ObservationDeck
                observations={sections.texture.observations}
                projectName={projectName}
                source={source}
                onOpenImage={setPreviewImage}
                onRequestDeleteImage={
                  canDeleteLookbookImages ? setDeleteImage : undefined
                }
              />
              <EvidenceGrid
                images={imagesForSection(projectName, source, 'texture')}
                size='feature'
                onOpenImage={setPreviewImage}
                onRequestDeleteImage={
                  canDeleteLookbookImages ? setDeleteImage : undefined
                }
              />
            </div>
          </SectionWideContent>

          {sections.camera ? (
            <ReportSection number='07' kicker='Camera' title='Camera'>
              <p className='max-w-[820px] text-base font-semibold leading-8 text-foreground lg:text-lg'>
                {sections.camera.description}
              </p>
            </ReportSection>
          ) : null}
          {sections.camera ? (
            <SectionWideContent>
              <div className='space-y-8'>
                <PatternDeck
                  title='Movement'
                  patterns={sections.camera.movement}
                  projectName={projectName}
                  source={source}
                  onOpenImage={setPreviewImage}
                  onRequestDeleteImage={
                    canDeleteLookbookImages ? setDeleteImage : undefined
                  }
                />
                <PatternDeck
                  title='Motion'
                  patterns={sections.camera.motion}
                  projectName={projectName}
                  source={source}
                  onOpenImage={setPreviewImage}
                  onRequestDeleteImage={
                    canDeleteLookbookImages ? setDeleteImage : undefined
                  }
                />
                <PatternDeck
                  title='Framing'
                  patterns={sections.camera.framing}
                  projectName={projectName}
                  source={source}
                  onOpenImage={setPreviewImage}
                  onRequestDeleteImage={
                    canDeleteLookbookImages ? setDeleteImage : undefined
                  }
                />
                <EvidenceGrid
                  images={imagesForSection(projectName, source, 'camera')}
                  size='feature'
                  onOpenImage={setPreviewImage}
                  onRequestDeleteImage={
                    canDeleteLookbookImages ? setDeleteImage : undefined
                  }
                />
              </div>
            </SectionWideContent>
          ) : null}

          {sections.inspiredBy ? (
            <ReportSection
              number={sections.camera ? '08' : '07'}
              kicker='Lineage'
              title='Inspired by'
            >
              <p className='max-w-[820px] text-base font-semibold leading-8 text-foreground lg:text-lg'>
                {sections.inspiredBy.description}
              </p>
            </ReportSection>
          ) : null}
          {sections.inspiredBy ? (
            <SectionWideContent>
              <div className='space-y-8'>
                <LineageGrid
                  section={sections.inspiredBy}
                  projectName={projectName}
                  source={source}
                  onOpenImage={setPreviewImage}
                  onRequestDeleteImage={
                    canDeleteLookbookImages ? setDeleteImage : undefined
                  }
                />
              </div>
            </SectionWideContent>
          ) : null}
      <ImagePreviewDialog
        images={previewImage ? [previewImage] : []}
        currentIndex={0}
        onOpenChange={(open) => !open && setPreviewImage(null)}
      />
      <DeleteConfirmDialog
        open={Boolean(deleteImage)}
        onOpenChange={(open) => !open && setDeleteImage(null)}
        title='Delete Image?'
        message='Remove this image from the lookbook. This cannot be undone.'
        onDelete={async () => {
          if (!deleteImage?.lookbookImageId || !onDeleteLookbookImage) return;
          await onDeleteLookbookImage(deleteImage.lookbookImageId);
          setDeleteImage(null);
          if (previewImage?.src === deleteImage.src) {
            setPreviewImage(null);
          }
        }}
      />
    </article>
  );
}

function isStoryboardSections(
  sections: MovieVisualLanguageSections | StoryboardLookbookDefinition
): sections is StoryboardLookbookDefinition {
  return 'styleBrief' in sections;
}

function ReportSection({
  number,
  kicker,
  title,
  children,
}: {
  number: string;
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className='grid gap-6 border-t border-border/40 py-8 lg:grid-cols-[minmax(300px,0.42fr)_minmax(0,1fr)] lg:gap-8'>
      <div>
        <p className='font-mono text-xs uppercase text-muted-foreground'>
          {number} - {kicker}
        </p>
        <h2 className='mt-4 text-4xl font-black leading-none text-foreground sm:whitespace-nowrap sm:text-5xl xl:text-6xl'>
          {title}
        </h2>
      </div>
      <div className='min-w-0'>{children}</div>
    </section>
  );
}

function SectionWideContent({ children }: { children: ReactNode }) {
  return <div className='pb-10 sm:pb-12'>{children}</div>;
}

function PrincipleList({ principles }: { principles: string[] }) {
  return (
    <ol className='grid gap-3 lg:grid-cols-2'>
      {principles.map((principle, index) => (
        <li
          key={principle}
          className='grid grid-cols-[2rem_minmax(0,1fr)] gap-3 border-t border-border/40 pt-4 text-sm leading-6 text-foreground/75'
        >
          <span className='font-mono text-xs text-primary'>
            {String(index + 1).padStart(2, '0')}
          </span>
          <span>{principle}</span>
        </li>
      ))}
    </ol>
  );
}

function PaletteGrid({ colors }: { colors: ColorSwatch[] }) {
  if (!colors.length) return null;
  return (
    <div className='grid grid-cols-[repeat(auto-fit,minmax(148px,1fr))] gap-3'>
      {colors.map((color) => (
        <div
          key={`${color.hex}-${color.name}`}
          className='overflow-hidden rounded-md border border-border/40 bg-card shadow-[0_18px_45px_rgba(0,0,0,0.26)]'
        >
          <div className='h-28' style={{ backgroundColor: color.hex }} />
          <div className='min-h-[150px] space-y-2 p-4'>
            <p className='text-sm font-black text-foreground'>{color.name}</p>
            <p className='font-mono text-xs text-muted-foreground'>{color.hex}</p>
            <p className='text-sm leading-6 text-muted-foreground'>{color.meaning}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ToneBand({ colors }: { colors: string[] }) {
  const background = colors.length
    ? `linear-gradient(90deg, ${colors.join(', ')})`
    : 'linear-gradient(90deg, var(--muted), var(--border), var(--foreground))';
  return (
    <div className='overflow-hidden rounded-md border border-border/40 bg-card'>
      <div className='h-24' style={{ background }} />
      <div className='grid grid-cols-3 border-t border-border/40 text-xs font-semibold text-muted-foreground'>
        <span className='px-4 py-3'>shadow</span>
        <span className='border-x border-border/40 px-4 py-3'>midtone</span>
        <span className='px-4 py-3'>highlight</span>
      </div>
    </div>
  );
}

function PatternReportSection({
  number,
  kicker,
  title,
  sectionKey,
  section,
  projectName,
  source,
  onOpenImage,
  onRequestDeleteImage,
}: {
  number: string;
  kicker: string;
  title: string;
  sectionKey: LookbookSection;
  section: PatternSection;
  projectName: string;
  source: VisualLanguageReportProps['source'];
  onOpenImage: (image: PreviewImage) => void;
  onRequestDeleteImage?: (image: ReportImage) => void;
}) {
  return (
    <>
      <ReportSection number={number} kicker={kicker} title={title}>
        <p className='max-w-[820px] text-base font-semibold leading-8 text-foreground lg:text-lg'>
          {section.description}
        </p>
      </ReportSection>
      <SectionWideContent>
        <div className='space-y-8'>
          <PatternDeck
            patterns={section.patterns}
            projectName={projectName}
            source={source}
            onOpenImage={onOpenImage}
            onRequestDeleteImage={onRequestDeleteImage}
          />
          <EvidenceGrid
            images={imagesForSection(projectName, source, sectionKey)}
            size='feature'
            onOpenImage={onOpenImage}
            onRequestDeleteImage={onRequestDeleteImage}
          />
        </div>
      </SectionWideContent>
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

function PatternDeck({
  title,
  patterns,
  projectName,
  source,
  onOpenImage,
  onRequestDeleteImage,
}: {
  title?: string;
  patterns: Pattern[];
  projectName: string;
  source: VisualLanguageReportProps['source'];
  onOpenImage: (image: PreviewImage) => void;
  onRequestDeleteImage?: (image: ReportImage) => void;
}) {
  if (!patterns.length) return null;
  return (
    <div className='space-y-4'>
      {title ? (
        <h3 className='text-sm font-black uppercase text-muted-foreground'>{title}</h3>
      ) : null}
      <div className='grid gap-4'>
        {patterns.map((pattern) => (
          <div
            key={`${title ?? 'pattern'}-${pattern.name}`}
            className='rounded-md border border-border/40 bg-card/92 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.22)]'
          >
            <div className='grid gap-5 xl:grid-cols-[minmax(0,0.82fr)_minmax(260px,0.68fr)]'>
              <div>
                <h3 className='text-xl font-black leading-tight text-foreground'>
                  {pattern.name}
                </h3>
                <p className='mt-3 text-sm leading-7 text-foreground/75'>
                  {pattern.description}
                </p>
              </div>
              <EvidenceGrid
                images={imagesForNestedReferences(projectName, source, pattern.imageFiles)}
                size='compact'
                onOpenImage={onOpenImage}
                onRequestDeleteImage={onRequestDeleteImage}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ObservationDeck({
  observations,
  projectName,
  source,
  onOpenImage,
  onRequestDeleteImage,
}: {
  observations: Observation[];
  projectName: string;
  source: VisualLanguageReportProps['source'];
  onOpenImage: (image: PreviewImage) => void;
  onRequestDeleteImage?: (image: ReportImage) => void;
}) {
  if (!observations.length) return null;
  return (
    <div className='grid gap-4 lg:grid-cols-2'>
      {observations.map((observation) => (
        <div
          key={observation.text}
          className='rounded-md border border-border/40 bg-card/92 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.2)]'
        >
          <p className='text-sm font-semibold leading-7 text-foreground/85'>
            {observation.text}
          </p>
          <EvidenceGrid
            images={imagesForNestedReferences(projectName, source, observation.imageFiles)}
            size='compact'
            className='mt-4'
            onOpenImage={onOpenImage}
            onRequestDeleteImage={onRequestDeleteImage}
          />
        </div>
      ))}
    </div>
  );
}

function LineageGrid({
  section,
  projectName,
  source,
  onOpenImage,
  onRequestDeleteImage,
}: {
  section: InspiredBySection;
  projectName: string;
  source: VisualLanguageReportProps['source'];
  onOpenImage: (image: PreviewImage) => void;
  onRequestDeleteImage?: (image: ReportImage) => void;
}) {
  if (!section.items.length) return null;
  return (
    <div className='grid gap-4 lg:grid-cols-2'>
      {section.items.map((item) => (
        <div
          key={`${item.category}-${item.name}`}
          className='rounded-md border border-border/40 bg-card/92 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.2)]'
        >
          <div className='flex flex-wrap items-center gap-2'>
            <span className='rounded-full border border-border/40 px-2.5 py-1 text-xs font-semibold text-foreground/75'>
              {item.category}
            </span>
            <span className='rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary'>
              {item.confidence}
            </span>
          </div>
          <h3 className='mt-4 text-xl font-black leading-tight text-foreground'>
            {item.name}
          </h3>
          <p className='mt-3 text-sm leading-7 text-foreground/75'>{item.why}</p>
          <EvidenceGrid
            images={imagesForNestedReferences(projectName, source, item.imageFiles)}
            size='compact'
            className='mt-4'
            onOpenImage={onOpenImage}
            onRequestDeleteImage={onRequestDeleteImage}
          />
        </div>
      ))}
    </div>
  );
}

function EvidenceGrid({
  images,
  size,
  className,
  onOpenImage,
  onRequestDeleteImage,
}: {
  images: ReportImage[];
  size: 'feature' | 'compact';
  className?: string;
  onOpenImage: (image: PreviewImage) => void;
  onRequestDeleteImage?: (image: ReportImage) => void;
}) {
  if (!images.length) return null;
  return (
    <div
      className={cn(
        'grid gap-3',
        size === 'feature'
          ? 'grid-cols-[repeat(auto-fit,minmax(210px,1fr))]'
          : 'grid-cols-[repeat(auto-fit,minmax(96px,1fr))]',
        className
      )}
    >
      {images.map((image) => (
        <EvidenceImage
          key={image.id}
          image={image}
          size={size}
          onOpen={() =>
            onOpenImage({
              src: image.src,
              alt: image.alt,
              title: readableImageTitle(image),
            })
          }
          onRequestDelete={
            image.lookbookImageId && onRequestDeleteImage
              ? () => onRequestDeleteImage(image)
              : undefined
          }
        />
      ))}
    </div>
  );
}

function EvidenceImage({
  image,
  size,
  onOpen,
  onRequestDelete,
}: {
  image: ReportImage;
  size: 'feature' | 'compact';
  onOpen: () => void;
  onRequestDelete?: () => void;
}) {
  return (
    <figure
      className={cn(
        'group relative overflow-hidden rounded-md border border-border/40 bg-card shadow-[0_18px_45px_rgba(0,0,0,0.3)]',
        size === 'feature' ? 'min-h-0' : 'min-h-0'
      )}
      title={image.title}
    >
      <Button
        type='button'
        variant='ghost'
        className='block h-auto w-full rounded-none p-0 hover:bg-transparent'
        onClick={onOpen}
      >
        <span className='block aspect-video'>
          <img src={image.src} alt={image.alt} className='h-full w-full object-cover' />
        </span>
      </Button>
      {image.lookbookImageId ? (
        <figcaption className='pointer-events-none absolute bottom-2 left-2 right-2 flex justify-start'>
          <span className='max-w-full overflow-hidden rounded-sm border border-border/20 bg-panel-bg/70 px-2 py-1 text-[10px] font-medium leading-4 text-foreground/65 shadow-sm backdrop-blur-sm transition-opacity group-hover:text-foreground/85 group-focus-within:text-foreground/85 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]'>
            {readableImageTitle(image)}
          </span>
        </figcaption>
      ) : null}
      {onRequestDelete ? (
        <span className='absolute right-1.5 top-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type='button'
                size='icon'
                variant='ghost'
                className='h-7 w-7 bg-black/50 text-white shadow-sm hover:bg-destructive hover:text-destructive-foreground'
                aria-label={`Delete ${readableImageTitle(image)}`}
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

function imagesForNestedReferences(
  projectName: string,
  source: VisualLanguageReportProps['source'],
  imageFiles: string[] = []
): ReportImage[] {
  if (source.kind !== 'inspiration') return [];
  return imageFiles.map((fileName) => ({
    id: fileName,
    src: inspirationImageUrl(projectName, source.folderId, fileName),
    alt: `${fileName} inspiration grab`,
    title: fileName,
  }));
}

function imagesForSection(
  projectName: string,
  source: VisualLanguageReportProps['source'],
  section: LookbookSection,
  imageFiles: string[] = []
): ReportImage[] {
  if (source.kind === 'inspiration') {
    return imageFiles.map((fileName) => ({
      id: fileName,
      src: inspirationImageUrl(projectName, source.folderId, fileName),
      alt: `${fileName} inspiration grab`,
      title: fileName,
    }));
  }
  return (source.imagesBySection[section] ?? []).flatMap((image) => {
    const file = image.asset.files[0];
    if (!file) return [];
    return [
      {
        id: image.id,
        src: lookbookImageFileUrl(projectName, image.id, file.id),
        alt: image.asset.title,
        title: image.asset.title,
        lookbookImageId: image.id,
      },
    ];
  });
}

function readableImageTitle(image: ReportImage): string {
  if (image.lookbookImageId) {
    return humanizeTitle(image.title);
  }
  return compactInspirationTitle(image.title);
}

function compactInspirationTitle(title: string): string {
  const fileName = title.split('/').at(-1) ?? title;
  const withoutExtension = fileName.replace(/\.[^.]+$/, '');
  const stillMatch = /^(still-\d+)/i.exec(withoutExtension);
  if (stillMatch?.[1]) return stillMatch[1];
  return humanizeTitle(withoutExtension);
}

function humanizeTitle(title: string): string {
  const fileName = title.split('/').at(-1) ?? title;
  const withoutExtension = fileName.replace(/\.[^.]+$/, '');
  const words = withoutExtension
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!words) return title;
  return words.charAt(0).toUpperCase() + words.slice(1);
}
