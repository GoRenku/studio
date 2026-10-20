import type { ProfileDescriptionHeading } from './profile-description-headings';

/** Presentation-only split: blank lines separate paragraphs; text is shown as stored. */
function paragraphsOf(text: string): string[] {
  return text.split(/\n\s*\n/).filter((paragraph) => paragraph.trim().length > 0);
}

export function ProfileParagraphs({ text }: { text: string }) {
  return (
    <>
      {paragraphsOf(text).map((paragraph, index) => (
        <p
          key={index}
          className='max-w-[68ch] whitespace-pre-line text-[15px] leading-[1.72] text-foreground/85 [&+p]:mt-3.5'
        >
          {paragraph}
        </p>
      ))}
    </>
  );
}

export function ProfileTextSection({ heading, text }: { heading: string; text: string }) {
  return (
    <section className='mt-8'>
      <h2 className='mb-2.5 text-base font-bold text-foreground'>{heading}</h2>
      <ProfileParagraphs text={text} />
    </section>
  );
}

export function ProfileDescriptionSections<Key extends string>({
  description,
  headings,
}: {
  description: Partial<Record<Key, string>> | undefined;
  headings: ProfileDescriptionHeading<Key>[];
}) {
  if (!description) {
    return null;
  }
  const overview = (description as Partial<Record<string, string>>).overview;
  return (
    <>
      {overview ? (
        <section className='mt-8'>
          <ProfileParagraphs text={overview} />
        </section>
      ) : null}
      {headings.map(({ key, heading }) => {
        const text = description[key as Key];
        return text ? <ProfileTextSection key={key} heading={heading} text={text} /> : null;
      })}
    </>
  );
}

export function ProfileSourceNote({ text }: { text: string | undefined }) {
  if (!text) {
    return null;
  }
  return (
    <p className='mt-9 max-w-[68ch] border-t border-border/40 pt-3.5 text-[12.5px] leading-relaxed text-muted-foreground'>
      <span className='mr-2 text-[11px] font-bold uppercase tracking-[0.12em]'>Source</span>
      {text}
    </p>
  );
}
