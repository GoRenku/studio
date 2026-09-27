export type RenkuUpdateStatus =
  | { state: 'notInstalled' }
  | { state: 'current' | 'available'; installedVersion: string; publishedVersion: string };
