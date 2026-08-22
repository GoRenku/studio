export interface ProviderCredentialStatus {
  provider: string;
  label: string;
  configured: boolean;
}

export interface ProviderCredentialsResource {
  providers: ProviderCredentialStatus[];
}

export interface ProviderCredentialUpdate {
  provider: string;
  value: string;
}

export interface ProviderCredentialsUpdate {
  changes: ProviderCredentialUpdate[];
}
