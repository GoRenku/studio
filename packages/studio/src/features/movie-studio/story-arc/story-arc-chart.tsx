import { Fragment, useMemo, useState } from 'react';
import {
  Anchor,
  CheckCircle2,
  Crown,
  Flag,
  Star,
  TriangleAlert,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type {
  ScreenplayAnalysisCriterion,
  ScreenplayBeatRole,
  ScreenplaySceneAnalysis,
} from '@gorenku/studio-core/client';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { cn } from '@/lib/utils';
import type { StoryArcResourceResponse } from '@/services/studio-project-contracts';
import {
  DEFAULT_CRITERION_COLORS,
  VIEW_BOX,
  buildMeasureView,
  buildStoryArcChartModel,
  scoreToY,
  type MeasureBeat,
  type MeasureView,
  type ScoreDomain,
  type StoryArcActBand,
  type StoryArcScenePoint,
} from './story-arc-chart-model';
import { StoryArcSceneAnalysisDialog } from './story-arc-scene-analysis-dialog';

interface StoryArcChartProps {
  resource: StoryArcResourceResponse;
}

/** Width of the left axis gutter, shared by the header, plot, and scene rail. */
const AXIS_GUTTER = 'w-12 shrink-0 sm:w-14';

/** Surface override for the inverted-by-default hover tooltip chip. */
const TOOLTIP_SURFACE =
  'max-w-xs whitespace-normal border border-border/60 bg-popover text-popover-foreground shadow-lg';

/** A measured beat lands far from its typical structural spot. */
const BEAT_DEVIATION_THRESHOLD = 0.06;

export function StoryArcChart({ resource }: StoryArcChartProps) {
  const model = useMemo(() => buildStoryArcChartModel(resource), [resource]);
  const [selectedCriterionKey, setSelectedCriterionKey] = useState(
    model.criteria[0]?.key ?? 'dramaticEnergy'
  );
  const [selectedScene, setSelectedScene] = useState<StoryArcScenePoint | null>(null);

  const selectedCriterion =
    model.criteria.find((criterion) => criterion.key === selectedCriterionKey) ??
    model.criteria[0];
  const sceneAnalysisById = useMemo(
    () =>
      new Map(
        resource.activeAnalysis?.scenes.map((scene) => [scene.sceneId, scene]) ?? []
      ),
    [resource.activeAnalysis]
  );
  const sceneById = useMemo(
    () => new Map(model.scenes.map((scene) => [scene.id, scene])),
    [model.scenes]
  );

  const view = useMemo(
    () =>
      selectedCriterion
        ? buildMeasureView({
            criterion: selectedCriterion,
            scenes: model.scenes,
            beats: model.beats,
            hasAnalysis: model.hasAnalysis,
            scoreForScene: (sceneId) =>
              sceneAnalysisById.get(sceneId)?.scoreByCriterion[selectedCriterion.key],
          })
        : null,
    [selectedCriterion, model, sceneAnalysisById]
  );

  if (model.scenes.length === 0 || !view || !selectedCriterion) {
    return (
      <section className='rounded-(--radius-panel) border border-border/60 bg-card/50 p-6'>
        <p className='text-sm text-muted-foreground'>
          No scenes have been added yet.
        </p>
      </section>
    );
  }

  return (
    <>
      <section className='rounded-(--radius-panel) border border-border/60 bg-gradient-to-b from-card/70 to-card/25 shadow-sm ring-1 ring-inset ring-foreground/[0.03]'>
        <div className='px-4 pb-5 pt-6 sm:px-7'>
          <ActHeaderRow acts={model.acts} />

          {/* Tweak graph height here: adjust h-[400px]. */}
          <div className='mt-4 flex'>
            <AxisColumn label={selectedCriterion.label} domain={view.domain} />
            <div className='relative h-[400px] flex-1'>
              <ActBackground acts={model.acts} />
              <svg
                className='absolute inset-0 h-full w-full overflow-visible'
                viewBox={`0 0 ${VIEW_BOX.width} ${VIEW_BOX.height}`}
                preserveAspectRatio='none'
                role='img'
                aria-label={`${selectedCriterion.label}: analysed versus expected cadence`}
              >
                <ChartGrid acts={model.acts} domain={view.domain} />
                <ExpectedCurve view={view} />
                <MeasuredCurve view={view} />
                {view.hasMeasured ? (
                  <DriftConnectors view={view} />
                ) : null}
              </svg>

              {view.measuredPoints.length > 0 ? (
                <MeasuredPointMarkers view={view} />
              ) : null}

              {view.hasMeasured ? <ExpectedGhosts view={view} /> : null}

              <BeatMarkers
                view={view}
                sceneById={sceneById}
                sceneAnalysisById={sceneAnalysisById}
                onSelectScene={setSelectedScene}
              />

              {!model.hasAnalysis ? <EmptyAnalysisCallout /> : null}
            </div>
          </div>

          <SceneRail
            acts={model.acts}
            resource={resource}
            sceneAnalysisById={sceneAnalysisById}
            selectedScene={selectedScene}
            onSelectScene={setSelectedScene}
          />

          <MeasureSelector
            criteria={model.criteria}
            selectedKey={selectedCriterion.key}
            color={view.color}
            onSelect={setSelectedCriterionKey}
          />
        </div>
      </section>

      {model.hasAnalysis && model.summary ? (
        <AnalysisSummary summary={model.summary} />
      ) : null}

      <StoryArcSceneAnalysisDialog
        open={Boolean(selectedScene)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedScene(null);
          }
        }}
        scene={selectedScene}
        resource={resource}
      />
    </>
  );
}

function ActHeaderRow({ acts }: { acts: StoryArcActBand[] }) {
  return (
    <div className='flex'>
      <div className={AXIS_GUTTER} aria-hidden='true' />
      <div className='flex flex-1 border-b border-border/40'>
        {acts.map((act, index) => (
          <div
            key={act.id}
            className={cn(
              'min-w-0 px-3 py-2.5 text-center',
              actTint(index),
              index > 0 && 'border-l border-dashed border-foreground/15'
            )}
            style={{ flexGrow: act.weight, flexBasis: 0 }}
          >
            <div className='truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/80'>
              {`Act ${toRoman(index + 1)}`}
            </div>
            <div className='mt-0.5 truncate text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground'>
              {act.title}
            </div>
            <div className='mt-1 text-[10px] font-medium tabular-nums text-muted-foreground/70'>
              {act.startPercent}% – {act.endPercent}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AxisColumn({ label, domain }: { label: string; domain: ScoreDomain }) {
  const ticks = [domain.max, Math.round((domain.min + domain.max) / 2), domain.min];
  return (
    <div className={cn('relative', AXIS_GUTTER)} aria-hidden='true'>
      <span className='absolute left-0 top-1/2 origin-center -translate-x-1/2 -translate-y-1/2 -rotate-90 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70'>
        {label}
      </span>
      {ticks.map((tick, index) => (
        <span
          key={index}
          className='absolute right-2 -translate-y-1/2 text-[10px] font-medium tabular-nums text-muted-foreground/70'
          style={{ top: `${scoreToY(tick, domain)}%` }}
        >
          {tick}
        </span>
      ))}
    </div>
  );
}

/** Subtle alternating tone so adjacent acts read as distinct columns. */
function actTint(index: number): string {
  return index % 2 === 0 ? 'bg-foreground/[0.03]' : '';
}

function ActBackground({ acts }: { acts: StoryArcActBand[] }) {
  return (
    <div className='pointer-events-none absolute inset-0 flex'>
      {acts.map((act, index) => (
        <div
          key={act.id}
          className={cn('h-full', actTint(index))}
          style={{ flexGrow: act.weight, flexBasis: 0 }}
        />
      ))}
    </div>
  );
}

function ChartGrid({ acts, domain }: { acts: StoryArcActBand[]; domain: ScoreDomain }) {
  const ticks = [domain.max, Math.round((domain.min + domain.max) / 2), domain.min];
  return (
    <g>
      {ticks.map((tick, index) => {
        const y = scoreToY(tick, domain);
        return (
          <line
            key={index}
            x1={0}
            x2={VIEW_BOX.width}
            y1={y}
            y2={y}
            className='stroke-foreground/10'
            strokeWidth={1}
            vectorEffect='non-scaling-stroke'
          />
        );
      })}
      {acts.map((act, index) =>
        index === 0 ? null : (
          <line
            key={act.id}
            x1={act.startFraction * VIEW_BOX.width}
            x2={act.startFraction * VIEW_BOX.width}
            y1={0}
            y2={VIEW_BOX.height}
            className='stroke-foreground/15'
            strokeWidth={1}
            strokeDasharray='3 4'
            vectorEffect='non-scaling-stroke'
          />
        )
      )}
    </g>
  );
}

function ExpectedCurve({ view }: { view: MeasureView }) {
  if (!view.expectedPath) {
    return null;
  }
  return (
    <path
      d={view.expectedPath}
      fill='none'
      stroke={view.color}
      strokeWidth={1.5}
      strokeOpacity={0.4}
      strokeDasharray='4 4'
      strokeLinecap='round'
      strokeLinejoin='round'
      vectorEffect='non-scaling-stroke'
    />
  );
}

function MeasuredCurve({ view }: { view: MeasureView }) {
  return (
    <g>
      {view.measuredSegments.map((segment) => (
        <path
          key={segment.key}
          d={segment.path}
          fill='none'
          stroke={view.color}
          strokeWidth={2.5}
          strokeLinecap='round'
          strokeLinejoin='round'
          vectorEffect='non-scaling-stroke'
        />
      ))}
    </g>
  );
}

function MeasuredPointMarkers({ view }: { view: MeasureView }) {
  return (
    <div className='pointer-events-none absolute inset-0'>
      {view.measuredPoints.map((point) => (
        <span
          key={point.key}
          data-story-arc-measured-point=''
          className='absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background shadow-sm'
          style={{
            left: `${point.xPercent}%`,
            top: `${point.yPercent}%`,
            backgroundColor: view.color,
          }}
        />
      ))}
    </div>
  );
}

/** Dashed lines from each beat's expected point to where it was measured. */
function DriftConnectors({ view }: { view: MeasureView }) {
  return (
    <g>
      {view.beats
        .filter((beat) => typeof beat.measuredLevel === 'number')
        .map((beat) => (
          <line
            key={beat.key}
            x1={beat.expectedPosition * VIEW_BOX.width}
            y1={scoreToY(beat.expectedLevel, view.domain)}
            x2={beat.measuredPosition * VIEW_BOX.width}
            y2={scoreToY(beat.measuredLevel ?? beat.expectedLevel, view.domain)}
            className={
              beatTimingDrift(beat)
                ? 'stroke-amber-500/70'
                : 'stroke-foreground/20'
            }
            strokeWidth={1}
            strokeDasharray='2 3'
            vectorEffect='non-scaling-stroke'
          />
        ))}
    </g>
  );
}

/** Hollow ghost dots sitting on the expected curve at each beat's ideal spot. */
function ExpectedGhosts({ view }: { view: MeasureView }) {
  return (
    <div className='pointer-events-none absolute inset-0'>
      {view.beats.map((beat) => (
        <span
          key={beat.key}
          className={cn(
            'absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed bg-background/50',
            beatTimingDrift(beat) ? 'border-amber-500/70' : 'border-foreground/40'
          )}
          style={{
            left: `${beat.expectedPosition * 100}%`,
            top: `${scoreToY(beat.expectedLevel, view.domain)}%`,
          }}
        />
      ))}
    </div>
  );
}

function beatTimingDrift(beat: MeasureBeat): boolean {
  return (
    beat.sceneSpecific &&
    typeof beat.measuredLevel === 'number' &&
    Math.abs(beat.measuredPosition - beat.expectedPosition) > BEAT_DEVIATION_THRESHOLD
  );
}

interface BeatGroup {
  id: string;
  beats: MeasureBeat[];
  position: number;
  level: number;
  sceneId?: string;
}

/** Merge beats the analysis placed on the same scene into a single marker. */
function groupBeats(beats: MeasureBeat[]): BeatGroup[] {
  const groups: BeatGroup[] = [];
  const indexBySceneId = new Map<string, number>();
  for (const beat of beats) {
    const level = beat.measuredLevel ?? beat.expectedLevel;
    if (beat.sceneId) {
      const existing = indexBySceneId.get(beat.sceneId);
      if (existing !== undefined) {
        groups[existing]?.beats.push(beat);
        continue;
      }
      indexBySceneId.set(beat.sceneId, groups.length);
    }
    groups.push({
      id: beat.key,
      beats: [beat],
      position: beat.measuredPosition,
      level,
      sceneId: beat.sceneId,
    });
  }
  return groups;
}

function BeatMarkers({
  view,
  sceneById,
  sceneAnalysisById,
  onSelectScene,
}: {
  view: MeasureView;
  sceneById: Map<string, StoryArcScenePoint>;
  sceneAnalysisById: Map<string, ScreenplaySceneAnalysis>;
  onSelectScene: (scene: StoryArcScenePoint) => void;
}) {
  const groups = groupBeats(view.beats);
  return (
    <div className='pointer-events-none absolute inset-0'>
      {groups.map((group) => {
        const curveY = scoreToY(group.level, view.domain);
        const shared = group.beats.length > 1;
        const deviates = !shared && group.beats.every(beatTimingDrift);
        const flagged = shared || deviates;
        const translateX =
          group.position <= 0.07
            ? '-12%'
            : group.position >= 0.93
              ? '-88%'
              : '-50%';
        const scene = group.sceneId ? sceneById.get(group.sceneId) : undefined;
        const analysis = group.sceneId
          ? sceneAnalysisById.get(group.sceneId)
          : undefined;
        const label = group.beats.map((beat) => beat.label).join(' · ');
        const interactive = Boolean(scene);
        const markerClass = cn(
          'flex h-7 items-center justify-center gap-1 rounded-full border shadow-xs backdrop-blur-sm',
          shared ? 'px-2' : 'w-7',
          flagged
            ? 'border-amber-500/70 bg-amber-500/10 text-amber-500 dark:text-amber-400'
            : 'border-primary/30 bg-background/80 text-primary/80'
        );
        const icons = (
          <>
            {group.beats.map((beat) => {
              const Icon = beatIcon(beat.key);
              return (
                <Icon key={beat.key} className='h-3.5 w-3.5' aria-hidden='true' />
              );
            })}
          </>
        );
        return (
          <Fragment key={group.id}>
            <span
              className='absolute w-px -translate-x-1/2 bg-foreground/25'
              style={{
                left: `${group.position * 100}%`,
                top: `calc(${curveY}% - 14px)`,
                height: '14px',
              }}
            />
            <span
              className='absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background shadow-sm'
              style={{
                left: `${group.position * 100}%`,
                top: `${curveY}%`,
                backgroundColor: flagged ? '#f59e0b' : view.color,
              }}
            />
            <div
              className='absolute flex flex-col items-center gap-1.5'
              style={{
                left: `${group.position * 100}%`,
                top: `calc(${curveY}% - 14px)`,
                transform: `translate(${translateX}, -100%)`,
              }}
            >
              <span className='max-w-[120px] text-center text-[11px] font-medium leading-tight text-foreground/75'>
                {label}
              </span>
              {interactive ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      aria-label={`Open analysis for beat: ${label}`}
                      onClick={() => scene && onSelectScene(scene)}
                      className={cn(
                        markerClass,
                        shared ? 'px-2 py-0' : 'p-0',
                        'transition-colors',
                        'hover:bg-transparent',
                        flagged
                          ? 'hover:border-amber-500'
                          : 'hover:border-primary/60 hover:text-primary'
                      )}
                    >
                      {icons}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side='bottom' className={TOOLTIP_SURFACE}>
                    <BeatTooltipContent
                      group={group}
                      criterionLabel={view.criterion.label}
                      analysis={analysis}
                      deviates={deviates}
                      shared={shared}
                    />
                  </TooltipContent>
                </Tooltip>
              ) : (
                <span className={markerClass}>
                  {icons}
                  <span className='sr-only'>{label}</span>
                </span>
              )}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

function BeatTooltipContent({
  group,
  criterionLabel,
  analysis,
  deviates,
  shared,
}: {
  group: BeatGroup;
  criterionLabel: string;
  analysis?: ScreenplaySceneAnalysis;
  deviates: boolean;
  shared: boolean;
}) {
  const concern = analysis?.critique.concerns?.[0];
  const beat = group.beats[0];
  return (
    <>
      <p className='text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
        {shared ? 'Overlapping Beats' : 'Key Beat'}
      </p>
      <p className='mt-1 text-sm font-semibold text-foreground'>
        {group.beats.map((entry) => entry.label).join(' · ')}
      </p>
      {beat && typeof beat.measuredLevel === 'number' ? (
        <p className='mt-1 text-[11px] text-muted-foreground'>
          {criterionLabel}: measured {beat.measuredLevel} · expected{' '}
          {beat.expectedLevel}
        </p>
      ) : null}
      {shared ? (
        <p className='mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-amber-500 dark:text-amber-400'>
          <TriangleAlert className='mt-0.5 h-3.5 w-3.5 shrink-0' aria-hidden='true' />
          <span>These beats were placed in the same scene.</span>
        </p>
      ) : null}
      {!shared && beat?.synopsis ? (
        <p className='mt-1.5 text-xs leading-relaxed text-muted-foreground'>
          {beat.synopsis}
        </p>
      ) : null}
      {!shared && deviates && beat ? (
        <p className='mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-amber-500 dark:text-amber-400'>
          <TriangleAlert className='mt-0.5 h-3.5 w-3.5 shrink-0' aria-hidden='true' />
          <span>
            Lands {beat.measuredPosition > beat.expectedPosition ? 'later' : 'earlier'}{' '}
            than its typical spot.
          </span>
        </p>
      ) : null}
      {concern ? (
        <p className='mt-2 text-xs leading-relaxed text-primary'>{concern}</p>
      ) : null}
      <p className='mt-2 text-[11px] text-muted-foreground/70'>
        Click to open full analysis
      </p>
    </>
  );
}

function SceneRail({
  acts,
  resource,
  sceneAnalysisById,
  selectedScene,
  onSelectScene,
}: {
  acts: StoryArcActBand[];
  resource: StoryArcResourceResponse;
  sceneAnalysisById: Map<string, ScreenplaySceneAnalysis>;
  selectedScene: StoryArcScenePoint | null;
  onSelectScene: (scene: StoryArcScenePoint) => void;
}) {
  return (
    <div className='mt-4 flex'>
      <div className={AXIS_GUTTER} aria-hidden='true' />
      <div className='flex h-8 flex-1 gap-2.5' aria-label='Scene rail'>
        {acts.map((act) => (
          <div
            key={act.id}
            className='flex min-w-0 gap-[2px]'
            style={{ flexGrow: act.weight, flexBasis: 0 }}
          >
            {act.scenes.map((scene) => {
              const analysis = sceneAnalysisById.get(scene.id);
              const selected = selectedScene?.id === scene.id;
              return (
                <div
                  key={scene.id}
                  className='relative min-w-0 flex-1'
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        aria-label={`Open analysis for scene: ${scene.title}`}
                        className={cn(
                          'block h-full w-full rounded-[3px] border border-border/40 bg-foreground/[0.07] px-0 py-0 transition-colors',
                          'hover:border-primary/60 hover:bg-primary/20',
                          selected &&
                            'border-primary bg-primary/30 ring-1 ring-primary/40'
                        )}
                        onClick={() => onSelectScene(scene)}
                      />
                    </TooltipTrigger>
                  <TooltipContent side='bottom' className={TOOLTIP_SURFACE}>
                    <SceneTooltipContent
                      scene={scene}
                      analysis={analysis}
                      hasActiveAnalysis={Boolean(resource.activeAnalysis)}
                    />
                  </TooltipContent>
                  </Tooltip>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function SceneTooltipContent({
  scene,
  analysis,
  hasActiveAnalysis,
}: {
  scene: StoryArcScenePoint;
  analysis?: ScreenplaySceneAnalysis;
  hasActiveAnalysis: boolean;
}) {
  const concern = analysis?.critique.concerns?.[0];
  return (
    <>
      <p className='text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
        {scene.actTitle} · {scene.sequenceTitle}
      </p>
      <p className='mt-1 text-sm font-semibold text-foreground'>{scene.title}</p>
      {analysis ? (
        <>
          <p className='mt-1.5 text-xs leading-relaxed text-muted-foreground'>
            {analysis.synopsis}
          </p>
          {analysis.beatRole ? (
            <p className='mt-2 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground/80'>
              Beat · {formatBeatRole(analysis.beatRole)}
            </p>
          ) : null}
          {concern ? (
            <p className='mt-2 text-xs leading-relaxed text-primary'>{concern}</p>
          ) : null}
        </>
      ) : (
        <>
          {scene.storyFunction.length > 0 ? (
            <p className='mt-1.5 text-xs leading-relaxed text-muted-foreground'>
              {scene.storyFunction.join(' ')}
            </p>
          ) : null}
          {hasActiveAnalysis ? (
            <p className='mt-2 text-xs text-muted-foreground/80'>
              No analysis saved for this scene.
            </p>
          ) : null}
        </>
      )}
    </>
  );
}

function MeasureSelector({
  criteria,
  selectedKey,
  color,
  onSelect,
}: {
  criteria: ScreenplayAnalysisCriterion[];
  selectedKey: string;
  color: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className='mt-5 flex flex-col items-center gap-3'>
      <div className='inline-flex flex-wrap items-center justify-center gap-1 rounded-full border border-border/50 bg-muted/20 p-1'>
        {criteria.map((criterion) => {
          const active = criterion.key === selectedKey;
          return (
            <Button
              key={criterion.key}
              type='button'
              variant='ghost'
              size='sm'
              aria-pressed={active}
              className={cn(
                'h-7 gap-2 rounded-full px-3 text-xs font-medium text-muted-foreground',
                'hover:bg-muted/40 hover:text-foreground',
                active && 'bg-card text-foreground shadow-xs'
              )}
              onClick={() => onSelect(criterion.key)}
            >
              <span
                className='h-2 w-2 rounded-full'
                style={{
                  backgroundColor:
                    DEFAULT_CRITERION_COLORS[criterion.key] ?? '#f1ac2b',
                }}
              />
              {criterion.label}
            </Button>
          );
        })}
      </div>
      <div className='flex items-center gap-5 text-[11px] text-muted-foreground'>
        <span className='flex items-center gap-1.5'>
          <span
            className='h-0.5 w-6 rounded-full'
            style={{ backgroundColor: color }}
          />
          Analysed
        </span>
        <span className='flex items-center gap-1.5'>
          <span
            className='h-0 w-6 border-t border-dashed'
            style={{ borderColor: color, opacity: 0.7 }}
          />
          Expected
        </span>
      </div>
    </div>
  );
}

function AnalysisSummary({ summary }: { summary: string }) {
  return (
    <section className='rounded-(--radius-panel) border border-border/60 bg-gradient-to-b from-card/70 to-card/25 shadow-sm ring-1 ring-inset ring-foreground/[0.03]'>
      <div className='grid gap-5 px-6 py-7 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,200px)_minmax(0,1fr)] lg:gap-12'>
        <div className='lg:border-r lg:border-border/40 lg:pr-6'>
          <h4 className='text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground'>
            Analysis Summary
          </h4>
          <p className='mt-2 text-xs leading-5 text-muted-foreground/70'>
            The overall read on the screenplay&rsquo;s arc.
          </p>
        </div>
        <p className='max-w-[62ch] text-[0.9375rem] leading-8 text-foreground/85'>
          {summary}
        </p>
      </div>
    </section>
  );
}

function EmptyAnalysisCallout() {
  return (
    <div className='absolute left-1/2 top-1/2 w-72 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border/60 bg-background/85 px-5 py-4 text-center shadow-md backdrop-blur-sm'>
      <h4 className='text-sm font-semibold text-foreground'>No analysis yet</h4>
      <p className='mt-1.5 text-xs leading-relaxed text-muted-foreground'>
        The dashed line shows the ideal cadence. Ask the agent to analyze this
        screenplay to compare.
      </p>
    </div>
  );
}

function beatIcon(role: ScreenplayBeatRole): LucideIcon {
  switch (role) {
    case 'hook':
      return Anchor;
    case 'incitingIncident':
      return Zap;
    case 'firstPlotPoint':
      return Flag;
    case 'midpoint':
      return Star;
    case 'secondPlotPoint':
      return TriangleAlert;
    case 'climax':
      return Crown;
    case 'resolution':
      return CheckCircle2;
    default:
      return Star;
  }
}

function formatBeatRole(role: string): string {
  return role.replace(/([A-Z])/g, ' $1').trim();
}

function toRoman(value: number): string {
  return ['I', 'II', 'III', 'IV', 'V'][value - 1] ?? String(value);
}
