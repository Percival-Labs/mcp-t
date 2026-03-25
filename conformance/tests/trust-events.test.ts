/**
 * MCP-T Conformance: Trust Event Type Tests
 *
 * Tests all 16 standard event types from Section 6.3 of the spec.
 * Validates required payload fields, dimensions_affected, and event_type format.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTrustEvent } from '../src/schema-validator.js';
import {
  STANDARD_EVENT_TYPES,
  DEFAULT_DIMENSIONS,
} from '../src/constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '../fixtures');

const allEvents = JSON.parse(
  readFileSync(resolve(FIXTURES, 'all-event-types.json'), 'utf-8')
);

describe('Trust Event Types', () => {
  describe('spec defines 16 standard event types', () => {
    it('should have exactly 16 standard event types', () => {
      expect(Object.keys(STANDARD_EVENT_TYPES).length).toBe(16);
    });

    it('should include all 4 contract event types', () => {
      expect('contract.completed' in STANDARD_EVENT_TYPES).toBe(true);
      expect('contract.failed' in STANDARD_EVENT_TYPES).toBe(true);
      expect('contract.disputed' in STANDARD_EVENT_TYPES).toBe(true);
      expect('contract.abandoned' in STANDARD_EVENT_TYPES).toBe(true);
    });

    it('should include all 4 security event types', () => {
      expect('security.incident' in STANDARD_EVENT_TYPES).toBe(true);
      expect('security.vulnerability_reported' in STANDARD_EVENT_TYPES).toBe(true);
      expect('security.vulnerability_resolved' in STANDARD_EVENT_TYPES).toBe(true);
      expect('security.audit_completed' in STANDARD_EVENT_TYPES).toBe(true);
    });

    it('should include all 3 behavioral event types', () => {
      expect('behavior.anomaly' in STANDARD_EVENT_TYPES).toBe(true);
      expect('behavior.definition_change' in STANDARD_EVENT_TYPES).toBe(true);
      expect('behavior.uptime_report' in STANDARD_EVENT_TYPES).toBe(true);
    });

    it('should include all 2 endorsement event types', () => {
      expect('endorsement.vouch' in STANDARD_EVENT_TYPES).toBe(true);
      expect('endorsement.revoke' in STANDARD_EVENT_TYPES).toBe(true);
    });

    it('should include all 3 economic event types', () => {
      expect('economic.stake_deposited' in STANDARD_EVENT_TYPES).toBe(true);
      expect('economic.stake_withdrawn' in STANDARD_EVENT_TYPES).toBe(true);
      expect('economic.slash_executed' in STANDARD_EVENT_TYPES).toBe(true);
    });
  });

  describe('event type format validation', () => {
    it('should use dot-namespaced format for all standard types', () => {
      const pattern = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;
      for (const eventType of Object.keys(STANDARD_EVENT_TYPES)) {
        expect(pattern.test(eventType)).toBe(true);
      }
    });
  });

  describe('all fixture event types pass schema validation', () => {
    for (const [name, event] of Object.entries(allEvents)) {
      it(`should validate ${name} event`, () => {
        const result = validateTrustEvent(event);
        expect(result.valid).toBe(true);
      });
    }
  });

  describe('contract.completed event', () => {
    it('should require contract_id and outcome in payload', () => {
      const spec = STANDARD_EVENT_TYPES['contract.completed'];
      expect(spec.requiredPayload).toContain('contract_id');
      expect(spec.requiredPayload).toContain('outcome');
    });

    it('should affect performance and consistency dimensions', () => {
      const spec = STANDARD_EVENT_TYPES['contract.completed'];
      expect(spec.dimensions).toContain('performance');
      expect(spec.dimensions).toContain('consistency');
    });
  });

  describe('contract.failed event', () => {
    it('should require contract_id, outcome, and reason in payload', () => {
      const spec = STANDARD_EVENT_TYPES['contract.failed'];
      expect(spec.requiredPayload).toContain('contract_id');
      expect(spec.requiredPayload).toContain('outcome');
      expect(spec.requiredPayload).toContain('reason');
    });
  });

  describe('contract.disputed event', () => {
    it('should require contract_id and dispute_reason in payload', () => {
      const spec = STANDARD_EVENT_TYPES['contract.disputed'];
      expect(spec.requiredPayload).toContain('contract_id');
      expect(spec.requiredPayload).toContain('dispute_reason');
    });
  });

  describe('contract.abandoned event', () => {
    it('should require contract_id and abandonment_reason in payload', () => {
      const spec = STANDARD_EVENT_TYPES['contract.abandoned'];
      expect(spec.requiredPayload).toContain('contract_id');
      expect(spec.requiredPayload).toContain('abandonment_reason');
    });

    it('should affect performance and commitment dimensions', () => {
      const spec = STANDARD_EVENT_TYPES['contract.abandoned'];
      expect(spec.dimensions).toContain('performance');
      expect(spec.dimensions).toContain('commitment');
    });
  });

  describe('security.incident event', () => {
    it('should require severity and description in payload', () => {
      const spec = STANDARD_EVENT_TYPES['security.incident'];
      expect(spec.requiredPayload).toContain('severity');
      expect(spec.requiredPayload).toContain('description');
    });

    it('should affect security dimension', () => {
      const spec = STANDARD_EVENT_TYPES['security.incident'];
      expect(spec.dimensions).toContain('security');
    });
  });

  describe('security.vulnerability_reported event', () => {
    it('should require severity and reported_by in payload', () => {
      const spec = STANDARD_EVENT_TYPES['security.vulnerability_reported'];
      expect(spec.requiredPayload).toContain('severity');
      expect(spec.requiredPayload).toContain('reported_by');
    });
  });

  describe('security.vulnerability_resolved event', () => {
    it('should require resolution_time_seconds in payload', () => {
      const spec = STANDARD_EVENT_TYPES['security.vulnerability_resolved'];
      expect(spec.requiredPayload).toContain('resolution_time_seconds');
    });
  });

  describe('security.audit_completed event', () => {
    it('should require auditor_id, findings_count, and critical_findings in payload', () => {
      const spec = STANDARD_EVENT_TYPES['security.audit_completed'];
      expect(spec.requiredPayload).toContain('auditor_id');
      expect(spec.requiredPayload).toContain('findings_count');
      expect(spec.requiredPayload).toContain('critical_findings');
    });

    it('should affect security and compliance dimensions', () => {
      const spec = STANDARD_EVENT_TYPES['security.audit_completed'];
      expect(spec.dimensions).toContain('security');
      expect(spec.dimensions).toContain('compliance');
    });
  });

  describe('behavior.anomaly event', () => {
    it('should require anomaly_type and evidence in payload', () => {
      const spec = STANDARD_EVENT_TYPES['behavior.anomaly'];
      expect(spec.requiredPayload).toContain('anomaly_type');
      expect(spec.requiredPayload).toContain('evidence');
    });

    it('should affect consistency dimension', () => {
      const spec = STANDARD_EVENT_TYPES['behavior.anomaly'];
      expect(spec.dimensions).toContain('consistency');
    });
  });

  describe('behavior.definition_change event', () => {
    it('should require tool_name and diff in payload', () => {
      const spec = STANDARD_EVENT_TYPES['behavior.definition_change'];
      expect(spec.requiredPayload).toContain('tool_name');
      expect(spec.requiredPayload).toContain('diff');
    });

    it('should affect consistency and transparency dimensions', () => {
      const spec = STANDARD_EVENT_TYPES['behavior.definition_change'];
      expect(spec.dimensions).toContain('consistency');
      expect(spec.dimensions).toContain('transparency');
    });
  });

  describe('behavior.uptime_report event', () => {
    it('should require period_seconds and availability_ratio in payload', () => {
      const spec = STANDARD_EVENT_TYPES['behavior.uptime_report'];
      expect(spec.requiredPayload).toContain('period_seconds');
      expect(spec.requiredPayload).toContain('availability_ratio');
    });
  });

  describe('endorsement.vouch event', () => {
    it('should have no required payload fields (endorser_trust_score and domain are optional)', () => {
      const spec = STANDARD_EVENT_TYPES['endorsement.vouch'];
      expect(spec.requiredPayload.length).toBe(0);
    });

    it('should affect community dimension', () => {
      const spec = STANDARD_EVENT_TYPES['endorsement.vouch'];
      expect(spec.dimensions).toContain('community');
    });
  });

  describe('endorsement.revoke event', () => {
    it('should require original_event_id in payload', () => {
      const spec = STANDARD_EVENT_TYPES['endorsement.revoke'];
      expect(spec.requiredPayload).toContain('original_event_id');
    });
  });

  describe('economic.stake_deposited event', () => {
    it('should require amount and currency in payload', () => {
      const spec = STANDARD_EVENT_TYPES['economic.stake_deposited'];
      expect(spec.requiredPayload).toContain('amount');
      expect(spec.requiredPayload).toContain('currency');
    });

    it('should affect commitment dimension', () => {
      const spec = STANDARD_EVENT_TYPES['economic.stake_deposited'];
      expect(spec.dimensions).toContain('commitment');
    });
  });

  describe('economic.stake_withdrawn event', () => {
    it('should require amount and currency in payload', () => {
      const spec = STANDARD_EVENT_TYPES['economic.stake_withdrawn'];
      expect(spec.requiredPayload).toContain('amount');
      expect(spec.requiredPayload).toContain('currency');
    });
  });

  describe('economic.slash_executed event', () => {
    it('should require amount, currency, reason, and adjudication_id in payload', () => {
      const spec = STANDARD_EVENT_TYPES['economic.slash_executed'];
      expect(spec.requiredPayload).toContain('amount');
      expect(spec.requiredPayload).toContain('currency');
      expect(spec.requiredPayload).toContain('reason');
      expect(spec.requiredPayload).toContain('adjudication_id');
    });

    it('should affect commitment and performance dimensions', () => {
      const spec = STANDARD_EVENT_TYPES['economic.slash_executed'];
      expect(spec.dimensions).toContain('commitment');
      expect(spec.dimensions).toContain('performance');
    });
  });

  describe('dimensions_affected values reference valid dimensions', () => {
    it('should only reference known default dimensions in standard event type definitions', () => {
      for (const [eventType, spec] of Object.entries(STANDARD_EVENT_TYPES)) {
        for (const dim of spec.dimensions) {
          expect(
            DEFAULT_DIMENSIONS.includes(dim as any),
            `Event type ${eventType} references unknown dimension: ${dim}`
          ).toBe(true);
        }
      }
    });
  });

  describe('event ID format', () => {
    it('should accept ULID-formatted event IDs', () => {
      const event = {
        event_id: '01HXYZ789ABCDEFGHJKLMNPQRS',
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

    it('should accept UUIDv7-formatted event IDs', () => {
      const event = {
        event_id: '0192aaaa-bbbb-7ccc-dddd-eeeeeeeeeeee',
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

    it('should accept prefixed event IDs (evt_ prefix)', () => {
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
  });
});
