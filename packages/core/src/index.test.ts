import {
  MOVIE_PROJECT_KIND,
  MOVIE_TASK_KIND,
  MOVIE_WORKFLOW_KIND,
  getMovieStudioPackageInfo,
} from './index.js';

describe('studio-core scaffold', () => {
  it('exports Renku Studio document kinds', () => {
    expect(MOVIE_PROJECT_KIND).toBe('renku.movie');
    expect(MOVIE_WORKFLOW_KIND).toBe('renku.movieWorkflow');
    expect(MOVIE_TASK_KIND).toBe('renku.movieTask');
  });

  it('identifies the new Renku Studio domain package', () => {
    expect(getMovieStudioPackageInfo()).toEqual({
      packageName: '@gorenku/studio-core',
      purpose: 'renku-studio-domain',
    });
  });
});
