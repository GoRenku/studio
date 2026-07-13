import type { LoadedModelCatalog } from '../../model-catalog.js';
import { loadModelSchemaFile } from '../../model-catalog.js';
import { validatePayloadIssues } from '../../sdk/schema-validator.js';
import { resolveSchemaRefs } from '../../sdk/unified/schema-file.js';
import {
  describeGenerationModelInputs,
  type GenerationModelInputDescriptor,
  type GenerationModelInputFieldDescriptor,
} from '../catalog/model-input-descriptors.js';
import {
  loadBundledGenerationCatalog,
  resolveBundledModelCatalogDir,
} from '../catalog/model-discovery.js';
import type {
  GenerationInputFile,
  GenerationPolicy,
  GenerationRequest,
} from '../contracts.js';

export interface GenerationProviderReferenceInput {
  providerField?: string;
  projectRelativePath: string;
  mediaKind: 'image' | 'audio' | 'video';
  sourceIndex: number;
  mimeType?: string | null;
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
}

export interface GenerationProviderPayloadIssue {
  path: string;
  message: string;
  suggestion: string;
}

export type GenerationProviderRequestAssembly =
  | {
      valid: true;
      descriptor: GenerationModelInputDescriptor;
      policy: GenerationPolicy;
      request: GenerationRequest;
      payload: Record<string, unknown>;
      issues: [];
    }
  | {
      valid: false;
      descriptor: GenerationModelInputDescriptor | null;
      issues: GenerationProviderPayloadIssue[];
    };

export async function assembleGenerationProviderRequest(input: {
  provider: string;
  model: string;
  values: Record<string, unknown>;
  references: GenerationProviderReferenceInput[];
  catalog?: LoadedModelCatalog;
}): Promise<GenerationProviderRequestAssembly> {
  const catalog = input.catalog ?? await loadBundledGenerationCatalog();
  const descriptor = await describeGenerationModelInputs({
    provider: input.provider,
    model: input.model,
    catalog,
  });
  if (!descriptor) {
    return {
      valid: false,
      descriptor: null,
      issues: [{
        path: 'model',
        message: `Unknown provider model ${input.provider}/${input.model}.`,
        suggestion: 'Choose an existing provider and model endpoint.',
      }],
    };
  }

  const issues: GenerationProviderPayloadIssue[] = [];
  const fields = new Map(descriptor.fields.map((field) => [field.name, field]));
  const payload = { ...input.values };
  const inputFiles: GenerationInputFile[] = [];

  for (const [name] of Object.entries(input.values)) {
    const field = fields.get(name);
    if (field?.media) {
      issues.push({
        path: `values.${name}`,
        message: `Provider field ${name} is file-backed and cannot be authored in values.`,
        suggestion: `Remove values.${name} and assign an exact reference to provider field ${name}.`,
      });
    }
  }

  const groupedReferences = new Map<string, GenerationProviderReferenceInput[]>();
  for (const reference of input.references) {
    if (!reference.providerField) {
      issues.push({
        path: `references.${reference.sourceIndex}.providerField`,
        message: 'Included reference is not assigned to a provider media field.',
        suggestion: 'Choose the exact provider media field that should receive this reference.',
      });
      continue;
    }
    const field = fields.get(reference.providerField);
    if (!field?.media) {
      issues.push({
        path: `references.${reference.sourceIndex}.providerField`,
        message: field
          ? `Provider field ${reference.providerField} is not a file-backed media field.`
          : `Provider field ${reference.providerField} does not exist.`,
        suggestion: 'Assign the reference to a media field declared by the selected provider model.',
      });
      continue;
    }
    if (!field.media.acceptedKinds.includes(reference.mediaKind)) {
      issues.push({
        path: `references.${reference.sourceIndex}.reference`,
        message: `Provider field ${reference.providerField} does not accept ${reference.mediaKind} media.`,
        suggestion: `Use one of the accepted media kinds: ${field.media.acceptedKinds.join(', ')}.`,
      });
      continue;
    }
    addMediaEnvelopeIssues(issues, field, reference);
    const references = groupedReferences.get(reference.providerField) ?? [];
    references.push(reference);
    groupedReferences.set(reference.providerField, references);
  }

  for (const field of descriptor.fields) {
    if (!field.media) {
      continue;
    }
    const references = groupedReferences.get(field.name) ?? [];
    addCardinalityIssues(issues, field, references);
    if (Object.hasOwn(input.values, field.name)) {
      continue;
    }
    for (const reference of references) {
      const logicalValue = `renku-input://${encodeURI(reference.projectRelativePath)}`;
      if (field.media.cardinality === 'many') {
        const values = Array.isArray(payload[field.name])
          ? payload[field.name] as unknown[]
          : [];
        payload[field.name] = [...values, logicalValue];
      } else if (!Object.hasOwn(payload, field.name)) {
        payload[field.name] = logicalValue;
      }
      inputFiles.push({
        field: field.name,
        projectRelativePath: reference.projectRelativePath,
        mediaKind: reference.mediaKind,
        ...(field.media.cardinality === 'many' ? { asArray: true } : {}),
        required: field.required,
      });
    }
  }

  const schemaFile = await loadModelSchemaFile(
    resolveBundledModelCatalogDir(),
    catalog,
    input.provider,
    input.model
  );
  if (schemaFile) {
    const schemaIssues = validatePayloadIssues(
      JSON.stringify(resolveSchemaRefs(schemaFile.inputSchema, schemaFile.definitions)),
      payload,
      `${input.provider}/${input.model} input`
    );
    for (const issue of schemaIssues) {
      const fieldName = issue.path.split('/').filter(Boolean)[0];
      const field = fieldName ? fields.get(fieldName) : undefined;
      issues.push({
        path: field?.media
          ? `references.${fieldName}`
          : fieldName
            ? `values.${fieldName}`
            : 'values',
        message: `${issue.path} ${issue.message}`.trim(),
        suggestion: field?.media
          ? `Assign media that satisfies provider field ${fieldName}.`
          : 'Change the authored value to satisfy the selected provider model schema.',
      });
    }
  }

  const uniqueIssues = deduplicateIssues(issues);
  if (uniqueIssues.length > 0) {
    return { valid: false, descriptor, issues: uniqueIssues };
  }
  return {
    valid: true,
    descriptor,
    policy: {
      provider: input.provider,
      model: input.model,
      mediaKind: descriptor.mediaKind,
    },
    request: {
      payload: structuredClone(payload),
      inputFiles,
    },
    payload,
    issues: [],
  };
}

function addMediaEnvelopeIssues(
  issues: GenerationProviderPayloadIssue[],
  field: GenerationModelInputFieldDescriptor,
  reference: GenerationProviderReferenceInput
): void {
  const media = field.media;
  if (!media) {
    return;
  }
  const checks: Array<{
    value: number | null | undefined;
    boundary: number | undefined;
    comparison: 'minimum' | 'maximum';
    label: string;
  }> = [
    { value: reference.sizeBytes, boundary: media.maximumSizeBytes, comparison: 'maximum', label: 'file size in bytes' },
    { value: reference.width, boundary: media.minimumWidth, comparison: 'minimum', label: 'width' },
    { value: reference.width, boundary: media.maximumWidth, comparison: 'maximum', label: 'width' },
    { value: reference.height, boundary: media.minimumHeight, comparison: 'minimum', label: 'height' },
    { value: reference.height, boundary: media.maximumHeight, comparison: 'maximum', label: 'height' },
    { value: reference.durationSeconds, boundary: media.minimumDurationSeconds, comparison: 'minimum', label: 'duration in seconds' },
    { value: reference.durationSeconds, boundary: media.maximumDurationSeconds, comparison: 'maximum', label: 'duration in seconds' },
  ];
  for (const check of checks) {
    if (
      check.value === null ||
      check.value === undefined ||
      check.boundary === undefined
    ) {
      continue;
    }
    const invalid = check.comparison === 'minimum'
      ? check.value < check.boundary
      : check.value > check.boundary;
    if (invalid) {
      issues.push({
        path: `references.${reference.sourceIndex}.reference`,
        message: `Provider field ${field.name} requires ${check.label} to have a ${check.comparison} of ${check.boundary}; received ${check.value}.`,
        suggestion: `Choose media whose ${check.label} satisfies the provider limit.`,
      });
    }
  }
  if (
    reference.width &&
    reference.height &&
    (media.minimumAspectRatio !== undefined || media.maximumAspectRatio !== undefined)
  ) {
    const aspectRatio = reference.width / reference.height;
    if (
      (media.minimumAspectRatio !== undefined && aspectRatio < media.minimumAspectRatio) ||
      (media.maximumAspectRatio !== undefined && aspectRatio > media.maximumAspectRatio)
    ) {
      issues.push({
        path: `references.${reference.sourceIndex}.reference`,
        message: `Provider field ${field.name} does not accept media aspect ratio ${aspectRatio.toFixed(3)}.`,
        suggestion: `Choose media within the provider aspect-ratio range ${media.minimumAspectRatio ?? '-infinity'} to ${media.maximumAspectRatio ?? 'infinity'}.`,
      });
    }
  }
  if (
    reference.mimeType &&
    media.acceptedMimeTypes &&
    !media.acceptedMimeTypes.includes(reference.mimeType)
  ) {
    issues.push({
      path: `references.${reference.sourceIndex}.reference`,
      message: `Provider field ${field.name} does not accept MIME type ${reference.mimeType}.`,
      suggestion: `Use one of the accepted MIME types: ${media.acceptedMimeTypes.join(', ')}.`,
    });
  }
}

function addCardinalityIssues(
  issues: GenerationProviderPayloadIssue[],
  field: GenerationModelInputFieldDescriptor,
  references: GenerationProviderReferenceInput[]
): void {
  if (!field.media) {
    return;
  }
  if (references.length < field.media.minimum) {
    issues.push({
      path: `references.${field.name}`,
      message: `Provider field ${field.name} requires at least ${field.media.minimum} media input${field.media.minimum === 1 ? '' : 's'}.`,
      suggestion: `Assign at least ${field.media.minimum} compatible reference${field.media.minimum === 1 ? '' : 's'} to ${field.name}.`,
    });
  }
  if (
    field.media.maximum !== null &&
    references.length > field.media.maximum
  ) {
    issues.push({
      path: `references.${field.name}`,
      message: `Provider field ${field.name} accepts at most ${field.media.maximum} media input${field.media.maximum === 1 ? '' : 's'}.`,
      suggestion: `Remove or reassign references until ${field.name} has at most ${field.media.maximum}.`,
    });
  }
}

function deduplicateIssues(
  issues: GenerationProviderPayloadIssue[]
): GenerationProviderPayloadIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.path}\0${issue.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
