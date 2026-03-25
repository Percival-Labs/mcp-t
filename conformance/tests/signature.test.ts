/**
 * MCP-T Conformance: Signature Tests
 *
 * Tests Ed25519 signature generation, verification, and canonical JSON
 * serialization as specified in Sections 4.2.5 and 6.4.
 */

import { describe, it, expect } from 'vitest';
import {
  generateKeypair,
  canonicalizeForSigning,
  signEd25519,
  verifyEd25519,
  createSignedTrustScore,
  createSignedTrustEvent,
  toBase64Url,
  fromBase64Url,
  toHex,
} from '../src/signature-utils.js';

describe('Signature Tests', () => {
  describe('Ed25519 key generation', () => {
    it('should generate a valid keypair', async () => {
      const { privateKey, publicKey } = await generateKeypair();
      expect(privateKey).toBeInstanceOf(Uint8Array);
      expect(publicKey).toBeInstanceOf(Uint8Array);
      expect(privateKey.length).toBe(32);
      expect(publicKey.length).toBe(32);
    });

    it('should generate unique keypairs', async () => {
      const kp1 = await generateKeypair();
      const kp2 = await generateKeypair();
      expect(toHex(kp1.publicKey)).not.toBe(toHex(kp2.publicKey));
    });
  });

  describe('canonical JSON serialization', () => {
    it('should produce deterministic output regardless of key order', () => {
      const obj1 = { b: 2, a: 1 };
      const obj2 = { a: 1, b: 2 };
      const c1 = canonicalizeForSigning(obj1, []);
      const c2 = canonicalizeForSigning(obj2, []);
      expect(c1).toBe(c2);
    });

    it('should remove the signature field before canonicalization', () => {
      const obj = {
        subject_id: 'did:key:z6MkTest',
        score: 500,
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
      };
      const canonical = canonicalizeForSigning(obj);
      expect(canonical).not.toContain('signature');
      expect(canonical).toContain('subject_id');
      expect(canonical).toContain('score');
    });

    it('should remove both signature and co_signatures for trust events', () => {
      const obj = {
        event_id: 'evt_01',
        event_type: 'contract.completed',
        signature: { algorithm: 'Ed25519', public_key: 'key', value: 'sig' },
        co_signatures: [{ signer_id: 'test' }],
      };
      const canonical = canonicalizeForSigning(obj, [
        'signature',
        'co_signatures',
      ]);
      expect(canonical).not.toContain('signature');
      expect(canonical).not.toContain('co_signatures');
      expect(canonical).toContain('event_id');
    });

    it('should handle nested objects deterministically', () => {
      const obj = {
        score: {
          dimensions: {
            verification: { value: 850, confidence: 0.95 },
            tenure: { value: 620, confidence: 0.88 },
          },
          composite: 742,
        },
      };
      const canonical = canonicalizeForSigning(obj, []);
      // RFC 8785 sorts keys alphabetically at each level
      expect(canonical).toBe(
        '{"score":{"composite":742,"dimensions":{"tenure":{"confidence":0.88,"value":620},"verification":{"confidence":0.95,"value":850}}}}'
      );
    });
  });

  describe('Ed25519 sign and verify', () => {
    it('should sign and verify a message successfully', async () => {
      const { privateKey, publicKey } = await generateKeypair();
      const message = '{"composite":742,"subject_id":"did:key:z6MkTest"}';
      const signature = await signEd25519(message, privateKey);
      const isValid = await verifyEd25519(message, signature, publicKey);
      expect(isValid).toBe(true);
    });

    it('should reject verification with wrong public key', async () => {
      const kp1 = await generateKeypair();
      const kp2 = await generateKeypair();
      const message = '{"test":"data"}';
      const signature = await signEd25519(message, kp1.privateKey);
      const isValid = await verifyEd25519(message, signature, kp2.publicKey);
      expect(isValid).toBe(false);
    });

    it('should reject verification with tampered message', async () => {
      const { privateKey, publicKey } = await generateKeypair();
      const message = '{"composite":742}';
      const signature = await signEd25519(message, privateKey);
      const isValid = await verifyEd25519(
        '{"composite":743}',
        signature,
        publicKey
      );
      expect(isValid).toBe(false);
    });

    it('should reject verification with tampered signature', async () => {
      const { privateKey, publicKey } = await generateKeypair();
      const message = '{"test":"data"}';
      const signature = await signEd25519(message, privateKey);
      // Tamper one byte
      const tampered = new Uint8Array(signature);
      tampered[0] = (tampered[0] + 1) % 256;
      const isValid = await verifyEd25519(message, tampered, publicKey);
      expect(isValid).toBe(false);
    });
  });

  describe('base64url encoding', () => {
    it('should round-trip encode and decode', () => {
      const original = new Uint8Array([0, 1, 2, 255, 254, 253]);
      const encoded = toBase64Url(original);
      const decoded = fromBase64Url(encoded);
      expect(decoded).toEqual(original);
    });

    it('should not contain +, /, or = characters', () => {
      const bytes = new Uint8Array(64);
      for (let i = 0; i < 64; i++) bytes[i] = i * 4;
      const encoded = toBase64Url(bytes);
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');
    });
  });

  describe('signed trust score creation', () => {
    it('should create a trust score with valid Ed25519 signature', async () => {
      const { privateKey, publicKey } = await generateKeypair();
      const score = {
        schema_version: '0.1.0',
        subject_id: 'did:key:z6MkTest',
        provider_id: 'did:web:provider.example.com',
        score: {
          composite: 742,
          dimensions: {
            verification: { value: 850, confidence: 0.95, evidence_count: 47 },
            tenure: { value: 620, confidence: 0.88, evidence_count: 1 },
          },
        },
        validity: {
          issued_at: '2026-03-15T10:30:00Z',
          expires_at: '2026-03-15T11:30:00Z',
          max_age_seconds: 3600,
        },
      };

      const signed = await createSignedTrustScore(score, privateKey, publicKey);

      // Should have signature with Ed25519
      expect((signed.signature as Record<string, unknown>).algorithm).toBe(
        'Ed25519'
      );

      // Should be verifiable
      const sigObj = signed.signature as Record<string, unknown>;
      const sigBytes = fromBase64Url(sigObj.value as string);
      const canonical = canonicalizeForSigning(signed);
      const isValid = await verifyEd25519(canonical, sigBytes, publicKey);
      expect(isValid).toBe(true);
    });

    it('should produce a signature that fails if score is modified after signing', async () => {
      const { privateKey, publicKey } = await generateKeypair();
      const score = {
        schema_version: '0.1.0',
        subject_id: 'did:key:z6MkTest',
        provider_id: 'did:web:provider.example.com',
        score: {
          composite: 500,
          dimensions: {
            verification: { value: 500, confidence: 0.5, evidence_count: 1 },
            tenure: { value: 500, confidence: 0.5, evidence_count: 1 },
          },
        },
        validity: {
          issued_at: '2026-03-15T10:30:00Z',
          expires_at: '2026-03-15T11:30:00Z',
          max_age_seconds: 3600,
        },
      };

      const signed = await createSignedTrustScore(score, privateKey, publicKey);

      // Tamper with the composite score
      (
        (signed.score as Record<string, unknown>)
      ).composite = 999;

      const sigObj = signed.signature as Record<string, unknown>;
      const sigBytes = fromBase64Url(sigObj.value as string);
      const canonical = canonicalizeForSigning(signed);
      const isValid = await verifyEd25519(canonical, sigBytes, publicKey);
      expect(isValid).toBe(false);
    });
  });

  describe('signed trust event creation', () => {
    it('should create a trust event with valid Ed25519 signature', async () => {
      const { privateKey, publicKey } = await generateKeypair();
      const event = {
        event_id: 'evt_01HXYZ789ABC',
        event_type: 'contract.completed',
        subject_id: 'did:key:z6MkTest',
        issuer_id: 'did:web:platform.example.com',
        timestamp: '2026-03-15T09:45:00Z',
        payload: { contract_id: 'ctr_001', outcome: 'success' },
        dimensions_affected: ['performance', 'consistency'],
      };

      const signed = await createSignedTrustEvent(event, privateKey, publicKey);

      const sigObj = signed.signature as Record<string, unknown>;
      const sigBytes = fromBase64Url(sigObj.value as string);
      const canonical = canonicalizeForSigning(signed, [
        'signature',
        'co_signatures',
      ]);
      const isValid = await verifyEd25519(canonical, sigBytes, publicKey);
      expect(isValid).toBe(true);
    });

    it('should exclude co_signatures from signed payload', async () => {
      const { privateKey, publicKey } = await generateKeypair();
      const event = {
        event_id: 'evt_01',
        event_type: 'contract.completed',
        subject_id: 'did:key:z6MkTest',
        issuer_id: 'did:web:platform.example.com',
        timestamp: '2026-03-15T09:45:00Z',
        payload: { contract_id: 'ctr_001', outcome: 'success' },
      };

      const signed = await createSignedTrustEvent(event, privateKey, publicKey);

      // Add co_signatures after signing - should NOT invalidate the signature
      (signed as Record<string, unknown>).co_signatures = [
        { signer_id: 'cosigner', algorithm: 'Ed25519', public_key: 'k', value: 's' },
      ];

      const sigObj = signed.signature as Record<string, unknown>;
      const sigBytes = fromBase64Url(sigObj.value as string);
      const canonical = canonicalizeForSigning(signed, [
        'signature',
        'co_signatures',
      ]);
      const isValid = await verifyEd25519(canonical, sigBytes, publicKey);
      expect(isValid).toBe(true);
    });
  });
});
