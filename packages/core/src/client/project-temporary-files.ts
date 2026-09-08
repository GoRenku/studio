export interface CleanProjectTemporaryFilesInput {
  projectName: string;
  homeDir?: string;
}

export interface ProjectTemporaryFilesCleanupReport {
  removedFiles: number;
  removedBytes: number;
}
