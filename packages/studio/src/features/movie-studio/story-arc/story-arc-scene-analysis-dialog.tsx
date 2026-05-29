import type { ReactNode } from 'react';
import {
  CheckCircle2,
  Lightbulb,
  Quote,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import type {
  ScreenplayAnalysisCriterion,
  ScreenplaySceneAnalysis,
  SuggestedSceneAddition,
} from '@gorenku/studio-core/client';
import { DEFAULT_SCREENPLAY_ANALYSIS_CRITERIA } from '@gorenku/studio-core/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog';
import { cn } from '@/lib/utils';
import type { StoryArcResourceResponse } from '@/services/studio-project-contracts';
import { DEFAULT_CRITERION_COLORS } from './story-arc-chart-model';
import type { StoryArcScenePoint } from './story-arc-chart-model';

interface StoryArcSceneAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scene: StoryArcScenePoint | null;
  resource: StoryArcResourceResponse;
}

export function StoryArcSceneAnalysisDialog({
  open,
  onOpenChange,
  scene,
  resource,
}: StoryArcSceneAnalysisDialogProps) {
  const analysis = scene
    ? resource.activeAnalysis?.scenes.find((candidate) => candidate.sceneId === scene.id)
    : undefined;
  const relatedAdditions = scene
    ? findRelatedSuggestedSceneAdditions(resource, scene)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[84vh] max-w-3xl gap-0 overflow-hidden p-0'>
        <DialogHeader className='gap-2 px-6 py-5'>
          <DialogDescription className='text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground'>
            {scene ? `${scene.actTitle} · ${scene.sequenceTitle}` : 'Story arc scene detail'}
          </DialogDescription>
          <DialogTitle className='text-xl font-semibold normal-case leading-tight tracking-tight text-foreground'>
            {scene?.title ?? 'Scene Analysis'}
          </DialogTitle>
          {analysis?.beatRole ? (
            <span className='mt-1 inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-primary'>
              <Sparkles className='h-3 w-3' aria-hidden='true' />
              {formatBeatRole(analysis.beatRole)}
            </span>
          ) : null}
        </DialogHeader>
        <div className='max-h-[68vh] space-y-7 overflow-y-auto px-6 py-6'>
          {scene ? (
            <>
              {analysis ? (
                <SceneAnalysisDetails
                  analysis={analysis}
                  criteria={resource.activeAnalysis?.criteria ?? []}
                />
              ) : (
                <ScenePlacement scene={scene} hasActiveAnalysis={Boolean(resource.activeAnalysis)} />
              )}
              {relatedAdditions.length > 0 ? (
                <SuggestedSceneAdditions additions={relatedAdditions} />
              ) : null}
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SceneAnalysisDetails({
  analysis,
  criteria,
}: {
  analysis: ScreenplaySceneAnalysis;
  criteria: ScreenplayAnalysisCriterion[];
}) {
  const defaultCriterionKeys = new Set<string>(
    DEFAULT_SCREENPLAY_ANALYSIS_CRITERIA.map((criterion) => criterion.key)
  );
  const additionalCriteria = criteria.filter(
    (criterion) =>
      !defaultCriterionKeys.has(criterion.key) &&
      typeof analysis.scoreByCriterion[criterion.key] === 'number'
  );

  return (
    <>
      <Section title='Synopsis'>
        <p className='text-sm leading-7 text-foreground/85'>{analysis.synopsis}</p>
      </Section>

      <Section title='Scores'>
        <div className='space-y-3.5'>
          {DEFAULT_SCREENPLAY_ANALYSIS_CRITERIA.map((criterion) => (
            <ScoreBar
              key={criterion.key}
              label={criterion.label}
              score={analysis.scoreByCriterion[criterion.key]}
              color={DEFAULT_CRITERION_COLORS[criterion.key] ?? '#f1ac2b'}
            />
          ))}
          {additionalCriteria.map((criterion) => (
            <ScoreBar
              key={criterion.key}
              label={criterion.label}
              score={analysis.scoreByCriterion[criterion.key]}
              color='var(--muted-foreground)'
            />
          ))}
        </div>
      </Section>

      <Section title='Critique'>
        <p className='rounded-lg border border-border/50 bg-muted/20 px-4 py-3 text-sm leading-7 text-foreground/85'>
          {analysis.critique.summary}
        </p>
      </Section>

      <CritiqueList
        title='Strengths'
        items={analysis.critique.strengths ?? []}
        tone='positive'
      />
      <CritiqueList
        title='Concerns'
        items={analysis.critique.concerns ?? []}
        tone='warning'
      />
      <CritiqueList
        title='Suggestions'
        items={analysis.critique.suggestions}
        tone='idea'
      />

      {analysis.critique.evidence.length > 0 ? (
        <Section title='Evidence'>
          <div className='space-y-3'>
            {analysis.critique.evidence.map((evidence, index) => (
              <blockquote
                key={`evidence-${index}`}
                className='flex gap-2.5 border-l-2 border-border/60 pl-3 text-sm italic leading-6 text-muted-foreground'
              >
                <Quote className='mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60' aria-hidden='true' />
                <span>{evidence.text}</span>
              </blockquote>
            ))}
          </div>
        </Section>
      ) : null}
    </>
  );
}

function ScoreBar({
  label,
  score,
  color,
}: {
  label: string;
  score?: number;
  color: string;
}) {
  const value = typeof score === 'number' ? score : null;
  return (
    <div>
      <div className='flex items-baseline justify-between'>
        <span className='text-xs font-medium text-foreground/80'>{label}</span>
        <span className='text-sm font-semibold tabular-nums text-foreground'>
          {value ?? '—'}
        </span>
      </div>
      <div className='mt-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/10'>
        <div
          className='h-full rounded-full transition-[width]'
          style={{ width: `${value ?? 0}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

const TONE_STYLES = {
  positive: {
    icon: CheckCircle2,
    iconColor: 'text-emerald-500 dark:text-emerald-400',
  },
  warning: {
    icon: TriangleAlert,
    iconColor: 'text-amber-500 dark:text-amber-400',
  },
  idea: {
    icon: Lightbulb,
    iconColor: 'text-primary',
  },
} as const;

function CritiqueList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: keyof typeof TONE_STYLES;
}) {
  if (items.length === 0) {
    return null;
  }
  const { icon: Icon, iconColor } = TONE_STYLES[tone];
  return (
    <Section title={title}>
      <ul className='space-y-2.5'>
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className='flex gap-2.5'>
            <Icon
              className={cn('mt-0.5 h-4 w-4 shrink-0', iconColor)}
              aria-hidden='true'
            />
            <span className='text-sm leading-6 text-foreground/85'>{item}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function ScenePlacement({
  scene,
  hasActiveAnalysis,
}: {
  scene: StoryArcScenePoint;
  hasActiveAnalysis: boolean;
}) {
  return (
    <>
      {scene.storyFunction.length > 0 ? (
        <Section title='Story Function'>
          <p className='text-sm leading-7 text-foreground/85'>
            {scene.storyFunction.join(' ')}
          </p>
        </Section>
      ) : null}
      <p className='rounded-lg border border-border/50 bg-muted/20 px-4 py-3 text-sm text-muted-foreground'>
        {hasActiveAnalysis
          ? 'No analysis has been saved for this scene yet.'
          : 'No screenplay analysis has been saved yet. Ask the agent to analyze this screenplay.'}
      </p>
    </>
  );
}

function SuggestedSceneAdditions({
  additions,
}: {
  additions: SuggestedSceneAddition[];
}) {
  return (
    <Section title='Suggested Scenes'>
      <div className='space-y-3'>
        {additions.map((addition) => (
          <div
            key={`${addition.targetActId}-${addition.targetSequenceId ?? 'act'}-${addition.title}`}
            className='rounded-lg border border-primary/30 bg-primary/[0.07] px-4 py-3'
          >
            <p className='text-sm font-semibold text-foreground'>{addition.title}</p>
            <p className='mt-1.5 text-sm leading-6 text-muted-foreground'>
              {addition.synopsis}
            </p>
            <p className='mt-2 flex gap-2 text-sm leading-6 text-primary'>
              <Lightbulb className='mt-0.5 h-4 w-4 shrink-0' aria-hidden='true' />
              <span>{addition.rationale}</span>
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className='space-y-3'>
      <h4 className='text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground'>
        {title}
      </h4>
      {children}
    </section>
  );
}

function findRelatedSuggestedSceneAdditions(
  resource: StoryArcResourceResponse,
  scene: StoryArcScenePoint
): SuggestedSceneAddition[] {
  return (
    resource.activeAnalysis?.suggestedSceneAdditions.filter((addition) => {
      if (
        addition.placement?.beforeSceneId === scene.id ||
        addition.placement?.afterSceneId === scene.id
      ) {
        return true;
      }
      return (
        addition.targetSequenceId === scene.sequenceId ||
        (!addition.targetSequenceId && addition.targetActId === scene.actId)
      );
    }) ?? []
  );
}

function formatBeatRole(role: string): string {
  return role.replace(/([A-Z])/g, ' $1').trim();
}
