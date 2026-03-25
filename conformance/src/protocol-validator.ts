/**
 * MCP-T Protocol Message Validator
 *
 * Validates JSON-RPC 2.0 message structure for all 5 MCP-T methods.
 * Does NOT validate the schema of embedded trust scores/events (use
 * schema-validator for that). This validates the protocol envelope.
 */

export interface ProtocolValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_METHODS = [
  'trust/query',
  'trust/verify',
  'trust/history',
  'trust/providers',
  'trust/publish',
] as const;

type McpTMethod = (typeof VALID_METHODS)[number];

const QUERY_ERROR_CODES = [-32001, -32002, -32003, -32004] as const;
const PUBLISH_ERROR_CODES = [-32010, -32011, -32012, -32013] as const;
const COMMON_ERROR_CODES = [-32020, -32021, -32022] as const;

/**
 * Validate a JSON-RPC 2.0 request message for an MCP-T method.
 */
export function validateRequest(msg: unknown): ProtocolValidationResult {
  const errors: string[] = [];

  if (typeof msg !== 'object' || msg === null) {
    return { valid: false, errors: ['Message must be a non-null object'] };
  }

  const m = msg as Record<string, unknown>;

  // JSON-RPC 2.0 envelope
  if (m.jsonrpc !== '2.0') {
    errors.push('jsonrpc field must be "2.0"');
  }
  if (!('id' in m)) {
    errors.push('id field is required for request messages');
  }
  if (typeof m.method !== 'string') {
    errors.push('method field must be a string');
  } else if (!VALID_METHODS.includes(m.method as McpTMethod)) {
    errors.push(
      `method must be one of: ${VALID_METHODS.join(', ')}. Got: ${m.method}`
    );
  }

  if (errors.length > 0) return { valid: false, errors };

  // Method-specific param validation
  const method = m.method as McpTMethod;
  const params = m.params as Record<string, unknown> | undefined;

  switch (method) {
    case 'trust/query':
      validateQueryRequestParams(params, errors);
      break;
    case 'trust/verify':
      validateVerifyRequestParams(params, errors);
      break;
    case 'trust/history':
      validateHistoryRequestParams(params, errors);
      break;
    case 'trust/providers':
      // params can be empty or omitted
      break;
    case 'trust/publish':
      validatePublishRequestParams(params, errors);
      break;
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a JSON-RPC 2.0 response message for an MCP-T method.
 */
export function validateResponse(
  msg: unknown,
  method: McpTMethod
): ProtocolValidationResult {
  const errors: string[] = [];

  if (typeof msg !== 'object' || msg === null) {
    return { valid: false, errors: ['Message must be a non-null object'] };
  }

  const m = msg as Record<string, unknown>;

  if (m.jsonrpc !== '2.0') {
    errors.push('jsonrpc field must be "2.0"');
  }
  if (!('id' in m)) {
    errors.push('id field is required for response messages');
  }

  // Either result or error, not both
  const hasResult = 'result' in m;
  const hasError = 'error' in m;

  if (!hasResult && !hasError) {
    errors.push('Response must have either result or error');
  }
  if (hasResult && hasError) {
    errors.push('Response must not have both result and error');
  }

  if (hasError) {
    validateErrorResponse(m.error, method, errors);
    return { valid: errors.length === 0, errors };
  }

  if (!hasResult) return { valid: errors.length === 0, errors };

  const result = m.result as Record<string, unknown>;

  switch (method) {
    case 'trust/query':
      validateQueryResponse(result, errors);
      break;
    case 'trust/verify':
      validateVerifyResponse(result, errors);
      break;
    case 'trust/history':
      validateHistoryResponse(result, errors);
      break;
    case 'trust/providers':
      validateProvidersResponse(result, errors);
      break;
    case 'trust/publish':
      validatePublishResponse(result, errors);
      break;
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate an error response envelope.
 */
export function validateErrorResponse(
  error: unknown,
  method: McpTMethod,
  errors: string[]
): void {
  if (typeof error !== 'object' || error === null) {
    errors.push('error must be a non-null object');
    return;
  }

  const e = error as Record<string, unknown>;

  if (typeof e.code !== 'number') {
    errors.push('error.code must be a number');
  }
  if (typeof e.message !== 'string') {
    errors.push('error.message must be a string');
  }

  if (typeof e.code === 'number') {
    const allValidCodes = [
      ...QUERY_ERROR_CODES,
      ...PUBLISH_ERROR_CODES,
      ...COMMON_ERROR_CODES,
      // Standard JSON-RPC 2.0 error codes
      -32700, -32600, -32601, -32602, -32603,
    ];

    if (!allValidCodes.includes(e.code)) {
      errors.push(`Unrecognized MCP-T error code: ${e.code}`);
    }
  }
}

// --- Method-specific param validators ---

function validateQueryRequestParams(
  params: Record<string, unknown> | undefined,
  errors: string[]
): void {
  if (!params) {
    errors.push('trust/query requires params');
    return;
  }
  if (typeof params.subject_id !== 'string' || params.subject_id.length === 0) {
    errors.push('trust/query params.subject_id is required and must be a non-empty string');
  }
  if (params.domain !== undefined && typeof params.domain !== 'string') {
    errors.push('trust/query params.domain must be a string if provided');
  }
  if (params.provider_id !== undefined && typeof params.provider_id !== 'string') {
    errors.push('trust/query params.provider_id must be a string if provided');
  }
  if (
    params.max_age_seconds !== undefined &&
    (typeof params.max_age_seconds !== 'number' || params.max_age_seconds < 1)
  ) {
    errors.push('trust/query params.max_age_seconds must be a positive integer if provided');
  }
  if (params.dimensions !== undefined) {
    if (!Array.isArray(params.dimensions)) {
      errors.push('trust/query params.dimensions must be an array if provided');
    } else if (params.dimensions.some((d: unknown) => typeof d !== 'string')) {
      errors.push('trust/query params.dimensions must be an array of strings');
    }
  }
}

function validateVerifyRequestParams(
  params: Record<string, unknown> | undefined,
  errors: string[]
): void {
  if (!params) {
    errors.push('trust/verify requires params');
    return;
  }
  if (typeof params.subject_id !== 'string' || params.subject_id.length === 0) {
    errors.push('trust/verify params.subject_id is required and must be a non-empty string');
  }
  if (!params.threshold || typeof params.threshold !== 'object') {
    errors.push('trust/verify params.threshold is required and must be an object');
  } else {
    const t = params.threshold as Record<string, unknown>;
    if (t.composite_min === undefined && t.dimension_mins === undefined) {
      errors.push(
        'trust/verify params.threshold must have at least one of composite_min or dimension_mins'
      );
    }
  }
}

function validateHistoryRequestParams(
  params: Record<string, unknown> | undefined,
  errors: string[]
): void {
  if (!params) {
    errors.push('trust/history requires params');
    return;
  }
  if (typeof params.subject_id !== 'string' || params.subject_id.length === 0) {
    errors.push('trust/history params.subject_id is required and must be a non-empty string');
  }
  if (params.limit !== undefined) {
    if (typeof params.limit !== 'number' || params.limit < 1 || params.limit > 1000) {
      errors.push('trust/history params.limit must be between 1 and 1000');
    }
  }
}

function validatePublishRequestParams(
  params: Record<string, unknown> | undefined,
  errors: string[]
): void {
  if (!params) {
    errors.push('trust/publish requires params');
    return;
  }
  if (!params.event || typeof params.event !== 'object') {
    errors.push('trust/publish params.event is required and must be an object');
  }
}

// --- Method-specific response validators ---

function validateQueryResponse(
  result: Record<string, unknown>,
  errors: string[]
): void {
  if (!result.trust_score || typeof result.trust_score !== 'object') {
    errors.push('trust/query result must contain trust_score object');
  }
}

function validateVerifyResponse(
  result: Record<string, unknown>,
  errors: string[]
): void {
  if (typeof result.verified !== 'boolean') {
    errors.push('trust/verify result.verified must be a boolean');
  }
  if (result.checked_at !== undefined && typeof result.checked_at !== 'string') {
    errors.push('trust/verify result.checked_at must be an ISO 8601 string');
  }
  if (result.confidence !== undefined && typeof result.confidence !== 'number') {
    errors.push('trust/verify result.confidence must be a number');
  }
}

function validateHistoryResponse(
  result: Record<string, unknown>,
  errors: string[]
): void {
  if (!Array.isArray(result.events)) {
    errors.push('trust/history result.events must be an array');
  }
  if (typeof result.has_more !== 'boolean') {
    errors.push('trust/history result.has_more must be a boolean');
  }
  if (typeof result.total_count !== 'number') {
    errors.push('trust/history result.total_count must be a number');
  }
}

function validateProvidersResponse(
  result: Record<string, unknown>,
  errors: string[]
): void {
  if (!Array.isArray(result.providers)) {
    errors.push('trust/providers result.providers must be an array');
    return;
  }
  for (let i = 0; i < result.providers.length; i++) {
    const p = result.providers[i] as Record<string, unknown>;
    if (typeof p.provider_id !== 'string') {
      errors.push(`trust/providers result.providers[${i}].provider_id must be a string`);
    }
    if (typeof p.name !== 'string') {
      errors.push(`trust/providers result.providers[${i}].name must be a string`);
    }
    if (typeof p.conformance_level !== 'number') {
      errors.push(
        `trust/providers result.providers[${i}].conformance_level must be a number`
      );
    }
    if (!Array.isArray(p.dimensions)) {
      errors.push(`trust/providers result.providers[${i}].dimensions must be an array`);
    }
  }
}

function validatePublishResponse(
  result: Record<string, unknown>,
  errors: string[]
): void {
  if (typeof result.accepted !== 'boolean') {
    errors.push('trust/publish result.accepted must be a boolean');
  }
  if (typeof result.event_id !== 'string') {
    errors.push('trust/publish result.event_id must be a string');
  }
  if (typeof result.processing_status !== 'string') {
    errors.push('trust/publish result.processing_status must be a string');
  } else {
    const valid = ['processed', 'queued', 'rejected'];
    if (!valid.includes(result.processing_status as string)) {
      errors.push(
        `trust/publish result.processing_status must be one of: ${valid.join(', ')}`
      );
    }
  }
}
