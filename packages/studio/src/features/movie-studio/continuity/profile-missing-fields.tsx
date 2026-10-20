export function ProfileMissingFields({ fields }: { fields: string[] }) {
  if (fields.length === 0) {
    return null;
  }
  return (
    <p className='mt-7 text-[13px] leading-relaxed text-muted-foreground'>
      Not written yet:{' '}
      <span className='font-semibold text-foreground/80'>{fields.join(' · ')}</span>
    </p>
  );
}
