# MCP-T + Universal Commerce Protocol (UCP) Integration Guide

**Version:** 1.0
**Date:** 2026-03-24
**MCP-T Version:** 0.2.0
**UCP Reference:** [shopify.engineering/ucp](https://shopify.engineering/ucp)

---

## Overview

The Universal Commerce Protocol (UCP), co-developed by Shopify and Google, enables AI agents to discover merchants, negotiate capabilities, and complete purchase transactions. UCP supports MCP as one of its transport options and uses reverse-domain namespacing for extensions.

MCP-T provides the trust layer that UCP's architecture deliberately omits. UCP solves *capability* ("can this agent check out?"). MCP-T solves *trust* ("should this agent be allowed to check out?").

```
Agent (ChatGPT, Copilot, Gemini, custom)
    |
    v
UCP Capability Negotiation (/.well-known/ucp)
    |
    +-- MCP-T trust/verify
    |   "Does this agent meet my trust threshold?"
    |
    v
Merchant MCP Server (Storefront, Cart, Checkout)
    |
    v
Transaction Complete
```

Together, UCP + MCP-T give merchants two independent control surfaces:
- **UCP**: What can agents do? (capability negotiation)
- **MCP-T**: Which agents can do it? (trust verification)

---

## Why UCP Needs Trust Scoring

UCP uses namespace binding for security: agents and merchants identify each other via reverse-domain namespacing. This verifies *identity* but does not evaluate *reputation*.

Consider a merchant receiving requests from two agents:

| Agent | UCP Identity | Capability Match | Trust Score |
|-------|-------------|-----------------|-------------|
| Agent A | `com.reputable-ai.shopper` | Full checkout | 820 (verified, 200+ transactions, 0.97 fidelity ratio) |
| Agent B | `com.unknown-startup.buyer` | Full checkout | 190 (unverified, 2 transactions, 0.41 fidelity ratio) |

Without MCP-T, the merchant sees two identical capability-matched agents. With MCP-T, the merchant can set a threshold: "Only agents with composite >= 600 and behavioral_fidelity >= 700 can proceed to checkout without human escalation."

This maps directly to UCP's existing `requires_escalation` checkout state. Low-trust agents trigger escalation. High-trust agents proceed autonomously.

---

## Integration Architecture

### 1. Merchant-Side: Trust Requirements in UCP Profile

Merchants publish their UCP capability profile at `/.well-known/ucp`. MCP-T trust requirements are added as an extension using UCP's reverse-domain namespace mechanism:

```json
{
  "merchant": {
    "id": "merchant.example.com",
    "name": "Example Store",
    "capabilities": {
      "checkout": true,
      "returns": true,
      "subscriptions": false
    },
    "extensions": {
      "ai.percival-labs.mcp-t": {
        "required": true,
        "trust_provider": "did:web:percival-labs.ai",
        "trust_endpoint": "https://percivalvouch-api-production.up.railway.app/mcp-t/v1",
        "thresholds": {
          "browse": {
            "composite_min": 0,
            "description": "Any agent can browse products"
          },
          "add_to_cart": {
            "composite_min": 300,
            "description": "Minimum trust to add items to cart"
          },
          "checkout": {
            "composite_min": 600,
            "dimension_mins": {
              "verification": 500,
              "behavioral_fidelity": 700
            },
            "description": "Trust threshold for autonomous checkout"
          },
          "checkout_high_value": {
            "composite_min": 800,
            "dimension_mins": {
              "verification": 800,
              "commitment": 600,
              "behavioral_fidelity": 800
            },
            "description": "High-value orders (>$500) require elevated trust"
          }
        },
        "escalation_policy": "agents_below_threshold_require_human_approval"
      }
    }
  }
}
```

### 2. Agent-Side: Trust Verification During Negotiation

When an agent discovers a merchant via UCP and sees the `ai.percival-labs.mcp-t` extension, it performs a trust verification before proceeding:

```
Agent                        Trust Provider              Merchant
  |                               |                         |
  |  GET /.well-known/ucp         |                         |
  |-------------------------------------------------->      |
  |                               |                         |
  |  UCP profile with MCP-T       |                         |
  |  extension + thresholds       |                         |
  |<--------------------------------------------------      |
  |                               |                         |
  |  [Agent reads thresholds      |                         |
  |   for desired action]         |                         |
  |                               |                         |
  |  trust/verify                 |                         |
  |  subject_id: <agent DID>      |                         |
  |  domain: "financial"          |                         |
  |  threshold: checkout          |                         |
  |------------------------------>|                         |
  |                               |                         |
  |  verified: true               |                         |
  |  confidence: 0.87             |                         |
  |<------------------------------|                         |
  |                               |                         |
  |  [Proceed with checkout,      |                         |
  |   include trust proof]        |                         |
  |-------------------------------------------------->      |
  |                               |                         |
  |  [Merchant validates proof    |                         |
  |   or queries provider]        |                         |
  |                               |                         |
```

### 3. Merchant-Side: Trust Verification at Checkout

Merchants that want to verify trust server-side (recommended) query the trust provider directly during checkout:

```json
{
  "jsonrpc": "2.0",
  "id": "checkout-verify-001",
  "method": "trust/verify",
  "params": {
    "subject_id": "did:key:z6Mk...",
    "domain": "financial",
    "threshold": {
      "composite_min": 600,
      "dimension_mins": {
        "verification": 500,
        "behavioral_fidelity": 700
      },
      "confidence_min": 0.5,
      "min_evidence_count": 10
    },
    "nonce": "checkout-session-abc123"
  }
}
```

The nonce ties the verification to the specific checkout session, preventing replay.

---

## Trust-Tiered Commerce Flows

MCP-T enables graduated autonomy based on trust, matching UCP's existing state machine:

### Browse (No Trust Required)
```
Agent → Merchant Storefront MCP → Product Discovery
```
No trust check. Any agent can browse. This maximizes discovery and conversion.

### Cart Operations (Low Trust)
```
Agent → trust/verify (composite >= 300) → Cart MCP → Add/Remove Items
```
Basic verification prevents cart abuse (inventory manipulation, denial-of-service through mass cart holds).

### Standard Checkout (Medium Trust)
```
Agent → trust/verify (composite >= 600, bf >= 700) → Checkout MCP → Payment
```
Agents with demonstrated performance and behavioral fidelity can complete transactions autonomously. The `behavioral_fidelity` threshold ensures the agent actually does what it claims during checkout (no scope creep, no undeclared data access).

### High-Value Checkout (High Trust)
```
Agent → trust/verify (composite >= 800, commitment >= 600) → Checkout MCP → Payment
```
Large orders require agents with economic stake (commitment dimension). This means the agent or its operator has skin in the game. Failed transactions impact the agent's trust score and may trigger economic slashing.

### Escalation (Below Threshold)
```
Agent → trust/verify (verified: false) → UCP requires_escalation → Human Approval
```
Agents that don't meet the threshold aren't blocked. They're escalated to human approval via UCP's existing `requires_escalation` state. The merchant decides whether to proceed manually.

---

## Behavioral Fidelity in Commerce (v0.2.0)

MCP-T v0.2.0's `behavioral_fidelity` dimension is particularly relevant for agentic commerce:

**What it catches:**
- An agent that declares it only reads product data but also sends data to undeclared endpoints
- An agent that claims to compare prices but actually directs users to a specific merchant
- An agent that accesses payment information beyond what's needed for checkout
- Scope creep: an agent authorized for "browse and compare" that attempts checkout

**How it works in UCP context:**

1. The merchant's Storefront MCP Server publishes what tools are available (product search, cart operations, checkout).
2. The agent declares which tools it will use during UCP capability negotiation.
3. During execution, behavioral traces capture what tools the agent actually invoked and what resources it accessed.
4. The `fidelity_ratio` (declared actions / total actions) feeds the behavioral_fidelity score.
5. Agents with consistently high fidelity earn higher trust. Agents that exceed their declared scope get flagged.

**Example behavioral trace from a commerce interaction:**

```json
{
  "event_type": "behavior.trace",
  "payload": {
    "trace_id": "trc_checkout_001",
    "contract_id": "order_12345",
    "tool_calls": [
      { "tool_name": "product_search", "declared": true, "duration_ms": 120 },
      { "tool_name": "cart_add", "declared": true, "duration_ms": 45 },
      { "tool_name": "checkout_create", "declared": true, "duration_ms": 200 },
      { "tool_name": "customer_data_read", "declared": false, "duration_ms": 30 }
    ],
    "resources_accessed": [
      { "resource_type": "api", "resource_id": "storefront/products", "access_type": "read", "declared": true },
      { "resource_type": "api", "resource_id": "storefront/cart", "access_type": "write", "declared": true },
      { "resource_type": "api", "resource_id": "customer/addresses", "access_type": "read", "declared": false }
    ],
    "total_tool_calls": 4,
    "undeclared_tool_calls": 1,
    "total_resources": 3,
    "undeclared_resources": 1,
    "fidelity_ratio": 0.67,
    "duration_ms": 395
  }
}
```

This trace shows an agent that accessed customer address data without declaring it. The fidelity ratio drops to 0.67. Over time, this pattern reduces the agent's behavioral_fidelity score, making it harder to pass checkout trust thresholds.

---

## Simulation as Bid Evidence in Commerce

MCP-T v0.2.0 simulation events enable agents to demonstrate capability before being trusted with real transactions:

**Use case:** A new agent with no transaction history wants to operate on a merchant's store. Instead of starting with zero trust, the agent runs a simulation of a checkout flow and submits the results:

```json
{
  "event_type": "simulation.result",
  "payload": {
    "simulation_id": "sim_commerce_001",
    "predicted_outcome": "success",
    "confidence": 0.91,
    "predicted_tool_calls": ["product_search", "cart_add", "checkout_create"],
    "predicted_resources": ["storefront/products", "storefront/cart", "checkout/sessions"],
    "predicted_side_effects": [],
    "risk_flags": [],
    "comparable_task_count": 0
  }
}
```

After the agent completes real transactions, `simulation.delta` events measure how well predictions matched reality. Accurate simulators earn trust faster.

This creates a bootstrapping path for new agents: simulate first, build trust incrementally, reach autonomous checkout thresholds.

---

## Implementation for Shopify App Developers

### Adding MCP-T to a Shopify Storefront MCP Server

Shopify app developers building Storefront MCP Servers can add MCP-T trust verification with minimal code:

**1. Announce trust capability during MCP initialize:**

```json
{
  "capabilities": {
    "trust": {
      "conformance_level": 0,
      "provider_id": "did:web:percival-labs.ai",
      "supported_methods": ["trust/query", "trust/verify"]
    }
  }
}
```

**2. Check trust before sensitive operations:**

```typescript
// Before processing checkout
const trustResult = await fetch('https://percivalvouch-api-production.up.railway.app/mcp-t/v1/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: `verify-${sessionId}`,
    method: 'trust/verify',
    params: {
      subject_id: agentDid,
      domain: 'financial',
      threshold: {
        composite_min: 600,
        dimension_mins: { behavioral_fidelity: 700 }
      },
      nonce: sessionId
    }
  })
});

const { result } = await trustResult.json();

if (!result.verified) {
  // Trigger UCP escalation state
  return { status: 'requires_escalation', reason: 'trust_threshold_not_met' };
}

// Proceed with checkout
```

**3. Report outcomes after transaction:**

```typescript
// After successful order completion
await fetch('https://percivalvouch-api-production.up.railway.app/mcp-t/v1/publish', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Nostr ${nostrAuthEvent}`
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: `publish-${orderId}`,
    method: 'trust/publish',
    params: {
      event: {
        event_id: `evt_order_${orderId}`,
        event_type: 'contract.completed',
        subject_id: agentDid,
        issuer_id: merchantDid,
        timestamp: new Date().toISOString(),
        payload: {
          contract_id: orderId,
          outcome: 'success',
          duration_seconds: checkoutDurationSecs
        },
        dimensions_affected: ['performance', 'consistency'],
        signature: { algorithm: 'Ed25519', public_key: merchantPubkey, value: sig }
      }
    }
  })
});
```

This creates a feedback loop: successful transactions improve the agent's trust score, enabling more autonomous commerce.

---

## Domain Scoping for Commerce

MCP-T domain scopes map to commerce activities:

| MCP-T Domain | Commerce Activity | Recommended Threshold |
|---|---|---|
| `general` | Product browsing, search | None (open access) |
| `data-access` | Customer data, order history | composite >= 500, verification >= 600 |
| `financial` | Checkout, payment processing | composite >= 600, behavioral_fidelity >= 700 |
| `communication` | Order notifications, support messages | composite >= 400 |

Merchants can define custom domains using reverse-DNS:

```json
{
  "com.example-store.high-value-checkout": {
    "composite_min": 800,
    "dimension_mins": {
      "verification": 800,
      "commitment": 600,
      "behavioral_fidelity": 800
    }
  }
}
```

---

## Compatibility Notes

**UCP versions:** This integration guide targets UCP as specified in the Shopify Engineering blog post (January 2026). UCP is evolving; future versions may include native trust extension points.

**MCP-T versions:** All examples use MCP-T v0.2.0. The behavioral_fidelity dimension, simulation events, and behavioral traces are v0.2.0 features. Implementations using MCP-T v0.1.0 can use the same integration pattern with the original 9 dimensions.

**Transport:** The examples use the HTTPS transport binding. Merchants and agents operating on Nostr can use the Nostr transport binding (MCP-T Section 9.2) for decentralized trust score publication.

**Authentication:** Read operations (trust/query, trust/verify) are public and require no authentication. Write operations (trust/publish) require NIP-98 Nostr authentication to prevent event spoofing.

---

## References

- [MCP-T v0.2.0 Specification](../../spec/mcp-t-v0.2.0.md)
- [MCP-T v0.1.0 Specification](../../spec/mcp-t-v0.1.0.md)
- [Universal Commerce Protocol (Shopify Engineering)](https://shopify.engineering/ucp)
- [UCP Technical Details (Google Developers)](https://developers.googleblog.com/under-the-hood-universal-commerce-protocol-ucp/)
- [About Storefront MCP (Shopify Dev)](https://shopify.dev/docs/apps/build/storefront-mcp)
- [Shopify Agentic Commerce Platform](https://www.shopify.com/news/ai-commerce-at-scale)
- [Building Trust in Agentic Commerce (Liminal)](https://liminal.co/articles/buildng-trust-in-agentic-commerce/)
- [Agentic Trust Framework (CSA)](https://cloudsecurityalliance.org/blog/2026/02/02/the-agentic-trust-framework-zero-trust-governance-for-ai-agents)

---

*This integration guide is released under CC-BY-4.0 alongside the MCP-T specification.*
