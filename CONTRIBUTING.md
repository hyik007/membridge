# Contributing to MemBridge

Thanks for helping make AI memory portable!

## Quick start
```bash
git clone https://github.com/hyik007/membridge.git
cd membridge
npm test        # runs parser/formatter/redaction tests (no dependencies to install)
npm start       # local Web Studio at http://127.0.0.1:4321
```

## Good first contributions
- Add a parser for another export format (Gemini Takeout, Perplexity, Grok, DeepSeek).
- Add a new destination formatter in `src/core/engine.js` (`formatForTarget`).
- Improve secret-redaction patterns in `SECRET_RULES`.
- Translate the README.

## Guidelines
- Keep it dependency-free and 100% local: no network calls, no telemetry.
- Add or update a test in `test/test.js` for every behavior change.
- Run `npm test` before opening a pull request.
