import type { ReactNode } from 'react';
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
  TextureSection,
  ThesisSection,
  ToneMoodSection,
} from '@gorenku/studio-core/client';
import { cn } from '@/lib/utils';
import {
  inspirationImageUrl,
  lookbookImageFileUrl,
} from './visual-language-image-urls';

interface ReportImage {
  id: string;
  src: string;
  title: string;
  alt: string;
}

interface VisualLanguageReportProps {
  projectName: string;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  sections: {
    thesis: ThesisSection;
    palette: PaletteSection;
    toneMood: ToneMoodSection;
    composition: PatternSection;
    lighting: PatternSection;
    texture: TextureSection;
    camera?: CameraSection;
    inspiredBy?: InspiredBySection;
  };
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

export function VisualLanguageReport({
  projectName,
  title,
  subtitle,
  action,
  sections,
  source,
}: VisualLanguageReportProps) {
  const hasHeader = Boolean(title || subtitle || action);
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
    'tone_mood',
    sections.toneMood.imageFiles
  );

  return (
    <article className='min-h-full bg-panel-bg text-foreground'>
      <div className='bg-[linear-gradient(180deg,var(--panel-bg)_0%,var(--background)_360px,var(--panel-bg)_100%)]'>
        <div
          className={cn(
            'mx-auto max-w-[1240px] px-5 sm:px-8 lg:px-12',
            hasHeader ? 'py-8' : 'py-0'
          )}
        >
          {hasHeader ? (
            <header className='mb-10 flex flex-wrap items-end justify-between gap-5 border-b border-border/40 pb-8'>
              <div className='min-w-0'>
                <p className='text-xs font-semibold uppercase text-muted-foreground'>
                  Visual Language
                </p>
                {title ? (
                  <h1 className='mt-3 max-w-[920px] text-4xl font-black leading-none text-foreground sm:text-5xl lg:text-6xl'>
                    {title}
                  </h1>
                ) : null}
                {subtitle ? (
                  <p className='mt-3 max-w-[760px] text-sm leading-6 text-muted-foreground'>
                    {subtitle}
                  </p>
                ) : null}
              </div>
              {action ? <div className='shrink-0'>{action}</div> : null}
            </header>
          ) : null}

          <ReportSection number='01' kicker='Core Idea' title='The thesis'>
            <p className='max-w-[820px] text-lg font-semibold leading-8 text-foreground lg:text-xl lg:leading-9'>
              {sections.thesis.statement}
            </p>
          </ReportSection>
          <SectionWideContent>
            <div className='space-y-8'>
              <EvidenceGrid images={thesisImages} size='feature' />
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
              <EvidenceGrid images={toneImages} size='feature' />
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
          />

          <PatternReportSection
            number='05'
            kicker='Light'
            title='Lighting'
            sectionKey='lighting'
            section={sections.lighting}
            projectName={projectName}
            source={source}
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
              />
              <EvidenceGrid
                images={imagesForSection(projectName, source, 'texture')}
                size='feature'
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
                />
                <PatternDeck
                  title='Motion'
                  patterns={sections.camera.motion}
                  projectName={projectName}
                  source={source}
                />
                <PatternDeck
                  title='Framing'
                  patterns={sections.camera.framing}
                  projectName={projectName}
                  source={source}
                />
                <EvidenceGrid
                  images={imagesForSection(projectName, source, 'camera')}
                  size='feature'
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
                />
              </div>
            </SectionWideContent>
          ) : null}
        </div>
      </div>
    </article>
  );
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
    <section className='grid gap-8 border-t border-border/40 py-10 sm:py-12 lg:grid-cols-[minmax(300px,0.42fr)_minmax(0,1fr)] lg:gap-12'>
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
}: {
  number: string;
  kicker: string;
  title: string;
  sectionKey: LookbookSection;
  section: PatternSection;
  projectName: string;
  source: VisualLanguageReportProps['source'];
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
          />
          <EvidenceGrid
            images={imagesForSection(projectName, source, sectionKey)}
            size='feature'
          />
        </div>
      </SectionWideContent>
    </>
  );
}

function PatternDeck({
  title,
  patterns,
  projectName,
  source,
}: {
  title?: string;
  patterns: Pattern[];
  projectName: string;
  source: VisualLanguageReportProps['source'];
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
}: {
  observations: Observation[];
  projectName: string;
  source: VisualLanguageReportProps['source'];
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
}: {
  section: InspiredBySection;
  projectName: string;
  source: VisualLanguageReportProps['source'];
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
}: {
  images: ReportImage[];
  size: 'feature' | 'compact';
  className?: string;
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
        <EvidenceImage key={image.id} image={image} size={size} />
      ))}
    </div>
  );
}

function EvidenceImage({
  image,
  size,
}: {
  image: ReportImage;
  size: 'feature' | 'compact';
}) {
  return (
    <figure
      className={cn(
        'group relative overflow-hidden rounded-md border border-border/40 bg-card shadow-[0_18px_45px_rgba(0,0,0,0.3)]',
        size === 'feature' ? 'min-h-0' : 'min-h-0'
      )}
      title={image.title}
    >
      <div className='aspect-video'>
        <img src={image.src} alt={image.alt} className='h-full w-full object-cover' />
      </div>
      <figcaption className='pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.82))] px-3 pb-2 pt-8 text-xs font-semibold text-white opacity-90'>
        {compactImageTitle(image.title)}
      </figcaption>
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
  return source.imagesBySection[section].flatMap((image) => {
    const file = image.asset.files[0];
    if (!file) return [];
    return [
      {
        id: image.id,
        src: lookbookImageFileUrl(projectName, image.id, file.id),
        alt: image.asset.title,
        title: image.asset.title,
      },
    ];
  });
}

function compactImageTitle(title: string): string {
  const fileName = title.split('/').at(-1) ?? title;
  const withoutExtension = fileName.replace(/\.[^.]+$/, '');
  const stillMatch = /^(still-\d+)/i.exec(withoutExtension);
  if (stillMatch?.[1]) return stillMatch[1];
  return withoutExtension.length > 22
    ? `${withoutExtension.slice(0, 19)}...`
    : withoutExtension;
}
