export function numberedSlug(position: number, title: string): string {
  return `${String(position).padStart(2, '0')}-${slugify(title)}`;
}

export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'untitled';
}
