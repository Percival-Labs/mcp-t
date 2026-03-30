# OATR -> MCP-T Integration Boundary Specification

**Status:** Draft v0.1.0
**Authors:** Alan Carroll (@realpercivallabs), FransDevelopment (OATR)
**Date:** 2026-03-29
**Scope:** Defines the data contract between OATR verification (Step 2) and MCP-T trust scoring (Step 3)

---

## 1. Purpose and Scope

This document defines the integration boundary between the Open Agent Trust Registry (OATR) and MCP-T. It specifies:

- What OATR provides as structured verification output (Step 2)
- How MCP-T consumers map that output into trust dimension inputs (Step 3)
- What each layer owns, and where interpretation responsibility transfers

The goal is a clean separation: **OATR provides facts. MCP-T interprets them.** Neither layer overreaches into the other's domain.

This spec covers the Step 2 to Step 3 handoff only. It does not define OATR's internal verification logic or MCP-T's scoring algorithms.

---

## 2. The Three-Step Flow

```
Step 1: Registry Lookup          Step 2: Verification Result       Step 3: Trust Scoring
┌──────────────────────┐         ┌───────────────────────┐        ┌───────────────────────┐
│  OATR Registry       │         │  OATR Structured      │        │  MCP-T Trust           │
│                      │         │  Verification Result   │        │  Score Response         │
│  Input: agent key    │────────>│                        │───────>│                        │
│  Output: issuer +    │         │  Output: status,       │        │  Output: composite     │
│    key metadata      │         │  reason code,          │        │  score, dimensions,    │
│                      │         │  issuer entry,         │        │  confidence, evidence  │
│                      │         │  key details           │        │                        │
└──────────────────────┘         └───────────────────────┘        └───────────────────────┘
         OATR owns                        OATR owns                      MCP-T owns
    "Is this key known?"          "What do we know about it?"      "How much should we
                                                                     trust this agent?"
```

**Boundary rule:** Step 2 output is OATR's final product. Step 3 input is MCP-T's responsibility to construct from that output. No scoring logic in OATR. No registry logic in MCP-T.

---

## 3. Step 2 Output Schema: OATR VerificationResult

This is what OATR returns after verification. It is a factual record, not an opinion.

```typescript
interface OATRVerificationResult {
  /** Whether the verification passed */
  verified: boolean;

  /**
   * Structured reason code when verified is false.
   * Disambiguates WHY verification failed so consumers
   * can make informed trust decisions.
   */
  reason_code?: OATRReasonCode;

  /** Human-readable reason string (for logging, not logic) */
  reason?: string;

  /** The issuer entry from the registry, if found */
  issuer?: OATRIssuerEntry;

  /** The specific key that was verified against */
  matched_key?: OATRKeyEntry;

  /** Timestamp of this verification */
  verified_at: string; // ISO 8601
}

/**
 * Disambiguation codes from OATR SDK v1.2.0
 * These are facts about WHY verification failed.
 * MCP-T decides what each means for trust scoring.
 */
type OATRReasonCode =
  | "suspended_issuer"      // Issuer temporarily suspended
  | "revoked_issuer"        // Issuer permanently revoked
  | "grace_period_expired"  // Deprecated key past 90-day window
  | "revoked_key"           // Key explicitly revoked
  | "unknown_issuer"        // Issuer not in registry
  | "unknown_key"           // Key not associated with any known issuer
  | "expired_attestation"   // Attestation past its expiry
  | "audience_mismatch"     // Attestation not intended for this verifier
  | "nonce_mismatch"        // Replay protection failed
  | "invalid_signature";    // Cryptographic signature invalid

interface OATRIssuerEntry {
  /** Issuer DID or identifier */
  id: string;

  /** Human-readable name */
  name?: string;

  /** When this issuer was first registered */
  registered_at: string; // ISO 8601

  /** Current issuer status */
  status: "active" | "suspended" | "revoked";

  /** All public keys associated with this issuer */
  public_keys: OATRKeyEntry[];
}

interface OATRKeyEntry {
  /** The public key (multibase-encoded for Ed25519) */
  key: string;

  /** Key algorithm */
  algorithm: "Ed25519" | "ES256" | "ES384";

  /** Current key status */
  status: "active" | "deprecated" | "revoked";

  /** When this key was added to the registry */
  added_at: string; // ISO 8601

  /** When this key was marked deprecated (start of grace period) */
  deprecated_at?: string; // ISO 8601

  /** When this key was revoked (immediate, no grace period) */
  revoked_at?: string; // ISO 8601

  /** When this key expires (if set) */
  expires_at?: string; // ISO 8601
}
```

---

## 4. Step 3 Input Mapping: OATR Results to MCP-T Dimensions

MCP-T consumers translate OATR's factual output into trust dimension inputs. Different trust providers MAY interpret the same OATR result differently based on their risk model. This is by design.

### 4.1 Verification Status -> `verification_level` Dimension

The binary `verified` field plus the reason code map to the verification_level dimension.

```typescript
function mapVerificationLevel(result: OATRVerificationResult): DimensionInput {
  if (result.verified) {
    return {
      dimension: "verification_level",
      value: 1000,
      confidence: 1.0,
      evidence: [{
        type: "oatr_verification",
        verified_at: result.verified_at,
        issuer_id: result.issuer?.id,
      }],
    };
  }

  // Unverified — but WHY matters for the score
  const severityMap: Record<OATRReasonCode, number> = {
    // Cryptographic failures — zero trust
    invalid_signature: 0,
    revoked_key: 0,
    revoked_issuer: 0,

    // Protocol failures — zero trust, different cause
    nonce_mismatch: 0,
    audience_mismatch: 50,

    // Temporal / administrative — reduced trust, not zero
    expired_attestation: 200,
    grace_period_expired: 150,
    suspended_issuer: 100,

    // Unknown — no basis for trust, but not adversarial signal
    unknown_issuer: 50,
    unknown_key: 50,
  };

  const value = result.reason_code
    ? severityMap[result.reason_code] ?? 0
    : 0;

  return {
    dimension: "verification_level",
    value,
    confidence: 1.0, // OATR result is deterministic
    evidence: [{
      type: "oatr_verification_failure",
      reason_code: result.reason_code,
      verified_at: result.verified_at,
    }],
  };
}
```

### 4.2 Tenure from `registered_at` -> `tenure` Dimension

How long an issuer has been in the registry is a trust signal. Longer tenure = more history to evaluate.

```typescript
function mapTenure(result: OATRVerificationResult): DimensionInput | null {
  if (!result.issuer?.registered_at) return null;

  const registeredAt = new Date(result.issuer.registered_at);
  const now = new Date();
  const tenureDays = (now.getTime() - registeredAt.getTime()) / (1000 * 60 * 60 * 24);

  // Linear ramp: 0 days = 100, 365 days = 700, 730+ days = 1000
  const value = Math.min(1000, Math.round(100 + (tenureDays / 730) * 900));

  return {
    dimension: "tenure",
    value,
    confidence: 1.0,
    evidence: [{
      type: "oatr_tenure",
      registered_at: result.issuer.registered_at,
      tenure_days: Math.round(tenureDays),
    }],
    // Use the new DimensionScore fields from PR #1
    observed_since: result.issuer.registered_at,
    observation_window_seconds: Math.round(tenureDays * 86400),
  };
}
```

### 4.3 Key Rotation Hygiene -> `governance` Dimension

Key rotation is a **governance signal**, not a behavioral consistency signal. An issuer that rotates keys on schedule, uses deprecation periods correctly, and doesn't accumulate stale keys demonstrates operational discipline.

OATR provides the facts (key statuses, timestamps). MCP-T interprets the pattern.

```typescript
function mapGovernance(result: OATRVerificationResult): DimensionInput | null {
  if (!result.issuer?.public_keys) return null;

  const keys = result.issuer.public_keys;
  const now = new Date();

  // Count governance signals
  let signals = {
    total_keys: keys.length,
    active_keys: keys.filter(k => k.status === "active").length,
    properly_deprecated: keys.filter(k =>
      k.status === "deprecated" && k.deprecated_at
    ).length,
    revoked_keys: keys.filter(k => k.status === "revoked").length,
    stale_deprecated: keys.filter(k => {
      if (k.status !== "deprecated" || !k.deprecated_at) return false;
      const deprecatedAt = new Date(k.deprecated_at);
      const daysSinceDeprecation = (now.getTime() - deprecatedAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceDeprecation > 90; // Past grace period but not cleaned up
    }).length,
  };

  // Scoring heuristics (trust providers can override)
  let score = 500; // Baseline

  // Having rotated at least once is a positive signal
  if (signals.total_keys > 1) score += 150;

  // Proper deprecation (not just revocation) shows process
  if (signals.properly_deprecated > 0) score += 150;

  // Too many active keys simultaneously is a smell
  if (signals.active_keys > 3) score -= 200;

  // Stale deprecated keys not cleaned up
  score -= signals.stale_deprecated * 100;

  // Emergency revocations are necessary but suggest incidents
  if (signals.revoked_keys > 0) score -= 50;

  return {
    dimension: "governance",
    value: Math.max(0, Math.min(1000, score)),
    confidence: 0.7, // Heuristic-based, not deterministic
    evidence: [{
      type: "oatr_key_governance",
      ...signals,
    }],
  };
}
```

### 4.4 Grace Period Status -> Risk Signal

An agent currently operating under a deprecated key within the 90-day grace period is a **risk signal**, not necessarily a trust failure. MCP-T consumers should factor this into confidence weighting.

```typescript
function assessGracePeriodRisk(result: OATRVerificationResult): RiskSignal | null {
  if (!result.matched_key || result.matched_key.status !== "deprecated") {
    return null;
  }

  const deprecatedAt = new Date(result.matched_key.deprecated_at!);
  const now = new Date();
  const daysInGrace = (now.getTime() - deprecatedAt.getTime()) / (1000 * 60 * 60 * 24);
  const graceRemaining = 90 - daysInGrace;

  return {
    type: "deprecated_key_in_grace_period",
    severity: graceRemaining < 14 ? "high" : graceRemaining < 45 ? "medium" : "low",
    days_remaining: Math.round(graceRemaining),
    recommendation: graceRemaining < 14
      ? "Key expiring soon. Reduce trust confidence or require re-verification."
      : "Key deprecated but within grace period. Monitor.",
  };
}

interface RiskSignal {
  type: string;
  severity: "low" | "medium" | "high";
  days_remaining: number;
  recommendation: string;
}
```

### 4.5 Rejection Code -> Trust Impact Summary

Full mapping of OATR reason codes to MCP-T trust impacts. This is the reference table for implementers.

| OATR Reason Code | Trust Impact | Affected Dimensions | Recommended Response |
|---|---|---|---|
| `invalid_signature` | **Critical** — cryptographic proof failed | verification_level = 0 | Reject. Log incident. |
| `revoked_key` | **Critical** — key explicitly revoked | verification_level = 0, governance -= 50 | Reject. Check for compromise. |
| `revoked_issuer` | **Critical** — entire issuer revoked | verification_level = 0, all dimensions suspect | Reject. Quarantine all interactions. |
| `nonce_mismatch` | **Critical** — potential replay attack | verification_level = 0 | Reject. Rate-limit source. |
| `suspended_issuer` | **Severe** — temporary administrative action | verification_level = 100 | Hold. Re-verify after suspension lifted. |
| `grace_period_expired` | **Moderate** — operational neglect | verification_level = 150, governance -= 200 | Reject but allow re-auth with new key. |
| `expired_attestation` | **Moderate** — stale credential | verification_level = 200 | Request fresh attestation. |
| `audience_mismatch` | **Low-Moderate** — wrong verifier | verification_level = 50 | Reject. Likely misconfiguration. |
| `unknown_issuer` | **Unknown** — no registry record | verification_level = 50, tenure = 0 | No trust basis. Require registration. |
| `unknown_key` | **Unknown** — key not in any issuer | verification_level = 50 | No trust basis. Require association. |

---

## 5. Integration Pattern

Complete example showing the Step 2 to Step 3 handoff.

```typescript
import { OATRClient } from "@oatr/sdk"; // OATR SDK v1.2.0+
import type { TrustScoreRequest } from "@mcp-t/types";

interface DimensionInput {
  dimension: string;
  value: number;
  confidence: number;
  evidence: Record<string, unknown>[];
  observed_since?: string;
  observation_window_seconds?: number;
}

/**
 * Bridge function: takes an OATR VerificationResult and produces
 * MCP-T dimension inputs ready for scoring.
 *
 * This is the Step 2 -> Step 3 boundary in code.
 */
function oatrToMcpTDimensions(
  result: OATRVerificationResult
): DimensionInput[] {
  const dimensions: DimensionInput[] = [];

  // Always map verification status
  dimensions.push(mapVerificationLevel(result));

  // Map tenure if issuer data available
  const tenure = mapTenure(result);
  if (tenure) dimensions.push(tenure);

  // Map governance if key data available
  const governance = mapGovernance(result);
  if (governance) dimensions.push(governance);

  return dimensions;
}

/**
 * Full integration example: verify an agent key via OATR,
 * then construct an MCP-T trust query.
 */
async function verifyAndScore(
  agentKey: string,
  attestation: string
): Promise<{ oatr: OATRVerificationResult; mcpTInput: DimensionInput[] }> {
  // Step 1 + 2: OATR verification
  const oatr = await OATRClient.verify(attestation, {
    expectedAudience: "my-service",
  });

  // Step 2 -> 3 boundary: map facts to dimension inputs
  const mcpTInput = oatrToMcpTDimensions(oatr);

  // Check for risk signals
  const graceRisk = assessGracePeriodRisk(oatr);
  if (graceRisk?.severity === "high") {
    // Reduce confidence on all dimensions
    mcpTInput.forEach(d => {
      d.confidence = Math.max(0.1, d.confidence - 0.3);
    });
  }

  return { oatr, mcpTInput };
}
```

---

## 6. Ownership Boundaries

| Concern | Owner | Rationale |
|---|---|---|
| Key validity, issuer status, cryptographic verification | **OATR** | Binary facts about registry state |
| Reason code semantics (what each code means) | **OATR** | OATR defines its own failure taxonomy |
| Reason code interpretation (what each code means for trust) | **MCP-T** | Different risk models, different interpretations |
| Grace period duration (90 days) | **OATR** | Registry policy |
| Grace period trust impact | **MCP-T** | Scoring decision |
| Key rotation as governance signal | **MCP-T** | Interpretation of OATR facts |
| Key rotation as behavioral consistency | **Neither** | Orthogonal concern (per DIF #38 consensus) |
| Verification result schema | **OATR** | Upstream provider defines output shape |
| Dimension mapping logic | **MCP-T** | Downstream consumer defines interpretation |
| Integration bridge code | **Joint** | Both sides must agree on the contract |

---

## 7. Open Questions

1. **Schema versioning.** How do we handle OATR adding new reason codes? MCP-T consumers need a fallback for unknown codes. Proposal: treat unknown codes as equivalent to `unknown_key` (no trust basis, but not adversarial).

2. **Batch verification.** Should the boundary support verifying multiple keys in a single call? Relevant for multi-agent workflows where a coordinator needs to score several agents simultaneously.

3. **Caching semantics.** OATR verification results are point-in-time. MCP-T scores have a `ValidityWindow` with `max_age_seconds`. Should the OATR result's freshness constrain the MCP-T score's validity window? Probably yes -- an MCP-T score should not outlive the OATR verification it was built on.

4. **Rotation context enrichment.** FransDevelopment noted that OATR should provide facts about rotation events, not interpret them. Should OATR expose a `rotation_history` array (timestamps + reason strings) to give MCP-T richer governance signals? Or is the current `public_keys` array with status timestamps sufficient?

5. **Trust dimension registry.** The dimension names used here (`verification_level`, `tenure`, `governance`) are not yet standardized in MCP-T. Should we maintain a registry of well-known dimension identifiers that map to OATR concepts?

6. **Negative trust propagation.** If an issuer is revoked, should MCP-T automatically reduce scores for all agents that were verified under that issuer? This is a scoring policy question, but it affects how much OATR state MCP-T consumers need to track.

---

## Appendix: MCP-T DimensionScore Fields

Per MCP-T spec v0.1.0 and PR #1:

```typescript
interface DimensionScore {
  /** Dimensional score. Range [0, 1000]. */
  value: number;

  /** Statistical confidence. Range [0.0, 1.0]. */
  confidence: number;

  /** Number of Trust Events contributing to this score. */
  evidence_count: number;

  /** Duration of the observation window in seconds. (PR #1) */
  observation_window_seconds?: number;

  /** ISO 8601 timestamp for the start of the observation period. (PR #1) */
  observed_since?: string;
}
```

The `observation_window_seconds` and `observed_since` fields are particularly relevant for OATR-derived dimensions. For the `tenure` dimension, `observed_since` maps directly to the issuer's `registered_at` timestamp, and `observation_window_seconds` represents the full tenure duration. This gives trust score consumers explicit temporal context without requiring them to re-derive it from the OATR data.
