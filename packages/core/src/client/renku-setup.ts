export type RenkuSetup =
  | {
      status: 'setupRequired';
      recommendedStorageRoot: string;
    }
  | {
      status: 'configured';
      storageRoot: string;
    };

export interface RenkuSetupInitializationReport {
  status: 'created' | 'existing';
  setup: {
    status: 'configured';
    storageRoot: string;
  };
}
