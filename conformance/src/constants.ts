/**
 * MCP-T Specification Constants
 *
 * Canonical values from the MCP-T v0.1.0 specification.
 */

/** The 10 default trust dimensions defined in Section 5 of the spec. */
export const DEFAULT_DIMENSIONS = [
  'verification',
  'tenure',
  'performance',
  'commitment',
  'community',
  'consistency',
  'transparency',
  'compliance',
  'security',
  'behavioral_fidelity', // v0.2.0
] as const;

export type DefaultDimension = (typeof DEFAULT_DIMENSIONS)[number];

/** Score range: 0 to 1000 inclusive (Section 4.2.2, 4.2.3). */
export const SCORE_MIN = 0;
export const SCORE_MAX = 1000;

/** Confidence range: 0.0 to 1.0 inclusive (Section 4.2.3). */
export const CONFIDENCE_MIN = 0.0;
export const CONFIDENCE_MAX = 1.0;

/** Minimum number of dimensions required in a trust score (Section 4.2.2). */
export const MIN_DIMENSIONS = 2;

/** Supported signature algorithms (Section 4.2.5). */
export const SIGNATURE_ALGORITHMS = ['Ed25519', 'ES256', 'ES384'] as const;

/** All 16 standard event types from Section 6.3. */
export const STANDARD_EVENT_TYPES = {
  // Contract events (6.3.1)
  'contract.completed': {
    requiredPayload: ['contract_id', 'outcome'],
    dimensions: ['performance', 'consistency'],
  },
  'contract.failed': {
    requiredPayload: ['contract_id', 'outcome', 'reason'],
    dimensions: ['performance'],
  },
  'contract.disputed': {
    requiredPayload: ['contract_id', 'dispute_reason'],
    dimensions: ['performance', 'consistency'],
  },
  'contract.abandoned': {
    requiredPayload: ['contract_id', 'abandonment_reason'],
    dimensions: ['performance', 'commitment'],
  },
  // Security events (6.3.2)
  'security.incident': {
    requiredPayload: ['severity', 'description'],
    dimensions: ['security'],
  },
  'security.vulnerability_reported': {
    requiredPayload: ['severity', 'reported_by'],
    dimensions: ['security'],
  },
  'security.vulnerability_resolved': {
    requiredPayload: ['resolution_time_seconds'],
    dimensions: ['security'],
  },
  'security.audit_completed': {
    requiredPayload: ['auditor_id', 'findings_count', 'critical_findings'],
    dimensions: ['security', 'compliance'],
  },
  // Behavioral events (6.3.3)
  'behavior.anomaly': {
    requiredPayload: ['anomaly_type', 'evidence'],
    dimensions: ['consistency'],
  },
  'behavior.definition_change': {
    requiredPayload: ['tool_name', 'diff'],
    dimensions: ['consistency', 'transparency'],
  },
  'behavior.uptime_report': {
    requiredPayload: ['period_seconds', 'availability_ratio'],
    dimensions: ['consistency', 'performance'],
  },
  // Endorsement events (6.3.4)
  'endorsement.vouch': {
    requiredPayload: [],
    dimensions: ['community'],
  },
  'endorsement.revoke': {
    requiredPayload: ['original_event_id'],
    dimensions: ['community'],
  },
  // Economic events (6.3.5)
  'economic.stake_deposited': {
    requiredPayload: ['amount', 'currency'],
    dimensions: ['commitment'],
  },
  'economic.stake_withdrawn': {
    requiredPayload: ['amount', 'currency'],
    dimensions: ['commitment'],
  },
  'economic.slash_executed': {
    requiredPayload: ['amount', 'currency', 'reason', 'adjudication_id'],
    dimensions: ['commitment', 'performance'],
  },
  // Behavioral observation events (6.3.6) -- v0.2.0
  'behavior.trace': {
    requiredPayload: ['trace_id', 'tool_calls', 'resources_accessed', 'duration_ms', 'total_tool_calls', 'undeclared_tool_calls', 'total_resources', 'undeclared_resources'],
    dimensions: ['behavioral_fidelity', 'performance', 'consistency'],
  },
  'behavior.invariant_discovered': {
    requiredPayload: ['invariant_id', 'invariant_type', 'pattern', 'confidence', 'observation_count'],
    dimensions: ['behavioral_fidelity', 'consistency'],
  },
  'behavior.declaration_delta': {
    requiredPayload: ['declared_scope', 'observed_scope', 'delta_type', 'severity'],
    dimensions: ['behavioral_fidelity', 'security'],
  },
  'behavior.resource_access': {
    requiredPayload: ['resource_type', 'resource_id', 'access_type', 'authorized'],
    dimensions: ['behavioral_fidelity', 'security'],
  },
  // Simulation events (6.3.7) -- v0.2.0
  'simulation.executed': {
    requiredPayload: ['simulation_id', 'task_spec_hash', 'execution_paths_explored'],
    dimensions: ['behavioral_fidelity'],
  },
  'simulation.result': {
    requiredPayload: ['simulation_id', 'predicted_outcome', 'confidence'],
    dimensions: ['behavioral_fidelity', 'performance'],
  },
  'simulation.delta': {
    requiredPayload: ['simulation_id', 'contract_id', 'divergence_score'],
    dimensions: ['behavioral_fidelity', 'consistency'],
  },
  // Bid events (6.3.8) -- v0.2.0
  'contract.bid_submitted': {
    requiredPayload: ['contract_id', 'bid_id', 'bid_amount', 'currency'],
    dimensions: ['commitment', 'performance'],
  },
  'contract.bid_accepted': {
    requiredPayload: ['contract_id', 'bid_id', 'agent_id'],
    dimensions: ['performance', 'community'],
  },
  'contract.bid_rejected': {
    requiredPayload: ['contract_id', 'bid_id', 'reason'],
    dimensions: ['performance'],
  },
} as const;

/** MCP-T specific error codes (Section 7). */
export const ERROR_CODES = {
  // trust/query errors (7.1.3)
  SUBJECT_NOT_FOUND: -32001,
  PROVIDER_UNAVAILABLE: -32002,
  DOMAIN_NOT_SUPPORTED: -32003,
  STALE_SCORE: -32004,
  // trust/publish errors (7.5.3)
  INVALID_SIGNATURE: -32010,
  UNKNOWN_EVENT_TYPE: -32011,
  DUPLICATE_EVENT: -32012,
  ISSUER_NOT_AUTHORIZED: -32013,
  // Common errors (7.6)
  RATE_LIMITED: -32020,
  UNSUPPORTED_VERSION: -32021,
  KEY_BINDING_FAILED: -32022,
} as const;

/** Conformance levels (Section 10). */
export const CONFORMANCE_LEVELS = {
  L0_READ_ONLY: 0,
  L1_BASIC: 1,
  L2_ECONOMIC: 2,
  L3_ZERO_KNOWLEDGE: 3,
} as const;

/** Valid processing statuses for trust/publish response. */
export const PROCESSING_STATUSES = ['processed', 'queued', 'rejected'] as const;

/** Severity levels for security events. */
export const SEVERITY_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
