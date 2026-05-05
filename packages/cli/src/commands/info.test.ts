import { getMovieCliInfo } from './info.js';

describe('studio-cli scaffold', () => {
  it('reports the movie CLI and movie core packages', () => {
    expect(getMovieCliInfo()).toEqual({
      cli: '@gorenku/studio-cli',
      core: {
        packageName: '@gorenku/studio-core',
        purpose: 'renku-studio-domain',
      },
    });
  });
});
