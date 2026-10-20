import type { CastMember } from '@gorenku/studio-core/client';

export function CastMemberStorySummary({ castMember }: { castMember: CastMember }) {
  const rows = [
    ['Want', castMember.want],
    ['Need', castMember.need],
    ['Arc', castMember.arc],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  if (rows.length === 0) {
    return null;
  }
  return (
    <dl className='mt-7 grid max-w-[760px] grid-cols-[76px_minmax(0,1fr)] gap-x-[18px] gap-y-3.5 rounded-[10px] border border-border/40 bg-muted/30 px-[22px] py-5'>
      {rows.map(([label, value]) => (
        <div key={label} className='contents'>
          <dt className='pt-[3px] text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground'>
            {label}
          </dt>
          <dd className='max-w-[64ch] text-[15px] leading-[1.65] text-foreground'>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
