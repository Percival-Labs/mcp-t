/**
 * MCP-T Conformance Schema Validator
 *
 * Provides Ajv-based validation against the official MCP-T JSON schemas.
 * Resolves $ref references between schemas (trust-event references trust-score
 * for Signature definition).
 */

import Ajv, { type ValidateFunction, type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMAS_DIR = resolve(__dirname, '../../schemas');

export interface ValidationResult {
  valid: boolean;
  errors: ErrorObject[] | null;
}

let ajvInstance: Ajv | null = null;
let trustScoreValidator: ValidateFunction | null = null;
let trustEventValidator: ValidateFunction | null = null;
let thresholdSpecValidator: ValidateFunction | null = null;

/**
 * Resolve relative $ref paths in a schema by replacing them with the
 * full $id URI of the referenced schema.
 */
function resolveRefs(schema: Record<string, unknown>): Record<string, unknown> {
  const json = JSON.stringify(schema);
  // Replace relative ref "trust-score.json#/$defs/Signature" with the full $id URI
  const resolved = json.replace(
    /"\$ref"\s*:\s*"trust-score\.json#\/\$defs\/Signature"/g,
    '"$ref":"https://github.com/Percival-Labs/mcp-t/schemas/trust-score.json#/$defs/Signature"'
  );
  return JSON.parse(resolved);
}

function getAjv(): Ajv {
  if (ajvInstance) return ajvInstance;

  ajvInstance = new Ajv({
    allErrors: true,
    strict: false,
    validateSchema: false, // Don't try to validate against the 2020-12 meta-schema
  });
  addFormats(ajvInstance);

  // Load schemas - trust-score first since trust-event references it
  const trustScoreSchema = JSON.parse(
    readFileSync(resolve(SCHEMAS_DIR, 'trust-score.json'), 'utf-8')
  );
  const trustEventSchemaRaw = JSON.parse(
    readFileSync(resolve(SCHEMAS_DIR, 'trust-event.json'), 'utf-8')
  );
  const thresholdSpecSchema = JSON.parse(
    readFileSync(resolve(SCHEMAS_DIR, 'threshold-spec.json'), 'utf-8')
  );

  // Resolve relative $ref in trust-event schema
  const trustEventSchema = resolveRefs(trustEventSchemaRaw);

  // Add trust-score schema first (trust-event $refs it for Signature)
  ajvInstance.addSchema(trustScoreSchema);
  ajvInstance.addSchema(trustEventSchema);
  ajvInstance.addSchema(thresholdSpecSchema);

  return ajvInstance;
}

export function validateTrustScore(data: unknown): ValidationResult {
  if (!trustScoreValidator) {
    const ajv = getAjv();
    trustScoreValidator = ajv.getSchema(
      'https://github.com/Percival-Labs/mcp-t/schemas/trust-score.json'
    )!;
  }
  const valid = trustScoreValidator(data) as boolean;
  return { valid, errors: trustScoreValidator.errors ?? null };
}

export function validateTrustEvent(data: unknown): ValidationResult {
  if (!trustEventValidator) {
    const ajv = getAjv();
    trustEventValidator = ajv.getSchema(
      'https://github.com/Percival-Labs/mcp-t/schemas/trust-event.json'
    )!;
  }
  const valid = trustEventValidator(data) as boolean;
  return { valid, errors: trustEventValidator.errors ?? null };
}

export function validateThresholdSpec(data: unknown): ValidationResult {
  if (!thresholdSpecValidator) {
    const ajv = getAjv();
    thresholdSpecValidator = ajv.getSchema(
      'https://github.com/Percival-Labs/mcp-t/schemas/threshold-spec.json'
    )!;
  }
  const valid = thresholdSpecValidator(data) as boolean;
  return { valid, errors: thresholdSpecValidator.errors ?? null };
}

/**
 * Reset cached validators (useful for testing the validator itself).
 */
export function resetValidators(): void {
  ajvInstance = null;
  trustScoreValidator = null;
  trustEventValidator = null;
  thresholdSpecValidator = null;
}
