import { MOVIE_PROJECT_KIND } from '../index.js';

export type StudioProjectKind = typeof MOVIE_PROJECT_KIND;

export interface StudioProjectRecord {
  id: string;
  kind: StudioProjectKind;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertStudioProjectInput {
  id: string;
  name: string;
}

export interface StudioStorageSession {
  getProject(id: string): Promise<StudioProjectRecord | undefined>;
  listProjects(): Promise<StudioProjectRecord[]>;
  upsertProject(input: UpsertStudioProjectInput): Promise<StudioProjectRecord>;
}

export interface StudioStorage extends StudioStorageSession {
  close(): Promise<void>;
}
