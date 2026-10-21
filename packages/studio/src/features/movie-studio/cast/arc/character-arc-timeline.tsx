import type { CastMemberCharacterArcResourceResponse } from '@/services/studio-project-contracts';
import {
  ARC_HEIGHT,
  TIMELINE_GUTTER,
  TIMELINE_WIDTH,
  buildCharacterArcTimeline,
} from './character-arc-timeline-model';

const GUTTER_LABEL = { fontSize: 11, fontWeight: 700, letterSpacing: 1, fill: 'var(--muted-foreground)' } as const;

export function CharacterArcTimeline({ resource }: { resource: CastMemberCharacterArcResourceResponse }) {
  const layout = buildCharacterArcTimeline(resource);
  const { arc } = layout;
  return (
    <figure className='mt-7'>
      <svg
        width='100%'
        viewBox={`0 0 ${TIMELINE_WIDTH} ${layout.height}`}
        role='img'
        aria-label={`${resource.castMember.name} arc across the screenplay`}
        className='block'
      >
        {layout.acts.length > 0 ? <text x={0} y={18} style={GUTTER_LABEL}>STRUCTURE</text> : null}
        {layout.acts.map((act, index) => (
          <g key={act.label + act.x}>
            <rect x={act.x} y={0} width={act.width} height={26} rx={4} style={{ fill: index % 2 ? 'var(--muted)' : 'var(--card)', opacity: 0.7 }} />
            <text x={act.x + act.width / 2} y={17} textAnchor='middle' style={{ ...GUTTER_LABEL, fill: 'var(--foreground)', opacity: 0.7 }}>
              {act.label.toUpperCase()}
            </text>
          </g>
        ))}
        {layout.beats.map((beat) => {
          const nearEnd = beat.x > TIMELINE_WIDTH - 90;
          return (
            <g key={beat.label}>
              <line x1={beat.x} x2={beat.x} y1={38 + beat.level * 13} y2={layout.beatLineBottom} strokeDasharray='2 3' style={{ stroke: 'var(--primary)', opacity: 0.3 }} />
              <text
                x={nearEnd ? beat.x - 4 : beat.x + 4}
                y={42 + beat.level * 13}
                textAnchor={nearEnd ? 'end' : 'start'}
                style={{ fontSize: 10.5, fontWeight: 600, fill: 'var(--primary)' }}
              >
                {beat.label}
              </text>
            </g>
          );
        })}
        {layout.presence ? (
          <g>
            <text x={0} y={layout.presence.y + 12} style={GUTTER_LABEL}>IN SCENE</text>
            <text x={0} y={layout.presence.y + 26} style={{ fontSize: 10.5, fill: 'var(--muted-foreground)', opacity: 0.8 }}>From the screenplay</text>
            <rect x={TIMELINE_GUTTER} y={layout.presence.y} width={TIMELINE_WIDTH - TIMELINE_GUTTER - 8} height={18} rx={2} style={{ fill: 'var(--muted)', opacity: 0.5 }} />
            {layout.presence.cells.map((cell) => (
              <rect key={cell.x} x={cell.x} y={layout.presence!.y} width={cell.width} height={18} style={{ fill: 'var(--foreground)', opacity: cell.speaks ? 0.85 : 0.35 }}>
                <title>{`${cell.heading} · ${cell.speaks ? 'speaks' : 'present or mentioned'}`}</title>
              </rect>
            ))}
          </g>
        ) : null}
        <text x={0} y={arc.top - 14} style={GUTTER_LABEL}>ARC</text>
        <text x={36} y={arc.top - 14} style={{ fontSize: 10, fontWeight: 700, fill: 'rgb(125 211 252 / 0.9)' }}>· INTERPRETATION</text>
        <foreignObject x={0} y={arc.highY - 6} width={TIMELINE_GUTTER - 14} height={40}>
          <p className='text-[11px] font-semibold leading-tight text-emerald-300/90'>{resource.arc.ends.high}</p>
        </foreignObject>
        <foreignObject x={0} y={arc.lowY - 30} width={TIMELINE_GUTTER - 14} height={40}>
          <p className='flex h-full items-end text-[11px] font-semibold leading-tight text-rose-300/90'>{resource.arc.ends.low}</p>
        </foreignObject>
        <rect x={TIMELINE_GUTTER} y={arc.highY - 10} width={TIMELINE_WIDTH - TIMELINE_GUTTER - 8} height={ARC_HEIGHT + 20} rx={6} style={{ fill: 'none', stroke: 'var(--border)', opacity: 0.5 }} />
        <line x1={TIMELINE_GUTTER} x2={TIMELINE_WIDTH - 8} y1={arc.midY} y2={arc.midY} strokeDasharray='3 4' style={{ stroke: 'var(--border)' }} />
        <path d={arc.path} style={{ fill: 'none', stroke: 'var(--primary)', strokeWidth: 2.5, strokeLinejoin: 'round' }} />
        {arc.markers.map((marker) => (
          <g key={marker.number}>
            {Math.abs(marker.x - marker.trueX) > 1 ? (
              <line x1={marker.trueX} x2={marker.x} y1={arc.lowY + 10} y2={marker.y + 11} style={{ stroke: 'var(--primary)', opacity: 0.35 }} />
            ) : null}
            <circle cx={marker.x} cy={marker.y} r={11} style={{ fill: 'var(--primary)', stroke: 'var(--panel-bg)', strokeWidth: 2 }} />
            <text x={marker.x} y={marker.y + 4} textAnchor='middle' style={{ fontSize: 11, fontWeight: 800, fill: 'var(--primary-foreground)' }}>
              {marker.number}
            </text>
            <title>{marker.title}</title>
          </g>
        ))}
        <text x={0} y={layout.axisY} style={{ fontSize: 10, fill: 'var(--muted-foreground)' }}>Scene</text>
        {layout.ticks.map((tick) => (
          <text key={tick.x} x={tick.x} y={layout.axisY} textAnchor='middle' style={{ fontSize: 10, fill: 'var(--muted-foreground)' }}>
            {tick.label}
          </text>
        ))}
      </svg>
      {layout.presence ? (
        <figcaption className='ml-[150px] mt-2.5 flex gap-4 text-[11.5px] text-muted-foreground'>
          <span><i className='mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-foreground/85 align-[-1px]' />Speaks</span>
          <span><i className='mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-foreground/35 align-[-1px]' />Present or mentioned</span>
        </figcaption>
      ) : null}
    </figure>
  );
}
