import assert from 'node:assert/strict';
import {
  SAMPLE_DATA,
  TARGETS,
  parseInput,
  redactSecrets,
  formatForTarget,
} from '../src/core/engine.mjs';

function runTests() {
  // 1. Parse ChatGPT conversations.json
  const gpt = parseInput(SAMPLE_DATA.chatgpt, 'conversations.json');
  assert.equal(gpt.format, 'chatgpt-json');
  assert.ok(gpt.items.length >= 4, 'Should extract multiple ChatGPT memories');
  assert.ok(
    gpt.items.every((m) => !m.text.includes('fix this typo')),
    'Should filter out trivial conversational noise'
  );
  assert.ok(
    gpt.items.some((m) => m.hasSecret),
    'Should flag API keys and emails as containing secrets'
  );

  // 2. Parse Claude conversations.json
  const claude = parseInput(SAMPLE_DATA.claude, 'claude-conversations.json');
  assert.equal(claude.format, 'claude-json');
  assert.ok(claude.items.length >= 3, 'Should extract Claude human messages');
  assert.ok(
    claude.items.every((m) => !m.text.includes('Looks good, thank you')),
    'Should filter out pleasantries'
  );

  // 3. Parse Raw Markdown
  const raw = parseInput(SAMPLE_DATA.raw, 'profile.md');
  assert.equal(raw.format, 'markdown');
  assert.ok(raw.items.length >= 8, 'Should parse all markdown bullets');
  assert.ok(raw.items.some((m) => m.category === 'identity'));
  assert.ok(raw.items.some((m) => m.category === 'projects'));
  assert.ok(raw.items.some((m) => m.category === 'stack'));
  assert.ok(raw.items.some((m) => m.category === 'preferences'));
  assert.ok(raw.items.some((m) => m.category === 'rules'));

  // 4. Secret redaction
  const dirty = 'Key sk-proj-abcd1234efgh5678ijkl9012, GitHub ghp_1234567890abcdefghij, mail me@test.dev';
  const clean = redactSecrets(dirty);
  assert.ok(!clean.includes('sk-proj-'), 'OpenAI key should be redacted');
  assert.ok(!clean.includes('ghp_'), 'GitHub token should be redacted');
  assert.ok(!clean.includes('me@test.dev'), 'Email should be redacted');

  // 5. Target formatters + .brain.json round-trip
  for (const targetId of Object.keys(TARGETS)) {
    const res = formatForTarget(gpt.items, targetId, { redact: true, rawChars: gpt.rawChars });
    assert.ok(res.output.length > 20, `Formatter for ${targetId} produced empty output`);
    assert.ok(!res.output.includes('sk-proj-demo9876543210'), `${targetId} leaked unredacted API key`);
    assert.ok(res.stats.estimatedTokens > 0);
  }

  const jsonExport = formatForTarget(raw.items, 'json', { redact: true, rawChars: raw.rawChars });
  const roundTrip = parseInput(jsonExport.output, 'membridge.brain.json');
  assert.equal(roundTrip.format, 'brain-json');
  assert.equal(roundTrip.items.length, raw.items.length);

  console.log(`Verified ${Object.keys(TARGETS).length} target formatters, 4 input parsers, and secret redaction.`);
  console.log('ALL TESTS PASSED');
}

runTests();
