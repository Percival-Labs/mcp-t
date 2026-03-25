/**
 * MCP-T Conformance Testing Suite
 *
 * Public API for programmatic use of the conformance validators.
 */

export {
  validateTrustScore,
  validateTrustEvent,
  validateThresholdSpec,
  resetValidators,
  type ValidationResult,
} from './schema-validator.js';

export {
  validateRequest,
  validateResponse,
  type ProtocolValidationResult,
} from './protocol-validator.js';

export {
  generateKeypair,
  canonicalizeForSigning,
  signEd25519,
  verifyEd25519,
  createSignedTrustScore,
  createSignedTrustEvent,
  toBase64Url,
  fromBase64Url,
  toHex,
} from './signature-utils.js';

export {
  DEFAULT_DIMENSIONS,
  STANDARD_EVENT_TYPES,
  ERROR_CODES,
  CONFORMANCE_LEVELS,
  SIGNATURE_ALGORITHMS,
  SCORE_MIN,
  SCORE_MAX,
  CONFIDENCE_MIN,
  CONFIDENCE_MAX,
  MIN_DIMENSIONS,
  PROCESSING_STATUSES,
  SEVERITY_LEVELS,
} from './constants.js';
