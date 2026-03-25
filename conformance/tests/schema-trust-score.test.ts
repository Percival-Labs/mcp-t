/**
 * MCP-T Conformance: Trust Score Schema Validation
 *
 * Tests the trust-score.json schema against valid and invalid inputs.
 * References: Section 4 of MCP-T v0.1.0 spec.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTrustScore } from '../src/schema-validator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '../fixtures');

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES, name), 'utf-8'));
}

describe('Trust Score Schema Validation', () => {
  describe('valid trust scores', () => {
    it('should accept a full trust score with 6 dimensions', () => {
      const score = loadFixture('valid-trust-score.json');
      const result = validateTrustScore(score);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should accept a minimal trust score with 2 dimensions', () => {
      const score = loadFixture('valid-trust-score-minimal.json');
      const result = validateTrustScore(score);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should accept boundary values: composite=0, dimension=0, confidence=0.0', () => {
      const score = loadFixture('valid-trust-score-boundary.json');
      const result = validateTrustScore(score);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should accept composite=1000 at upper boundary', () => {
      const score = {
        schema_version: '0.1.0',
        subject_id: 'did:key:z6MkUpperBound',
        provider_id: 'did:web:max.example.com',
        score: {
          composite: 1000,
          dimensions: {
            verification: { value: 1000, confidence: 1.0, evidence_count: 1 },
            tenure: { value: 1000, confidence: 1.0, evidence_count: 1 },
          },
        },
        validity: {
          issued_at: '2026-03-15T10:30:00Z',
          expires_at: '2026-03-15T11:30:00Z',
          max_age_seconds: 3600,
        },
        signature: {
          algorithm: 'Ed25519',
          public_key: 'testkey',
          value: 'testsig',
        },
      };
      const result = validateTrustScore(score);
      expect(result.valid).toBe(true);
    });

    it('should accept all 9 default dimensions', () => {
      const dims: Record<string, unknown> = {};
      const allDims = [
        'verification', 'tenure', 'performance', 'commitment',
        'community', 'consistency', 'transparency', 'compliance', 'security',
      ];
      for (const d of allDims) {
        dims[d] = { value: 500, confidence: 0.5, evidence_count: 10 };
      }
      const score = {
        schema_version: '0.1.0',
        subject_id: 'did:key:z6MkAllDims',
        provider_id: 'did:web:all.example.com',
        score: { composite: 500, dimensions: dims },
        validity: {
          issued_at: '2026-03-15T10:30:00Z',
          expires_at: '2026-03-15T11:30:00Z',
          max_age_seconds: 3600,
        },
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustScore(score);
      expect(result.valid).toBe(true);
    });

    it('should accept custom dimensions with reverse-DNS namespacing', () => {
      const score = {
        schema_version: '0.1.0',
        subject_id: 'did:key:z6MkCustomDims',
        provider_id: 'did:web:custom.example.com',
        score: {
          composite: 700,
          dimensions: {
            verification: { value: 800, confidence: 0.9, evidence_count: 20 },
            performance: { value: 600, confidence: 0.7, evidence_count: 50 },
            'com.example.custom-metric': {
              value: 750,
              confidence: 0.6,
              evidence_count: 5,
            },
          },
        },
        validity: {
          issued_at: '2026-03-15T10:30:00Z',
          expires_at: '2026-03-15T11:30:00Z',
          max_age_seconds: 3600,
        },
        signature: { algorithm: 'ES384', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustScore(score);
      expect(result.valid).toBe(true);
    });

    it('should accept all three supported signature algorithms', () => {
      for (const algo of ['Ed25519', 'ES256', 'ES384']) {
        const score = {
          schema_version: '1.0.0',
          subject_id: 'did:key:z6MkAlgo',
          provider_id: 'did:web:algo.example.com',
          score: {
            composite: 500,
            dimensions: {
              verification: { value: 500, confidence: 0.5, evidence_count: 1 },
              tenure: { value: 500, confidence: 0.5, evidence_count: 1 },
            },
          },
          validity: {
            issued_at: '2026-03-15T10:30:00Z',
            expires_at: '2026-03-15T11:30:00Z',
            max_age_seconds: 3600,
          },
          signature: { algorithm: algo, public_key: 'key', value: 'sig' },
        };
        const result = validateTrustScore(score);
        expect(result.valid).toBe(true);
      }
    });

    it('should accept optional domain and metadata fields', () => {
      const score = {
        schema_version: '0.1.0',
        subject_id: 'did:key:z6MkOptional',
        provider_id: 'did:web:opt.example.com',
        score: {
          composite: 500,
          dimensions: {
            verification: { value: 500, confidence: 0.5, evidence_count: 1 },
            performance: { value: 500, confidence: 0.5, evidence_count: 1 },
          },
        },
        domain: 'financial',
        domain_match: false,
        authorized: true,
        validity: {
          issued_at: '2026-03-15T10:30:00Z',
          expires_at: '2026-03-15T11:30:00Z',
          max_age_seconds: 3600,
        },
        metadata: { custom_field: 'any value' },
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustScore(score);
      expect(result.valid).toBe(true);
    });
  });

  describe('invalid trust scores', () => {
    it('should reject missing schema_version', () => {
      const score = {
        subject_id: 'did:key:z6MkTest',
        provider_id: 'did:web:test.example.com',
        score: {
          composite: 500,
          dimensions: {
            verification: { value: 500, confidence: 0.5, evidence_count: 1 },
            tenure: { value: 500, confidence: 0.5, evidence_count: 1 },
          },
        },
        validity: {
          issued_at: '2026-03-15T10:30:00Z',
          expires_at: '2026-03-15T11:30:00Z',
          max_age_seconds: 3600,
        },
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustScore(score);
      expect(result.valid).toBe(false);
      expect(result.errors).not.toBeNull();
    });

    it('should reject invalid schema_version format (not semver)', () => {
      const score = {
        schema_version: 'v1',
        subject_id: 'did:key:z6MkTest',
        provider_id: 'did:web:test.example.com',
        score: {
          composite: 500,
          dimensions: {
            verification: { value: 500, confidence: 0.5, evidence_count: 1 },
            tenure: { value: 500, confidence: 0.5, evidence_count: 1 },
          },
        },
        validity: {
          issued_at: '2026-03-15T10:30:00Z',
          expires_at: '2026-03-15T11:30:00Z',
          max_age_seconds: 3600,
        },
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustScore(score);
      expect(result.valid).toBe(false);
    });

    it('should reject empty subject_id', () => {
      const score = {
        schema_version: '0.1.0',
        subject_id: '',
        provider_id: 'did:web:test.example.com',
        score: {
          composite: 500,
          dimensions: {
            verification: { value: 500, confidence: 0.5, evidence_count: 1 },
            tenure: { value: 500, confidence: 0.5, evidence_count: 1 },
          },
        },
        validity: {
          issued_at: '2026-03-15T10:30:00Z',
          expires_at: '2026-03-15T11:30:00Z',
          max_age_seconds: 3600,
        },
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustScore(score);
      expect(result.valid).toBe(false);
    });

    it('should reject composite score above 1000', () => {
      const score = {
        schema_version: '0.1.0',
        subject_id: 'did:key:z6MkTest',
        provider_id: 'did:web:test.example.com',
        score: {
          composite: 1001,
          dimensions: {
            verification: { value: 500, confidence: 0.5, evidence_count: 1 },
            tenure: { value: 500, confidence: 0.5, evidence_count: 1 },
          },
        },
        validity: {
          issued_at: '2026-03-15T10:30:00Z',
          expires_at: '2026-03-15T11:30:00Z',
          max_age_seconds: 3600,
        },
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustScore(score);
      expect(result.valid).toBe(false);
    });

    it('should reject composite score below 0', () => {
      const score = {
        schema_version: '0.1.0',
        subject_id: 'did:key:z6MkTest',
        provider_id: 'did:web:test.example.com',
        score: {
          composite: -1,
          dimensions: {
            verification: { value: 500, confidence: 0.5, evidence_count: 1 },
            tenure: { value: 500, confidence: 0.5, evidence_count: 1 },
          },
        },
        validity: {
          issued_at: '2026-03-15T10:30:00Z',
          expires_at: '2026-03-15T11:30:00Z',
          max_age_seconds: 3600,
        },
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustScore(score);
      expect(result.valid).toBe(false);
    });

    it('should reject dimension value above 1000', () => {
      const score = {
        schema_version: '0.1.0',
        subject_id: 'did:key:z6MkTest',
        provider_id: 'did:web:test.example.com',
        score: {
          composite: 500,
          dimensions: {
            verification: { value: 1001, confidence: 0.5, evidence_count: 1 },
            tenure: { value: 500, confidence: 0.5, evidence_count: 1 },
          },
        },
        validity: {
          issued_at: '2026-03-15T10:30:00Z',
          expires_at: '2026-03-15T11:30:00Z',
          max_age_seconds: 3600,
        },
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustScore(score);
      expect(result.valid).toBe(false);
    });

    it('should reject confidence above 1.0', () => {
      const score = {
        schema_version: '0.1.0',
        subject_id: 'did:key:z6MkTest',
        provider_id: 'did:web:test.example.com',
        score: {
          composite: 500,
          dimensions: {
            verification: { value: 500, confidence: 1.1, evidence_count: 1 },
            tenure: { value: 500, confidence: 0.5, evidence_count: 1 },
          },
        },
        validity: {
          issued_at: '2026-03-15T10:30:00Z',
          expires_at: '2026-03-15T11:30:00Z',
          max_age_seconds: 3600,
        },
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustScore(score);
      expect(result.valid).toBe(false);
    });

    it('should reject confidence below 0.0', () => {
      const score = {
        schema_version: '0.1.0',
        subject_id: 'did:key:z6MkTest',
        provider_id: 'did:web:test.example.com',
        score: {
          composite: 500,
          dimensions: {
            verification: { value: 500, confidence: -0.1, evidence_count: 1 },
            tenure: { value: 500, confidence: 0.5, evidence_count: 1 },
          },
        },
        validity: {
          issued_at: '2026-03-15T10:30:00Z',
          expires_at: '2026-03-15T11:30:00Z',
          max_age_seconds: 3600,
        },
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustScore(score);
      expect(result.valid).toBe(false);
    });

    it('should reject negative evidence_count', () => {
      const score = {
        schema_version: '0.1.0',
        subject_id: 'did:key:z6MkTest',
        provider_id: 'did:web:test.example.com',
        score: {
          composite: 500,
          dimensions: {
            verification: { value: 500, confidence: 0.5, evidence_count: -1 },
            tenure: { value: 500, confidence: 0.5, evidence_count: 1 },
          },
        },
        validity: {
          issued_at: '2026-03-15T10:30:00Z',
          expires_at: '2026-03-15T11:30:00Z',
          max_age_seconds: 3600,
        },
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustScore(score);
      expect(result.valid).toBe(false);
    });

    it('should reject fewer than 2 dimensions', () => {
      const score = {
        schema_version: '0.1.0',
        subject_id: 'did:key:z6MkTest',
        provider_id: 'did:web:test.example.com',
        score: {
          composite: 500,
          dimensions: {
            verification: { value: 500, confidence: 0.5, evidence_count: 1 },
          },
        },
        validity: {
          issued_at: '2026-03-15T10:30:00Z',
          expires_at: '2026-03-15T11:30:00Z',
          max_age_seconds: 3600,
        },
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustScore(score);
      expect(result.valid).toBe(false);
    });

    it('should reject missing validity', () => {
      const score = {
        schema_version: '0.1.0',
        subject_id: 'did:key:z6MkTest',
        provider_id: 'did:web:test.example.com',
        score: {
          composite: 500,
          dimensions: {
            verification: { value: 500, confidence: 0.5, evidence_count: 1 },
            tenure: { value: 500, confidence: 0.5, evidence_count: 1 },
          },
        },
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustScore(score);
      expect(result.valid).toBe(false);
    });

    it('should reject missing signature', () => {
      const score = {
        schema_version: '0.1.0',
        subject_id: 'did:key:z6MkTest',
        provider_id: 'did:web:test.example.com',
        score: {
          composite: 500,
          dimensions: {
            verification: { value: 500, confidence: 0.5, evidence_count: 1 },
            tenure: { value: 500, confidence: 0.5, evidence_count: 1 },
          },
        },
        validity: {
          issued_at: '2026-03-15T10:30:00Z',
          expires_at: '2026-03-15T11:30:00Z',
          max_age_seconds: 3600,
        },
      };
      const result = validateTrustScore(score);
      expect(result.valid).toBe(false);
    });

    it('should reject unsupported signature algorithm', () => {
      const score = {
        schema_version: '0.1.0',
        subject_id: 'did:key:z6MkTest',
        provider_id: 'did:web:test.example.com',
        score: {
          composite: 500,
          dimensions: {
            verification: { value: 500, confidence: 0.5, evidence_count: 1 },
            tenure: { value: 500, confidence: 0.5, evidence_count: 1 },
          },
        },
        validity: {
          issued_at: '2026-03-15T10:30:00Z',
          expires_at: '2026-03-15T11:30:00Z',
          max_age_seconds: 3600,
        },
        signature: { algorithm: 'RSA-SHA256', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustScore(score);
      expect(result.valid).toBe(false);
    });

    it('should reject missing dimension required fields (value, confidence, evidence_count)', () => {
      const score = {
        schema_version: '0.1.0',
        subject_id: 'did:key:z6MkTest',
        provider_id: 'did:web:test.example.com',
        score: {
          composite: 500,
          dimensions: {
            verification: { value: 500 },
            tenure: { value: 500, confidence: 0.5, evidence_count: 1 },
          },
        },
        validity: {
          issued_at: '2026-03-15T10:30:00Z',
          expires_at: '2026-03-15T11:30:00Z',
          max_age_seconds: 3600,
        },
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustScore(score);
      expect(result.valid).toBe(false);
    });

    it('should reject max_age_seconds of 0', () => {
      const score = {
        schema_version: '0.1.0',
        subject_id: 'did:key:z6MkTest',
        provider_id: 'did:web:test.example.com',
        score: {
          composite: 500,
          dimensions: {
            verification: { value: 500, confidence: 0.5, evidence_count: 1 },
            tenure: { value: 500, confidence: 0.5, evidence_count: 1 },
          },
        },
        validity: {
          issued_at: '2026-03-15T10:30:00Z',
          expires_at: '2026-03-15T11:30:00Z',
          max_age_seconds: 0,
        },
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustScore(score);
      expect(result.valid).toBe(false);
    });

    it('should reject non-integer composite score', () => {
      const score = {
        schema_version: '0.1.0',
        subject_id: 'did:key:z6MkTest',
        provider_id: 'did:web:test.example.com',
        score: {
          composite: 742.5,
          dimensions: {
            verification: { value: 500, confidence: 0.5, evidence_count: 1 },
            tenure: { value: 500, confidence: 0.5, evidence_count: 1 },
          },
        },
        validity: {
          issued_at: '2026-03-15T10:30:00Z',
          expires_at: '2026-03-15T11:30:00Z',
          max_age_seconds: 3600,
        },
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustScore(score);
      expect(result.valid).toBe(false);
    });

    it('should reject wrong type for composite (string instead of integer)', () => {
      const score = {
        schema_version: '0.1.0',
        subject_id: 'did:key:z6MkTest',
        provider_id: 'did:web:test.example.com',
        score: {
          composite: '742',
          dimensions: {
            verification: { value: 500, confidence: 0.5, evidence_count: 1 },
            tenure: { value: 500, confidence: 0.5, evidence_count: 1 },
          },
        },
        validity: {
          issued_at: '2026-03-15T10:30:00Z',
          expires_at: '2026-03-15T11:30:00Z',
          max_age_seconds: 3600,
        },
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const result = validateTrustScore(score);
      expect(result.valid).toBe(false);
    });
  });
});
