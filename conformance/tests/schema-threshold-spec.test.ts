/**
 * MCP-T Conformance: Threshold Spec Schema Validation
 *
 * Tests the threshold-spec.json schema against valid and invalid inputs.
 * References: Section 7.2.3 of MCP-T v0.1.0 spec.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateThresholdSpec } from '../src/schema-validator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '../fixtures');

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES, name), 'utf-8'));
}

describe('Threshold Spec Schema Validation', () => {
  describe('valid threshold specs', () => {
    it('should accept a full threshold spec with all fields', () => {
      const spec = loadFixture('valid-threshold-spec.json');
      const result = validateThresholdSpec(spec);
      expect(result.valid).toBe(true);
    });

    it('should accept composite_min only', () => {
      const spec = { composite_min: 600 };
      const result = validateThresholdSpec(spec);
      expect(result.valid).toBe(true);
    });

    it('should accept dimension_mins only', () => {
      const spec = {
        dimension_mins: { verification: 800, performance: 700 },
      };
      const result = validateThresholdSpec(spec);
      expect(result.valid).toBe(true);
    });

    it('should accept boundary composite_min of 0', () => {
      const spec = { composite_min: 0 };
      const result = validateThresholdSpec(spec);
      expect(result.valid).toBe(true);
    });

    it('should accept boundary composite_min of 1000', () => {
      const spec = { composite_min: 1000 };
      const result = validateThresholdSpec(spec);
      expect(result.valid).toBe(true);
    });

    it('should accept confidence_min at boundaries', () => {
      for (const val of [0.0, 0.5, 1.0]) {
        const spec = { composite_min: 500, confidence_min: val };
        const result = validateThresholdSpec(spec);
        expect(result.valid).toBe(true);
      }
    });

    it('should accept min_evidence_count of 0', () => {
      const spec = { composite_min: 500, min_evidence_count: 0 };
      const result = validateThresholdSpec(spec);
      expect(result.valid).toBe(true);
    });
  });

  describe('invalid threshold specs', () => {
    it('should reject empty object (neither composite_min nor dimension_mins)', () => {
      const spec = {};
      const result = validateThresholdSpec(spec);
      expect(result.valid).toBe(false);
    });

    it('should reject object with only confidence_min (no composite_min or dimension_mins)', () => {
      const spec = { confidence_min: 0.8 };
      const result = validateThresholdSpec(spec);
      expect(result.valid).toBe(false);
    });

    it('should reject composite_min above 1000', () => {
      const spec = { composite_min: 1001 };
      const result = validateThresholdSpec(spec);
      expect(result.valid).toBe(false);
    });

    it('should reject composite_min below 0', () => {
      const spec = { composite_min: -1 };
      const result = validateThresholdSpec(spec);
      expect(result.valid).toBe(false);
    });

    it('should reject dimension_mins value above 1000', () => {
      const spec = { dimension_mins: { verification: 1001 } };
      const result = validateThresholdSpec(spec);
      expect(result.valid).toBe(false);
    });

    it('should reject dimension_mins value below 0', () => {
      const spec = { dimension_mins: { verification: -1 } };
      const result = validateThresholdSpec(spec);
      expect(result.valid).toBe(false);
    });

    it('should reject confidence_min above 1.0', () => {
      const spec = { composite_min: 500, confidence_min: 1.1 };
      const result = validateThresholdSpec(spec);
      expect(result.valid).toBe(false);
    });

    it('should reject confidence_min below 0.0', () => {
      const spec = { composite_min: 500, confidence_min: -0.1 };
      const result = validateThresholdSpec(spec);
      expect(result.valid).toBe(false);
    });
  });
});
