import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const server = spawn(process.execPath, [path.join(here, '..', 'bin', 'mcp.js')], {
  stdio: ['pipe', 'pipe', 'inherit'],
});

const pending = new Map();
let buffer = '';
server.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  let idx;
  while ((idx = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    const resolve = pending.get(msg.id);
    if (resolve) {
      pending.delete(msg.id);
      resolve(msg);
    }
  }
});

let nextId = 1;
function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${method}`)), 5000);
    pending.set(id, (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
    server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
}

try {
  const init = await rpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test', version: '0' },
  });
  assert.equal(init.result.serverInfo.name, 'membridge');

  const list = await rpc('tools/list', {});
  const names = list.result.tools.map((t) => t.name).sort();
  assert.deepEqual(names, ['membridge_extract', 'membridge_format', 'membridge_redact']);

  const redact = await rpc('tools/call', {
    name: 'membridge_redact',
    arguments: { text: 'key sk-proj-abcd1234efgh5678ijkl9012 mail a@b.dev' },
  });
  const redactedText = redact.result.content[0].text;
  assert.ok(!redactedText.includes('sk-proj-') && !redactedText.includes('a@b.dev'));

  const fmt = await rpc('tools/call', {
    name: 'membridge_format',
    arguments: {
      target: 'claude',
      text: '- I am a full-stack developer based in Malaysia\n- Always reply concisely',
    },
  });
  assert.ok(fmt.result.content[0].text.includes('<user_profile>'));

  const bad = await rpc('tools/call', { name: 'membridge_format', arguments: { target: 'nope', text: 'x' } });
  assert.equal(bad.result.isError, true);

  console.log('MCP SERVER TESTS PASSED');
} finally {
  server.kill();
}
