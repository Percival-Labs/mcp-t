/**
 * MCP-T Conformance: Trust Event Schema Validation
 *
 * Tests the trust-event.json schema against valid and invalid inputs.
 * References: Section 6 of MCP-T v0.1.0 spec.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTrustEvent } from '../src/schema-validator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '../fixtures');

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES, name), 'utf-8'));
}

describe('Trust Event Schema Validation', () => {
  describe('valid trust events', () => {
    it('should accept a valid contract.completed event', () => {
      const event = loadFixture('valid-trust-event.json');
      const result = validateTrustEvent(event);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should accept an event with co_signatures', () => {
      const event = {
        event_id: 'evt_01HXYZ789ABC',
        event_type: 'contract.completed',
        subject_id: 'did:key:z6MkTest',
        issuer_id: 'did:web:platform.example.com',
        timestamp: '2026-03-15T09:45:00Z',
        payload: { contract_id: 'ctr_001', outcome: 'success' },
        dimensions_affected: ['performance'],
        signature: { algorithm: 'Ed25519', public_key: 'key1', value: 'sig1' },
        co_signatures: [
          {
            signer_id: 'did:key:z6MkCosigner',
            algorithm: 'Ed25519',
            public_key: 'key2',
            value: 'sig2',
          },
        ],
      };
      const result = validateTrustEvent(event);
      expect(result.valid).toBe(true);
    });

    it('should accept an event without optional dimensions_affected', () => {
      const event = {
        event_id: 'evt_01HXYZ789ABC',
        event_type: 'contract.completed',
        subject_id: 'did:key:z6MkTest',
        issuer_id: 'did:web:platform.example.com',
        timestamp: '2026-03-15T09:45:00Z',
        payload: { contract_id: 'ctr_001', outcome: 'success' },
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustEvent(event);
      expect(result.valid).toBe(true);
    });

    it('should accept a custom event type with reverse-DNS namespacing', () => {
      const event = {
        event_id: 'evt_custom_001',
        event_type: 'com.example.custom_event',
        subject_id: 'did:key:z6MkTest',
        issuer_id: 'did:web:platform.example.com',
        timestamp: '2026-03-15T09:45:00Z',
        payload: { custom_data: 'value' },
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustEvent(event);
      expect(result.valid).toBe(true);
    });
  });

  describe('invalid trust events', () => {
    it('should reject missing event_id', () => {
      const event = {
        event_type: 'contract.completed',
        subject_id: 'did:key:z6MkTest',
        issuer_id: 'did:web:platform.example.com',
        timestamp: '2026-03-15T09:45:00Z',
        payload: { contract_id: 'ctr_001', outcome: 'success' },
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustEvent(event);
      expect(result.valid).toBe(false);
    });

    it('should reject empty event_id', () => {
      const event = {
        event_id: '',
        event_type: 'contract.completed',
        subject_id: 'did:key:z6MkTest',
        issuer_id: 'did:web:platform.example.com',
        timestamp: '2026-03-15T09:45:00Z',
        payload: { contract_id: 'ctr_001', outcome: 'success' },
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustEvent(event);
      expect(result.valid).toBe(false);
    });

    it('should reject missing event_type', () => {
      const event = {
        event_id: 'evt_01',
        subject_id: 'did:key:z6MkTest',
        issuer_id: 'did:web:platform.example.com',
        timestamp: '2026-03-15T09:45:00Z',
        payload: { contract_id: 'ctr_001' },
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustEvent(event);
      expect(result.valid).toBe(false);
    });

    it('should reject event_type not matching dot-namespaced pattern', () => {
      const event = {
        event_id: 'evt_01',
        event_type: 'INVALID-TYPE',
        subject_id: 'did:key:z6MkTest',
        issuer_id: 'did:web:platform.example.com',
        timestamp: '2026-03-15T09:45:00Z',
        payload: {},
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustEvent(event);
      expect(result.valid).toBe(false);
    });

    it('should reject event_type starting with a number', () => {
      const event = {
        event_id: 'evt_01',
        event_type: '1contract.completed',
        subject_id: 'did:key:z6MkTest',
        issuer_id: 'did:web:platform.example.com',
        timestamp: '2026-03-15T09:45:00Z',
        payload: {},
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustEvent(event);
      expect(result.valid).toBe(false);
    });

    it('should reject missing subject_id', () => {
      const event = {
        event_id: 'evt_01',
        event_type: 'contract.completed',
        issuer_id: 'did:web:platform.example.com',
        timestamp: '2026-03-15T09:45:00Z',
        payload: { contract_id: 'ctr_001', outcome: 'success' },
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustEvent(event);
      expect(result.valid).toBe(false);
    });

    it('should reject missing issuer_id', () => {
      const event = {
        event_id: 'evt_01',
        event_type: 'contract.completed',
        subject_id: 'did:key:z6MkTest',
        timestamp: '2026-03-15T09:45:00Z',
        payload: { contract_id: 'ctr_001', outcome: 'success' },
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustEvent(event);
      expect(result.valid).toBe(false);
    });

    it('should reject missing timestamp', () => {
      const event = {
        event_id: 'evt_01',
        event_type: 'contract.completed',
        subject_id: 'did:key:z6MkTest',
        issuer_id: 'did:web:platform.example.com',
        payload: { contract_id: 'ctr_001', outcome: 'success' },
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustEvent(event);
      expect(result.valid).toBe(false);
    });

    it('should reject missing payload', () => {
      const event = {
        event_id: 'evt_01',
        event_type: 'contract.completed',
        subject_id: 'did:key:z6MkTest',
        issuer_id: 'did:web:platform.example.com',
        timestamp: '2026-03-15T09:45:00Z',
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustEvent(event);
      expect(result.valid).toBe(false);
    });

    it('should reject missing signature', () => {
      const event = {
        event_id: 'evt_01',
        event_type: 'contract.completed',
        subject_id: 'did:key:z6MkTest',
        issuer_id: 'did:web:platform.example.com',
        timestamp: '2026-03-15T09:45:00Z',
        payload: { contract_id: 'ctr_001', outcome: 'success' },
      };
      const result = validateTrustEvent(event);
      expect(result.valid).toBe(false);
    });

    it('should reject co_signature with unsupported algorithm', () => {
      const event = {
        event_id: 'evt_01',
        event_type: 'contract.completed',
        subject_id: 'did:key:z6MkTest',
        issuer_id: 'did:web:platform.example.com',
        timestamp: '2026-03-15T09:45:00Z',
        payload: { contract_id: 'ctr_001', outcome: 'success' },
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
        co_signatures: [
          {
            signer_id: 'did:key:z6MkCosigner',
            algorithm: 'RSA-SHA256',
            public_key: 'key2',
            value: 'sig2',
          },
        ],
      };
      const result = validateTrustEvent(event);
      expect(result.valid).toBe(false);
    });
  });
});
