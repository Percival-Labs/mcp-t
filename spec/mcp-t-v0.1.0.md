# Model Context Protocol -- Trust Extension (MCP-T)

**Version:** 0.1.0-draft
**Status:** Draft
**Date:** 2026-03-15
**Authors:** Alan Carroll (Percival Labs)
**License:** CC-BY-4.0
**Specification URI:** `https://github.com/Percival-Labs/mcp-t/blob/main/spec/mcp-t-v0.1.0.md`

---

## Abstract

The Model Context Protocol -- Trust Extension (MCP-T) defines a standard format and query protocol for trust scores associated with AI agents and tool servers operating within the Model Context Protocol (MCP) ecosystem. MCP-T is transport-agnostic, implementation-agnostic, and composable with MCP-I (Identity) to form a complete agent verification stack. It enables any platform to query, publish, and verify trust information for autonomous agents without prescribing the scoring algorithms or economic mechanisms that produce that information.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Terminology](#2-terminology)
3. [Architecture Overview](#3-architecture-overview)
4. [Trust Score Schema](#4-trust-score-schema)
5. [Trust Dimensions](#5-trust-dimensions)
6. [Trust Events](#6-trust-events)
7. [Protocol Messages](#7-protocol-messages)
8. [Trust Provider Interface](#8-trust-provider-interface)
9. [Transport Bindings](#9-transport-bindings)
10. [Conformance Levels](#10-conformance-levels)
11. [Security Considerations](#11-security-considerations)
12. [Privacy Considerations](#12-privacy-considerations)
13. [IANA Considerations](#13-iana-considerations)
14. [References](#14-references)
15. [Appendix A: JSON Schema Definitions](#appendix-a-json-schema-definitions)
16. [Appendix B: Example Flows](#appendix-b-example-flows)

---

## 1. Introduction

### 1.1 Motivation

The Model Context Protocol (MCP) provides a standard interface for AI agents to discover and invoke external tools. MCP-I (Identity), contributed to the Decentralized Identity Foundation (DIF), provides a standard for establishing _who_ an agent is via Decentralized Identifiers (DIDs) and Verifiable Credentials (VCs). Neither protocol addresses a fundamental question that every platform must answer before granting an agent access to resources: _should this agent be trusted to perform this action?_

Trust in agent ecosystems is currently determined through ad-hoc, platform-specific mechanisms: API key allowlists, manual review, reputation systems with no interoperability, or simply no trust evaluation at all. This fragmentation means:

- An agent's demonstrated trustworthiness on one platform carries no weight on another.
- Platforms must independently solve the trust evaluation problem.
- Agents cannot present portable proof of their operational history.
- No standard exists for communicating trust-relevant events (contract completion, service failure, security incidents) between platforms.

MCP-T addresses this gap by defining:

1. A **schema** for representing trust scores with dimensional granularity, confidence metadata, temporal validity, and domain scoping.
2. A **query protocol** for requesting and receiving trust information, aligned with MCP's existing JSON-RPC message format.
3. A **trust event format** for publishing trust-relevant observations that any scoring system can consume.
4. A **trust provider interface** for registering, discovering, and authorizing trust scoring services.
5. **Conformance levels** that allow incremental adoption from simple read-only queries to zero-knowledge trust proofs.

### 1.2 Design Principles

**Composable.** MCP-T is designed to work alongside MCP and MCP-I. An agent identified by an MCP-I DID can have one or more MCP-T trust scores. MCP-T does not require MCP-I but benefits from it.

**Implementation-Agnostic.** This specification defines the _format_ of trust data, not the _algorithm_ that produces it. A trust score computed from behavioral analysis, economic staking, community attestation, or any other methodology is valid provided it conforms to the schema.

**Portable.** Trust data can be published and retrieved via any transport: Nostr relay events, HTTPS endpoints, IPFS content-addressed storage, or any future transport. The specification defines transport bindings but does not mandate a single transport.

**Queryable.** The protocol supports three query patterns: full score retrieval (`trust/query`), binary threshold verification (`trust/verify`), and historical event retrieval (`trust/history`). All queries use JSON-RPC 2.0, consistent with MCP.

**Extensible.** The default trust dimensions (Section 5) represent a recommended baseline. Implementations MAY define additional dimensions. Custom dimensions MUST use a namespaced identifier to prevent collisions.

**Privacy-Aware.** The specification supports zero-knowledge trust proofs that allow an agent to demonstrate its trust score exceeds a threshold without revealing the exact score, the underlying data, or the identity of its trust provider.

### 1.3 Relationship to Other Specifications

| Specification | Role | Relationship to MCP-T |
|---|---|---|
| MCP | Tool integration protocol | MCP-T extends MCP's capability model with trust metadata |
| MCP-I | Agent identity (DIDs + VCs) | MCP-T references MCP-I identifiers as trust subjects |
| JSON-RPC 2.0 | Message format | MCP-T messages conform to JSON-RPC 2.0 |
| NIP-32/33/40 | Nostr labeling, replaceable events, expiration | MCP-T defines a Nostr transport binding using these NIPs |
| W3C DID | Decentralized identifiers | MCP-T uses DIDs as agent identifiers when MCP-I is present |
| W3C VC | Verifiable credentials | Trust scores MAY be wrapped as VCs for W3C-aligned ecosystems |

### 1.4 Notational Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119] when, and only when, they appear in all capitals, as shown here. This is clarified in [RFC 8174].

---

## 2. Terminology

**Agent.** An autonomous software entity that performs actions on behalf of a principal (human or organization). In MCP, agents connect to tool servers to execute capabilities.

**Trust Subject.** The entity whose trust is being evaluated. A Trust Subject is identified by a Subject Identifier (Section 4.1). Trust Subjects include agents, tool servers, and human operators.

**Subject Identifier.** A string that uniquely identifies a Trust Subject. Supported formats include DIDs (`did:key:z6Mk...`), Nostr public keys (`npub1...`), and URIs. When MCP-I is available, the DID SHOULD be used.

**Trust Score.** A structured representation of an entity's trustworthiness, comprising one or more dimensional scores, a composite score, confidence metadata, and temporal validity bounds.

**Trust Dimension.** A specific axis of trust evaluation. The default dimensions are defined in Section 5. Custom dimensions MAY be defined by implementations.

**Trust Event.** A signed, timestamped record of an observation relevant to trust evaluation. Trust Events are the raw inputs from which Trust Providers compute Trust Scores.

**Trust Provider.** A service that computes and publishes Trust Scores for Trust Subjects. A single Trust Subject MAY have scores from multiple Trust Providers.

**Trust Consumer.** A service or agent that queries Trust Scores to make authorization decisions. Any MCP client or server MAY act as a Trust Consumer.

**Confidence Level.** A numeric indicator (0.0 to 1.0) expressing the statistical reliability of a Trust Score, based on the quantity and quality of underlying Trust Events.

**Domain Scope.** A classification of the operational domain for which a Trust Score is valid. An agent trusted for `code-review` is not necessarily trusted for `financial-transactions`.

**Trust Proof.** A cryptographic proof that a Trust Score satisfies a given predicate (e.g., "composite score >= 700") without revealing the exact score or underlying data.

**Freshness.** The elapsed time since a Trust Score was last computed. Consumers SHOULD define maximum acceptable freshness for their use case.

---

## 3. Architecture Overview

MCP-T introduces a trust layer between Trust Providers (who compute scores) and Trust Consumers (who use scores for authorization decisions). The architecture is intentionally decoupled: Providers and Consumers communicate through a standard schema and protocol, with trust data flowing through one or more transports.

```
                    ┌─────────────────────────────────────────────┐
                    │              TRUST CONSUMERS                 │
                    │                                             │
                    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
                    │  │MCP Client│  │MCP Server│  │ Platform │  │
                    │  │(Agent)   │  │(Tool)    │  │(Registry)│  │
                    │  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
                    │       │             │             │         │
                    └───────┼─────────────┼─────────────┼─────────┘
                            │             │             │
                    ┌───────▼─────────────▼─────────────▼─────────┐
                    │           MCP-T QUERY PROTOCOL               │
                    │       (JSON-RPC 2.0 messages)                │
                    │                                              │
                    │   trust/query  trust/verify  trust/history   │
                    └───────┬─────────────┬─────────────┬─────────┘
                            │             │             │
                    ┌───────▼─────────────▼─────────────▼─────────┐
                    │         TRANSPORT LAYER                      │
                    │                                              │
                    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
                    │  │  Nostr   │  │  HTTPS   │  │   IPFS   │  │
                    │  │ (NIP-32) │  │  (REST)  │  │  (CID)   │  │
                    │  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
                    └───────┼─────────────┼─────────────┼─────────┘
                            │             │             │
                    ┌───────▼─────────────▼─────────────▼─────────┐
                    │            TRUST PROVIDERS                   │
                    │                                              │
                    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
                    │  │Provider A│  │Provider B│  │Provider C│  │
                    │  │(economic)│  │(attesta.)│  │(behavior)│  │
                    │  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
                    └───────┼─────────────┼─────────────┼─────────┘
                            │             │             │
                    ┌───────▼─────────────▼─────────────▼─────────┐
                    │            TRUST EVENTS                      │
                    │   (signed observations from the ecosystem)   │
                    └─────────────────────────────────────────────┘
```

### 3.1 Data Flow

1. **Trust Events** are generated by ecosystem participants (agents, platforms, users) and published to one or more transports.
2. **Trust Providers** consume Trust Events, apply their scoring methodology, and publish Trust Scores.
3. **Trust Consumers** query Trust Providers via the MCP-T protocol to retrieve scores or verify thresholds.
4. Trust Consumers make authorization decisions based on the retrieved Trust Scores and their local policy.

### 3.2 Separation of Concerns

MCP-T explicitly separates:

- **Data format** (this specification) from **scoring algorithm** (implementation-specific).
- **Query protocol** (this specification) from **transport mechanism** (transport bindings).
- **Trust dimensions** (extensible default set) from **dimension weights** (consumer-specific policy).
- **Score publication** (provider responsibility) from **score interpretation** (consumer responsibility).

---

## 4. Trust Score Schema

### 4.1 TrustScore Object

A Trust Score is the primary data structure in MCP-T. It represents the trust evaluation of a single Trust Subject by a single Trust Provider at a specific point in time.

```json
{
  "schema_version": "0.1.0",
  "subject_id": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
  "provider_id": "did:web:trustprovider.example.com",
  "score": {
    "composite": 742,
    "dimensions": {
      "verification": {
        "value": 850,
        "confidence": 0.95,
        "evidence_count": 47
      },
      "tenure": {
        "value": 620,
        "confidence": 0.88,
        "evidence_count": 1
      },
      "performance": {
        "value": 780,
        "confidence": 0.72,
        "evidence_count": 156
      },
      "commitment": {
        "value": 690,
        "confidence": 0.91,
        "evidence_count": 12
      },
      "community": {
        "value": 710,
        "confidence": 0.65,
        "evidence_count": 34
      },
      "consistency": {
        "value": 800,
        "confidence": 0.83,
        "evidence_count": 892,
        "observation_window_seconds": 2592000
      }
    }
  },
  "domain": "code-execution",
  "validity": {
    "issued_at": "2026-03-15T10:30:00Z",
    "expires_at": "2026-03-15T11:30:00Z",
    "max_age_seconds": 3600
  },
  "metadata": {
    "algorithm_version": "provider-specific-v2.1",
    "total_events_processed": 1142,
    "first_event_at": "2025-09-01T00:00:00Z"
  },
  "signature": {
    "algorithm": "Ed25519",
    "public_key": "z6MkrHKy02OJz2FpaMohCstPqHSyBfShVJBaByLktb5GJbKH",
    "value": "3TnKbP8RqG4VWxhFzKm..."
  }
}
```

### 4.2 Field Definitions

#### 4.2.1 Top-Level Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `schema_version` | string | REQUIRED | The MCP-T schema version. MUST be a semantic version string. |
| `subject_id` | string | REQUIRED | The Subject Identifier of the entity being evaluated. See Section 4.3 for supported formats. |
| `provider_id` | string | REQUIRED | The identifier of the Trust Provider that computed this score. |
| `score` | TrustScoreValue | REQUIRED | The trust score data. See Section 4.2.2. |
| `domain` | string | OPTIONAL | The domain scope for which this score is valid. See Section 4.4. If omitted, the score is domain-general. |
| `validity` | ValidityWindow | REQUIRED | Temporal validity bounds. See Section 4.2.3. |
| `metadata` | object | OPTIONAL | Provider-specific metadata. Consumers SHOULD NOT rely on metadata fields for authorization decisions. |
| `signature` | Signature | REQUIRED | Cryptographic signature over the canonical JSON representation of all other fields. See Section 4.2.4. |

#### 4.2.2 TrustScoreValue

| Field | Type | Required | Description |
|---|---|---|---|
| `composite` | integer | REQUIRED | Composite trust score. MUST be in the range [0, 1000]. |
| `dimensions` | map<string, DimensionScore> | REQUIRED | Map of dimension identifiers to their scores. MUST include at least two dimensions (see Section 5). |

#### 4.2.3 DimensionScore

| Field | Type | Required | Description |
|---|---|---|---|
| `value` | integer | REQUIRED | Dimensional score. MUST be in the range [0, 1000]. |
| `confidence` | number | REQUIRED | Confidence level. MUST be in the range [0.0, 1.0]. Represents the statistical reliability of this dimensional score based on evidence quantity and quality. |
| `evidence_count` | integer | REQUIRED | The number of Trust Events that contributed to this dimensional score. MUST be >= 0. |
| `observation_window_seconds` | integer | OPTIONAL | The duration in seconds of the observation window over which the contributing Trust Events were collected. For example, `86400` indicates the score reflects the most recent 24 hours of evidence. When omitted, the window is unbounded or unknown. Consumers SHOULD use this field to apply recency requirements (e.g., reject scores computed over windows shorter than a minimum threshold). |

#### 4.2.4 ValidityWindow

| Field | Type | Required | Description |
|---|---|---|---|
| `issued_at` | string (ISO 8601) | REQUIRED | Timestamp when this score was computed. |
| `expires_at` | string (ISO 8601) | REQUIRED | Timestamp after which this score SHOULD NOT be used without re-query. |
| `max_age_seconds` | integer | REQUIRED | Maximum number of seconds this score should be cached. Consumers MUST re-query after this duration. |

#### 4.2.5 Signature

| Field | Type | Required | Description |
|---|---|---|---|
| `algorithm` | string | REQUIRED | The signature algorithm. MUST be one of: `Ed25519`, `ES256`, `ES384`. |
| `public_key` | string | REQUIRED | The public key of the signer, encoded per the algorithm's conventions. For Ed25519, this is a multibase-encoded key. |
| `value` | string | REQUIRED | The signature value, base64url-encoded. |

The signature MUST be computed over the canonical JSON serialization (RFC 8785: JCS) of the Trust Score object with the `signature` field removed.

### 4.3 Subject Identifier Formats

MCP-T supports the following Subject Identifier formats. Implementations MUST support at least one.

| Format | Pattern | Example | Notes |
|---|---|---|---|
| DID | `did:*` | `did:key:z6Mk...` | Preferred when MCP-I is available |
| Nostr npub | `npub1*` | `npub1abc123...` | For Nostr-native ecosystems |
| HTTPS URI | `https://*` | `https://agent.example.com` | For web-accessible agents |
| MCP Server ID | `mcp:server:*` | `mcp:server:@org/tool-name` | For MCP namespace-registered servers |

When a Trust Subject has identifiers in multiple formats, the Trust Provider SHOULD publish a score under each known identifier, or publish an equivalence assertion linking the identifiers.

### 4.4 Domain Scopes

Domain scopes limit the applicability of a Trust Score. An agent trusted for one domain is not necessarily trusted for another.

The following domain identifiers are RECOMMENDED. Implementations MAY define additional domains using a reverse-DNS namespace (e.g., `com.example.custom-domain`).

| Domain | Identifier | Description |
|---|---|---|
| General | `general` | No domain restriction. Default if omitted. |
| Code execution | `code-execution` | Writing, reviewing, or executing code. |
| Financial transactions | `financial` | Handling payments, transfers, or financial data. |
| Data access | `data-access` | Reading or writing persistent data stores. |
| Communication | `communication` | Sending messages, emails, or notifications on behalf of a principal. |
| System administration | `system-admin` | Modifying system configuration, credentials, or infrastructure. |
| Content generation | `content-generation` | Producing text, images, or media for publication. |
| Research | `research` | Gathering, analyzing, or synthesizing information. |

A Trust Consumer MAY request a domain-scoped score. If the Trust Provider does not have sufficient data for the requested domain, it SHOULD return a domain-general score with a `domain_match: false` indicator (see Section 7.1.2).

---

## 5. Trust Dimensions

Trust Dimensions are the component axes that contribute to a composite Trust Score. MCP-T defines nine default dimensions representing a broad range of trust signals across economic, behavioral, security, and governance domains. Implementations MUST compute at least two default dimensions. Implementations MAY define additional custom dimensions (Section 5.3) for domain-specific needs.

### 5.1 Default Dimensions

#### 5.1.1 Verification (`verification`)

Measures the degree to which the Trust Subject's identity and credentials have been verified.

Inputs MAY include: identity proofs (MCP-I Verifiable Credentials), domain ownership verification, code signing certificates, organizational attestations, KYC/KYB completion status.

A score of 0 indicates no identity verification. A score of 1000 indicates comprehensive multi-factor identity verification with independent attestation.

#### 5.1.2 Tenure (`tenure`)

Measures the length and continuity of the Trust Subject's operational history.

Inputs MAY include: first observed timestamp, total active duration, gaps in activity, account age on relevant platforms.

A score of 0 indicates a newly created identity. A score of 1000 indicates an established identity with years of continuous operational history.

#### 5.1.3 Performance (`performance`)

Measures the Trust Subject's track record of successful task completion and service quality.

Inputs MAY include: contract completion rates, response time percentiles, error rates, SLA adherence, user satisfaction signals.

A score of 0 indicates no performance history or consistent failure. A score of 1000 indicates a flawless operational record across a large sample of interactions.

#### 5.1.4 Commitment (`commitment`)

Measures the economic, reputational, or organizational value committed by the Trust Subject or on its behalf. This dimension is intentionally broad: commitment MAY take the form of economic stake (e.g., locked funds, collateral), organizational endorsement (e.g., an enterprise backing an agent with its reputation), insurance bonds, or any other mechanism that creates tangible consequences for failure.

Inputs MAY include: economic stake amount, collateral deposits, insurance bonds, organizational endorsements with liability, escrow balances, security deposits.

A score of 0 indicates no commitment of any form. A score of 1000 indicates substantial commitment proportional to the agent's operational scope, with verifiable consequences for failure.

#### 5.1.5 Community (`community`)

Measures the breadth and quality of endorsements from other trusted entities.

Inputs MAY include: number of endorsing entities, trust scores of endorsing entities, diversity of endorsement sources, recency of endorsements.

A score of 0 indicates no community endorsement. A score of 1000 indicates widespread endorsement from diverse, high-trust entities.

#### 5.1.6 Consistency (`consistency`)

Measures the stability and predictability of the Trust Subject's behavior over time.

Inputs MAY include: behavioral variance metrics, anomaly frequency, definition stability (for tool servers), output predictability, uptime.

A score of 0 indicates highly erratic or unpredictable behavior. A score of 1000 indicates stable, predictable behavior over a large observation window.

#### 5.1.7 Transparency (`transparency`)

Measures the degree to which the Trust Subject's operations, decision-making, and methodology are open to inspection.

Inputs MAY include: published source code or methodology, open audit trails, explainable decision outputs, public logging of actions, availability of operational documentation.

A score of 0 indicates fully opaque operations with no visibility. A score of 1000 indicates comprehensive operational transparency with independently auditable records.

#### 5.1.8 Compliance (`compliance`)

Measures the Trust Subject's adherence to applicable regulatory frameworks, industry standards, and organizational policies.

Inputs MAY include: regulatory certifications (SOC2, ISO 27001), AI governance framework adherence (EU AI Act, NIST AI RMF), policy conformance attestations, audit completion records, data protection compliance status.

A score of 0 indicates no compliance assessment or known violations. A score of 1000 indicates comprehensive compliance across all applicable frameworks with current certification.

#### 5.1.9 Security (`security`)

Measures the Trust Subject's security posture, including vulnerability history, incident response capability, and defensive practices.

Inputs MAY include: known vulnerability count and severity, mean time to remediation, security audit results, code signing practices, dependency hygiene, incident response track record, penetration test results.

A score of 0 indicates unassessed security posture or critical unresolved vulnerabilities. A score of 1000 indicates a mature security program with no known vulnerabilities and demonstrated incident response capability.

### 5.2 Dimension Selection Guidance

The nine default dimensions are designed to serve diverse trust evaluation approaches. No single implementation is expected to score all nine. The following table suggests which dimensions are most relevant for common use cases:

| Use Case | Recommended Dimensions |
|----------|----------------------|
| Agent marketplace / skill registry | verification, performance, security, community |
| Financial transactions | verification, commitment, compliance, consistency |
| Enterprise deployment | verification, compliance, security, transparency |
| Open-source / decentralized ecosystem | performance, community, transparency, consistency |
| Behavioral analysis system | performance, consistency, security, tenure |

Implementations SHOULD document which dimensions they score and why, enabling consumers to make informed decisions about dimensional coverage.

### 5.3 Custom Dimensions

Beyond the nine default dimensions, implementations MAY define custom dimensions for domain-specific trust signals using a namespaced identifier:

```json
{
  "com.example.regulatory-compliance": {
    "value": 900,
    "confidence": 0.80,
    "evidence_count": 5
  },
  "io.openclaw.skill-safety": {
    "value": 750,
    "confidence": 0.60,
    "evidence_count": 12
  }
}
```

Custom dimension identifiers MUST use reverse-DNS notation to prevent collisions. Consumers that do not recognize a custom dimension MUST ignore it when computing local trust decisions. Custom dimensions MUST NOT be included in the composite score computation unless the consumer explicitly opts in.

Custom dimensions are intended for emerging trust signals that the default set does not cover. If a custom dimension gains broad adoption, it MAY be proposed for inclusion as a default dimension in a future version of this specification.

### 5.4 Composite Score Computation

The composite score is computed by the Trust Provider. This specification does not mandate a specific aggregation formula. Providers MUST document their composite computation method. Common approaches include:

- Weighted arithmetic mean
- Weighted geometric mean (penalizes low outliers)
- Minimum-of-dimensions (most conservative)

Consumers MAY override the provider's composite with their own local computation by applying custom weights to the dimensional scores.

---

## 6. Trust Events

Trust Events are the raw observations that Trust Providers consume to compute Trust Scores. MCP-T defines a standard event format to enable interoperability between event publishers and Trust Providers.

### 6.1 TrustEvent Object

```json
{
  "event_id": "evt_01HXYZ789ABC",
  "event_type": "contract.completed",
  "subject_id": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
  "issuer_id": "did:web:platform.example.com",
  "timestamp": "2026-03-15T09:45:00Z",
  "payload": {
    "contract_id": "ctr_98765",
    "outcome": "success",
    "duration_seconds": 342,
    "deliverable_hash": "sha256:a1b2c3d4..."
  },
  "dimensions_affected": ["performance", "consistency"],
  "signature": {
    "algorithm": "Ed25519",
    "public_key": "z6MkrHKy02OJz2FpaMohCstPqHSyBfShVJBaByLktb5GJbKH",
    "value": "7YnKbP8RqG4VWxhFzKm..."
  },
  "co_signatures": [
    {
      "signer_id": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
      "algorithm": "Ed25519",
      "public_key": "z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
      "value": "9PqKbP8RqG4VWxhFzKm..."
    }
  ]
}
```

### 6.2 Event Field Definitions

| Field | Type | Required | Description |
|---|---|---|---|
| `event_id` | string | REQUIRED | Globally unique event identifier. Implementations SHOULD use ULID or UUIDv7 for temporal ordering. |
| `event_type` | string | REQUIRED | Dot-namespaced event type. See Section 6.3 for standard types. |
| `subject_id` | string | REQUIRED | The Trust Subject this event pertains to. |
| `issuer_id` | string | REQUIRED | The entity publishing this event. |
| `timestamp` | string (ISO 8601) | REQUIRED | When the observed event occurred. |
| `payload` | object | REQUIRED | Event-type-specific data. Schema varies by `event_type`. |
| `dimensions_affected` | array of strings | RECOMMENDED | Which trust dimensions this event is relevant to. Assists Trust Providers in routing events to the correct scoring pipeline. |
| `signature` | Signature | REQUIRED | Signature of the issuer over the event data (all fields except `signature` and `co_signatures`). |
| `co_signatures` | array of CoSignature | OPTIONAL | Additional signatures from other parties who attest to the event's validity. The subject MAY co-sign to indicate agreement. |

### 6.3 Standard Event Types

MCP-T defines the following standard event types. Implementations MAY define additional types using reverse-DNS namespacing.

#### 6.3.1 Contract Events

| Event Type | Description | Required Payload Fields |
|---|---|---|
| `contract.completed` | A contract or task was successfully completed. | `contract_id`, `outcome` ("success") |
| `contract.failed` | A contract or task failed to meet requirements. | `contract_id`, `outcome` ("failure"), `reason` |
| `contract.disputed` | A contract outcome is under dispute. | `contract_id`, `dispute_reason` |
| `contract.abandoned` | A contract was abandoned by the subject. | `contract_id`, `abandonment_reason` |

#### 6.3.2 Security Events

| Event Type | Description | Required Payload Fields |
|---|---|---|
| `security.incident` | A security incident involving the subject. | `severity` ("low" | "medium" | "high" | "critical"), `description` |
| `security.vulnerability_reported` | A vulnerability was reported against the subject. | `cve_id` (optional), `severity`, `reported_by` |
| `security.vulnerability_resolved` | A reported vulnerability was resolved. | `cve_id` (optional), `resolution_time_seconds` |
| `security.audit_completed` | A security audit was completed. | `auditor_id`, `findings_count`, `critical_findings` |

#### 6.3.3 Behavioral Events

| Event Type | Description | Required Payload Fields |
|---|---|---|
| `behavior.anomaly` | An anomalous behavior was observed. | `anomaly_type`, `evidence` |
| `behavior.definition_change` | A tool definition was modified (MCP tool servers). | `tool_name`, `diff` (before/after) |
| `behavior.uptime_report` | Periodic uptime observation. | `period_seconds`, `availability_ratio` |

#### 6.3.4 Endorsement Events

| Event Type | Description | Required Payload Fields |
|---|---|---|
| `endorsement.vouch` | An entity endorses the subject. | `endorser_trust_score` (optional), `domain` (optional) |
| `endorsement.revoke` | A previously issued endorsement is revoked. | `original_event_id` |

#### 6.3.5 Economic Events

| Event Type | Description | Required Payload Fields |
|---|---|---|
| `economic.stake_deposited` | Economic stake was committed. | `amount`, `currency`, `lock_duration_seconds` (optional) |
| `economic.stake_withdrawn` | Economic stake was withdrawn. | `amount`, `currency` |
| `economic.slash_executed` | Economic stake was slashed. | `amount`, `currency`, `reason`, `adjudication_id` |

### 6.4 Event Signing

All Trust Events MUST be signed by the issuer. The signature MUST be computed over the canonical JSON serialization (RFC 8785: JCS) of the event with the `signature` and `co_signatures` fields removed.

Co-signatures are OPTIONAL and provide additional attestation. Common use cases:

- The Trust Subject co-signs to acknowledge the event (e.g., acknowledging a completed contract).
- A third-party verifier co-signs to independently attest to the event (e.g., an auditor confirming audit findings).
- A platform co-signs to attest that the event occurred within its infrastructure.

### 6.5 Event Ordering

Trust Events carry a `timestamp` and an `event_id`. When `event_id` uses a temporally ordered format (ULID, UUIDv7), receivers MAY use the event ID for ordering. When timestamps conflict, receivers SHOULD prefer the issuer's signed timestamp.

Events are idempotent. Receiving the same `event_id` multiple times MUST be treated as a single event.

---

## 7. Protocol Messages

MCP-T defines three protocol messages for trust data exchange. All messages conform to JSON-RPC 2.0, consistent with the Model Context Protocol.

### 7.1 trust/query

Retrieves the full Trust Score for a Trust Subject.

#### 7.1.1 Request

```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "method": "trust/query",
  "params": {
    "subject_id": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
    "domain": "code-execution",
    "provider_id": "did:web:trustprovider.example.com",
    "max_age_seconds": 3600,
    "dimensions": ["performance", "consistency", "verification"]
  }
}
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `subject_id` | string | REQUIRED | The Subject Identifier to query. |
| `domain` | string | OPTIONAL | Request a domain-scoped score. If omitted, returns domain-general score. |
| `provider_id` | string | OPTIONAL | Request score from a specific provider. If omitted, the endpoint returns its own score or aggregates from known providers. |
| `max_age_seconds` | integer | OPTIONAL | Maximum acceptable age of the score in seconds. The provider SHOULD recompute if its cached score is older. Default: provider-defined. |
| `dimensions` | array of strings | OPTIONAL | Request only specific dimensions. If omitted, all available dimensions are returned. |

#### 7.1.2 Response

```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "result": {
    "trust_score": {
      "schema_version": "0.1.0",
      "subject_id": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
      "provider_id": "did:web:trustprovider.example.com",
      "score": {
        "composite": 742,
        "dimensions": {
          "verification": { "value": 850, "confidence": 0.95, "evidence_count": 47 },
          "performance": { "value": 780, "confidence": 0.72, "evidence_count": 156 },
          "consistency": { "value": 800, "confidence": 0.83, "evidence_count": 892 }
        }
      },
      "domain": "code-execution",
      "domain_match": true,
      "validity": {
        "issued_at": "2026-03-15T10:30:00Z",
        "expires_at": "2026-03-15T11:30:00Z",
        "max_age_seconds": 3600
      },
      "signature": {
        "algorithm": "Ed25519",
        "public_key": "z6MkrHKy02OJz2FpaMohCstPqHSyBfShVJBaByLktb5GJbKH",
        "value": "3TnKbP8RqG4VWxhFzKm..."
      }
    }
  }
}
```

The `domain_match` field (boolean) indicates whether the provider had sufficient domain-specific data. If `false`, the returned score is a domain-general fallback.

#### 7.1.3 Errors

| Code | Message | Description |
|---|---|---|
| -32001 | `SubjectNotFound` | No trust data exists for the requested subject. |
| -32002 | `ProviderUnavailable` | The requested Trust Provider is not reachable. |
| -32003 | `DomainNotSupported` | The requested domain is not recognized by this provider. |
| -32004 | `StaleScore` | The provider cannot satisfy the requested `max_age_seconds`. Returns the stale score with this error code so the consumer can decide. |

### 7.2 trust/verify

A binary threshold check. Returns whether the Trust Subject meets a specified trust threshold for a given action. This is the most common query pattern for authorization decisions.

#### 7.2.1 Request

```json
{
  "jsonrpc": "2.0",
  "id": "req-002",
  "method": "trust/verify",
  "params": {
    "subject_id": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
    "domain": "financial",
    "threshold": {
      "composite_min": 700,
      "dimension_mins": {
        "verification": 800,
        "commitment": 600
      }
    },
    "nonce": "a1b2c3d4e5f6",
    "provider_id": "did:web:trustprovider.example.com"
  }
}
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `subject_id` | string | REQUIRED | The Subject Identifier to verify. |
| `domain` | string | OPTIONAL | Domain scope for the verification. |
| `threshold` | ThresholdSpec | REQUIRED | The trust requirements to check against. See Section 7.2.3. |
| `nonce` | string | RECOMMENDED | A unique value generated by the consumer to prevent replay attacks. The provider MUST echo this value in the response. Consumers SHOULD reject responses with missing or mismatched nonces. |
| `provider_id` | string | OPTIONAL | Specific provider to check. If omitted, any available provider is used. |

#### 7.2.2 Response

```json
{
  "jsonrpc": "2.0",
  "id": "req-002",
  "result": {
    "verified": true,
    "subject_id": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
    "provider_id": "did:web:trustprovider.example.com",
    "nonce": "a1b2c3d4e5f6",
    "threshold_results": {
      "composite_min": { "required": 700, "met": true },
      "dimension_mins": {
        "verification": { "required": 800, "met": true },
        "commitment": { "required": 600, "met": true }
      }
    },
    "confidence": 0.85,
    "checked_at": "2026-03-15T10:31:00Z",
    "valid_until": "2026-03-15T11:31:00Z",
    "signature": {
      "algorithm": "Ed25519",
      "public_key": "z6MkrHKy02OJz2FpaMohCstPqHSyBfShVJBaByLktb5GJbKH",
      "value": "8RnKbP8RqG4VWxhFzKm..."
    }
  }
}
```

The response MUST include `verified` (boolean) and SHOULD include individual threshold results. The response MUST NOT include the actual score values — only whether each threshold was met. This supports privacy-preserving authorization where the consumer learns the binary outcome without learning the exact score.

The `nonce` field, if present in the request, MUST be echoed in the response and included in the signed payload. This prevents replay of verify responses across consumers. Consumers SHOULD reject responses where the nonce does not match their request.

The `valid_until` field indicates when this verification result expires. Consumers MUST NOT cache a verify result beyond this timestamp. If omitted, the result is valid only for the immediate request.

The `confidence` field represents the minimum confidence across all dimensions evaluated in the threshold check. If only `composite_min` was checked, it is the composite confidence. If `dimension_mins` were checked, it is the lowest confidence among the checked dimensions. This enables consumers to distinguish between a high-score/high-confidence pass and a high-score/low-confidence pass.

#### 7.2.3 ThresholdSpec

| Field | Type | Required | Description |
|---|---|---|---|
| `composite_min` | integer | OPTIONAL | Minimum required composite score. |
| `dimension_mins` | map<string, integer> | OPTIONAL | Minimum required score per dimension. |
| `confidence_min` | number | OPTIONAL | Minimum required confidence level. If any dimension evaluated in this threshold check has confidence below this value, `verified` is `false`. |
| `min_evidence_count` | integer | OPTIONAL | Minimum total evidence count across all evaluated dimensions. If the Trust Score is based on fewer events than this threshold, `verified` is `false`. |

At least one of `composite_min` or `dimension_mins` MUST be specified.

### 7.3 trust/history

Retrieves Trust Events for a Trust Subject, enabling consumers to audit the data underlying a Trust Score.

#### 7.3.1 Request

```json
{
  "jsonrpc": "2.0",
  "id": "req-003",
  "method": "trust/history",
  "params": {
    "subject_id": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
    "event_types": ["contract.completed", "contract.failed", "security.incident"],
    "after": "2026-01-01T00:00:00Z",
    "before": "2026-03-15T23:59:59Z",
    "limit": 50,
    "cursor": null
  }
}
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `subject_id` | string | REQUIRED | The Trust Subject whose history is requested. |
| `event_types` | array of strings | OPTIONAL | Filter by event type. If omitted, all event types are returned. |
| `after` | string (ISO 8601) | OPTIONAL | Return events after this timestamp. |
| `before` | string (ISO 8601) | OPTIONAL | Return events before this timestamp. |
| `limit` | integer | OPTIONAL | Maximum number of events to return. Default: 50. Maximum: 1000. |
| `cursor` | string | OPTIONAL | Pagination cursor from a previous response. |

#### 7.3.2 Response

```json
{
  "jsonrpc": "2.0",
  "id": "req-003",
  "result": {
    "events": [
      {
        "event_id": "evt_01HXYZ789ABC",
        "event_type": "contract.completed",
        "subject_id": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
        "issuer_id": "did:web:platform.example.com",
        "timestamp": "2026-03-15T09:45:00Z",
        "payload": {
          "contract_id": "ctr_98765",
          "outcome": "success",
          "duration_seconds": 342
        },
        "dimensions_affected": ["performance", "consistency"],
        "signature": {
          "algorithm": "Ed25519",
          "public_key": "z6MkrHKy02OJz2FpaMohCstPqHSyBfShVJBaByLktb5GJbKH",
          "value": "7YnKbP8RqG4VWxhFzKm..."
        }
      }
    ],
    "cursor": "eyJsYXN0X2lkIjoiZXZ0XzAxSFhZWjc4OUFCQyJ9",
    "has_more": true,
    "total_count": 1142
  }
}
```

| Field | Type | Description |
|---|---|---|
| `events` | array of TrustEvent | The requested events, ordered by timestamp descending. |
| `cursor` | string or null | Pagination cursor. Null if no more results. |
| `has_more` | boolean | Whether additional events exist beyond this page. |
| `total_count` | integer | Total number of events matching the query (approximate, for display purposes). |

### 7.4 trust/providers (Discovery)

Lists Trust Providers known to the responding endpoint.

#### 7.4.1 Request

```json
{
  "jsonrpc": "2.0",
  "id": "req-004",
  "method": "trust/providers",
  "params": {}
}
```

#### 7.4.2 Response

```json
{
  "jsonrpc": "2.0",
  "id": "req-004",
  "result": {
    "providers": [
      {
        "provider_id": "did:web:trustprovider.example.com",
        "name": "Example Trust Service",
        "description": "Behavioral and economic trust scoring for MCP agents.",
        "endpoint": "https://api.trustprovider.example.com/mcp-t/v1",
        "transport_bindings": ["https", "nostr"],
        "conformance_level": 2,
        "supported_domains": ["general", "code-execution", "financial"],
        "dimensions": ["verification", "tenure", "performance", "commitment", "community", "consistency"],
        "scoring_methodology_uri": "https://trustprovider.example.com/docs/scoring",
        "public_key": "z6MkrHKy02OJz2FpaMohCstPqHSyBfShVJBaByLktb5GJbKH"
      }
    ]
  }
}
```

### 7.5 trust/publish

Submits a Trust Event to a Trust Provider or relay endpoint. This is how platforms and agents report trust-relevant observations.

#### 7.5.1 Request

```json
{
  "jsonrpc": "2.0",
  "id": "req-005",
  "method": "trust/publish",
  "params": {
    "event": {
      "event_id": "evt_01HXYZ789DEF",
      "event_type": "contract.completed",
      "subject_id": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
      "issuer_id": "did:web:platform.example.com",
      "timestamp": "2026-03-15T12:00:00Z",
      "payload": {
        "contract_id": "ctr_11111",
        "outcome": "success",
        "duration_seconds": 120
      },
      "dimensions_affected": ["performance"],
      "signature": {
        "algorithm": "Ed25519",
        "public_key": "z6MkrHKy02OJz2FpaMohCstPqHSyBfShVJBaByLktb5GJbKH",
        "value": "ABcKbP8RqG4VWxhFzKm..."
      }
    }
  }
}
```

#### 7.5.2 Response

```json
{
  "jsonrpc": "2.0",
  "id": "req-005",
  "result": {
    "accepted": true,
    "event_id": "evt_01HXYZ789DEF",
    "processing_status": "queued"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `accepted` | boolean | Whether the event passed validation and was accepted. |
| `event_id` | string | Echo of the submitted event ID. |
| `processing_status` | string | One of: `processed`, `queued`, `rejected`. |

#### 7.5.3 Errors

| Code | Message | Description |
|---|---|---|
| -32010 | `InvalidSignature` | The event signature failed verification. |
| -32011 | `UnknownEventType` | The event type is not recognized. |
| -32012 | `DuplicateEvent` | An event with this ID was already received. |
| -32013 | `IssuerNotAuthorized` | The issuer is not authorized to publish events of this type. |

### 7.6 Common Error Codes

The following error codes apply across all MCP-T methods:

| Code | Message | Description |
|---|---|---|
| -32020 | `RateLimited` | The consumer has exceeded the provider's rate limits. Providers returning this error SHOULD include a `retry_after_seconds` field in the error data object. |
| -32021 | `UnsupportedVersion` | The `schema_version` in the request is not supported by this provider. The error data SHOULD include `supported_versions` (array of strings). |
| -32022 | `KeyBindingFailed` | The provider could not verify that the signing key belongs to the claimed `provider_id` or `issuer_id`. See Section 7.7. |

### 7.7 Key-to-Identity Binding

Trust Scores and Trust Events carry signatures with an embedded `public_key`. Consumers MUST verify that the public key is authoritative for the claimed `provider_id` or `issuer_id` before accepting the signed data. Without this step, any entity can generate a keypair, sign arbitrary scores, and claim any identity.

Key binding MUST be verified through at least one of the following mechanisms:

1. **DID Document resolution.** If the `provider_id` is a DID, resolve the DID Document and verify that the signing key appears in the `verificationMethod` or `assertionMethod` arrays.
2. **Well-known endpoint.** Fetch `{provider_domain}/.well-known/mcp-t-provider.json` and verify that the `public_key` field matches the signing key.
3. **MCP capability announcement.** If the Trust Provider was discovered via MCP `initialize`, the public key from the capability announcement is authoritative.

Consumers SHOULD cache resolved key bindings with a TTL appropriate to their security requirements (RECOMMENDED: 1 hour). Consumers MUST re-resolve key bindings when signature verification fails.

---

## 8. Trust Provider Interface

### 8.1 Provider Registration

A Trust Provider registers itself with an MCP-T-aware endpoint by publishing a Provider Descriptor.

```json
{
  "provider_id": "did:web:trustprovider.example.com",
  "name": "Example Trust Service",
  "description": "Behavioral and economic trust scoring for MCP agents.",
  "endpoint": "https://api.trustprovider.example.com/mcp-t/v1",
  "transport_bindings": ["https", "nostr"],
  "conformance_level": 2,
  "supported_domains": ["general", "code-execution", "financial"],
  "dimensions": ["verification", "tenure", "performance", "commitment", "community", "consistency"],
  "custom_dimensions": [],
  "scoring_methodology_uri": "https://trustprovider.example.com/docs/scoring",
  "public_key": "z6MkrHKy02OJz2FpaMohCstPqHSyBfShVJBaByLktb5GJbKH",
  "terms_of_service_uri": "https://trustprovider.example.com/tos",
  "max_age_seconds_default": 3600,
  "rate_limits": {
    "queries_per_minute": 60,
    "publishes_per_minute": 30
  }
}
```

### 8.2 Provider Discovery

Trust Consumers discover Trust Providers through one or more mechanisms:

1. **Well-Known URI.** A Trust Provider SHOULD publish its Provider Descriptor at `/.well-known/mcp-t-provider.json` on its domain.

2. **MCP Capability Negotiation.** When MCP-T is used alongside MCP, the Trust Provider capability is announced during MCP's `initialize` handshake:

```json
{
  "jsonrpc": "2.0",
  "id": "init-001",
  "result": {
    "protocolVersion": "2025-03-26",
    "capabilities": {
      "trust": {
        "conformance_level": 2,
        "provider_id": "did:web:trustprovider.example.com",
        "supported_methods": ["trust/query", "trust/verify", "trust/history", "trust/providers", "trust/publish"]
      }
    },
    "serverInfo": {
      "name": "example-mcp-server",
      "version": "1.0.0"
    }
  }
}
```

3. **Nostr Relay Discovery.** Trust Providers operating on Nostr publish a kind 30078 (application-specific data) event containing the Provider Descriptor, enabling discovery through relay queries.

4. **Trust Provider Registry.** A centralized or federated registry of known Trust Providers MAY exist. This specification does not mandate a specific registry but defines the Provider Descriptor format that any registry SHOULD index.

### 8.3 Agent Authorization

Before a Trust Provider publishes scores for a Trust Subject, the subject MAY authorize the provider. Authorization is OPTIONAL but RECOMMENDED.

Authorization flow:

1. The Trust Subject sends a signed authorization message to the Trust Provider:

```json
{
  "authorization_type": "score_publication",
  "subject_id": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
  "provider_id": "did:web:trustprovider.example.com",
  "scope": ["general", "code-execution"],
  "granted_at": "2026-03-15T10:00:00Z",
  "expires_at": "2027-03-15T10:00:00Z",
  "signature": {
    "algorithm": "Ed25519",
    "public_key": "z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
    "value": "XYZKbP8RqG4VWxhFzKm..."
  }
}
```

2. The Trust Provider stores the authorization and includes an `authorized: true` flag in published Trust Scores.

3. Trust Scores published without subject authorization MUST include `authorized: false`. If the `authorized` field is absent, consumers MUST treat the score as unauthorized. Consumers SHOULD reject unauthorized scores by default. Consumers that choose to accept unauthorized scores MUST apply reduced weight and MUST document their rationale for doing so.

### 8.4 Multi-Provider Aggregation

A Trust Subject MAY have scores from multiple Trust Providers. Consumers that receive scores from multiple providers SHOULD:

1. Validate each score's signature independently.
2. Apply provider-specific trust weights based on the consumer's local configuration.
3. Compute a local aggregate using a method appropriate to their security requirements.

This specification does not mandate an aggregation algorithm. Common approaches include:

- **Highest-of:** Use the highest score (most permissive).
- **Lowest-of:** Use the lowest score (most conservative).
- **Weighted mean:** Weight by provider reputation, conformance level, or consumer preference.
- **Quorum:** Require a minimum number of providers to agree above threshold.

---

## 9. Transport Bindings

MCP-T is transport-agnostic. This section defines standard bindings for common transports.

### 9.1 HTTPS Binding

The HTTPS binding maps MCP-T protocol messages to HTTP endpoints.

| Method | HTTP Verb | Path | Content-Type |
|---|---|---|---|
| `trust/query` | POST | `/mcp-t/v1/query` | `application/json` |
| `trust/verify` | POST | `/mcp-t/v1/verify` | `application/json` |
| `trust/history` | POST | `/mcp-t/v1/history` | `application/json` |
| `trust/providers` | GET | `/mcp-t/v1/providers` | `application/json` (response only) |
| `trust/publish` | POST | `/mcp-t/v1/publish` | `application/json` |

Request and response bodies are the JSON-RPC 2.0 messages defined in Section 7. The HTTP path determines the method; the `method` field in the JSON-RPC body MUST match the path. Providers MUST reject requests where the path and `method` field disagree.

**Exception:** `trust/providers` uses HTTP GET with no request body. The response is a JSON-RPC 2.0 response message (Section 7.4.2). When used via the JSON-RPC transport (e.g., MCP's stdio/SSE), `trust/providers` follows the standard JSON-RPC request format (Section 7.4.1). The HTTPS binding uses GET for discoverability — providers MAY be discovered via simple HTTP GET without requiring a JSON-RPC client.

HTTPS endpoints MUST use TLS 1.2 or higher. Endpoints MUST implement rate limiting as documented in the Provider Descriptor. Providers MUST return error code -32020 (`RateLimited`) when limits are exceeded, with a `retry_after_seconds` value in the error data.

Authentication for HTTPS endpoints is not mandated by this specification. Providers MAY require authentication (Bearer tokens, API keys, mTLS) and SHOULD document their authentication requirements in the Provider Descriptor. Public read-only endpoints (Level 0) SHOULD NOT require authentication to maximize accessibility.

### 9.2 Nostr Binding

Trust Scores and Trust Events are published as Nostr events. This binding uses NIP-32 (Labeling) for efficient relay-level filtering, NIP-33 (Parameterized Replaceable Events) for score updates, and NIP-40 (Expiration) for automatic cleanup.

> **Note:** This specification proposes Nostr event kind 30085 (parameterized replaceable) for trust scores and kind 1085 (regular) for trust events. Trust events use a non-replaceable kind because they are historical records that MUST NOT be overwritten. These kind numbers are provisional and subject to confirmation through the Nostr NIP process. A companion NIP proposal is planned.

#### Score Publication

Trust Scores are published as kind 30085 (parameterized replaceable) events. The `d` tag MUST include both the subject identifier and domain, separated by a colon, to prevent multi-domain score collision:

```json
{
  "kind": 30085,
  "pubkey": "<provider nostr pubkey hex>",
  "created_at": 1742035800,
  "tags": [
    ["d", "<subject_id>:code-execution"],
    ["p", "<subject nostr pubkey hex>"],
    ["L", "mcp-t"],
    ["l", "trust-score", "mcp-t"],
    ["l", "code-execution", "mcp-t"],
    ["t", "mcp-t"],
    ["t", "mcp-t:code-execution"],
    ["expiration", "1742039400"]
  ],
  "content": "<full JSON TrustScore object, encrypted if privacy required>",
  "sig": "<nostr event signature>"
}
```

**Tag design rationale:**
- `d` tag includes `<subject_id>:<domain>` to ensure each subject+domain combination is a unique replaceable event (NIP-33).
- `L` and `l` tags follow NIP-32 (Labeling) for relay-indexed filtering. The `L` tag declares the namespace (`mcp-t`), `l` tags declare values within it. Both are single-letter tags, universally indexed by relays.
- `t` tags provide additional hashtag-style filtering (`mcp-t`, `mcp-t:code-execution`). The `t` tag is indexed by all major relay implementations.
- `expiration` tag follows NIP-40, enabling relays to auto-delete expired scores.
- The full TrustScore JSON in `content` is the canonical data source. Tags are for filtering and quick access.

#### Event Publication

Trust Events are published as kind 1085 (regular, non-replaceable) events. Trust Events are historical records and MUST NOT be overwritable:

```json
{
  "kind": 1085,
  "pubkey": "<issuer nostr pubkey hex>",
  "created_at": 1742035500,
  "tags": [
    ["p", "<subject nostr pubkey hex>"],
    ["L", "mcp-t"],
    ["l", "trust-event", "mcp-t"],
    ["t", "mcp-t:contract.completed"],
    ["a", "30085:<provider pubkey hex>:<subject_id>:<domain>"]
  ],
  "content": "<full JSON TrustEvent object>",
  "sig": "<nostr event signature>"
}
```

The `a` tag (NIP-33) references the corresponding replaceable trust score event, enabling relay-level back-referencing from events to scores.

#### Query via Relay

Consumers query scores using single-letter indexed tags:

**All trust scores for a subject:**
```json
{
  "kinds": [30085],
  "#p": ["<subject nostr pubkey hex>"]
}
```

**All trust scores from a provider:**
```json
{
  "kinds": [30085],
  "authors": ["<provider nostr pubkey hex>"]
}
```

**All trust scores in a domain (via NIP-32 label):**
```json
{
  "kinds": [30085],
  "#l": ["code-execution"]
}
```

**All trust events for a subject:**
```json
{
  "kinds": [1085],
  "#p": ["<subject nostr pubkey hex>"]
}
```

### 9.3 IPFS Binding

Trust Scores and Trust Events MAY be stored as content-addressed objects on IPFS.

- Each Trust Score or Trust Event is stored as a JSON file with a deterministic CID.
- An IPNS name MAY be used for the "latest score" pointer for a given subject + provider + domain tuple.
- Consumers resolve the CID and validate the embedded signature.

The IPFS binding is suitable for archival and auditability but is not recommended for low-latency queries.

### 9.4 Streamable HTTP Binding

For real-time score updates, MCP-T supports Server-Sent Events (SSE) over the HTTPS binding:

```
GET /mcp-t/v1/stream?subject_id=did:key:z6Mk...&domain=code-execution
Accept: text/event-stream
```

The server sends score updates as SSE events:

```
event: trust_score_update
data: {"trust_score": { ... }}

event: trust_event
data: {"event": { ... }}
```

---

## 10. Conformance Levels

MCP-T defines four conformance levels to enable incremental adoption. Implementations declare their conformance level in the Provider Descriptor and MCP capability negotiation.

### Level 0: Read-Only

**Capability:** Query trust scores. No publishing.

**Requirements:**
- MUST support `trust/query` (request only).
- MUST support `trust/verify` (request only).
- MUST validate Trust Score signatures.
- MUST respect `validity.expires_at` and `validity.max_age_seconds`.

**Use case:** An MCP client that checks agent trust scores before granting tool access. The client consumes scores but does not produce them.

### Level 1: Basic

**Capability:** Query + publish Trust Events. No economic infrastructure.

**Requirements:**
- All Level 0 requirements.
- MUST support `trust/publish` (send Trust Events).
- MUST support `trust/history` (request and respond).
- MUST sign all published events.
- Published events MUST conform to the standard event types (Section 6.3) or use properly namespaced custom types.

**Use case:** A platform that reports contract completions, security incidents, and behavioral observations to Trust Providers.

### Level 2: Economic

**Capability:** Full economic trust infrastructure including staking and slashing.

**Requirements:**
- All Level 1 requirements.
- MUST support `economic.*` event types.
- MUST support `endorsement.*` event types.
- MUST publish the `commitment` trust dimension.
- MUST document staking and slashing procedures in the provider's `scoring_methodology_uri`.
- Economic events MUST reference verifiable on-chain or payment-network transactions where applicable.

**Use case:** A Trust Provider that computes scores based on economic commitments (staking, collateral, insurance bonds). A platform that manages staking lifecycle events.

### Level 3: Zero-Knowledge

**Capability:** Zero-knowledge trust proofs. Prove trust exceeds a threshold without revealing the score.

**Requirements:**
- All Level 2 requirements.
- MUST support a `trust/verify` response mode where the response is a zero-knowledge proof rather than a signed assertion.
- The proof MUST demonstrate that the Trust Score satisfies the requested `ThresholdSpec` without revealing:
  - The exact composite score.
  - The exact dimensional scores.
  - The identity of the Trust Provider (if `anonymous_provider` is requested).
  - The underlying Trust Events.
- The proof MUST be independently verifiable by the consumer without contacting the Trust Provider.
- The proof format SHOULD be based on established ZK proof systems (e.g., Groth16, PLONK, or Bulletproofs).

**Additional `trust/verify` parameters for Level 3:**

```json
{
  "jsonrpc": "2.0",
  "id": "req-006",
  "method": "trust/verify",
  "params": {
    "subject_id": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
    "threshold": {
      "composite_min": 700,
      "dimension_mins": { "verification": 800 }
    },
    "proof_request": {
      "type": "zero_knowledge",
      "hide_score": true,
      "hide_provider": false,
      "hide_events": true,
      "proof_system": "groth16"
    }
  }
}
```

**Response with ZK proof:**

```json
{
  "jsonrpc": "2.0",
  "id": "req-006",
  "result": {
    "verified": true,
    "proof": {
      "type": "groth16",
      "public_inputs": [
        "threshold_composite_min:700",
        "threshold_dim_verification_min:800",
        "subject_id_commitment:0xabc123..."
      ],
      "proof_data": "base64url-encoded-proof...",
      "verification_key_uri": "https://trustprovider.example.com/vk/mcp-t-v1.json"
    },
    "checked_at": "2026-03-15T10:31:00Z"
  }
}
```

**Use case:** An agent operating in a privacy-sensitive environment (healthcare, legal) that needs to prove trustworthiness without revealing its operational history or the details of its trust score.

---

## 11. Security Considerations

### 11.1 Trust Score Poisoning

**Threat:** A malicious actor creates fake Trust Events to inflate a Trust Score (Sybil attack on the event layer) or deflate a competitor's score (griefing attack).

**Mitigations:**
- Trust Providers MUST verify event signatures before processing.
- Trust Providers SHOULD weight events by the issuer's own trust score (recursive trust weighting).
- Trust Providers SHOULD require a minimum confidence threshold before publishing dimensional scores.
- Consumers SHOULD require minimum `evidence_count` thresholds via the `min_evidence_count` parameter in `trust/verify`.
- Level 2 providers SHOULD require economic stake from event issuers, making Sybil attacks economically costly.

### 11.2 Trust Provider Compromise

**Threat:** A Trust Provider's signing key is compromised, enabling publication of fraudulent Trust Scores.

**Mitigations:**
- Trust Providers SHOULD use hardware security modules (HSMs) for key storage.
- Trust Scores SHOULD be published with a limited `max_age_seconds` to bound the window of compromise.
- Consumers SHOULD query multiple independent providers and apply quorum or conservative aggregation (Section 8.4).
- Trust Providers SHOULD publish key rotation events and support key revocation through their discovery endpoints.

### 11.3 Replay Attacks

**Threat:** An attacker replays a previously valid Trust Score or Trust Event to deceive a consumer.

**Mitigations:**
- Trust Scores include `validity.issued_at` and `validity.expires_at`. Consumers MUST reject expired scores.
- Trust Events include `event_id` for idempotency. Receivers MUST deduplicate by `event_id`.
- Consumers SHOULD enforce `max_age_seconds` appropriate to their security requirements.

### 11.4 Score Interpretation Attacks

**Threat:** A consumer misinterprets a trust score due to domain mismatch (e.g., using a `code-execution` score to authorize a `financial` action) or confidence neglect (using a high score with very low confidence).

**Mitigations:**
- Consumers MUST check the `domain` field and `domain_match` indicator.
- Consumers SHOULD enforce minimum confidence thresholds.
- Consumers SHOULD enforce minimum `evidence_count` to avoid decisions based on thin data.
- The `trust/verify` method provides a built-in way to express multi-dimensional requirements, reducing the risk of naive single-score interpretation.

### 11.5 Transport Security

- HTTPS endpoints MUST use TLS 1.2+.
- Nostr events are signed at the protocol level but transmitted in cleartext. Consumers MUST validate Nostr event signatures.
- IPFS content is addressed by hash but not encrypted. Sensitive Trust Scores SHOULD be encrypted in the `content` field with the intended consumer's public key.

### 11.6 Denial of Service

**Threat:** Excessive trust queries or event publications overwhelm a Trust Provider.

**Mitigations:**
- Trust Providers SHOULD implement rate limiting as documented in the Provider Descriptor.
- Consumers SHOULD cache Trust Scores locally per `max_age_seconds`.
- The Nostr binding distributes load across relays rather than concentrating on a single endpoint.

### 11.7 Cross-Provider Trust Aggregation Risks

When aggregating scores from multiple Trust Providers:
- Providers may use different scoring methodologies, making scores not directly comparable.
- A low-quality provider with inflated scores can skew aggregation.
- Consumers SHOULD maintain a local provider trust configuration specifying which providers to accept and their relative weight.
- Consumers SHOULD NOT blindly average scores from all available providers.

---

## 12. Privacy Considerations

### 12.1 Public Trust Scores

Trust Scores published to public transports (Nostr relays, IPFS) are visible to any observer. This enables:
- Agents to build portable reputation.
- Consumers to verify scores without provider interaction.

But also creates risks:
- Trust history reveals operational patterns.
- Score changes over time reveal incidents.
- Dimensional scores may reveal sensitive business metrics.

### 12.2 Selective Disclosure

MCP-T supports selective disclosure through multiple mechanisms:

1. **Dimension filtering:** Providers MAY publish only a subset of dimensions publicly and reserve others for authenticated queries.
2. **Domain restriction:** Providers MAY restrict domain-specific scores to authorized consumers.
3. **Zero-knowledge proofs (Level 3):** Subjects can prove threshold compliance without revealing scores.

### 12.3 Right to Erasure

Trust Subjects MAY request removal of their Trust Scores from a Trust Provider. Providers operating in jurisdictions with data protection requirements (GDPR, CCPA) MUST honor such requests for provider-held data. Providers SHOULD document their data retention and deletion policies.

Trust Events published to decentralized transports (Nostr, IPFS) may not be erasable. Subjects SHOULD be informed of the persistence characteristics of each transport before consenting to score publication.

### 12.4 Correlation Resistance

When an agent uses the same Subject Identifier across multiple platforms, its trust history is correlatable. Agents requiring correlation resistance SHOULD:
- Use different Subject Identifiers per platform.
- Use Level 3 zero-knowledge proofs that do not reveal the Subject Identifier.
- Use unlinkable credential presentation schemes (e.g., BBS+ signatures) when MCP-I supports them.

---

## 13. IANA Considerations

This specification requests registration of:

### 13.1 Well-Known URI

URI suffix: `mcp-t-provider.json`
Change controller: MCP-T Working Group
Specification: This document, Section 8.2

### 13.2 Media Type

This specification does not define new media types. All messages use `application/json`.

---

## 14. References

### 14.1 Normative References

- **[RFC 2119]** Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- **[RFC 8174]** Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- **[RFC 7518]** Jones, M., "JSON Web Algorithms (JWA)", RFC 7518, May 2015. (Defines ES256, ES384.)
- **[RFC 8032]** Josefsson, S., Liusvaara, I., "Edwards-Curve Digital Signature Algorithm (EdDSA)", RFC 8032, January 2017. (Defines Ed25519.)
- **[RFC 8615]** Nottingham, M., "Well-Known Uniform Resource Identifiers (URIs)", RFC 8615, May 2019.
- **[RFC 8785]** Rundgren, A., Jordan, B., Erdtman, S., "JSON Canonicalization Scheme (JCS)", RFC 8785, June 2020.
- **[Multibase]** Multiformats, "Multibase: Self-describing base encodings", https://github.com/multiformats/multibase.
- **[JSON-RPC 2.0]** JSON-RPC Working Group, "JSON-RPC 2.0 Specification", January 2013.

### 14.2 Informative References

- **[MCP]** Anthropic, "Model Context Protocol Specification", https://spec.modelcontextprotocol.io/
- **[MCP-I]** Vouched.id / DIF, "Model Context Protocol -- Identity Extension (MCP-I)", Decentralized Identity Foundation.
- **[NIP-01]** Nostr Implementation Possibilities, "NIP-01: Basic Protocol Flow Description".
- **[NIP-32]** Nostr Implementation Possibilities, "NIP-32: Labeling".
- **[NIP-33]** Nostr Implementation Possibilities, "NIP-33: Parameterized Replaceable Events".
- **[NIP-40]** Nostr Implementation Possibilities, "NIP-40: Expiration Timestamp".
- **[W3C-DID]** W3C, "Decentralized Identifiers (DIDs) v1.0", W3C Recommendation, July 2022.
- **[W3C-VC]** W3C, "Verifiable Credentials Data Model v2.0", W3C Recommendation, March 2024.
- **[NIP-47]** Nostr Implementation Possibilities, "NIP-47: Nostr Wallet Connect".

---

## Appendix A: JSON Schema Definitions

### A.1 TrustScore Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/Percival-Labs/mcp-t/schemas/trust-score.json",
  "title": "MCP-T Trust Score",
  "type": "object",
  "required": ["schema_version", "subject_id", "provider_id", "score", "validity", "signature"],
  "properties": {
    "schema_version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "MCP-T schema version (semver)."
    },
    "subject_id": {
      "type": "string",
      "minLength": 1,
      "description": "The Trust Subject identifier (DID, npub, URI, or MCP server ID)."
    },
    "provider_id": {
      "type": "string",
      "minLength": 1,
      "description": "The Trust Provider identifier."
    },
    "score": {
      "$ref": "#/$defs/TrustScoreValue"
    },
    "domain": {
      "type": "string",
      "description": "Domain scope. Omit for domain-general scores."
    },
    "domain_match": {
      "type": "boolean",
      "description": "Whether the provider had sufficient domain-specific data."
    },
    "validity": {
      "$ref": "#/$defs/ValidityWindow"
    },
    "metadata": {
      "type": "object",
      "description": "Provider-specific metadata."
    },
    "authorized": {
      "type": "boolean",
      "description": "Whether the subject authorized this provider to publish scores."
    },
    "signature": {
      "$ref": "#/$defs/Signature"
    }
  },
  "$defs": {
    "TrustScoreValue": {
      "type": "object",
      "required": ["composite", "dimensions"],
      "properties": {
        "composite": {
          "type": "integer",
          "minimum": 0,
          "maximum": 1000,
          "description": "Composite trust score."
        },
        "dimensions": {
          "type": "object",
          "minProperties": 2,
          "additionalProperties": {
            "$ref": "#/$defs/DimensionScore"
          },
          "description": "Map of dimension IDs to scores."
        }
      }
    },
    "DimensionScore": {
      "type": "object",
      "required": ["value", "confidence", "evidence_count"],
      "properties": {
        "value": {
          "type": "integer",
          "minimum": 0,
          "maximum": 1000,
          "description": "Dimensional score."
        },
        "confidence": {
          "type": "number",
          "minimum": 0.0,
          "maximum": 1.0,
          "description": "Statistical reliability of this score."
        },
        "evidence_count": {
          "type": "integer",
          "minimum": 0,
          "description": "Number of contributing Trust Events."
        },
        "observation_window_seconds": {
          "type": "integer",
          "minimum": 1,
          "description": "Duration (in seconds) of the observation window over which the contributing Trust Events were collected. Enables consumers to distinguish a score derived from 892 events over 3 years vs. 892 events over 24 hours, and to apply time-decay or recency requirements. OPTIONAL; omit when the window is unbounded or unknown."
        }
      }
    },
    "ValidityWindow": {
      "type": "object",
      "required": ["issued_at", "expires_at", "max_age_seconds"],
      "properties": {
        "issued_at": {
          "type": "string",
          "format": "date-time"
        },
        "expires_at": {
          "type": "string",
          "format": "date-time"
        },
        "max_age_seconds": {
          "type": "integer",
          "minimum": 1
        }
      }
    },
    "Signature": {
      "type": "object",
      "required": ["algorithm", "public_key", "value"],
      "properties": {
        "algorithm": {
          "type": "string",
          "enum": ["Ed25519", "ES256", "ES384"]
        },
        "public_key": {
          "type": "string"
        },
        "value": {
          "type": "string"
        }
      }
    }
  }
}
```

### A.2 TrustEvent Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/Percival-Labs/mcp-t/schemas/trust-event.json",
  "title": "MCP-T Trust Event",
  "type": "object",
  "required": ["event_id", "event_type", "subject_id", "issuer_id", "timestamp", "payload", "signature"],
  "properties": {
    "event_id": {
      "type": "string",
      "minLength": 1,
      "description": "Globally unique event identifier (ULID or UUIDv7 recommended)."
    },
    "event_type": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)*$",
      "description": "Dot-namespaced event type."
    },
    "subject_id": {
      "type": "string",
      "minLength": 1
    },
    "issuer_id": {
      "type": "string",
      "minLength": 1
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    },
    "payload": {
      "type": "object",
      "description": "Event-type-specific data."
    },
    "dimensions_affected": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Trust dimensions this event is relevant to."
    },
    "signature": {
      "$ref": "trust-score.json#/$defs/Signature"
    },
    "co_signatures": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["signer_id", "algorithm", "public_key", "value"],
        "properties": {
          "signer_id": { "type": "string" },
          "algorithm": { "type": "string", "enum": ["Ed25519", "ES256", "ES384"] },
          "public_key": { "type": "string" },
          "value": { "type": "string" }
        }
      }
    }
  }
}
```

### A.3 ThresholdSpec Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/Percival-Labs/mcp-t/schemas/threshold-spec.json",
  "title": "MCP-T Threshold Specification",
  "type": "object",
  "anyOf": [
    { "required": ["composite_min"] },
    { "required": ["dimension_mins"] }
  ],
  "properties": {
    "composite_min": {
      "type": "integer",
      "minimum": 0,
      "maximum": 1000,
      "description": "Minimum required composite score."
    },
    "dimension_mins": {
      "type": "object",
      "additionalProperties": {
        "type": "integer",
        "minimum": 0,
        "maximum": 1000
      },
      "description": "Minimum required score per dimension."
    },
    "confidence_min": {
      "type": "number",
      "minimum": 0.0,
      "maximum": 1.0,
      "description": "Minimum required confidence level."
    },
    "min_evidence_count": {
      "type": "integer",
      "minimum": 0,
      "description": "Minimum total evidence count."
    }
  }
}
```

---

## Appendix B: Example Flows

### B.1 MCP Client Checks Agent Trust Before Tool Access

```
MCP Client                    Trust Provider
    │                              │
    │  trust/verify                │
    │  subject: agent-did          │
    │  domain: code-execution      │
    │  threshold: composite >= 600 │
    │─────────────────────────────>│
    │                              │
    │  result: verified=true       │
    │  confidence: 0.85            │
    │<─────────────────────────────│
    │                              │
    │  [Grant tool access]         │
    │                              │
```

### B.2 Platform Reports Contract Completion

```
Platform                      Trust Provider
    │                              │
    │  trust/publish               │
    │  event_type:                 │
    │    contract.completed        │
    │  subject: agent-did          │
    │  payload: {outcome: success} │
    │─────────────────────────────>│
    │                              │
    │  result: accepted=true       │
    │  status: queued              │
    │<─────────────────────────────│
    │                              │
    │                   [Provider recomputes score]
    │                              │
```

### B.3 Multi-Provider Trust Decision

```
MCP Client              Provider A          Provider B
    │                       │                    │
    │  trust/query          │                    │
    │  subject: agent-did   │                    │
    │──────────────────────>│                    │
    │                       │                    │
    │  trust/query          │                    │
    │  subject: agent-did   │                    │
    │───────────────────────────────────────────>│
    │                       │                    │
    │  score: 742           │                    │
    │<──────────────────────│                    │
    │                       │                    │
    │  score: 680           │                    │
    │<───────────────────────────────────────────│
    │                       │                    │
    │  [Apply local         │                    │
    │   aggregation policy: │                    │
    │   min(742,680)=680]   │                    │
    │                       │                    │
```

### B.4 Zero-Knowledge Trust Proof

```
Agent                      Trust Provider            MCP Server
    │                           │                        │
    │  [Agent wants access to   │                        │
    │   sensitive tool server]  │                        │
    │                           │                        │
    │  trust/verify             │                        │
    │  proof_request: {         │                        │
    │    type: zero_knowledge,  │                        │
    │    hide_score: true       │                        │
    │  }                        │                        │
    │──────────────────────────>│                        │
    │                           │                        │
    │  result: {                │                        │
    │    verified: true,        │                        │
    │    proof: {groth16...}    │                        │
    │  }                        │                        │
    │<──────────────────────────│                        │
    │                           │                        │
    │  [Present ZK proof to MCP Server]                  │
    │───────────────────────────────────────────────────>│
    │                           │                        │
    │  [Server verifies proof   │                        │
    │   without learning score] │                        │
    │                           │                        │
    │  [Access granted]         │                        │
    │<───────────────────────────────────────────────────│
    │                           │                        │
```

---

## Changelog

### v0.1.0-draft (2026-03-15)

- Initial draft specification.
- Defined Trust Score schema with nine default dimensions (verification, tenure, performance, commitment, community, consistency, transparency, compliance, security).
- Defined Trust Event format with five event categories.
- Defined five protocol messages (query, verify, history, providers, publish).
- Defined Trust Provider interface with discovery, registration, and authorization.
- Defined four transport bindings (HTTPS, Nostr, IPFS, SSE).
- Defined four conformance levels (Read-Only, Basic, Economic, Zero-Knowledge).
- Security and privacy considerations.
- JSON Schema definitions for all data structures.

---

*This specification is released under CC-BY-4.0. Contributions welcome.*
