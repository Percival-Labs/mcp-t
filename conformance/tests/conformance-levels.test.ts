/**
 * MCP-T Conformance: Conformance Level Tests
 *
 * Tests that validate the requirements for each conformance level (L0-L3).
 * References: Section 10 of MCP-T v0.1.0 spec.
 */

import { describe, it, expect } from 'vitest';
import {
  CONFORMANCE_LEVELS,
  DEFAULT_DIMENSIONS,
  STANDARD_EVENT_TYPES,
} from '../src/constants.js';
import { validateRequest, validateResponse } from '../src/protocol-validator.js';
import { validateTrustScore, validateTrustEvent } from '../src/schema-validator.js';

/** Helper to create a minimal valid trust score. */
function minimalTrustScore(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: '0.1.0',
    subject_id: 'did:key:z6MkTest',
    provider_id: 'did:web:provider.example.com',
    score: {
      composite: 500,
      dimensions: {
        verification: { value: 500, confidence: 0.5, evidence_count: 10 },
        performance: { value: 500, confidence: 0.5, evidence_count: 10 },
      },
    },
    validity: {
      issued_at: '2026-03-15T10:30:00Z',
      expires_at: '2026-03-15T11:30:00Z',
      max_age_seconds: 3600,
    },
    signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
    ...overrides,
  };
}

/** Helper to create a minimal valid trust event. */
function minimalTrustEvent(overrides: Record<string, unknown> = {}) {
  return {
    event_id: 'evt_01TEST',
    event_type: 'contract.completed',
    subject_id: 'did:key:z6MkTest',
    issuer_id: 'did:web:platform.example.com',
    timestamp: '2026-03-15T09:45:00Z',
    payload: { contract_id: 'ctr_001', outcome: 'success' },
    dimensions_affected: ['performance'],
    signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
    ...overrides,
  };
}

describe('Conformance Level Tests', () => {
  describe('Level 0: Read-Only', () => {
    it('should define L0 as conformance level 0', () => {
      expect(CONFORMANCE_LEVELS.L0_READ_ONLY).toBe(0);
    });

    it('should support trust/query request format', () => {
      const msg = {
        jsonrpc: '2.0',
        id: '1',
        method: 'trust/query',
        params: { subject_id: 'did:key:z6MkTest' },
      };
      const result = validateRequest(msg);
      expect(result.valid).toBe(true);
    });

    it('should support trust/verify request format', () => {
      const msg = {
        jsonrpc: '2.0',
        id: '1',
        method: 'trust/verify',
        params: {
          subject_id: 'did:key:z6MkTest',
          threshold: { composite_min: 600 },
        },
      };
      const result = validateRequest(msg);
      expect(result.valid).toBe(true);
    });

    it('should validate trust score signatures are present', () => {
      const score = minimalTrustScore();
      const result = validateTrustScore(score);
      expect(result.valid).toBe(true);
      expect(score.signature).toBeDefined();
      expect(score.signature.algorithm).toBeDefined();
      expect(score.signature.public_key).toBeDefined();
      expect(score.signature.value).toBeDefined();
    });

    it('should reject trust score without signature (L0 must validate signatures)', () => {
      const score = minimalTrustScore();
      delete (score as Record<string, unknown>).signature;
      const result = validateTrustScore(score);
      expect(result.valid).toBe(false);
    });

    it('should validate validity window fields are present', () => {
      const score = minimalTrustScore();
      expect(score.validity.issued_at).toBeDefined();
      expect(score.validity.expires_at).toBeDefined();
      expect(score.validity.max_age_seconds).toBeDefined();
    });
  });

  describe('Level 1: Basic', () => {
    it('should define L1 as conformance level 1', () => {
      expect(CONFORMANCE_LEVELS.L1_BASIC).toBe(1);
    });

    it('should support trust/publish request format', () => {
      const msg = {
        jsonrpc: '2.0',
        id: '1',
        method: 'trust/publish',
        params: { event: minimalTrustEvent() },
      };
      const result = validateRequest(msg);
      expect(result.valid).toBe(true);
    });

    it('should support trust/history request format', () => {
      const msg = {
        jsonrpc: '2.0',
        id: '1',
        method: 'trust/history',
        params: { subject_id: 'did:key:z6MkTest' },
      };
      const result = validateRequest(msg);
      expect(result.valid).toBe(true);
    });

    it('should require signed events for publishing', () => {
      const event = minimalTrustEvent();
      const result = validateTrustEvent(event);
      expect(result.valid).toBe(true);
      expect(event.signature).toBeDefined();
    });

    it('should reject unsigned events', () => {
      const event = minimalTrustEvent();
      delete (event as Record<string, unknown>).signature;
      const result = validateTrustEvent(event);
      expect(result.valid).toBe(false);
    });

    it('should support standard event types or properly namespaced custom types', () => {
      // Standard type
      const standardEvent = minimalTrustEvent({ event_type: 'contract.completed' });
      expect(validateTrustEvent(standardEvent).valid).toBe(true);

      // Custom namespaced type
      const customEvent = minimalTrustEvent({
        event_type: 'com.example.custom_metric',
      });
      expect(validateTrustEvent(customEvent).valid).toBe(true);
    });

    it('should validate trust/history response contains pagination fields', () => {
      const response = {
        jsonrpc: '2.0',
        id: '1',
        result: {
          events: [],
          cursor: null,
          has_more: false,
          total_count: 0,
        },
      };
      const result = validateResponse(response, 'trust/history');
      expect(result.valid).toBe(true);
    });
  });

  describe('Level 2: Economic', () => {
    it('should define L2 as conformance level 2', () => {
      expect(CONFORMANCE_LEVELS.L2_ECONOMIC).toBe(2);
    });

    it('should require support for economic event types', () => {
      const economicTypes = [
        'economic.stake_deposited',
        'economic.stake_withdrawn',
        'economic.slash_executed',
      ];
      for (const eventType of economicTypes) {
        expect(eventType in STANDARD_EVENT_TYPES).toBe(true);
      }
    });

    it('should require support for endorsement event types', () => {
      const endorsementTypes = ['endorsement.vouch', 'endorsement.revoke'];
      for (const eventType of endorsementTypes) {
        expect(eventType in STANDARD_EVENT_TYPES).toBe(true);
      }
    });

    it('should require the commitment dimension', () => {
      expect(DEFAULT_DIMENSIONS).toContain('commitment');
    });

    it('should validate economic.stake_deposited event format', () => {
      const event = minimalTrustEvent({
        event_type: 'economic.stake_deposited',
        payload: { amount: 100000, currency: 'sats', lock_duration_seconds: 2592000 },
        dimensions_affected: ['commitment'],
      });
      const result = validateTrustEvent(event);
      expect(result.valid).toBe(true);
    });

    it('should validate economic.slash_executed event format', () => {
      const event = minimalTrustEvent({
        event_type: 'economic.slash_executed',
        payload: {
          amount: 10000,
          currency: 'sats',
          reason: 'SLA violation',
          adjudication_id: 'adj_001',
        },
        dimensions_affected: ['commitment', 'performance'],
      });
      const result = validateTrustEvent(event);
      expect(result.valid).toBe(true);
    });

    it('should include commitment dimension in L2 trust scores', () => {
      const score = minimalTrustScore({
        score: {
          composite: 600,
          dimensions: {
            verification: { value: 700, confidence: 0.8, evidence_count: 20 },
            commitment: { value: 500, confidence: 0.7, evidence_count: 5 },
          },
        },
      });
      const result = validateTrustScore(score);
      expect(result.valid).toBe(true);
    });
  });

  describe('Level 3: Zero-Knowledge', () => {
    it('should define L3 as conformance level 3', () => {
      expect(CONFORMANCE_LEVELS.L3_ZERO_KNOWLEDGE).toBe(3);
    });

    it('should support proof_request parameter in trust/verify', () => {
      // L3 adds a proof_request parameter to trust/verify
      const msg = {
        jsonrpc: '2.0',
        id: '1',
        method: 'trust/verify',
        params: {
          subject_id: 'did:key:z6MkTest',
          threshold: {
            composite_min: 700,
            dimension_mins: { verification: 800 },
          },
          proof_request: {
            type: 'zero_knowledge',
            hide_score: true,
            hide_provider: false,
            hide_events: true,
            proof_system: 'groth16',
          },
        },
      };
      // The basic request validator accepts extra params
      const result = validateRequest(msg);
      expect(result.valid).toBe(true);
    });

    it('should validate ZK proof response structure', () => {
      const response = {
        jsonrpc: '2.0',
        id: '1',
        result: {
          verified: true,
          proof: {
            type: 'groth16',
            public_inputs: [
              'threshold_composite_min:700',
              'threshold_dim_verification_min:800',
              'subject_id_commitment:0xabc123',
            ],
            proof_data: 'base64url-encoded-proof',
            verification_key_uri:
              'https://trustprovider.example.com/vk/mcp-t-v1.json',
          },
          checked_at: '2026-03-15T10:31:00Z',
        },
      };
      const result = validateResponse(response, 'trust/verify');
      expect(result.valid).toBe(true);
    });

    it('should include proof object with type, public_inputs, proof_data, and verification_key_uri', () => {
      const proof = {
        type: 'groth16',
        public_inputs: ['threshold_composite_min:700'],
        proof_data: 'base64url-encoded-proof',
        verification_key_uri: 'https://example.com/vk.json',
      };
      expect(proof.type).toBeDefined();
      expect(Array.isArray(proof.public_inputs)).toBe(true);
      expect(proof.proof_data).toBeDefined();
      expect(proof.verification_key_uri).toBeDefined();
    });
  });
});
