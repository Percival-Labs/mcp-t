# Model Context Protocol -- Trust Extension (MCP-T)

**Version:** 0.2.0-draft
**Status:** Draft
**Date:** 2026-03-23
**Authors:** Alan Carroll (Percival Labs)
**License:** CC-BY-4.0
**Specification URI:** `https://github.com/Percival-Labs/mcp-t/blob/main/spec/mcp-t-v0.2.0.md`
**Previous Version:** [v0.1.0](./mcp-t-v0.1.0.md)

---

## Abstract

The Model Context Protocol -- Trust Extension (MCP-T) defines a standard format and query protocol for trust scores associated with AI agents and tool servers operating within the Model Context Protocol (MCP) ecosystem. MCP-T is transport-agnostic, implementation-agnostic, and composable with MCP-I (Identity) to form a complete agent verification stack. It enables any platform to query, publish, and verify trust information for autonomous agents without prescribing the scoring algorithms or economic mechanisms that produce that information.

**v0.2.0** extends MCP-T with behavioral observation primitives, simulation event types, contract bidding events, and scoring methodology guidance. All additions are backward-compatible with v0.1.0.

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
17. [Appendix C: Scoring Methodology Guidance](#appendix-c-scoring-methodology-guidance)

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

**Observable.** _(New in v0.2.0.)_ Trust is ultimately derived from observed behavior, not declared intent. The specification provides first-class support for behavioral traces, declared-vs-observed comparison, and simulation artifacts as trust inputs.

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

**Behavioral Trace.** _(New in v0.2.0.)_ A structured record of an agent's runtime behavior during task execution, including tool calls made, resources accessed, side effects produced, and timing data. Behavioral Traces are the observational foundation for behavioral trust scoring.

**Behavioral Fidelity.** _(New in v0.2.0.)_ The degree to which an agent's observed runtime behavior matches its declared capabilities and scope. High behavioral fidelity indicates an agent that does what it says it does; low behavioral fidelity indicates divergence between declaration and reality.

**Simulation.** _(New in v0.2.0.)_ A pre-execution analysis that predicts an agent's behavior on a specific task, based on task specification, agent capabilities, and historical behavioral patterns. Simulations produce artifacts that may be used as trust evidence.

---

## 3. Architecture Overview

MCP-T introduces a trust layer between Trust Providers (who compute scores) and Trust Consumers (who use scores for authorization decisions). The architecture is intentionally decoupled: Providers and Consumers communicate through a standard schema and protocol, with trust data flowing through one or more transports.

```
                    +---------------------------------------------+
                    |              TRUST CONSUMERS                 |
                    |                                              |
                    |  +----------+  +----------+  +----------+   |
                    |  |MCP Client|  |MCP Server|  | Platform |   |
                    |  |(Agent)   |  |(Tool)    |  |(Registry)|   |
                    |  +----+-----+  +----+-----+  +----+-----+  |
                    |       |             |             |          |
                    +-------+-------------+-------------+----------+
                            |             |             |
                    +-------v-------------v-------------v----------+
                    |           MCP-T QUERY PROTOCOL                |
                    |       (JSON-RPC 2.0 messages)                 |
                    |                                               |
                    |   trust/query  trust/verify  trust/history    |
                    +-------+-------------+-------------+----------+
                            |             |             |
                    +-------v-------------v-------------v----------+
                    |         TRANSPORT LAYER                       |
                    |                                               |
                    |  +----------+  +----------+  +----------+    |
                    |  |  Nostr   |  |  HTTPS   |  |   IPFS   |   |
                    |  | (NIP-32) |  |  (REST)  |  |  (CID)   |   |
                    |  +----+-----+  +----+-----+  +----+-----+   |
                    +-------+-------------+-------------+----------+
                            |             |             |
                    +-------v-------------v-------------v----------+
                    |            TRUST PROVIDERS                    |
                    |                                               |
                    |  +----------+  +----------+  +----------+    |
                    |  |Provider A|  |Provider B|  |Provider C|    |
                    |  |(economic)|  |(attesta.)|  |(behavior)|    |
                    |  +----+-----+  +----+-----+  +----+-----+   |
                    +-------+-------------+-------------+----------+
                            |             |             |
                    +-------v-------------v-------------v----------+
                    |            TRUST EVENTS                       |
                    |   (signed observations from the ecosystem)    |
                    |                                               |
                    |  +----------+  +----------+  +----------+    |
                    |  |Contract  |  |Behavioral|  |Simulation|    |
                    |  |Events    |  |Traces    |  |Results   |    |
                    |  +----------+  +----------+  +----------+    |
                    +----------------------------------------------+
```

### 3.1 Data Flow

1. **Trust Events** are generated by ecosystem participants (agents, platforms, users) and published to one or more transports. _(v0.2.0: This includes behavioral traces captured during agent execution and simulation results generated before or during contract bidding.)_
2. **Trust Providers** consume Trust Events, apply their scoring methodology, and publish Trust Scores.
3. **Trust Consumers** query Trust Providers via the MCP-T protocol to retrieve scores or verify thresholds.
4. Trust Consumers make authorization decisions based on the retrieved Trust Scores and their local policy.

### 3.2 Separation of Concerns

MCP-T explicitly separates:

- **Data format** (this specification) from **scoring algorithm** (implementation-specific).
- **Query protocol** (this specification) from **transport mechanism** (transport bindings).
- **Trust dimensions** (extensible default set) from **dimension weights** (consumer-specific policy).
- **Score publication** (provider responsibility) from **score interpretation** (consumer responsibility).
- **Behavioral observation** (event format, this specification) from **behavioral analysis** (provider-specific methodology). _(New in v0.2.0.)_

---

## 4. Trust Score Schema

### 4.1 TrustScore Object

A Trust Score is the primary data structure in MCP-T. It represents the trust evaluation of a single Trust Subject by a single Trust Provider at a specific point in time.

```json
{
  "schema_version": "0.2.0",
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
        "evidence_count": 892
      },
      "behavioral_fidelity": {
        "value": 870,
        "confidence": 0.78,
        "evidence_count": 234
      }
    }
  },
  "domain": "code-execution",
  "validity": {
    "issued_at": "2026-03-23T10:30:00Z",
    "expires_at": "2026-03-23T11:30:00Z",
    "max_age_seconds": 3600
  },
  "metadata": {
    "algorithm_version": "provider-specific-v3.0",
    "total_events_processed": 1376,
    "first_event_at": "2025-09-01T00:00:00Z",
    "scoring_methodology": "two-tier"
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

Trust Dimensions are the component axes that contribute to a composite Trust Score. MCP-T defines ten default dimensions representing a broad range of trust signals across economic, behavioral, security, and governance domains. Implementations MUST compute at least two default dimensions. Implementations MAY define additional custom dimensions (Section 5.3) for domain-specific needs.

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

#### 5.1.10 Behavioral Fidelity (`behavioral_fidelity`) _(New in v0.2.0)_

Measures the degree to which the Trust Subject's observed runtime behavior matches its declared capabilities, scope, and operational boundaries. Unlike `consistency` (which measures behavioral stability over time) and `performance` (which measures task completion quality), behavioral fidelity measures _honesty_ -- does the agent do what it says it does, and only what it says it does?

Inputs MAY include:

- **Declaration-observation delta:** Comparison of declared tool capabilities, resource access patterns, and scope boundaries against observed runtime behavior captured in Behavioral Traces (Section 6.3.6).
- **Scope adherence:** Whether the agent accesses only the resources it declared it would need, or exhibits scope creep (accessing undeclared resources, making undeclared network calls, writing to undeclared locations).
- **Side effect analysis:** Whether the agent produces undeclared side effects beyond its stated outputs.
- **Implicit invariant consistency:** Whether the agent's behavior adheres to patterns discovered through observation that were never explicitly declared (see `behavior.invariant_discovered`, Section 6.3.6).
- **Simulation accuracy:** When simulation results exist, the delta between predicted behavior and actual behavior (see `simulation.delta`, Section 6.3.7).

A score of 0 indicates significant divergence between declared and observed behavior, or insufficient observation data to assess fidelity. A score of 1000 indicates perfect alignment between declared capabilities and observed behavior across a large sample of traced executions.

**Relationship to other dimensions:**

| Dimension | What it measures | Relationship to behavioral fidelity |
|-----------|-----------------|--------------------------------------|
| `performance` | Did the agent succeed at the task? | An agent can succeed while exceeding its declared scope. Performance measures outcomes; behavioral fidelity measures the path taken. |
| `consistency` | Does the agent behave the same way over time? | An agent can be consistently dishonest (always exceeding scope in the same way). Consistency measures variance; behavioral fidelity measures truth. |
| `transparency` | Can we see what the agent does? | Transparency is a prerequisite for behavioral fidelity scoring. You cannot measure fidelity without observability. But transparency alone does not imply fidelity. |
| `security` | Is the agent safe? | Security violations often manifest as behavioral fidelity failures (undeclared network calls, unauthorized resource access). Behavioral fidelity can serve as an early warning signal for security issues. |

### 5.2 Dimension Selection Guidance

The ten default dimensions are designed to serve diverse trust evaluation approaches. No single implementation is expected to score all ten. The following table suggests which dimensions are most relevant for common use cases:

| Use Case | Recommended Dimensions |
|----------|----------------------|
| Agent marketplace / skill registry | verification, performance, security, community, behavioral_fidelity |
| Financial transactions | verification, commitment, compliance, consistency, behavioral_fidelity |
| Enterprise deployment | verification, compliance, security, transparency, behavioral_fidelity |
| Open-source / decentralized ecosystem | performance, community, transparency, consistency |
| Behavioral analysis system | performance, consistency, security, tenure, behavioral_fidelity |
| Contract bidding / agent economy | performance, commitment, behavioral_fidelity, community |

Implementations SHOULD document which dimensions they score and why, enabling consumers to make informed decisions about dimensional coverage.

### 5.3 Custom Dimensions

Beyond the ten default dimensions, implementations MAY define custom dimensions for domain-specific trust signals using a namespaced identifier:

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
- Two-tier scoring (see Appendix C for guidance) _(New in v0.2.0)_

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
  "timestamp": "2026-03-23T09:45:00Z",
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

#### 6.3.6 Behavioral Observation Events _(New in v0.2.0)_

These event types support granular behavioral observation, enabling Trust Providers to compute the `behavioral_fidelity` dimension with high precision. They complement the existing behavioral events (Section 6.3.3) by providing structured, traceable records of agent runtime behavior rather than summary observations.

| Event Type | Description | Required Payload Fields | Dimensions Affected |
|---|---|---|---|
| `behavior.trace` | A structured record of agent runtime behavior during task execution. | `trace_id`, `tool_calls`, `resources_accessed`, `duration_ms` | `behavioral_fidelity`, `performance`, `consistency` |
| `behavior.invariant_discovered` | An implicit behavioral pattern was detected through observation that was not part of the agent's declared behavior. | `invariant_id`, `invariant_type`, `pattern`, `confidence`, `observation_count` | `behavioral_fidelity`, `consistency` |
| `behavior.declaration_delta` | A divergence was detected between the agent's declared capabilities/scope and its observed behavior. | `declared_scope`, `observed_scope`, `delta_type`, `severity` | `behavioral_fidelity`, `security` |
| `behavior.resource_access` | An observed resource access pattern during agent execution. | `resource_type`, `resource_id`, `access_type`, `authorized` | `behavioral_fidelity`, `security` |

##### `behavior.trace` Payload Schema

The `behavior.trace` event captures a complete behavioral record of an agent executing a task. This is the primary data structure for behavioral fidelity scoring.

```json
{
  "event_type": "behavior.trace",
  "payload": {
    "trace_id": "trc_01JABC789XYZ",
    "contract_id": "ctr_98765",
    "tool_calls": [
      {
        "tool_name": "file_read",
        "arguments_hash": "sha256:abc123...",
        "timestamp": "2026-03-23T09:45:01Z",
        "duration_ms": 45,
        "result_hash": "sha256:def456...",
        "declared": true
      },
      {
        "tool_name": "http_request",
        "arguments_hash": "sha256:ghi789...",
        "timestamp": "2026-03-23T09:45:02Z",
        "duration_ms": 230,
        "result_hash": "sha256:jkl012...",
        "declared": false
      }
    ],
    "resources_accessed": [
      {
        "resource_type": "file",
        "resource_id": "/data/input.csv",
        "access_type": "read",
        "declared": true
      },
      {
        "resource_type": "network",
        "resource_id": "api.external-service.com:443",
        "access_type": "write",
        "declared": false
      }
    ],
    "side_effects": [
      {
        "type": "file_write",
        "target": "/data/output.json",
        "declared": true
      }
    ],
    "duration_ms": 3420,
    "peak_memory_bytes": 134217728,
    "total_tool_calls": 2,
    "undeclared_tool_calls": 1,
    "total_resources": 2,
    "undeclared_resources": 1,
    "fidelity_ratio": 0.50
  }
}
```

**Payload Field Definitions:**

| Field | Type | Required | Description |
|---|---|---|---|
| `trace_id` | string | REQUIRED | Unique identifier for this behavioral trace. |
| `contract_id` | string | OPTIONAL | The contract this trace is associated with, if applicable. |
| `tool_calls` | array of ToolCallRecord | REQUIRED | Ordered list of tool invocations observed during execution. |
| `resources_accessed` | array of ResourceAccessRecord | REQUIRED | List of resources the agent accessed during execution. |
| `side_effects` | array of SideEffectRecord | RECOMMENDED | List of side effects produced by the agent beyond its stated output. |
| `duration_ms` | integer | REQUIRED | Total execution duration in milliseconds. |
| `peak_memory_bytes` | integer | OPTIONAL | Peak memory consumption during execution. |
| `total_tool_calls` | integer | REQUIRED | Total number of tool calls made. |
| `undeclared_tool_calls` | integer | REQUIRED | Number of tool calls not in the agent's declared capability set. |
| `total_resources` | integer | REQUIRED | Total number of resources accessed. |
| `undeclared_resources` | integer | REQUIRED | Number of resources not in the agent's declared access list. |
| `fidelity_ratio` | number | RECOMMENDED | Ratio of declared-to-total actions: `(total - undeclared) / total`. Range [0.0, 1.0]. A value of 1.0 indicates perfect fidelity. |

**ToolCallRecord:**

| Field | Type | Required | Description |
|---|---|---|---|
| `tool_name` | string | REQUIRED | Name of the tool invoked. |
| `arguments_hash` | string | RECOMMENDED | Hash of the call arguments (for privacy; raw arguments SHOULD NOT be included). |
| `timestamp` | string (ISO 8601) | REQUIRED | When the tool call was made. |
| `duration_ms` | integer | REQUIRED | Duration of the tool call. |
| `result_hash` | string | OPTIONAL | Hash of the tool call result. |
| `declared` | boolean | REQUIRED | Whether this tool call was within the agent's declared capabilities. |

**ResourceAccessRecord:**

| Field | Type | Required | Description |
|---|---|---|---|
| `resource_type` | string | REQUIRED | Type of resource: `file`, `network`, `database`, `api`, `memory`, `system`. |
| `resource_id` | string | REQUIRED | Identifier of the resource accessed. |
| `access_type` | string | REQUIRED | Nature of access: `read`, `write`, `execute`, `delete`. |
| `declared` | boolean | REQUIRED | Whether this resource access was within the agent's declared scope. |

**SideEffectRecord:**

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | REQUIRED | Type of side effect: `file_write`, `network_request`, `state_mutation`, `notification`, `other`. |
| `target` | string | REQUIRED | The target of the side effect. |
| `declared` | boolean | REQUIRED | Whether this side effect was within the agent's declared output scope. |

##### `behavior.invariant_discovered` Payload Schema

```json
{
  "event_type": "behavior.invariant_discovered",
  "payload": {
    "invariant_id": "inv_01JDEF456",
    "invariant_type": "resource_pattern",
    "pattern": "Agent always reads config.json before any file write operation",
    "confidence": 0.92,
    "observation_count": 47,
    "first_observed": "2026-01-15T00:00:00Z",
    "last_observed": "2026-03-23T09:45:00Z",
    "declared": false
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `invariant_id` | string | REQUIRED | Unique identifier for this invariant. |
| `invariant_type` | string | REQUIRED | Category: `resource_pattern`, `timing_pattern`, `call_sequence`, `scope_boundary`, `error_handling`. |
| `pattern` | string | REQUIRED | Human-readable description of the discovered invariant. |
| `confidence` | number | REQUIRED | Confidence that this invariant is a true behavioral pattern, not noise. Range [0.0, 1.0]. |
| `observation_count` | integer | REQUIRED | Number of executions in which this pattern was observed. |
| `first_observed` | string (ISO 8601) | REQUIRED | Timestamp of first observation. |
| `last_observed` | string (ISO 8601) | REQUIRED | Timestamp of most recent observation. |
| `declared` | boolean | REQUIRED | Whether this pattern corresponds to any declared behavior. `false` for implicit invariants. |

##### `behavior.declaration_delta` Payload Schema

```json
{
  "event_type": "behavior.declaration_delta",
  "payload": {
    "declared_scope": {
      "tools": ["file_read", "file_write"],
      "resources": ["file:/data/*"],
      "side_effects": ["file_write"]
    },
    "observed_scope": {
      "tools": ["file_read", "file_write", "http_request"],
      "resources": ["file:/data/*", "network:api.external-service.com:443"],
      "side_effects": ["file_write", "network_request"]
    },
    "delta_type": "scope_exceeded",
    "severity": "high",
    "undeclared_additions": {
      "tools": ["http_request"],
      "resources": ["network:api.external-service.com:443"],
      "side_effects": ["network_request"]
    },
    "trace_id": "trc_01JABC789XYZ"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `declared_scope` | ScopeDescriptor | REQUIRED | The agent's declared capabilities and access patterns. |
| `observed_scope` | ScopeDescriptor | REQUIRED | The actual capabilities and access patterns observed during execution. |
| `delta_type` | string | REQUIRED | Nature of the delta: `scope_exceeded` (agent did more than declared), `scope_underutilized` (agent declared more than used), `scope_contradicted` (agent did the opposite of declared). |
| `severity` | string | REQUIRED | Impact assessment: `low`, `medium`, `high`, `critical`. |
| `undeclared_additions` | ScopeDescriptor | RECOMMENDED | Specific items present in observed but absent from declared scope. |
| `trace_id` | string | OPTIONAL | Reference to the behavioral trace that triggered this delta detection. |

##### `behavior.resource_access` Payload Schema

```json
{
  "event_type": "behavior.resource_access",
  "payload": {
    "resource_type": "network",
    "resource_id": "api.external-service.com:443",
    "access_type": "write",
    "authorized": false,
    "frequency": 12,
    "observation_window_seconds": 3600,
    "trace_id": "trc_01JABC789XYZ"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `resource_type` | string | REQUIRED | Type of resource: `file`, `network`, `database`, `api`, `memory`, `system`. |
| `resource_id` | string | REQUIRED | Identifier of the resource accessed. |
| `access_type` | string | REQUIRED | Nature of access: `read`, `write`, `execute`, `delete`. |
| `authorized` | boolean | REQUIRED | Whether this access was authorized by the agent's declared scope. |
| `frequency` | integer | OPTIONAL | Number of times this resource was accessed in the observation window. |
| `observation_window_seconds` | integer | OPTIONAL | Duration of the observation window. |
| `trace_id` | string | OPTIONAL | Reference to the behavioral trace containing this access. |

#### 6.3.7 Simulation Events _(New in v0.2.0)_

Simulation events record pre-execution behavioral predictions and post-execution accuracy measurements. Simulations are run by agents, platforms, or third-party analysis services to predict what an agent will do before it executes a task. The accuracy of past simulations is itself a trust signal.

| Event Type | Description | Required Payload Fields | Dimensions Affected |
|---|---|---|---|
| `simulation.executed` | A pre-execution simulation was completed. | `simulation_id`, `task_spec_hash`, `execution_paths_explored` | `behavioral_fidelity` |
| `simulation.result` | The predicted outcome of a simulation. | `simulation_id`, `predicted_outcome`, `confidence` | `behavioral_fidelity`, `performance` |
| `simulation.delta` | The measured difference between simulation prediction and actual execution. | `simulation_id`, `contract_id`, `divergence_score` | `behavioral_fidelity`, `consistency` |

##### `simulation.executed` Payload Schema

```json
{
  "event_type": "simulation.executed",
  "payload": {
    "simulation_id": "sim_01JGHI789",
    "task_spec_hash": "sha256:task_spec_abc123...",
    "subject_id": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
    "simulator_id": "did:web:simulator.example.com",
    "environment": {
      "sandbox_type": "container",
      "resource_constraints": {
        "max_memory_bytes": 536870912,
        "max_duration_ms": 60000,
        "network_access": false
      }
    },
    "execution_paths_explored": 47,
    "duration_ms": 12340,
    "methodology": "behavioral_replay"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `simulation_id` | string | REQUIRED | Unique identifier for this simulation run. |
| `task_spec_hash` | string | REQUIRED | Hash of the task specification that was simulated against. |
| `subject_id` | string | REQUIRED | The agent whose behavior was simulated. |
| `simulator_id` | string | REQUIRED | The entity that ran the simulation. |
| `environment` | object | RECOMMENDED | Description of the simulation environment and constraints. |
| `execution_paths_explored` | integer | REQUIRED | Number of distinct execution paths the simulation explored. |
| `duration_ms` | integer | REQUIRED | Time taken to run the simulation. |
| `methodology` | string | RECOMMENDED | The simulation approach: `behavioral_replay` (replay past behavior against new task), `static_analysis` (analyze declared capabilities against task requirements), `sandbox_execution` (actually run the agent in a sandbox), `hybrid`. |

##### `simulation.result` Payload Schema

```json
{
  "event_type": "simulation.result",
  "payload": {
    "simulation_id": "sim_01JGHI789",
    "predicted_outcome": "success",
    "confidence": 0.87,
    "predicted_duration_ms": 4500,
    "predicted_tool_calls": ["file_read", "file_write", "json_parse"],
    "predicted_resources": ["file:/data/input.csv", "file:/data/output.json"],
    "predicted_side_effects": ["file_write:/data/output.json"],
    "risk_flags": [
      {
        "flag": "network_access_possible",
        "probability": 0.12,
        "evidence": "Agent has used http_request in 12% of similar tasks"
      }
    ],
    "comparable_task_count": 23
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `simulation_id` | string | REQUIRED | Reference to the simulation run. |
| `predicted_outcome` | string | REQUIRED | Predicted task outcome: `success`, `partial_success`, `failure`, `timeout`, `indeterminate`. |
| `confidence` | number | REQUIRED | Confidence in the prediction. Range [0.0, 1.0]. |
| `predicted_duration_ms` | integer | OPTIONAL | Predicted execution duration. |
| `predicted_tool_calls` | array of strings | RECOMMENDED | Tools the agent is predicted to use. |
| `predicted_resources` | array of strings | RECOMMENDED | Resources the agent is predicted to access. |
| `predicted_side_effects` | array of strings | OPTIONAL | Side effects the agent is predicted to produce. |
| `risk_flags` | array of RiskFlag | OPTIONAL | Potential behavioral risks identified by the simulation. |
| `comparable_task_count` | integer | RECOMMENDED | Number of historical tasks used as basis for the prediction. |

**RiskFlag:**

| Field | Type | Required | Description |
|---|---|---|---|
| `flag` | string | REQUIRED | Identifier for the risk. |
| `probability` | number | REQUIRED | Estimated probability of this risk materializing. Range [0.0, 1.0]. |
| `evidence` | string | REQUIRED | Human-readable explanation of why this risk was flagged. |

##### `simulation.delta` Payload Schema

```json
{
  "event_type": "simulation.delta",
  "payload": {
    "simulation_id": "sim_01JGHI789",
    "contract_id": "ctr_98765",
    "trace_id": "trc_01JABC789XYZ",
    "predicted_outcome": "success",
    "actual_outcome": "success",
    "outcome_match": true,
    "divergence_score": 0.15,
    "divergences": [
      {
        "category": "tool_calls",
        "predicted": ["file_read", "file_write", "json_parse"],
        "actual": ["file_read", "file_write", "json_parse", "http_request"],
        "delta": "actual included undeclared http_request"
      },
      {
        "category": "duration",
        "predicted_ms": 4500,
        "actual_ms": 5200,
        "delta_percent": 15.6
      }
    ]
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `simulation_id` | string | REQUIRED | Reference to the simulation that made the prediction. |
| `contract_id` | string | REQUIRED | Reference to the contract that was actually executed. |
| `trace_id` | string | RECOMMENDED | Reference to the behavioral trace of actual execution. |
| `predicted_outcome` | string | REQUIRED | What the simulation predicted. |
| `actual_outcome` | string | REQUIRED | What actually happened. |
| `outcome_match` | boolean | REQUIRED | Whether the predicted and actual outcomes matched. |
| `divergence_score` | number | REQUIRED | Overall divergence between prediction and reality. Range [0.0, 1.0]. 0.0 = perfect prediction; 1.0 = complete divergence. |
| `divergences` | array of DivergenceRecord | RECOMMENDED | Specific areas where prediction and reality diverged. |

**DivergenceRecord:**

| Field | Type | Required | Description |
|---|---|---|---|
| `category` | string | REQUIRED | What diverged: `tool_calls`, `resources`, `side_effects`, `duration`, `outcome`, `scope`. |
| `predicted` | any | REQUIRED | What was predicted. |
| `actual` | any | REQUIRED | What actually happened. |
| `delta` | string | REQUIRED | Human-readable description of the divergence. |

#### 6.3.8 Bid Events _(New in v0.2.0)_

Bid events record the lifecycle of contract bidding in agent economies. When agents compete for contracts, bid events create an auditable record that feeds into trust scoring. Bids MAY include simulation evidence (referencing a `simulation.result` event) as proof of capability.

| Event Type | Description | Required Payload Fields | Dimensions Affected |
|---|---|---|---|
| `contract.bid_submitted` | An agent submitted a bid on a contract. | `contract_id`, `bid_id`, `bid_amount`, `currency` | `commitment`, `performance` |
| `contract.bid_accepted` | A bid was accepted by the contract issuer. | `contract_id`, `bid_id`, `agent_id` | `performance`, `community` |
| `contract.bid_rejected` | A bid was rejected by the contract issuer. | `contract_id`, `bid_id`, `reason` | `performance` |

##### `contract.bid_submitted` Payload Schema

```json
{
  "event_type": "contract.bid_submitted",
  "payload": {
    "contract_id": "ctr_55555",
    "bid_id": "bid_01JKLM789",
    "bid_amount": 50000,
    "currency": "sats",
    "estimated_duration_ms": 300000,
    "simulation_id": "sim_01JGHI789",
    "stake_amount": 5000,
    "stake_currency": "sats",
    "capabilities_declared": ["code-execution", "file-access"],
    "message": "Agent bid with simulation evidence attached"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `contract_id` | string | REQUIRED | The contract being bid on. |
| `bid_id` | string | REQUIRED | Unique identifier for this bid. |
| `bid_amount` | number | REQUIRED | The price the agent is bidding. |
| `currency` | string | REQUIRED | Currency of the bid amount (e.g., `sats`, `usd`, `eur`). |
| `estimated_duration_ms` | integer | OPTIONAL | Estimated time to complete the contract. |
| `simulation_id` | string | OPTIONAL | Reference to a `simulation.result` event, if the agent ran a pre-bid simulation. This links the bid to verifiable behavioral prediction evidence. |
| `stake_amount` | number | OPTIONAL | Amount the agent is willing to stake on successful completion. |
| `stake_currency` | string | OPTIONAL | Currency of the stake (required if `stake_amount` is present). |
| `capabilities_declared` | array of strings | RECOMMENDED | The capabilities the agent declares it will use for this contract. |
| `message` | string | OPTIONAL | Free-text message from the bidding agent. |

##### `contract.bid_accepted` Payload Schema

```json
{
  "event_type": "contract.bid_accepted",
  "payload": {
    "contract_id": "ctr_55555",
    "bid_id": "bid_01JKLM789",
    "agent_id": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
    "accepted_amount": 50000,
    "currency": "sats",
    "acceptance_criteria": "highest_trust_score"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `contract_id` | string | REQUIRED | The contract. |
| `bid_id` | string | REQUIRED | The accepted bid. |
| `agent_id` | string | REQUIRED | The winning agent's Subject Identifier. |
| `accepted_amount` | number | OPTIONAL | The final accepted amount (may differ from bid if negotiated). |
| `currency` | string | OPTIONAL | Currency. |
| `acceptance_criteria` | string | OPTIONAL | Why this bid was selected (e.g., `lowest_price`, `highest_trust_score`, `best_simulation`, `manual_selection`). |

##### `contract.bid_rejected` Payload Schema

```json
{
  "event_type": "contract.bid_rejected",
  "payload": {
    "contract_id": "ctr_55555",
    "bid_id": "bid_01JKLM790",
    "reason": "trust_threshold_not_met",
    "details": "Agent composite score 580 below minimum 700"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `contract_id` | string | REQUIRED | The contract. |
| `bid_id` | string | REQUIRED | The rejected bid. |
| `reason` | string | REQUIRED | Rejection reason: `trust_threshold_not_met`, `price_too_high`, `insufficient_capabilities`, `simulation_failed`, `manual_rejection`, `other`. |
| `details` | string | OPTIONAL | Human-readable explanation. |

### 6.4 Event Signing

All Trust Events MUST be signed by the issuer. The signature MUST be computed over the canonical JSON serialization (RFC 8785: JCS) of the event with the `signature` and `co_signatures` fields removed.

Co-signatures are OPTIONAL and provide additional attestation. Common use cases:

- The Trust Subject co-signs to acknowledge the event (e.g., acknowledging a completed contract).
- A third-party verifier co-signs to independently attest to the event (e.g., an auditor confirming audit findings).
- A platform co-signs to attest that the event occurred within its infrastructure.
- _(v0.2.0)_ A simulation provider co-signs a `simulation.delta` event to attest to the accuracy measurement.

### 6.5 Event Ordering

Trust Events carry a `timestamp` and an `event_id`. When `event_id` uses a temporally ordered format (ULID, UUIDv7), receivers MAY use the event ID for ordering. When timestamps conflict, receivers SHOULD prefer the issuer's signed timestamp.

Events are idempotent. Receiving the same `event_id` multiple times MUST be treated as a single event.

### 6.6 Event Linking _(New in v0.2.0)_

Several v0.2.0 event types reference other events via identifier fields (`trace_id`, `simulation_id`, `contract_id`, `bid_id`). These cross-references enable Trust Providers to construct rich event graphs connecting bids to simulations to traces to outcomes.

Event linking is informational, not transactional. A `simulation.delta` event referencing a `simulation_id` and `trace_id` asserts a relationship but does not require atomic consistency between the referenced events. Trust Providers SHOULD validate that referenced events exist before incorporating the linking event into scoring. Missing references SHOULD be logged but MUST NOT cause event rejection.

---

## 7. Protocol Messages

MCP-T defines five protocol messages for trust data exchange. All messages conform to JSON-RPC 2.0, consistent with the Model Context Protocol.

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
    "dimensions": ["performance", "consistency", "behavioral_fidelity"]
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
      "schema_version": "0.2.0",
      "subject_id": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
      "provider_id": "did:web:trustprovider.example.com",
      "score": {
        "composite": 742,
        "dimensions": {
          "performance": { "value": 780, "confidence": 0.72, "evidence_count": 156 },
          "consistency": { "value": 800, "confidence": 0.83, "evidence_count": 892 },
          "behavioral_fidelity": { "value": 870, "confidence": 0.78, "evidence_count": 234 }
        }
      },
      "domain": "code-execution",
      "domain_match": true,
      "validity": {
        "issued_at": "2026-03-23T10:30:00Z",
        "expires_at": "2026-03-23T11:30:00Z",
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
        "commitment": 600,
        "behavioral_fidelity": 750
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
        "commitment": { "required": 600, "met": true },
        "behavioral_fidelity": { "required": 750, "met": true }
      }
    },
    "confidence": 0.78,
    "checked_at": "2026-03-23T10:31:00Z",
    "valid_until": "2026-03-23T11:31:00Z",
    "signature": {
      "algorithm": "Ed25519",
      "public_key": "z6MkrHKy02OJz2FpaMohCstPqHSyBfShVJBaByLktb5GJbKH",
      "value": "8RnKbP8RqG4VWxhFzKm..."
    }
  }
}
```

The response MUST include `verified` (boolean) and SHOULD include individual threshold results. The response MUST NOT include the actual score values -- only whether each threshold was met. This supports privacy-preserving authorization where the consumer learns the binary outcome without learning the exact score.

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
    "event_types": ["contract.completed", "contract.failed", "behavior.trace", "simulation.delta"],
    "after": "2026-01-01T00:00:00Z",
    "before": "2026-03-23T23:59:59Z",
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
        "timestamp": "2026-03-23T09:45:00Z",
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
    "total_count": 1376
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
        "dimensions": ["verification", "tenure", "performance", "commitment", "community", "consistency", "behavioral_fidelity"],
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
      "event_type": "behavior.trace",
      "subject_id": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
      "issuer_id": "did:web:platform.example.com",
      "timestamp": "2026-03-23T12:00:00Z",
      "payload": {
        "trace_id": "trc_01JABC789XYZ",
        "contract_id": "ctr_11111",
        "tool_calls": [],
        "resources_accessed": [],
        "duration_ms": 1200,
        "total_tool_calls": 3,
        "undeclared_tool_calls": 0,
        "total_resources": 2,
        "undeclared_resources": 0,
        "fidelity_ratio": 1.0
      },
      "dimensions_affected": ["behavioral_fidelity", "performance"],
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
  "dimensions": ["verification", "tenure", "performance", "commitment", "community", "consistency", "behavioral_fidelity"],
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
  "granted_at": "2026-03-23T10:00:00Z",
  "expires_at": "2027-03-23T10:00:00Z",
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

**Exception:** `trust/providers` uses HTTP GET with no request body. The response is a JSON-RPC 2.0 response message (Section 7.4.2). When used via the JSON-RPC transport (e.g., MCP's stdio/SSE), `trust/providers` follows the standard JSON-RPC request format (Section 7.4.1). The HTTPS binding uses GET for discoverability -- providers MAY be discovered via simple HTTP GET without requiring a JSON-RPC client.

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
- _(v0.2.0)_ Level 1 implementations that publish behavioral observation events (Section 6.3.6) MUST include the `fidelity_ratio` field in `behavior.trace` events.

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
- _(v0.2.0)_ Level 2 implementations that support contract bidding MUST accept `contract.bid_submitted`, `contract.bid_accepted`, and `contract.bid_rejected` event types.

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
    "checked_at": "2026-03-23T10:31:00Z"
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

### 11.8 Behavioral Trace Privacy _(New in v0.2.0)_

**Threat:** Behavioral traces (Section 6.3.6) contain detailed records of agent execution, potentially revealing proprietary algorithms, trade secrets, or sensitive data access patterns.

**Mitigations:**
- Behavioral traces use hashed arguments (`arguments_hash`) and results (`result_hash`) rather than raw values. Implementers MUST NOT include raw arguments or results in published traces.
- Resource identifiers in traces SHOULD be anonymized where possible (e.g., `file:/data/input-{hash}` rather than full paths).
- Agents MAY opt out of behavioral tracing by not authorizing the trust provider for behavioral observation. However, opting out SHOULD result in reduced `behavioral_fidelity` confidence scores, reflecting the lack of observability.
- Behavioral traces published to public transports (Nostr, IPFS) MUST be encrypted if they contain resource identifiers that could reveal sensitive information.

### 11.9 Simulation Gaming _(New in v0.2.0)_

**Threat:** An agent behaves differently during simulation than during actual execution, gaming the simulation to win bids while delivering inferior results.

**Mitigations:**
- The `simulation.delta` event type (Section 6.3.7) explicitly measures divergence between simulation and reality. Agents with high simulation divergence SHOULD receive reduced `behavioral_fidelity` scores.
- Trust Providers SHOULD track simulation accuracy over time. An agent whose simulations consistently diverge from actual execution is exhibiting deceptive behavior.
- Consumers evaluating bids that include `simulation_id` references SHOULD cross-reference the agent's historical `simulation.delta` scores to assess simulation reliability.
- Simulation providers SHOULD co-sign `simulation.delta` events to attest to the accuracy measurement.

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

### 12.5 Behavioral Trace Minimization _(New in v0.2.0)_

Behavioral traces inherently contain more information than summary trust events. Implementers SHOULD apply data minimization principles:

- Capture the minimum trace detail needed for fidelity scoring. Not every tool call requires full argument hashing.
- Aggregate traces into summary events when real-time granularity is not required.
- Define retention policies for behavioral traces separate from (and shorter than) summary trust event retention.
- Allow Trust Subjects to specify trace granularity preferences in their authorization (Section 8.3).

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

See `schemas/trust-score.json` (updated for v0.2.0 with `behavioral_fidelity` dimension in examples).

### A.2 TrustEvent Schema

See `schemas/trust-event.json` (unchanged from v0.1.0; new event types use the existing extensible payload structure).

### A.3 ThresholdSpec Schema

See `schemas/threshold-spec.json` (unchanged from v0.1.0).

### A.4 BehavioralTrace Schema _(New in v0.2.0)_

See `schemas/behavioral-trace.json`.

### A.5 SimulationResult Schema _(New in v0.2.0)_

See `schemas/simulation-result.json`.

---

## Appendix B: Example Flows

### B.1 MCP Client Checks Agent Trust Before Tool Access

```
MCP Client                    Trust Provider
    |                              |
    |  trust/verify                |
    |  subject: agent-did          |
    |  domain: code-execution      |
    |  threshold: composite >= 600 |
    |              bf >= 700       |
    |----------------------------->|
    |                              |
    |  result: verified=true       |
    |  confidence: 0.78            |
    |<-----------------------------|
    |                              |
    |  [Grant tool access]         |
    |                              |
```

### B.2 Platform Reports Contract Completion with Behavioral Trace _(Updated in v0.2.0)_

```
Platform                      Trust Provider
    |                              |
    |  trust/publish               |
    |  event_type:                 |
    |    behavior.trace            |
    |  payload: {                  |
    |    trace_id, tool_calls,     |
    |    fidelity_ratio: 0.95      |
    |  }                           |
    |----------------------------->|
    |                              |
    |  result: accepted=true       |
    |<-----------------------------|
    |                              |
    |  trust/publish               |
    |  event_type:                 |
    |    contract.completed        |
    |  payload: {outcome: success} |
    |----------------------------->|
    |                              |
    |  result: accepted=true       |
    |<-----------------------------|
    |                              |
    |       [Provider recomputes score including
    |        behavioral_fidelity dimension]
    |                              |
```

### B.3 Agent Bids on Contract with Simulation Evidence _(New in v0.2.0)_

```
Agent                   Simulator          Contract Issuer       Trust Provider
  |                        |                     |                     |
  |  [Run simulation       |                     |                     |
  |   against task spec]   |                     |                     |
  |----------------------->|                     |                     |
  |                        |                     |                     |
  |  simulation.result     |                     |                     |
  |  predicted: success    |                     |                     |
  |  confidence: 0.87      |                     |                     |
  |<-----------------------|                     |                     |
  |                        |                     |                     |
  |  trust/publish(simulation.executed)          |                     |
  |------------------------------------------------------------->     |
  |  trust/publish(simulation.result)            |                     |
  |------------------------------------------------------------->     |
  |                        |                     |                     |
  |  contract.bid_submitted                      |                     |
  |  bid_amount: 50000 sats                      |                     |
  |  simulation_id: sim_01...                    |                     |
  |----------------------------------------->    |                     |
  |                        |                     |                     |
  |                        |   [Issuer evaluates bid:]                 |
  |                        |   1. trust/query for agent score          |
  |                        |      -------------------------------->    |
  |                        |      <--------------------------------    |
  |                        |   2. trust/history for simulation.delta   |
  |                        |      (past simulation accuracy)           |
  |                        |      -------------------------------->    |
  |                        |      <--------------------------------    |
  |                        |   3. Review simulation.result             |
  |                        |   4. Compare bid amount + trust + sim     |
  |                        |                     |                     |
  |  contract.bid_accepted                       |                     |
  |  criteria: best_simulation                   |                     |
  |<-----------------------------------------    |                     |
  |                        |                     |                     |
  |  [Agent executes contract]                   |                     |
  |                        |                     |                     |
  |  [Platform publishes behavior.trace          |                     |
  |   and contract.completed]                    |                     |
  |                        |                     |                     |
  |  [Provider computes simulation.delta         |                     |
  |   comparing sim prediction to actual trace]  |                     |
  |                        |                     |                     |
```

### B.4 Multi-Provider Trust Decision

```
MCP Client              Provider A          Provider B
    |                       |                    |
    |  trust/query          |                    |
    |  subject: agent-did   |                    |
    |---------------------->|                    |
    |                       |                    |
    |  trust/query          |                    |
    |  subject: agent-did   |                    |
    |----------------------------------------------->
    |                       |                    |
    |  score: 742           |                    |
    |<----------------------|                    |
    |                       |                    |
    |  score: 680           |                    |
    |<-----------------------------------------------|
    |                       |                    |
    |  [Apply local         |                    |
    |   aggregation policy: |                    |
    |   min(742,680)=680]   |                    |
    |                       |                    |
```

### B.5 Zero-Knowledge Trust Proof

```
Agent                      Trust Provider            MCP Server
    |                           |                        |
    |  [Agent wants access to   |                        |
    |   sensitive tool server]  |                        |
    |                           |                        |
    |  trust/verify             |                        |
    |  proof_request: {         |                        |
    |    type: zero_knowledge,  |                        |
    |    hide_score: true       |                        |
    |  }                        |                        |
    |-------------------------->|                        |
    |                           |                        |
    |  result: {                |                        |
    |    verified: true,        |                        |
    |    proof: {groth16...}    |                        |
    |  }                        |                        |
    |<--------------------------|                        |
    |                           |                        |
    |  [Present ZK proof to MCP Server]                  |
    |----------------------------------------------->    |
    |                           |                        |
    |  [Server verifies proof   |                        |
    |   without learning score] |                        |
    |                           |                        |
    |  [Access granted]         |                        |
    |<-----------------------------------------------|   |
    |                           |                        |
```

---

## Appendix C: Scoring Methodology Guidance _(New in v0.2.0)_

This appendix provides non-normative guidance on scoring methodologies for Trust Providers. MCP-T is implementation-agnostic (Section 1.2), and providers are free to use any scoring approach. This guidance documents patterns that have proven effective in production trust systems.

### C.1 Two-Tier Scoring Architecture

A RECOMMENDED pattern for Trust Providers that score behavioral dimensions (particularly `behavioral_fidelity`) is a two-tier architecture separating structural analysis from contextual interpretation:

```
    Trust Events (behavioral traces, contract outcomes, endorsements)
                            |
                            v
              +---------------------------+
              |    STRUCTURAL PASS        |
              |    (fast, deterministic)  |
              |                           |
              |  - Graph traversal of     |
              |    endorsement chains     |
              |  - Behavioral trace       |
              |    pattern matching       |
              |  - Fidelity ratio         |
              |    aggregation            |
              |  - Anomaly detection      |
              |    via statistical        |
              |    methods                |
              |  - Simulation delta       |
              |    trend analysis         |
              +---------------------------+
                            |
                    Flagged patterns,
                    structural scores,
                    anomaly candidates
                            |
                            v
              +---------------------------+
              |    CONTEXTUAL PASS        |
              |    (slower, interpretive) |
              |                           |
              |  - Interpret flagged      |
              |    patterns in domain     |
              |    context                |
              |  - Generate human-        |
              |    readable explanations  |
              |  - Assess severity of     |
              |    anomalies              |
              |  - Cross-reference        |
              |    behavioral deltas      |
              |    with declared          |
              |    capabilities           |
              |  - Weight implicit        |
              |    invariant violations   |
              +---------------------------+
                            |
                    Final dimensional scores,
                    confidence values,
                    scoring rationale
                            |
                            v
                   Published Trust Score
```

**Rationale:** Single-pass scoring (running one model or algorithm over all trust events) tends to either miss structural patterns that emerge from graph relationships (if the model is purely statistical) or miss contextual nuance (if the algorithm is purely structural). The two-tier approach uses each method where it excels:

- The **structural pass** is fast, deterministic, and scales to large event volumes. It identifies _what_ happened without interpreting _why_. It computes fidelity ratios, detects statistical anomalies, traverses endorsement graphs, and identifies divergence trends in simulation deltas. This pass produces candidate signals and preliminary scores.

- The **contextual pass** is slower and probabilistic but provides interpretive depth. It takes the structural pass output and evaluates whether flagged patterns are genuinely concerning or benign in context. For example, an undeclared network call might be a fidelity violation (agent accessing an API it did not declare) or a legitimate dependency resolution (agent fetching a required library). The contextual pass distinguishes these cases.

**Implementation guidance:**
- The structural pass SHOULD be implemented as a deterministic pipeline (graph algorithms, statistical aggregation, threshold checks). It SHOULD NOT use non-deterministic models.
- The contextual pass MAY use language models, domain-specific heuristics, or human reviewers. It SHOULD be triggered only for events or patterns flagged by the structural pass, not run on every event.
- The two passes SHOULD be independently auditable. A Trust Consumer querying `trust/history` SHOULD be able to see which pass produced which scoring inputs.

### C.2 Behavioral Fidelity Scoring Patterns

When computing the `behavioral_fidelity` dimension, providers SHOULD consider the following patterns:

**Fidelity ratio as baseline.** The `fidelity_ratio` field in `behavior.trace` events provides a straightforward starting signal: what percentage of an agent's actions were within its declared scope? Providers SHOULD compute a running average of fidelity ratios weighted by recency.

**Invariant stability.** When `behavior.invariant_discovered` events identify implicit patterns, subsequent violations of those patterns (detected via `behavior.declaration_delta` or future traces) SHOULD reduce the behavioral fidelity score. Stable invariants that persist across many observations carry more weight than recently discovered ones.

**Simulation accuracy as trust multiplier.** When `simulation.delta` events exist, the divergence score SHOULD act as a multiplier on behavioral fidelity. An agent with low simulation divergence (its predictions match its behavior) is demonstrating predictability and self-awareness. An agent with high simulation divergence (its predictions consistently miss) is either unable to predict its own behavior or actively gaming simulations.

**Temporal decay.** Behavioral observations decay in relevance over time. A fidelity violation from six months ago is less relevant than one from yesterday. Providers SHOULD apply temporal decay to behavioral evidence, with the decay rate documented in the `scoring_methodology_uri`.

### C.3 Event Correlation for Composite Scoring

Trust events do not exist in isolation. The event linking mechanism (Section 6.6) enables providers to construct event graphs that reveal compound trust signals:

- A `contract.bid_submitted` with `simulation_id` links to a `simulation.result` which links to a `simulation.executed`. After contract execution, a `behavior.trace` links to the contract, and a `simulation.delta` links the trace back to the simulation. This chain provides a complete lifecycle: prediction, bid, execution, verification.

- Providers SHOULD weight complete lifecycle chains more heavily than isolated events. An agent with many completed bid-execute-verify cycles and consistently low simulation divergence provides stronger trust evidence than an agent with equivalent individual event counts but no cross-referencing.

---

## Changelog

### v0.2.0-draft (2026-03-23)

**New Trust Dimension:**
- Added `behavioral_fidelity` as the tenth default dimension (Section 5.1.10). Measures the delta between declared and observed agent behavior. Distinct from `consistency` (stability over time) and `performance` (task completion quality). Behavioral fidelity measures _honesty_.

**New Behavioral Observation Events (Section 6.3.6):**
- `behavior.trace` -- Structured runtime behavioral record including tool calls, resource access, side effects, and fidelity ratio.
- `behavior.invariant_discovered` -- Implicit behavioral pattern detected through observation.
- `behavior.declaration_delta` -- Divergence between declared and observed behavior.
- `behavior.resource_access` -- Observed resource access pattern with authorization status.

**New Simulation Events (Section 6.3.7):**
- `simulation.executed` -- Pre-execution simulation completed.
- `simulation.result` -- Predicted outcome of a simulation, including risk flags.
- `simulation.delta` -- Measured divergence between simulation prediction and actual execution.

**New Bid Events (Section 6.3.8):**
- `contract.bid_submitted` -- Agent bid on a contract, optionally referencing simulation evidence.
- `contract.bid_accepted` -- Bid accepted by contract issuer.
- `contract.bid_rejected` -- Bid rejected with reason.

**New Appendix C: Scoring Methodology Guidance:**
- Two-tier scoring architecture (structural pass + contextual pass) as RECOMMENDED pattern.
- Behavioral fidelity scoring patterns: fidelity ratio baseline, invariant stability, simulation accuracy as trust multiplier, temporal decay.
- Event correlation guidance for composite scoring using event linking.

**New Section 6.6: Event Linking:**
- Formalized cross-reference mechanism between events via `trace_id`, `simulation_id`, `contract_id`, `bid_id`.

**Security Considerations (Sections 11.8, 11.9):**
- Behavioral trace privacy: hashed arguments, anonymized identifiers, opt-out with reduced confidence.
- Simulation gaming: detection via `simulation.delta` tracking, historical accuracy cross-referencing.

**Privacy Considerations (Section 12.5):**
- Behavioral trace minimization: data minimization principles, aggregation, retention policies, subject-controlled granularity.

**Updated Conformance Levels:**
- Level 1: Added requirement for `fidelity_ratio` in `behavior.trace` events.
- Level 2: Added requirement to accept bid event types for implementations supporting contract bidding.

**Backward Compatibility:**
- All v0.1.0 structures, dimensions, event types, protocol methods, and conformance levels are unchanged.
- v0.2.0 is purely additive. v0.1.0 implementations can ignore new event types and the `behavioral_fidelity` dimension without breaking.

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
