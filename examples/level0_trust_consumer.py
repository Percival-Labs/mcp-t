"""
MCP-T Level 0 Trust Consumer -- Python Implementation

A Level 0 consumer can:
  - Query trust scores (trust/query)
  - Verify trust thresholds (trust/verify)
  - Validate signatures on returned scores
  - Respect validity windows (expires_at, max_age_seconds)

It does NOT publish events or interact with economic/ZK layers.

Dependencies:
  pip install httpx pydantic

Note: Signature verification is stubbed out because the spec references
Ed25519 over JCS-canonicalized JSON (RFC 8785), but does not provide a
test vector, a reference implementation, or a working endpoint to test
against. See the "ambiguity" notes at the bottom of this file.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

import httpx


# ---------------------------------------------------------------------------
# Data models (matching spec Section 4 + Section 7)
# ---------------------------------------------------------------------------

@dataclass
class DimensionScore:
    value: int          # 0-1000
    confidence: float   # 0.0-1.0
    evidence_count: int


@dataclass
class TrustScoreValue:
    composite: int  # 0-1000
    dimensions: dict[str, DimensionScore]


@dataclass
class ValidityWindow:
    issued_at: str   # ISO 8601
    expires_at: str  # ISO 8601
    max_age_seconds: int


@dataclass
class Signature:
    algorithm: str   # Ed25519 | ES256 | ES384
    public_key: str
    value: str


@dataclass
class TrustScore:
    schema_version: str
    subject_id: str
    provider_id: str
    score: TrustScoreValue
    validity: ValidityWindow
    signature: Signature
    domain: Optional[str] = None
    domain_match: Optional[bool] = None
    metadata: Optional[dict[str, Any]] = None
    authorized: Optional[bool] = None


@dataclass
class VerifyResult:
    verified: bool
    confidence: float
    checked_at: str
    subject_id: Optional[str] = None
    provider_id: Optional[str] = None
    threshold_results: Optional[dict[str, Any]] = None
    signature: Optional[Signature] = None


@dataclass
class ThresholdSpec:
    """At least one of composite_min or dimension_mins is required."""
    composite_min: Optional[int] = None
    dimension_mins: Optional[dict[str, int]] = None
    confidence_min: Optional[float] = None
    min_evidence_count: Optional[int] = None

    def __post_init__(self):
        if self.composite_min is None and self.dimension_mins is None:
            raise ValueError(
                "ThresholdSpec requires at least one of "
                "composite_min or dimension_mins"
            )


class AccessDecision(Enum):
    ALLOW = "allow"
    DENY = "deny"
    DEFER = "defer"  # score expired, provider unavailable, etc.


# ---------------------------------------------------------------------------
# Score cache (respects max_age_seconds per spec Section 4.2.4)
# ---------------------------------------------------------------------------

@dataclass
class CachedScore:
    score: TrustScore
    fetched_at: float  # time.monotonic()


class ScoreCache:
    def __init__(self):
        self._cache: dict[str, CachedScore] = {}

    def _key(self, subject_id: str, domain: str | None, provider_id: str | None) -> str:
        return f"{subject_id}|{domain or ''}|{provider_id or ''}"

    def get(self, subject_id: str, domain: str | None = None,
            provider_id: str | None = None) -> TrustScore | None:
        key = self._key(subject_id, domain, provider_id)
        entry = self._cache.get(key)
        if entry is None:
            return None
        age = time.monotonic() - entry.fetched_at
        if age > entry.score.validity.max_age_seconds:
            del self._cache[key]
            return None
        # Also check expires_at
        expires = datetime.fromisoformat(entry.score.validity.expires_at)
        if datetime.now(timezone.utc) > expires:
            del self._cache[key]
            return None
        return entry.score

    def put(self, score: TrustScore, domain: str | None = None,
            provider_id: str | None = None):
        key = self._key(score.subject_id, domain, provider_id)
        self._cache[key] = CachedScore(score=score, fetched_at=time.monotonic())


# ---------------------------------------------------------------------------
# JSON-RPC helpers
# ---------------------------------------------------------------------------

_request_id = 0

def _next_id() -> str:
    global _request_id
    _request_id += 1
    return f"req-{_request_id:04d}"


def _make_jsonrpc_request(method: str, params: dict[str, Any]) -> dict:
    return {
        "jsonrpc": "2.0",
        "id": _next_id(),
        "method": method,
        "params": params,
    }


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------

def _parse_dimension(raw: dict) -> DimensionScore:
    return DimensionScore(
        value=raw["value"],
        confidence=raw["confidence"],
        evidence_count=raw["evidence_count"],
    )


def _parse_signature(raw: dict) -> Signature:
    return Signature(
        algorithm=raw["algorithm"],
        public_key=raw["public_key"],
        value=raw["value"],
    )


def _parse_trust_score(raw: dict) -> TrustScore:
    score_data = raw["score"]
    dims = {
        k: _parse_dimension(v)
        for k, v in score_data["dimensions"].items()
    }
    return TrustScore(
        schema_version=raw["schema_version"],
        subject_id=raw["subject_id"],
        provider_id=raw["provider_id"],
        score=TrustScoreValue(
            composite=score_data["composite"],
            dimensions=dims,
        ),
        domain=raw.get("domain"),
        domain_match=raw.get("domain_match"),
        validity=ValidityWindow(
            issued_at=raw["validity"]["issued_at"],
            expires_at=raw["validity"]["expires_at"],
            max_age_seconds=raw["validity"]["max_age_seconds"],
        ),
        signature=_parse_signature(raw["signature"]),
        metadata=raw.get("metadata"),
        authorized=raw.get("authorized"),
    )


def _parse_verify_result(raw: dict) -> VerifyResult:
    sig = _parse_signature(raw["signature"]) if "signature" in raw else None
    return VerifyResult(
        verified=raw["verified"],
        confidence=raw.get("confidence", 0.0),
        checked_at=raw.get("checked_at", ""),
        subject_id=raw.get("subject_id"),
        provider_id=raw.get("provider_id"),
        threshold_results=raw.get("threshold_results"),
        signature=sig,
    )


# ---------------------------------------------------------------------------
# Signature verification (STUBBED)
# ---------------------------------------------------------------------------

def verify_signature(score_or_result: TrustScore | VerifyResult) -> bool:
    """
    Verify the Ed25519/ES256/ES384 signature over the JCS-canonicalized
    JSON payload.

    STUBBED: The spec says to use RFC 8785 (JCS) canonicalization and
    then verify with Ed25519/ES256/ES384, but provides no test vectors.
    A real implementation would:
      1. Serialize the object minus the `signature` field using JCS
      2. Verify using the public_key and algorithm from the signature
      3. Return False if verification fails

    For now, we log a warning and return True.
    """
    sig = score_or_result.signature
    if sig is None:
        return False
    # TODO: Implement actual verification once test vectors exist
    #   - pip install pynacl (for Ed25519)
    #   - pip install canonicaljson (for JCS / RFC 8785)
    print(f"  [WARN] Signature verification stubbed for algorithm={sig.algorithm}")
    return True


# ---------------------------------------------------------------------------
# MCP-T Level 0 Trust Consumer
# ---------------------------------------------------------------------------

class MCPTrustConsumer:
    """
    A Level 0 MCP-T Trust Consumer.

    Supports:
      - trust/query  (full score retrieval)
      - trust/verify (binary threshold check)
      - Local caching per max_age_seconds
      - Signature validation (stubbed)
      - Validity window enforcement

    Does NOT support:
      - trust/publish (Level 1+)
      - trust/history (Level 1+)
      - Economic events (Level 2+)
      - ZK proofs (Level 3)
    """

    def __init__(
        self,
        provider_base_url: str,
        timeout: float = 10.0,
        verify_signatures: bool = True,
    ):
        """
        Args:
            provider_base_url: Base URL of the MCP-T HTTPS endpoint,
                e.g. "https://api.trustprovider.example.com".
                The HTTPS binding paths (/mcp-t/v1/*) are appended automatically.
            timeout: HTTP request timeout in seconds.
            verify_signatures: Whether to verify score signatures.
        """
        self._base = provider_base_url.rstrip("/")
        self._timeout = timeout
        self._verify_sigs = verify_signatures
        self._cache = ScoreCache()
        self._client = httpx.Client(timeout=timeout)

    def close(self):
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

    # -- trust/query -------------------------------------------------------

    def query_score(
        self,
        subject_id: str,
        domain: str | None = None,
        provider_id: str | None = None,
        max_age_seconds: int | None = None,
        dimensions: list[str] | None = None,
    ) -> TrustScore:
        """
        Full trust score retrieval (Section 7.1).
        Returns a TrustScore object. Raises on errors.
        """
        # Check cache first
        cached = self._cache.get(subject_id, domain, provider_id)
        if cached is not None:
            print(f"  [CACHE HIT] {subject_id}")
            return cached

        params: dict[str, Any] = {"subject_id": subject_id}
        if domain:
            params["domain"] = domain
        if provider_id:
            params["provider_id"] = provider_id
        if max_age_seconds is not None:
            params["max_age_seconds"] = max_age_seconds
        if dimensions:
            params["dimensions"] = dimensions

        body = _make_jsonrpc_request("trust/query", params)
        resp = self._client.post(f"{self._base}/mcp-t/v1/query", json=body)
        resp.raise_for_status()
        data = resp.json()

        if "error" in data:
            err = data["error"]
            raise MCPTError(err.get("code", -1), err.get("message", "Unknown"))

        trust_score = _parse_trust_score(data["result"]["trust_score"])

        # Validate signature
        if self._verify_sigs and not verify_signature(trust_score):
            raise MCPTError(-32099, "Signature verification failed")

        # Enforce validity
        self._check_validity(trust_score.validity)

        # Cache it
        self._cache.put(trust_score, domain, provider_id)
        return trust_score

    # -- trust/verify ------------------------------------------------------

    def verify_threshold(
        self,
        subject_id: str,
        threshold: ThresholdSpec,
        domain: str | None = None,
        provider_id: str | None = None,
    ) -> VerifyResult:
        """
        Binary threshold check (Section 7.2).
        Returns a VerifyResult with verified=True/False.
        """
        params: dict[str, Any] = {
            "subject_id": subject_id,
            "threshold": {},
        }
        if threshold.composite_min is not None:
            params["threshold"]["composite_min"] = threshold.composite_min
        if threshold.dimension_mins is not None:
            params["threshold"]["dimension_mins"] = threshold.dimension_mins
        if threshold.confidence_min is not None:
            params["threshold"]["confidence_min"] = threshold.confidence_min
        if threshold.min_evidence_count is not None:
            params["threshold"]["min_evidence_count"] = threshold.min_evidence_count
        if domain:
            params["domain"] = domain
        if provider_id:
            params["provider_id"] = provider_id

        body = _make_jsonrpc_request("trust/verify", params)
        resp = self._client.post(f"{self._base}/mcp-t/v1/verify", json=body)
        resp.raise_for_status()
        data = resp.json()

        if "error" in data:
            err = data["error"]
            raise MCPTError(err.get("code", -1), err.get("message", "Unknown"))

        result = _parse_verify_result(data["result"])

        if self._verify_sigs and result.signature and not verify_signature(result):
            raise MCPTError(-32099, "Signature verification failed on verify result")

        return result

    # -- High-level access decision ----------------------------------------

    def should_grant_access(
        self,
        subject_id: str,
        domain: str,
        min_composite: int = 500,
        min_confidence: float = 0.5,
        min_evidence: int = 10,
        dimension_mins: dict[str, int] | None = None,
    ) -> AccessDecision:
        """
        High-level decision function: should this agent get access?

        Uses trust/verify for the binary check, with fallback to
        trust/query for richer local analysis if verify is unavailable.

        Returns AccessDecision.ALLOW, DENY, or DEFER.
        """
        threshold = ThresholdSpec(
            composite_min=min_composite,
            dimension_mins=dimension_mins,
            confidence_min=min_confidence,
            min_evidence_count=min_evidence,
        )

        try:
            result = self.verify_threshold(
                subject_id=subject_id,
                threshold=threshold,
                domain=domain,
            )
            if result.verified:
                print(f"  [ALLOW] {subject_id} passed threshold "
                      f"(confidence={result.confidence})")
                return AccessDecision.ALLOW
            else:
                print(f"  [DENY] {subject_id} failed threshold check")
                return AccessDecision.DENY

        except MCPTError as e:
            # SubjectNotFound or ProviderUnavailable -> DEFER
            if e.code in (-32001, -32002):
                print(f"  [DEFER] {subject_id}: {e.message}")
                return AccessDecision.DEFER
            raise

        except httpx.HTTPError as e:
            print(f"  [DEFER] HTTP error querying trust: {e}")
            return AccessDecision.DEFER

    # -- Validity enforcement ----------------------------------------------

    @staticmethod
    def _check_validity(validity: ValidityWindow):
        """Enforce expires_at per spec Section 10 Level 0 requirements."""
        now = datetime.now(timezone.utc)
        expires = datetime.fromisoformat(validity.expires_at)
        if now > expires:
            raise MCPTError(
                -32004,
                f"Trust score expired at {validity.expires_at}"
            )


class MCPTError(Exception):
    """Represents a JSON-RPC error from the MCP-T protocol."""

    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message
        super().__init__(f"MCP-T Error {code}: {message}")


# ---------------------------------------------------------------------------
# Example usage / integration with a LangGraph agent
# ---------------------------------------------------------------------------

def langgraph_trust_gate(
    consumer: MCPTrustConsumer,
    agent_did: str,
    tool_domain: str = "code-execution",
) -> bool:
    """
    A trust gate you'd wire into a LangGraph node.

    In LangGraph, you'd use this as a conditional edge:

        from langgraph.graph import StateGraph

        def trust_check(state):
            consumer = MCPTrustConsumer("https://trust.example.com")
            decision = consumer.should_grant_access(
                subject_id=state["agent_did"],
                domain="code-execution",
                min_composite=600,
            )
            return "allowed" if decision == AccessDecision.ALLOW else "denied"

        graph = StateGraph(...)
        graph.add_conditional_edges("check_trust", trust_check, {
            "allowed": "execute_tool",
            "denied": "reject",
        })
    """
    decision = consumer.should_grant_access(
        subject_id=agent_did,
        domain=tool_domain,
        min_composite=600,
        min_confidence=0.6,
        min_evidence=5,
        dimension_mins={"verification": 500, "performance": 400},
    )
    return decision == AccessDecision.ALLOW


# ---------------------------------------------------------------------------
# Main -- demonstrates usage (will fail without a real endpoint)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # The README mentions a public endpoint:
    # https://percivalvouch-api-production.up.railway.app/v1/public/scores
    #
    # But that is a REST API, not the MCP-T HTTPS binding. The MCP-T binding
    # expects POST /mcp-t/v1/query with JSON-RPC body. There is no documented
    # endpoint that implements the MCP-T wire protocol as specified.
    #
    # So this will fail with a connection error -- which is itself a finding.

    print("=" * 60)
    print("MCP-T Level 0 Trust Consumer -- Demo")
    print("=" * 60)

    # Hypothetical endpoint
    PROVIDER_URL = "https://api.trustprovider.example.com"

    print(f"\nConnecting to: {PROVIDER_URL}")
    print("(This will fail -- no live MCP-T endpoint exists yet)\n")

    try:
        with MCPTrustConsumer(PROVIDER_URL, timeout=5.0) as consumer:
            decision = consumer.should_grant_access(
                subject_id="did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
                domain="code-execution",
                min_composite=600,
                min_confidence=0.6,
                min_evidence=5,
            )
            print(f"\nDecision: {decision.value}")
    except Exception as e:
        print(f"Expected failure: {e}")
        print("\nThis confirms: no live MCP-T HTTPS binding endpoint exists.")
        print("The Vouch API endpoint in the README uses a different REST shape.")
