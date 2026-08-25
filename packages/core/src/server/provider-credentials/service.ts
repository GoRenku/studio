import {
  findProviderCredentialDescriptor,
  listProviderCredentialDescriptors,
} from './catalog.js';
import {
  StructuredError,
  createDiagnosticError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type {
  ProviderCredentialsResource,
  ProviderCredentialsUpdate,
} from '../../client/provider-credentials.js';
import {
  ProviderCredentialStoreError,
  readProviderCredentialStore,
  writeProviderCredentials,
  type ProviderCredentialStoreOptions,
  type ProviderCredentialStoreState,
  type ProviderCredentialWrite,
} from './store.js';

export interface ReadProviderCredentialsInput
  extends ProviderCredentialStoreOptions {}

export interface UpdateProviderCredentialsInput
  extends ProviderCredentialStoreOptions {
  update: ProviderCredentialsUpdate;
}

export async function readProviderCredentials(
  input: ReadProviderCredentialsInput = {}
): Promise<ProviderCredentialsResource> {
  try {
    const store = await readProviderCredentialStore(input);
    return toProviderCredentialsResource(store);
  } catch (error) {
    throwProviderCredentialStoreError(error);
  }
}

export async function updateProviderCredentials(
  input: UpdateProviderCredentialsInput
): Promise<ProviderCredentialsResource> {
  const changes = validateProviderCredentialUpdate(input.update);
  try {
    const store = await writeProviderCredentials(changes, input);
    return toProviderCredentialsResource(store);
  } catch (error) {
    throwProviderCredentialStoreError(error);
  }
}

function toProviderCredentialsResource(
  store: ProviderCredentialStoreState
): ProviderCredentialsResource {
  return {
    providers: listProviderCredentialDescriptors().map((descriptor) => {
      const state = store.providers.find(
        (entry) => entry.provider === descriptor.provider
      );
      return {
        provider: descriptor.provider,
        label: descriptor.label,
        configured: state?.configured ?? false,
      };
    }),
  };
}

function validateProviderCredentialUpdate(
  update: ProviderCredentialsUpdate
): ProviderCredentialWrite[] {
  const issues: DiagnosticIssue[] = [];
  if (!update || !Array.isArray(update.changes) || update.changes.length === 0) {
    issues.push(
      createDiagnosticError(
        'PROVIDER_CREDENTIALS001',
        'At least one provider credential change is required.',
        { path: ['changes'], context: 'Provider credential update' }
      )
    );
    throwInvalidProviderCredentialUpdate(issues);
  }

  const normalized: ProviderCredentialWrite[] = [];
  const seenProviders = new Set<string>();
  update.changes.forEach((change, index) => {
    const path = ['changes', String(index)];
    if (!change || typeof change !== 'object') {
      issues.push(
        createDiagnosticError(
          'PROVIDER_CREDENTIALS001',
          'Provider credential change must be an object.',
          { path, context: 'Provider credential update' }
        )
      );
      return;
    }
    const provider = typeof change.provider === 'string'
      ? change.provider
      : '';
    const descriptor = findProviderCredentialDescriptor(provider);
    if (!descriptor) {
      issues.push(
        createDiagnosticError(
          'PROVIDER_CREDENTIALS001',
          'Provider is not available in Renku Settings.',
          {
            path: [...path, 'provider'],
            context: 'Provider credential update',
          }
        )
      );
    }
    if (provider && seenProviders.has(provider)) {
      issues.push(
        createDiagnosticError(
          'PROVIDER_CREDENTIALS001',
          'Only one change is allowed for each provider.',
          {
            path: [...path, 'provider'],
            context: 'Provider credential update',
          }
        )
      );
    }
    if (provider) {
      seenProviders.add(provider);
    }

    const value = typeof change.value === 'string' ? change.value.trim() : '';
    if (!value) {
      issues.push(
        createDiagnosticError(
          'PROVIDER_CREDENTIALS001',
          'API key must be a non-empty string.',
          {
            path: [...path, 'value'],
            context: 'Provider credential update',
          }
        )
      );
    } else if (/[\r\n\0]/.test(value)) {
      issues.push(
        createDiagnosticError(
          'PROVIDER_CREDENTIALS001',
          'API key must be a single line without NUL characters.',
          {
            path: [...path, 'value'],
            context: 'Provider credential update',
          }
        )
      );
    }
    if (descriptor && value && !/[\r\n\0]/.test(value)) {
      normalized.push({ provider, value });
    }
  });

  if (issues.length > 0) {
    throwInvalidProviderCredentialUpdate(issues);
  }
  return normalized;
}

function throwInvalidProviderCredentialUpdate(
  issues: DiagnosticIssue[]
): never {
  throw new StructuredError({
    code: 'PROVIDER_CREDENTIALS001',
    message: 'Provider credential update is invalid.',
    issues,
    suggestion: 'Fix every reported provider API key and try again.',
  });
}

function throwProviderCredentialStoreError(error: unknown): never {
  if (error instanceof ProviderCredentialStoreError) {
    throw new StructuredError({
      code:
        error.operation === 'read'
          ? 'PROVIDER_CREDENTIALS002'
          : 'PROVIDER_CREDENTIALS003',
      message:
        error.operation === 'read'
          ? 'Renku provider credentials could not be read.'
          : 'Renku provider credentials could not be saved.',
      suggestion:
        'Check the permissions and file type of the Renku configuration directory, then try again.',
    });
  }
  throw error;
}
