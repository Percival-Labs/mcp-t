# Contributing to MCP-T

Thank you for your interest in contributing to the MCP-T specification.

## How to Contribute

### Reporting Issues

- Use GitHub Issues for bug reports, spec ambiguities, or feature requests
- Include the relevant spec section number
- For security concerns, email security@percival-labs.ai

### Proposing Changes

1. Open an issue describing the change and its motivation
2. Fork the repository
3. Make your changes on a branch
4. Submit a pull request referencing the issue

### What We're Looking For

- **Spec clarifications** — ambiguous language, missing edge cases, inconsistent examples
- **New transport bindings** — beyond HTTPS, Nostr, IPFS, and SSE
- **Conformance test cases** — help validate implementations
- **Implementation reports** — share your experience implementing MCP-T
- **Security analysis** — identify threats not covered in Section 11

### What We're NOT Looking For

- Changes to the scoring algorithm (implementation-specific, not spec)
- Changes that break backward compatibility with v0.1.0
- Vendor-specific extensions that don't use reverse-DNS namespacing

## Style Guide

- Use RFC 2119 keywords (MUST, SHOULD, MAY) precisely
- Include JSON examples for all data structures
- Keep the spec transport-agnostic — no transport-specific requirements in core sections

## License

By contributing, you agree that your contributions will be licensed under CC-BY-4.0.
