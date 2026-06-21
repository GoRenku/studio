import type {
  CameraSection,
  ColorSwatch,
  InspiredBySection,
  Observation,
  PaletteSection,
  Pattern,
  PatternSection,
  TextureSection,
  ThesisSection,
  ToneMoodSection,
} from '@gorenku/studio-core/client';
import type { PreviewImage } from '@/ui/image-preview-dialog';
import {
  EvidenceGrid,
  LookbookReportProse,
  LookbookReportSection,
  SectionWideContent,
} from './lookbook-report-shared';
import {
  imagesForNestedReferences,
  imagesForSection,
  type LookbookReportSource,
  type ReportImage,
} from './lookbook-report-images';

export interface MovieVisualLanguageSections {
  thesis: ThesisSection;
  palette: PaletteSection;
  toneMood: ToneMoodSection;
  composition: PatternSection;
  lighting: PatternSection;
  texture: TextureSection;
  camera?: CameraSection;
  inspiredBy?: InspiredBySection;
}

interface MovieLookbookReportProps {
  projectName: string;
  sections: MovieVisualLanguageSections;
  source: LookbookReportSource;
  onOpenImage: (image: PreviewImage) => void;
  onRequestDeleteImage?: (image: ReportImage) => void;
}

export function MovieLookbookReport({
  projectName,
  sections,
  source,
  onOpenImage,
  onRequestDeleteImage,
}: MovieLookbookReportProps) {
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
    <>
      <LookbookReportSection number='01' kicker='Core Idea' title='The thesis'>
        <LookbookReportProse className='font-semibold text-foreground/85'>
          {sections.thesis.statement}
        </LookbookReportProse>
      </LookbookReportSection>
      <SectionWideContent>
        <div className='space-y-8'>
          <EvidenceGrid
            images={thesisImages}
            size='feature'
            onOpenImage={onOpenImage}
            onRequestDeleteImage={onRequestDeleteImage}
          />
          {sections.thesis.principles.length ? (
            <PrincipleList principles={sections.thesis.principles} />
          ) : null}
        </div>
      </SectionWideContent>

      <LookbookReportSection number='02' kicker='Color' title='Palette'>
        <LookbookReportProse className='font-semibold text-foreground/85'>
          {sections.palette.description}
        </LookbookReportProse>
      </LookbookReportSection>
      <SectionWideContent>
        <div className='space-y-8'>
          <PaletteGrid colors={sections.palette.colors} />
          <ObservationDeck
            observations={sections.palette.observations}
            projectName={projectName}
            source={source}
            onOpenImage={onOpenImage}
            onRequestDeleteImage={onRequestDeleteImage}
          />
          <EvidenceGrid
            images={imagesForSection(projectName, source, 'palette')}
            size='feature'
            onOpenImage={onOpenImage}
            onRequestDeleteImage={onRequestDeleteImage}
          />
        </div>
      </SectionWideContent>

      <LookbookReportSection number='03' kicker='Grade' title='Tone'>
        <div className='grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]'>
          <div className='space-y-4'>
            <p className='text-xl font-black leading-tight text-foreground'>
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
          <LookbookReportProse>{sections.toneMood.description}</LookbookReportProse>
        </div>
      </LookbookReportSection>
      <SectionWideContent>
        <div className='space-y-8'>
          <ToneBand colors={themeColors} />
          <EvidenceGrid
            images={toneImages}
            size='feature'
            onOpenImage={onOpenImage}
            onRequestDeleteImage={onRequestDeleteImage}
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
        onOpenImage={onOpenImage}
        onRequestDeleteImage={onRequestDeleteImage}
      />

      <PatternReportSection
        number='05'
        kicker='Light'
        title='Lighting'
        sectionKey='lighting'
        section={sections.lighting}
        projectName={projectName}
        source={source}
        onOpenImage={onOpenImage}
        onRequestDeleteImage={onRequestDeleteImage}
      />

      <LookbookReportSection number='06' kicker='Surface' title='Texture'>
        <LookbookReportProse className='font-semibold text-foreground/85'>
          {sections.texture.description}
        </LookbookReportProse>
      </LookbookReportSection>
      <SectionWideContent>
        <div className='space-y-8'>
          <ObservationDeck
            observations={sections.texture.observations}
            projectName={projectName}
            source={source}
            onOpenImage={onOpenImage}
            onRequestDeleteImage={onRequestDeleteImage}
          />
          <EvidenceGrid
            images={imagesForSection(projectName, source, 'texture')}
            size='feature'
            onOpenImage={onOpenImage}
            onRequestDeleteImage={onRequestDeleteImage}
          />
        </div>
      </SectionWideContent>

      {sections.camera ? (
        <LookbookReportSection number='07' kicker='Camera' title='Camera'>
          <LookbookReportProse className='font-semibold text-foreground/85'>
            {sections.camera.description}
          </LookbookReportProse>
        </LookbookReportSection>
      ) : null}
      {sections.camera ? (
        <SectionWideContent>
          <div className='space-y-8'>
            <PatternDeck
              title='Movement'
              patterns={sections.camera.movement}
              projectName={projectName}
              source={source}
              onOpenImage={onOpenImage}
              onRequestDeleteImage={onRequestDeleteImage}
            />
            <PatternDeck
              title='Motion'
              patterns={sections.camera.motion}
              projectName={projectName}
              source={source}
              onOpenImage={onOpenImage}
              onRequestDeleteImage={onRequestDeleteImage}
            />
            <PatternDeck
              title='Framing'
              patterns={sections.camera.framing}
              projectName={projectName}
              source={source}
              onOpenImage={onOpenImage}
              onRequestDeleteImage={onRequestDeleteImage}
            />
            <EvidenceGrid
              images={imagesForSection(projectName, source, 'camera')}
              size='feature'
              onOpenImage={onOpenImage}
              onRequestDeleteImage={onRequestDeleteImage}
            />
          </div>
        </SectionWideContent>
      ) : null}

      {sections.inspiredBy ? (
        <LookbookReportSection
          number={sections.camera ? '08' : '07'}
          kicker='Lineage'
          title='Inspired by'
        >
          <LookbookReportProse className='font-semibold text-foreground/85'>
            {sections.inspiredBy.description}
          </LookbookReportProse>
        </LookbookReportSection>
      ) : null}
      {sections.inspiredBy ? (
        <SectionWideContent>
          <div className='space-y-8'>
            <LineageGrid
              section={sections.inspiredBy}
              projectName={projectName}
              source={source}
              onOpenImage={onOpenImage}
              onRequestDeleteImage={onRequestDeleteImage}
            />
          </div>
        </SectionWideContent>
      ) : null}
    </>
  );
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
  sectionKey: 'composition' | 'lighting';
  section: PatternSection;
  projectName: string;
  source: LookbookReportSource;
  onOpenImage: (image: PreviewImage) => void;
  onRequestDeleteImage?: (image: ReportImage) => void;
}) {
  return (
    <>
      <LookbookReportSection number={number} kicker={kicker} title={title}>
        <LookbookReportProse className='font-semibold text-foreground/85'>
          {section.description}
        </LookbookReportProse>
      </LookbookReportSection>
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
  source: LookbookReportSource;
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
  source: LookbookReportSource;
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
  source: LookbookReportSource;
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
