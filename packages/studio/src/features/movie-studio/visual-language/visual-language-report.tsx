import type {
  CameraSection,
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
import { VisualLanguageImageCard } from './visual-language-image-card';
import { VisualLanguageImageGrid } from './visual-language-image-grid';
import {
  inspirationImageUrl,
  lookbookImageFileUrl,
} from './visual-language-image-urls';
import { VisualLanguageReportSection } from './visual-language-report-section';

interface ReportImage {
  id: string;
  src: string;
  title: string;
  alt: string;
}

interface VisualLanguageReportProps {
  projectName: string;
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
  sections,
  source,
}: VisualLanguageReportProps) {
  return (
    <div className='px-1'>
      <VisualLanguageReportSection number='01' title='Thesis'>
        <p className='leading-6 text-foreground/90'>{sections.thesis.statement}</p>
        {sections.thesis.principles.length ? (
          <ul className='space-y-2 text-sm text-muted-foreground'>
            {sections.thesis.principles.map((principle) => (
              <li key={principle} className='rounded-md border border-border/40 px-3 py-2'>
                {principle}
              </li>
            ))}
          </ul>
        ) : null}
        <SectionImages
          images={imagesForSection(projectName, source, 'thesis', sections.thesis.imageFiles)}
        />
      </VisualLanguageReportSection>

      <VisualLanguageReportSection number='02' title='Palette'>
        <p className='leading-6 text-foreground/90'>{sections.palette.description}</p>
        <div className='grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3'>
          {sections.palette.colors.map((color) => (
            <div
              key={`${color.hex}-${color.name}`}
              className='overflow-hidden rounded-md border border-border/40 bg-card'
            >
              <div className='h-14' style={{ backgroundColor: color.hex }} />
              <div className='space-y-1 p-3'>
                <p className='text-xs font-semibold text-foreground'>{color.name}</p>
                <p className='font-mono text-[11px] text-muted-foreground'>{color.hex}</p>
                <p className='text-xs text-muted-foreground'>{color.meaning}</p>
              </div>
            </div>
          ))}
        </div>
        <ObservationList
          observations={sections.palette.observations}
          projectName={projectName}
          source={source}
        />
        <SectionImages
          images={imagesForSection(projectName, source, 'palette')}
        />
      </VisualLanguageReportSection>

      <VisualLanguageReportSection number='03' title='Tone & Mood'>
        <div className='h-14 overflow-hidden rounded-md border border-border/40'>
          <div
            className='grid h-full grid-cols-3'
            style={{
              background: toneStripBackground(sections.palette.colors.map((color) => color.hex)),
            }}
          >
            {['shadow', 'midtone', 'highlight'].map((label) => (
              <span
                key={label}
                className='flex items-end px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/85 drop-shadow'
              >
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className='flex flex-wrap gap-2'>
          {sections.toneMood.moodTags.map((tag) => (
            <span
              key={tag}
              className='rounded-full border border-border/50 px-2.5 py-1 text-xs text-muted-foreground'
            >
              {tag}
            </span>
          ))}
        </div>
        <p className='text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
          {sections.toneMood.tone}
        </p>
        <p className='leading-6 text-foreground/90'>{sections.toneMood.description}</p>
        <SectionImages
          images={imagesForSection(projectName, source, 'tone_mood', sections.toneMood.imageFiles)}
        />
      </VisualLanguageReportSection>

      <PatternReportSection
        number='04'
        title='Composition'
        sectionKey='composition'
        section={sections.composition}
        projectName={projectName}
        source={source}
      />
      <PatternReportSection
        number='05'
        title='Lighting'
        sectionKey='lighting'
        section={sections.lighting}
        projectName={projectName}
        source={source}
      />

      <VisualLanguageReportSection number='06' title='Texture'>
        <p className='leading-6 text-foreground/90'>{sections.texture.description}</p>
        <ObservationList
          observations={sections.texture.observations}
          projectName={projectName}
          source={source}
        />
        <SectionImages
          images={imagesForSection(projectName, source, 'texture')}
        />
      </VisualLanguageReportSection>

      {sections.camera ? (
        <VisualLanguageReportSection number='07' title='Camera'>
          <p className='leading-6 text-foreground/90'>{sections.camera.description}</p>
          <PatternGroup
            title='Movement'
            patterns={sections.camera.movement}
            projectName={projectName}
            source={source}
          />
          <PatternGroup
            title='Motion'
            patterns={sections.camera.motion}
            projectName={projectName}
            source={source}
          />
          <PatternGroup
            title='Framing'
            patterns={sections.camera.framing}
            projectName={projectName}
            source={source}
          />
          <SectionImages
            images={imagesForSection(projectName, source, 'camera')}
          />
        </VisualLanguageReportSection>
      ) : null}

      {sections.inspiredBy ? (
        <VisualLanguageReportSection number='07' title='Lineage'>
          <p className='leading-6 text-foreground/90'>{sections.inspiredBy.description}</p>
          <div className='grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3'>
            {sections.inspiredBy.items.map((item) => (
              <div
                key={`${item.category}-${item.name}`}
                className='rounded-md border border-border/40 bg-card p-3'
              >
                <p className='text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
                  {item.category}
                </p>
                <p className='mt-1 text-sm font-semibold text-foreground'>{item.name}</p>
                <p className='mt-2 text-xs text-muted-foreground'>{item.why}</p>
                <NestedImages
                  projectName={projectName}
                  source={source}
                  imageFiles={item.imageFiles}
                />
              </div>
            ))}
          </div>
        </VisualLanguageReportSection>
      ) : null}
    </div>
  );
}

function PatternReportSection({
  number,
  title,
  sectionKey,
  section,
  projectName,
  source,
}: {
  number: string;
  title: string;
  sectionKey: LookbookSection;
  section: PatternSection;
  projectName: string;
  source: VisualLanguageReportProps['source'];
}) {
  return (
    <VisualLanguageReportSection number={number} title={title}>
      <p className='leading-6 text-foreground/90'>{section.description}</p>
      <PatternGroup patterns={section.patterns} projectName={projectName} source={source} />
      <SectionImages images={imagesForSection(projectName, source, sectionKey)} />
    </VisualLanguageReportSection>
  );
}

function PatternGroup({
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
  return (
    <div className='space-y-2'>
      {title ? (
        <p className='text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
          {title}
        </p>
      ) : null}
      {patterns.map((pattern) => (
        <div
          key={`${title ?? 'pattern'}-${pattern.name}`}
          className='rounded-md border border-border/40 bg-card/60 p-3'
        >
          <p className='text-sm font-semibold text-foreground'>{pattern.name}</p>
          <p className='mt-1 text-sm leading-6 text-muted-foreground'>
            {pattern.description}
          </p>
          <NestedImages
            projectName={projectName}
            source={source}
            imageFiles={pattern.imageFiles}
          />
        </div>
      ))}
    </div>
  );
}

function ObservationList({
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
    <div className='space-y-2'>
      {observations.map((observation) => (
        <div
          key={observation.text}
          className='rounded-md border border-border/40 bg-card/60 px-3 py-2 text-sm text-muted-foreground'
        >
          <p>{observation.text}</p>
          <NestedImages
            projectName={projectName}
            source={source}
            imageFiles={observation.imageFiles}
          />
        </div>
      ))}
    </div>
  );
}

function NestedImages({
  projectName,
  source,
  imageFiles,
}: {
  projectName: string;
  source: VisualLanguageReportProps['source'];
  imageFiles?: string[];
}) {
  return (
    <SectionImages images={imagesForNestedReferences(projectName, source, imageFiles)} />
  );
}

function SectionImages({ images }: { images: ReportImage[] }) {
  if (!images.length) return null;
  return (
    <VisualLanguageImageGrid>
      {images.map((image) => (
        <VisualLanguageImageCard
          key={image.id}
          src={image.src}
          alt={image.alt}
          title={image.title}
        />
      ))}
    </VisualLanguageImageGrid>
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

function toneStripBackground(colors: string[]): string {
  if (!colors.length) {
    return 'linear-gradient(90deg, #20242a, #626a72, #d0d5d8)';
  }
  return `linear-gradient(90deg, ${colors.join(', ')})`;
}
