# Security Policy

## Privacy-First Design

MemBridge processes chat exports and memory packs **100% locally** (in your browser for Web Studio, or on your local machine for CLI and MCP Server). No user conversations, API keys, or memory files are uploaded to any external MemBridge server.

## Supported Versions

| Version | Supported |
| ------- | --------- |
| `1.1.x` | :white_check_mark: |
| `< 1.1` | :x: |

## Reporting a Vulnerability

If you discover a security issue—such as a missed secret redaction pattern, path traversal in the MCP server, or XSS in Web Studio—please report it responsibly:

1. **Do not** open a public GitHub issue with exploit details.
2. Email **hylaw19@gmail.com** or open a private [GitHub Security Advisory](https://github.com/hyik007/membridge/security/advisories/new).
3. Include reproduction steps and the affected component (`cli`, `mcp`, or `web`).

We aim to acknowledge reports within 48 hours and ship a fix as quickly as possible.
