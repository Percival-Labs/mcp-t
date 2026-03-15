/**
 * MCP-T Nostr Binding Example
 *
 * Publishes a trust score as a kind 30085 parameterized replaceable event
 * and queries it back from a relay.
 *
 * Dependencies:
 *   npm install nostr-tools @noble/hashes
 *
 * NOTE: This code highlights several protocol concerns documented in the
 * review. See inline comments marked with [REVIEW].
 */

import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { Relay } from 'nostr-tools/relay';
import { nip19 } from 'nostr-tools';
import type { EventTemplate, Event as NostrEvent, Filter } from 'nostr-tools/core';

// -------------------------------------------------------------------
// Config
// -------------------------------------------------------------------

const RELAY_URL = 'wss://relay.damus.io'; // swap for your relay
const TRUST_SCORE_KIND = 30085;
const TRUST_EVENT_KIND = 30086;

// -------------------------------------------------------------------
// Key Setup
// -------------------------------------------------------------------

// Provider (the entity issuing the trust score)
const providerSk = generateSecretKey();
const providerPk = getPublicKey(providerSk);

// Subject (the agent being scored) -- in reality you'd know their pubkey
const subjectSk = generateSecretKey();
const subjectPk = getPublicKey(subjectSk);

const subjectNpub = nip19.npubEncode(subjectPk);
console.log(`Provider pubkey: ${providerPk}`);
console.log(`Subject pubkey:  ${subjectPk}`);
console.log(`Subject npub:    ${subjectNpub}`);

// -------------------------------------------------------------------
// Build the MCP-T Trust Score (the content payload)
// -------------------------------------------------------------------

const trustScore = {
  schema_version: '0.1.0',
  score_id: `score-${Date.now()}`,
  subject: {
    id: `did:key:z6Mk${subjectPk.slice(0, 40)}`, // synthetic DID
    type: 'agent',
    nostr_pubkey: subjectPk,
  },
  provider: {
    id: `did:key:z6Mk${providerPk.slice(0, 40)}`,
    name: 'ExampleTrustProvider',
    nostr_pubkey: providerPk,
  },
  domain: 'code-execution',
  composite_score: 742,
  dimensions: {
    verification: { score: 850, confidence: 0.95, evidence_count: 47 },
    performance: { score: 780, confidence: 0.72, evidence_count: 156 },
    consistency: { score: 800, confidence: 0.83, evidence_count: 892 },
  },
  valid_from: new Date().toISOString(),
  valid_until: new Date(Date.now() + 3600_000).toISOString(),
  metadata: {
    algorithm: 'weighted-average-v1',
    total_evidence: 1095,
  },
};

// -------------------------------------------------------------------
// Build and sign the Nostr event
// -------------------------------------------------------------------

function buildScoreEvent(score: typeof trustScore): EventTemplate {
  const expirationUnix = Math.floor(
    new Date(score.valid_until).getTime() / 1000
  ).toString();

  // [REVIEW] The d-tag should include domain to avoid cross-domain replacement.
  // The spec currently uses only subject_id, which means a second domain score
  // from the same provider replaces the first.
  const dTag = `${score.subject.id}:${score.domain}`; // FIX: include domain

  return {
    kind: TRUST_SCORE_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', dTag],
      ['p', subjectPk],
      // [REVIEW] 'schema' and 'domain' are multi-letter tags.
      // Most relays do NOT index multi-letter tags, so #schema and #domain
      // filters will silently return nothing on many relays.
      ['schema', 'mcp-t'],
      ['schema_version', '0.1.0'],
      ['domain', score.domain],
      ['composite', score.composite_score.toString()],
      // Dimension tags: ["dim", <name>, <score>, <confidence>, <evidence_count>]
      ...Object.entries(score.dimensions).map(([name, dim]) => [
        'dim',
        name,
        dim.score.toString(),
        dim.confidence.toString(),
        dim.evidence_count.toString(),
      ]),
      // [REVIEW] Should reference NIP-40 for expiration semantics.
      ['expiration', expirationUnix],
    ],
    content: JSON.stringify(score),
  };
}

// -------------------------------------------------------------------
// Publish to relay
// -------------------------------------------------------------------

async function publish(relay: Relay, sk: Uint8Array, template: EventTemplate): Promise<NostrEvent> {
  const signed = finalizeEvent(template, sk);
  console.log('\n--- Signed Event ---');
  console.log(JSON.stringify(signed, null, 2));

  await relay.publish(signed);
  console.log(`Published event ${signed.id} to ${relay.url}`);
  return signed;
}

// -------------------------------------------------------------------
// Query trust scores for a subject
// -------------------------------------------------------------------

async function queryScoresForSubject(
  relay: Relay,
  subjectPubkeyHex: string,
): Promise<NostrEvent[]> {
  const filter: Filter = {
    kinds: [TRUST_SCORE_KIND],
    '#p': [subjectPubkeyHex],
    // [REVIEW] The spec example includes #schema: ["mcp-t"] in the filter,
    // but 'schema' is a multi-letter tag. Relays implementing NIP-01 only
    // guarantee indexing of single-letter tags. This filter clause will be
    // silently ignored by most relays, returning ALL kind 30085 events for
    // this pubkey, not just MCP-T ones.
    //
    // Workaround: filter client-side, or use a single-letter tag like 'L'
    // (NIP-32 label namespace) instead of 'schema'.
  };

  console.log('\n--- Query Filter ---');
  console.log(JSON.stringify(filter, null, 2));

  return new Promise((resolve) => {
    const events: NostrEvent[] = [];
    const sub = relay.subscribe([filter], {
      onevent(event) {
        events.push(event);
        console.log(`Received score event: ${event.id}`);
      },
      oneose() {
        console.log(`End of stored events. Got ${events.length} result(s).`);
        sub.close();
        resolve(events);
      },
    });
  });
}

// -------------------------------------------------------------------
// Query all scores FROM a specific provider
// -------------------------------------------------------------------

async function queryScoresFromProvider(
  relay: Relay,
  providerPubkeyHex: string,
): Promise<NostrEvent[]> {
  // For "all scores from provider Y", we filter by authors (the pubkey
  // that signed the event). This works correctly because the provider's
  // Nostr keypair is the event author.
  const filter: Filter = {
    kinds: [TRUST_SCORE_KIND],
    authors: [providerPubkeyHex],
  };

  return new Promise((resolve) => {
    const events: NostrEvent[] = [];
    const sub = relay.subscribe([filter], {
      onevent(event) { events.push(event); },
      oneose() { sub.close(); resolve(events); },
    });
  });
}

// -------------------------------------------------------------------
// Parse a received event back into a trust score
// -------------------------------------------------------------------

function parseScoreEvent(event: NostrEvent): {
  subjectPubkey: string;
  domain: string;
  composite: number;
  dimensions: Record<string, { score: number; confidence: number; evidence: number }>;
  fullScore: typeof trustScore | null;
} {
  const pTag = event.tags.find((t) => t[0] === 'p');
  const domainTag = event.tags.find((t) => t[0] === 'domain');
  const compositeTag = event.tags.find((t) => t[0] === 'composite');
  const dimTags = event.tags.filter((t) => t[0] === 'dim');

  const dimensions: Record<string, { score: number; confidence: number; evidence: number }> = {};
  for (const dt of dimTags) {
    dimensions[dt[1]] = {
      score: Number(dt[2]),
      confidence: Number(dt[3]),
      evidence: Number(dt[4]),
    };
  }

  let fullScore = null;
  try {
    fullScore = JSON.parse(event.content);
  } catch {
    // content might be encrypted or absent
  }

  return {
    subjectPubkey: pTag?.[1] ?? '',
    domain: domainTag?.[1] ?? '',
    composite: Number(compositeTag?.[1] ?? 0),
    dimensions,
    fullScore,
  };
}

// -------------------------------------------------------------------
// Main
// -------------------------------------------------------------------

async function main() {
  const relay = await Relay.connect(RELAY_URL);
  console.log(`Connected to ${relay.url}`);

  try {
    // Publish
    const template = buildScoreEvent(trustScore);
    const published = await publish(relay, providerSk, template);

    // Small delay to let the relay index
    await new Promise((r) => setTimeout(r, 1500));

    // Query: all scores for this subject
    console.log('\n=== Query: all trust scores for subject ===');
    const subjectScores = await queryScoresForSubject(relay, subjectPk);
    for (const evt of subjectScores) {
      const parsed = parseScoreEvent(evt);
      console.log(`  Domain: ${parsed.domain}, Composite: ${parsed.composite}`);
      console.log(`  Dimensions:`, parsed.dimensions);
    }

    // Query: all scores from this provider
    console.log('\n=== Query: all trust scores from provider ===');
    const providerScores = await queryScoresFromProvider(relay, providerPk);
    console.log(`  Found ${providerScores.length} score(s) from provider`);
  } finally {
    relay.close();
  }
}

main().catch(console.error);
