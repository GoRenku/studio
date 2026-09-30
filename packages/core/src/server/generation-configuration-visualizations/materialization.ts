import { Buffer } from 'node:buffer';
import {
  GENERATION_CONFIGURATION_VISUALIZATION_PAYLOAD_PLACEHOLDER,
  GENERATION_CONFIGURATION_VISUALIZATION_TEMPLATE_MAX_BYTES,
} from './contracts.js';
import { validateGenerationConfigurationVisualizationTemplate } from './documents.js';
import { generationConfigurationVisualizationCacheError } from './errors.js';

export function materializeGenerationConfigurationVisualization(template: string, payload: unknown): string {
  validateGenerationConfigurationVisualizationTemplate(template);
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw generationConfigurationVisualizationCacheError(
      'GENERATION_CONFIGURATION_VISUALIZATION_CACHE006',
      'The visualization payload must be a JSON object.', ['payload'],
    );
  }
  const serialized = JSON.stringify(payload).replace(
    /[<>&\u2028\u2029]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
  const html = template.replace(
    GENERATION_CONFIGURATION_VISUALIZATION_PAYLOAD_PLACEHOLDER,
    () => `<script id="renku-generation-configuration-payload" type="application/json">${serialized}</script>`,
  );
  if (Buffer.byteLength(html, 'utf8') > GENERATION_CONFIGURATION_VISUALIZATION_TEMPLATE_MAX_BYTES) {
    throw generationConfigurationVisualizationCacheError(
      'GENERATION_CONFIGURATION_VISUALIZATION_CACHE006',
      'The materialized visualization exceeds the 1 MB fragment limit.', ['payload'],
    );
  }
  return html;
}
