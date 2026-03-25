# MCP-T Conformance Testing Suite

Conformance tests for the [MCP-T specification v0.1.0](../spec/mcp-t-v0.1.0.md). Run these tests against any MCP-T implementation to verify compliance with the spec.

## Quick Start

```bash
cd conformance
bun install
bun test
```

## What's Tested

### Schema Validation (Ajv against official JSON schemas)

- **Trust Score** (`trust-score.json`) -- Valid/invalid objects, boundary values (0-1000 scores, 0.0-1.0 confidence), all 9 dimensions, min 2 dimensions requirement, signature algorithms
- **Trust Event** (`trust-event.json`) -- Required fields, event_type regex pattern, co_signatures, signature validation
- **Threshold Spec** (`threshold-spec.json`) -- composite_min/dimension_mins requirement, range validation

### Protocol Messages (JSON-RPC 2.0)

All 5 MCP-T methods:
- `trust/query` -- request/response format, error codes (-32001 through -32004)
- `trust/verify` -- threshold spec, nonce echo, valid_until
- `trust/history` -- pagination (cursor, has_more, total_count), limit bounds (1-1000)
- `trust/providers` -- provider descriptor fields (provider_id, name, conformance_level, dimensions)
- `trust/publish` -- event submission, processing_status enum, error codes (-32010 through -32013)
- Common errors: RateLimited (-32020), UnsupportedVersion (-32021), KeyBindingFailed (-32022)

### Conformance Levels

- **L0 (Read-Only)** -- trust/query + trust/verify, signature presence, validity window
- **L1 (Basic)** -- trust/publish + trust/history, signed events
- **L2 (Economic)** -- economic.* events, endorsement.* events, commitment dimension
- **L3 (Zero-Knowledge)** -- proof_request parameter, ZK proof response structure

### Signature Tests

- Ed25519 key generation
- Canonical JSON serialization (RFC 8785 / JCS)
- Sign and verify round-trip
- Reject wrong keys, tampered messages, tampered signatures
- Trust score signing (remove `signature` field before signing)
- Trust event signing (remove `signature` and `co_signatures` before signing)

### Trust Event Types

All 16 standard event types validated:
- 4 contract events (`contract.completed`, `contract.failed`, `contract.disputed`, `contract.abandoned`)
- 4 security events (`security.incident`, `security.vulnerability_reported`, `security.vulnerability_resolved`, `security.audit_completed`)
- 3 behavioral events (`behavior.anomaly`, `behavior.definition_change`, `behavior.uptime_report`)
- 2 endorsement events (`endorsement.vouch`, `endorsement.revoke`)
- 3 economic events (`economic.stake_deposited`, `economic.stake_withdrawn`, `economic.slash_executed`)

Each type verified for required payload fields, affected dimensions, and event_type format.

## Project Structure

```
conformance/
  src/
    constants.ts          # Spec constants (dimensions, error codes, event types)
    schema-validator.ts   # Ajv-based JSON schema validation
    protocol-validator.ts # JSON-RPC 2.0 message validation
    signature-utils.ts    # Ed25519 signing/verification utilities
    index.ts              # Public API
  tests/
    schema-trust-score.test.ts    # Trust score schema tests
    schema-trust-event.test.ts    # Trust event schema tests
    schema-threshold-spec.test.ts # Threshold spec schema tests
    protocol-messages.test.ts     # Protocol message tests
    conformance-levels.test.ts    # Conformance level tests
    signature.test.ts             # Signature tests
    trust-events.test.ts          # Event type tests
  fixtures/
    valid-trust-score.json          # Full valid trust score
    valid-trust-score-minimal.json  # Minimal valid trust score (2 dims)
    valid-trust-score-boundary.json # Boundary values (0 and 1000)
    valid-trust-event.json          # Valid trust event
    valid-threshold-spec.json       # Valid threshold spec
    all-event-types.json            # All 16 standard event types
    protocol-messages.json          # Request/response/error fixtures
```

## Using as a Library

The validators can be imported for use in your own test suite:

```typescript
import {
  validateTrustScore,
  validateTrustEvent,
  validateThresholdSpec,
  validateRequest,
  validateResponse,
  generateKeypair,
  createSignedTrustScore,
} from '@mcp-t/conformance';
```

## License

Apache-2.0
