# MCP-T: Trust Extension for the Model Context Protocol

**MCP-T adds trust scoring to the Model Context Protocol (MCP) stack.** It complements [MCP](https://spec.modelcontextprotocol.io/) (tools) and [MCP-I](https://github.com/MCP-Identity/mcp-i-core) (identity) to provide the missing accountability layer for AI agents.

```
MCP   = How agents use tools
MCP-I = Who the agent is
MCP-T = Should you trust it
```

## The Problem

AI agents can connect to 10,000+ tools via MCP. None of those tools have trust scores. An agent's demonstrated trustworthiness on one platform carries no weight on another. Platforms must independently solve trust evaluation — or skip it entirely.

The result: [824 malicious skills](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/) on ClawHub. [41% of MCP servers lack authentication](https://astrix.security/learn/blog/state-of-mcp-server-security-2025/). Trust is the missing infrastructure layer.

## What MCP-T Defines

1. **Trust Score Schema** — Nine default dimensions across economic, behavioral, security, and governance domains. 0-1000 range, confidence metadata, domain scoping, temporal validity. Implementations score at least two; custom dimensions extend via reverse-DNS namespacing.

   | Dimension | What It Measures |
   |-----------|-----------------|
   | `verification` | Identity and credential verification |
   | `tenure` | Operational history and continuity |
   | `performance` | Task completion and service quality |
   | `commitment` | Economic, reputational, or organizational stake |
   | `community` | Endorsements from other trusted entities |
   | `consistency` | Behavioral stability and predictability |
   | `transparency` | Openness to inspection and audit |
   | `compliance` | Regulatory and policy adherence |
   | `security` | Vulnerability posture and incident response |

2. **Query Protocol** — Five JSON-RPC 2.0 methods aligned with MCP:
   - `trust/query` — Full trust score retrieval
   - `trust/verify` — Binary threshold check ("is this agent trusted enough?")
   - `trust/history` — Audit trail of trust events
   - `trust/providers` — Discover available trust providers
   - `trust/publish` — Report trust-relevant observations

3. **Trust Event Format** — Signed, timestamped records of trust-relevant observations (contract completions, security incidents, behavioral anomalies). Transport-agnostic.

4. **Trust Provider Interface** — Registration, discovery, authorization, and multi-provider aggregation.

5. **Conformance Levels** — Incremental adoption from read-only queries to zero-knowledge trust proofs:
   - **Level 0**: Read-only (query scores)
   - **Level 1**: Basic (query + publish events)
   - **Level 2**: Economic (staking, slashing, escrow)
   - **Level 3**: Zero-knowledge (prove trust without revealing score)

## Quick Start

**Check if an agent is trustworthy (Level 0):**

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "trust/verify",
  "params": {
    "subject_id": "did:key:z6Mk...",
    "domain": "code-execution",
    "threshold": {
      "composite_min": 600
    }
  }
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "verified": true,
    "confidence": 0.85,
    "checked_at": "2026-03-15T10:31:00Z"
  }
}
```

## Transport Bindings

MCP-T is transport-agnostic. The spec defines bindings for:

| Transport | Use Case | Spec Section |
|-----------|----------|-------------|
| **HTTPS** | Standard REST endpoints | 9.1 |
| **Nostr** | Decentralized, censorship-resistant | 9.2 |
| **IPFS** | Archival, content-addressed | 9.3 |
| **SSE** | Real-time score streaming | 9.4 |

## Design Principles

- **Implementation-agnostic** — Defines the format, not the algorithm. Any scoring methodology is valid.
- **Composable** — Works alongside MCP and MCP-I. Not required, but stronger together.
- **Portable** — Trust data flows through any transport. No vendor lock-in.
- **Privacy-aware** — Supports zero-knowledge trust proofs (Level 3).
- **Extensible** — Nine default dimensions plus unlimited custom dimensions via reverse-DNS namespacing.

## Specification

The full specification is at [`spec/mcp-t-v0.1.0.md`](spec/mcp-t-v0.1.0.md).

JSON schemas for all data structures are in [`schemas/`](schemas/).

## Implementations

| Implementation | Conformance Level | Language | Status |
|---------------|-------------------|----------|--------|
| [Vouch Protocol](https://percival-labs.ai/vouch) (Percival Labs) | Level 2 (Economic) | TypeScript | Reference |

*Add yours via PR.*

## Contributing

MCP-T is an open specification. Contributions are welcome.

- **Spec changes**: Open an issue or PR against `spec/mcp-t-v0.1.0.md`
- **New transport bindings**: Propose in a GitHub issue
- **New default dimensions**: Propose via RFC issue
- **Implementations**: Add to the table above via PR

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Standards Track

MCP-T is being submitted to the [Decentralized Identity Foundation (DIF)](https://identity.foundation/) for standardization alongside MCP-I.

## Origin

MCP-T was initially authored by Alan Carroll ([Percival Labs](https://percival-labs.ai)) based on the trust scoring architecture developed for the [Vouch Protocol](https://percival-labs.ai/vouch). The specification is designed to be implementation-agnostic and is offered to the community under CC-BY-4.0 for open development.

## License

Specification: [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/)

Implementation licenses are independent of the specification license.
