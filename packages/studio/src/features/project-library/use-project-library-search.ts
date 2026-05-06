import { useMemo } from 'react';
import type { ProjectSummaryWithHttp } from '@/services/studio-project-contracts';

export function useProjectLibrarySearch(
  projects: ProjectSummaryWithHttp[],
  query: string
): ProjectSummaryWithHttp[] {
  return useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return projects;
    }
    return projects.filter((project) =>
      [
        project.title,
        project.name,
        project.logline,
        project.format,
        project.baseLanguage,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery))
    );
  }, [projects, query]);
}

