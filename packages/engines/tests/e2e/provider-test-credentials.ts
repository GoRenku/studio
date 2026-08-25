export function readOptInProviderTestCredential(input: {
  optInEnvironmentVariable: string;
  credentialEnvironmentVariable: string;
  environment?: Record<string, string | undefined>;
}): string | null {
  const environment = input.environment ?? process.env;
  if (environment[input.optInEnvironmentVariable] !== '1') {
    return null;
  }
  const credential = environment[input.credentialEnvironmentVariable]?.trim();
  if (!credential) {
    throw new Error(
      `${input.credentialEnvironmentVariable} is required after ${input.optInEnvironmentVariable}=1.`,
    );
  }
  return credential;
}
