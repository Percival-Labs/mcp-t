/**
 * MCP-T Conformance: Protocol Message Validation
 *
 * Tests JSON-RPC 2.0 message structure for all 5 MCP-T methods.
 * References: Section 7 of MCP-T v0.1.0 spec.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRequest, validateResponse } from '../src/protocol-validator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '../fixtures');

const messages = JSON.parse(
  readFileSync(resolve(FIXTURES, 'protocol-messages.json'), 'utf-8')
);

describe('Protocol Message Validation', () => {
  // --- JSON-RPC 2.0 Envelope ---

  describe('JSON-RPC 2.0 envelope', () => {
    it('should reject missing jsonrpc field', () => {
      const msg = { id: '1', method: 'trust/query', params: { subject_id: 'did:key:z6Mk' } };
      const result = validateRequest(msg);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('jsonrpc field must be "2.0"');
    });

    it('should reject wrong jsonrpc version', () => {
      const msg = { jsonrpc: '1.0', id: '1', method: 'trust/query', params: { subject_id: 'did:key:z6Mk' } };
      const result = validateRequest(msg);
      expect(result.valid).toBe(false);
    });

    it('should reject missing id on request', () => {
      const msg = { jsonrpc: '2.0', method: 'trust/query', params: { subject_id: 'did:key:z6Mk' } };
      const result = validateRequest(msg);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('id field is required for request messages');
    });

    it('should reject non-MCP-T method', () => {
      const msg = { jsonrpc: '2.0', id: '1', method: 'unknown/method', params: {} };
      const result = validateRequest(msg);
      expect(result.valid).toBe(false);
    });

    it('should reject null message', () => {
      const result = validateRequest(null);
      expect(result.valid).toBe(false);
    });

    it('should reject non-object message', () => {
      const result = validateRequest('not an object');
      expect(result.valid).toBe(false);
    });
  });

  // --- trust/query ---

  describe('trust/query', () => {
    it('should accept a valid request', () => {
      const result = validateRequest(messages.trust_query.request);
      expect(result.valid).toBe(true);
    });

    it('should accept a minimal request with only subject_id', () => {
      const msg = {
        jsonrpc: '2.0',
        id: '1',
        method: 'trust/query',
        params: { subject_id: 'did:key:z6Mk' },
      };
      const result = validateRequest(msg);
      expect(result.valid).toBe(true);
    });

    it('should reject request without subject_id', () => {
      const msg = {
        jsonrpc: '2.0',
        id: '1',
        method: 'trust/query',
        params: { domain: 'code-execution' },
      };
      const result = validateRequest(msg);
      expect(result.valid).toBe(false);
    });

    it('should reject request with empty subject_id', () => {
      const msg = {
        jsonrpc: '2.0',
        id: '1',
        method: 'trust/query',
        params: { subject_id: '' },
      };
      const result = validateRequest(msg);
      expect(result.valid).toBe(false);
    });

    it('should accept a valid response', () => {
      const result = validateResponse(messages.trust_query.response, 'trust/query');
      expect(result.valid).toBe(true);
    });

    it('should accept SubjectNotFound error response', () => {
      const result = validateResponse(
        messages.trust_query.error_subject_not_found,
        'trust/query'
      );
      expect(result.valid).toBe(true);
    });

    it('should accept ProviderUnavailable error response', () => {
      const result = validateResponse(
        messages.trust_query.error_provider_unavailable,
        'trust/query'
      );
      expect(result.valid).toBe(true);
    });

    it('should accept DomainNotSupported error response', () => {
      const result = validateResponse(
        messages.trust_query.error_domain_not_supported,
        'trust/query'
      );
      expect(result.valid).toBe(true);
    });

    it('should accept StaleScore error response', () => {
      const result = validateResponse(
        messages.trust_query.error_stale_score,
        'trust/query'
      );
      expect(result.valid).toBe(true);
    });

    it('should reject response without trust_score in result', () => {
      const msg = {
        jsonrpc: '2.0',
        id: '1',
        result: { some_other_field: 'data' },
      };
      const result = validateResponse(msg, 'trust/query');
      expect(result.valid).toBe(false);
    });

    it('should reject response with both result and error', () => {
      const msg = {
        jsonrpc: '2.0',
        id: '1',
        result: { trust_score: {} },
        error: { code: -32001, message: 'SubjectNotFound' },
      };
      const result = validateResponse(msg, 'trust/query');
      expect(result.valid).toBe(false);
    });
  });

  // --- trust/verify ---

  describe('trust/verify', () => {
    it('should accept a valid request', () => {
      const result = validateRequest(messages.trust_verify.request);
      expect(result.valid).toBe(true);
    });

    it('should reject request without threshold', () => {
      const msg = {
        jsonrpc: '2.0',
        id: '1',
        method: 'trust/verify',
        params: { subject_id: 'did:key:z6Mk' },
      };
      const result = validateRequest(msg);
      expect(result.valid).toBe(false);
    });

    it('should reject threshold without composite_min or dimension_mins', () => {
      const msg = {
        jsonrpc: '2.0',
        id: '1',
        method: 'trust/verify',
        params: {
          subject_id: 'did:key:z6Mk',
          threshold: { confidence_min: 0.8 },
        },
      };
      const result = validateRequest(msg);
      expect(result.valid).toBe(false);
    });

    it('should accept threshold with only composite_min', () => {
      const msg = {
        jsonrpc: '2.0',
        id: '1',
        method: 'trust/verify',
        params: {
          subject_id: 'did:key:z6Mk',
          threshold: { composite_min: 700 },
        },
      };
      const result = validateRequest(msg);
      expect(result.valid).toBe(true);
    });

    it('should accept threshold with only dimension_mins', () => {
      const msg = {
        jsonrpc: '2.0',
        id: '1',
        method: 'trust/verify',
        params: {
          subject_id: 'did:key:z6Mk',
          threshold: { dimension_mins: { verification: 800 } },
        },
      };
      const result = validateRequest(msg);
      expect(result.valid).toBe(true);
    });

    it('should accept a valid response', () => {
      const result = validateResponse(messages.trust_verify.response, 'trust/verify');
      expect(result.valid).toBe(true);
    });

    it('should reject response without verified boolean', () => {
      const msg = {
        jsonrpc: '2.0',
        id: '1',
        result: {
          subject_id: 'did:key:z6Mk',
          confidence: 0.85,
        },
      };
      const result = validateResponse(msg, 'trust/verify');
      expect(result.valid).toBe(false);
    });

    it('should validate nonce echo in response', () => {
      const response = messages.trust_verify.response;
      expect(response.result.nonce).toBe('a1b2c3d4e5f6');
    });

    it('should validate valid_until is present in response', () => {
      const response = messages.trust_verify.response;
      expect(response.result.valid_until).toBeDefined();
      expect(typeof response.result.valid_until).toBe('string');
    });
  });

  // --- trust/history ---

  describe('trust/history', () => {
    it('should accept a valid request', () => {
      const result = validateRequest(messages.trust_history.request);
      expect(result.valid).toBe(true);
    });

    it('should accept request with only subject_id', () => {
      const msg = {
        jsonrpc: '2.0',
        id: '1',
        method: 'trust/history',
        params: { subject_id: 'did:key:z6Mk' },
      };
      const result = validateRequest(msg);
      expect(result.valid).toBe(true);
    });

    it('should reject request with limit above 1000', () => {
      const msg = {
        jsonrpc: '2.0',
        id: '1',
        method: 'trust/history',
        params: { subject_id: 'did:key:z6Mk', limit: 1001 },
      };
      const result = validateRequest(msg);
      expect(result.valid).toBe(false);
    });

    it('should reject request with limit of 0', () => {
      const msg = {
        jsonrpc: '2.0',
        id: '1',
        method: 'trust/history',
        params: { subject_id: 'did:key:z6Mk', limit: 0 },
      };
      const result = validateRequest(msg);
      expect(result.valid).toBe(false);
    });

    it('should accept a valid response', () => {
      const result = validateResponse(messages.trust_history.response, 'trust/history');
      expect(result.valid).toBe(true);
    });

    it('should reject response without events array', () => {
      const msg = {
        jsonrpc: '2.0',
        id: '1',
        result: { has_more: false, total_count: 0 },
      };
      const result = validateResponse(msg, 'trust/history');
      expect(result.valid).toBe(false);
    });

    it('should reject response without has_more', () => {
      const msg = {
        jsonrpc: '2.0',
        id: '1',
        result: { events: [], total_count: 0 },
      };
      const result = validateResponse(msg, 'trust/history');
      expect(result.valid).toBe(false);
    });

    it('should validate pagination cursor in response', () => {
      const response = messages.trust_history.response;
      expect(response.result.cursor).toBeDefined();
      expect(response.result.has_more).toBe(true);
    });
  });

  // --- trust/providers ---

  describe('trust/providers', () => {
    it('should accept a valid request', () => {
      const result = validateRequest(messages.trust_providers.request);
      expect(result.valid).toBe(true);
    });

    it('should accept request with empty params', () => {
      const msg = {
        jsonrpc: '2.0',
        id: '1',
        method: 'trust/providers',
        params: {},
      };
      const result = validateRequest(msg);
      expect(result.valid).toBe(true);
    });

    it('should accept a valid response', () => {
      const result = validateResponse(
        messages.trust_providers.response,
        'trust/providers'
      );
      expect(result.valid).toBe(true);
    });

    it('should reject response without providers array', () => {
      const msg = {
        jsonrpc: '2.0',
        id: '1',
        result: {},
      };
      const result = validateResponse(msg, 'trust/providers');
      expect(result.valid).toBe(false);
    });

    it('should validate provider descriptor fields', () => {
      const provider = messages.trust_providers.response.result.providers[0];
      expect(provider.provider_id).toBeDefined();
      expect(provider.name).toBeDefined();
      expect(provider.conformance_level).toBeDefined();
      expect(provider.dimensions).toBeDefined();
      expect(Array.isArray(provider.dimensions)).toBe(true);
    });

    it('should reject provider without provider_id', () => {
      const msg = {
        jsonrpc: '2.0',
        id: '1',
        result: {
          providers: [
            {
              name: 'Test',
              conformance_level: 0,
              dimensions: ['verification', 'tenure'],
            },
          ],
        },
      };
      const result = validateResponse(msg, 'trust/providers');
      expect(result.valid).toBe(false);
    });
  });

  // --- trust/publish ---

  describe('trust/publish', () => {
    it('should accept a valid request', () => {
      const result = validateRequest(messages.trust_publish.request);
      expect(result.valid).toBe(true);
    });

    it('should reject request without event', () => {
      const msg = {
        jsonrpc: '2.0',
        id: '1',
        method: 'trust/publish',
        params: {},
      };
      const result = validateRequest(msg);
      expect(result.valid).toBe(false);
    });

    it('should accept a valid response', () => {
      const result = validateResponse(messages.trust_publish.response, 'trust/publish');
      expect(result.valid).toBe(true);
    });

    it('should reject response with invalid processing_status', () => {
      const msg = {
        jsonrpc: '2.0',
        id: '1',
        result: {
          accepted: true,
          event_id: 'evt_01',
          processing_status: 'unknown_status',
        },
      };
      const result = validateResponse(msg, 'trust/publish');
      expect(result.valid).toBe(false);
    });

    it('should accept InvalidSignature error', () => {
      const result = validateResponse(
        messages.trust_publish.error_invalid_signature,
        'trust/publish'
      );
      expect(result.valid).toBe(true);
    });

    it('should accept UnknownEventType error', () => {
      const result = validateResponse(
        messages.trust_publish.error_unknown_event_type,
        'trust/publish'
      );
      expect(result.valid).toBe(true);
    });

    it('should accept DuplicateEvent error', () => {
      const result = validateResponse(
        messages.trust_publish.error_duplicate_event,
        'trust/publish'
      );
      expect(result.valid).toBe(true);
    });

    it('should accept IssuerNotAuthorized error', () => {
      const result = validateResponse(
        messages.trust_publish.error_issuer_not_authorized,
        'trust/publish'
      );
      expect(result.valid).toBe(true);
    });
  });

  // --- Common errors ---

  describe('common error codes', () => {
    it('should accept RateLimited error with retry_after_seconds', () => {
      const result = validateResponse(
        messages.common_errors.rate_limited,
        'trust/query'
      );
      expect(result.valid).toBe(true);
      expect(messages.common_errors.rate_limited.error.data.retry_after_seconds).toBe(30);
    });

    it('should accept UnsupportedVersion error with supported_versions', () => {
      const result = validateResponse(
        messages.common_errors.unsupported_version,
        'trust/query'
      );
      expect(result.valid).toBe(true);
      expect(messages.common_errors.unsupported_version.error.data.supported_versions).toContain('0.1.0');
    });

    it('should accept KeyBindingFailed error', () => {
      const result = validateResponse(
        messages.common_errors.key_binding_failed,
        'trust/query'
      );
      expect(result.valid).toBe(true);
    });
  });
});
