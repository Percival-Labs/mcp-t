/**
 * MCP-T + UCP Integration Example
 *
 * Demonstrates how a Shopify Storefront MCP Server uses MCP-T
 * to verify agent trust before allowing checkout.
 *
 * This is a complete, runnable example using the HTTPS transport binding.
 */

const MCPT_ENDPOINT = 'https://percivalvouch-api-production.up.railway.app/mcp-t/v1';

// ── Types ──

interface UcpMerchantProfile {
  merchant: {
    id: string;
    capabilities: Record<string, boolean>;
    extensions: {
      'ai.percival-labs.mcp-t'?: {
        required: boolean;
        trust_provider: string;
        trust_endpoint: string;
        thresholds: Record<string, {
          composite_min: number;
          dimension_mins?: Record<string, number>;
          confidence_min?: number;
          min_evidence_count?: number;
          description: string;
        }>;
        escalation_policy: string;
      };
    };
  };
}

interface TrustVerifyResult {
  verified: boolean;
  subject_id: string;
  provider_id: string;
  nonce?: string;
  threshold_results: Record<string, unknown>;
  confidence: number;
  checked_at: string;
  valid_until: string;
}

// ── Helper: Verify agent trust against merchant's MCP-T threshold ──

async function verifyAgentTrust(
  agentDid: string,
  action: string,
  merchantProfile: UcpMerchantProfile,
  sessionId: string,
): Promise<{ allowed: boolean; escalate: boolean; result?: TrustVerifyResult }> {
  const mcptConfig = merchantProfile.merchant.extensions['ai.percival-labs.mcp-t'];

  // If merchant doesn't require MCP-T, allow all actions
  if (!mcptConfig?.required) {
    return { allowed: true, escalate: false };
  }

  const threshold = mcptConfig.thresholds[action];

  // If no threshold defined for this action, allow by default
  if (!threshold) {
    return { allowed: true, escalate: false };
  }

  // If threshold is 0, no verification needed
  if (threshold.composite_min === 0 && !threshold.dimension_mins) {
    return { allowed: true, escalate: false };
  }

  // Query MCP-T trust provider
  const response = await fetch(`${mcptConfig.trust_endpoint}/verify`, {
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
          composite_min: threshold.composite_min,
          dimension_mins: threshold.dimension_mins,
          confidence_min: threshold.confidence_min,
          min_evidence_count: threshold.min_evidence_count,
        },
        nonce: sessionId,
      },
    }),
  });

  const { result, error } = await response.json();

  if (error) {
    // Trust provider unavailable -- escalate to human
    console.warn(`[mcp-t] Trust verification failed: ${error.message}`);
    return { allowed: false, escalate: true };
  }

  if (result.verified) {
    return { allowed: true, escalate: false, result };
  }

  // Agent below threshold -- apply escalation policy
  if (mcptConfig.escalation_policy === 'agents_below_threshold_require_human_approval') {
    return { allowed: false, escalate: true, result };
  }

  return { allowed: false, escalate: false, result };
}

// ── Helper: Report transaction outcome to MCP-T ──

async function reportTransactionOutcome(
  agentDid: string,
  orderId: string,
  outcome: 'success' | 'failure',
  durationSeconds: number,
  nostrAuthHeader: string,
): Promise<void> {
  await fetch(`${MCPT_ENDPOINT}/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': nostrAuthHeader,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: `publish-${orderId}`,
      method: 'trust/publish',
      params: {
        event: {
          event_id: `evt_order_${orderId}_${Date.now()}`,
          event_type: outcome === 'success' ? 'contract.completed' : 'contract.failed',
          subject_id: agentDid,
          issuer_id: 'did:web:merchant.example.com',
          timestamp: new Date().toISOString(),
          payload: {
            contract_id: orderId,
            outcome,
            duration_seconds: durationSeconds,
          },
          dimensions_affected: ['performance', 'consistency'],
          signature: {
            algorithm: 'Ed25519',
            public_key: 'merchant-key-placeholder',
            value: 'signature-placeholder',
          },
        },
      },
    }),
  });
}

// ── Example: Full Commerce Flow ──

async function exampleCommerceFlow() {
  const agentDid = 'did:key:z6MkExampleShoppingAgent';
  const sessionId = `session_${Date.now()}`;

  // 1. Agent discovers merchant via UCP
  const merchantProfile: UcpMerchantProfile = {
    merchant: {
      id: 'merchant.example.com',
      capabilities: {
        checkout: true,
        returns: true,
        subscriptions: false,
      },
      extensions: {
        'ai.percival-labs.mcp-t': {
          required: true,
          trust_provider: 'did:web:percival-labs.ai',
          trust_endpoint: MCPT_ENDPOINT,
          thresholds: {
            browse: { composite_min: 0, description: 'Any agent can browse' },
            add_to_cart: { composite_min: 300, description: 'Minimum trust for cart' },
            checkout: {
              composite_min: 600,
              dimension_mins: { verification: 500, behavioral_fidelity: 700 },
              description: 'Autonomous checkout',
            },
          },
          escalation_policy: 'agents_below_threshold_require_human_approval',
        },
      },
    },
  };

  // 2. Agent browses (no trust check needed)
  console.log('Browsing products...');
  const browseCheck = await verifyAgentTrust(agentDid, 'browse', merchantProfile, sessionId);
  console.log(`Browse allowed: ${browseCheck.allowed}`);

  // 3. Agent adds to cart (low trust threshold)
  console.log('Adding to cart...');
  const cartCheck = await verifyAgentTrust(agentDid, 'add_to_cart', merchantProfile, sessionId);
  console.log(`Cart allowed: ${cartCheck.allowed}, escalate: ${cartCheck.escalate}`);

  if (!cartCheck.allowed && cartCheck.escalate) {
    console.log('Cart operation requires human approval');
    return;
  }

  // 4. Agent attempts checkout (medium trust threshold)
  console.log('Attempting checkout...');
  const checkoutCheck = await verifyAgentTrust(agentDid, 'checkout', merchantProfile, sessionId);
  console.log(`Checkout allowed: ${checkoutCheck.allowed}, escalate: ${checkoutCheck.escalate}`);
  if (checkoutCheck.result) {
    console.log(`Trust confidence: ${checkoutCheck.result.confidence}`);
  }

  if (!checkoutCheck.allowed && checkoutCheck.escalate) {
    console.log('Checkout requires human approval (UCP requires_escalation state)');
    return;
  }

  if (!checkoutCheck.allowed) {
    console.log('Checkout denied');
    return;
  }

  // 5. Checkout succeeds, report outcome
  const orderId = `order_${Date.now()}`;
  console.log(`Order ${orderId} completed. Reporting outcome...`);
  await reportTransactionOutcome(agentDid, orderId, 'success', 12, 'Nostr <auth-event>');
  console.log('Outcome reported. Agent trust score will update.');
}

// Run
exampleCommerceFlow().catch(console.error);
