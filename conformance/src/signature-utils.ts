/**
 * MCP-T Signature Utilities
 *
 * Provides Ed25519 signing and verification for conformance testing.
 * Uses canonical JSON serialization (RFC 8785 / JCS) as specified
 * in Section 4.2.5 of the MCP-T spec.
 */

import * as ed25519 from '@noble/ed25519';
import canonicalize from 'canonicalize';

// Enable synchronous methods (required for noble/ed25519 v2+)
import { sha512 } from '@noble/ed25519';

/**
 * Generate an Ed25519 keypair for testing.
 */
export async function generateKeypair(): Promise<{
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}> {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = await ed25519.getPublicKeyAsync(privateKey);
  return { privateKey, publicKey };
}

/**
 * Create a canonical JSON representation of an object with specified fields
 * removed (for signing trust scores, remove "signature"; for events, remove
 * "signature" and "co_signatures").
 */
export function canonicalizeForSigning(
  obj: Record<string, unknown>,
  fieldsToRemove: string[] = ['signature']
): string {
  const copy = { ...obj };
  for (const field of fieldsToRemove) {
    delete copy[field];
  }
  const result = canonicalize(copy);
  if (!result) throw new Error('Canonicalization returned empty result');
  return result;
}

/**
 * Sign data with Ed25519.
 */
export async function signEd25519(
  data: string,
  privateKey: Uint8Array
): Promise<Uint8Array> {
  const encoded = new TextEncoder().encode(data);
  return ed25519.signAsync(encoded, privateKey);
}

/**
 * Verify an Ed25519 signature.
 */
export async function verifyEd25519(
  data: string,
  signature: Uint8Array,
  publicKey: Uint8Array
): Promise<boolean> {
  const encoded = new TextEncoder().encode(data);
  return ed25519.verifyAsync(signature, encoded, publicKey);
}

/**
 * Encode bytes to base64url (no padding).
 */
export function toBase64Url(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Decode base64url to bytes.
 */
export function fromBase64Url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encode public key to hex string.
 */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create a signed trust score object for testing.
 * Returns the complete trust score with a valid Ed25519 signature.
 */
export async function createSignedTrustScore(
  score: Record<string, unknown>,
  privateKey: Uint8Array,
  publicKey: Uint8Array
): Promise<Record<string, unknown>> {
  const withoutSig = { ...score };
  delete withoutSig.signature;

  const canonical = canonicalizeForSigning(score);
  const sig = await signEd25519(canonical, privateKey);

  return {
    ...withoutSig,
    signature: {
      algorithm: 'Ed25519',
      public_key: toHex(publicKey),
      value: toBase64Url(sig),
    },
  };
}

/**
 * Create a signed trust event object for testing.
 * Removes both "signature" and "co_signatures" before signing,
 * as specified in Section 6.4.
 */
export async function createSignedTrustEvent(
  event: Record<string, unknown>,
  privateKey: Uint8Array,
  publicKey: Uint8Array
): Promise<Record<string, unknown>> {
  const withoutSig = { ...event };
  delete withoutSig.signature;
  delete withoutSig.co_signatures;

  const canonical = canonicalizeForSigning(event, [
    'signature',
    'co_signatures',
  ]);
  const sig = await signEd25519(canonical, privateKey);

  return {
    ...withoutSig,
    signature: {
      algorithm: 'Ed25519',
      public_key: toHex(publicKey),
      value: toBase64Url(sig),
    },
  };
}
