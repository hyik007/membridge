#!/usr/bin/env node
// MemBridge MCP server: zero-dependency stdio JSON-RPC (MCP 2024-11-05).
// Lets any MCP client extract, format, and redact portable AI memories.
import { createInterface } from 'node:readline';
import fs from 'node:fs/promises';
import path from 'node:path';
import { TARGETS, parseInput, formatForTarget, redactSecrets } from '../src/core/engine.mjs';

const SERVER_INFO = { name: 'membridge', version: '1.0.0' };
const PROTOCOL_VERSION = '2024-11-05';
const TARGET_IDS = Object.keys(TARGETS);

const TOOLS = [
  {
    name: 'membridge_extract',
    description:
      'Extract and categorize portable memories (identity, projects, stack, preferences, rules) from raw text, a ChatGPT/Claude conversations.json export, or a .brain.json. Provide either "text" or "path".',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Raw memory text or JSON export content.' },
        path: { type: 'string', description: 'Absolute or relative path to an export file.' },
      },
    },
  },
  {
    name: 'membridge_format',
    description:
      'Convert memories into a ready-to-paste pack for a destination AI. Secrets (API keys, emails) are redacted by default.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Raw memory text or JSON export content.' },
        path: { type: 'string', description: 'Path to an export file (alternative to text).' },
        target: { type: 'string', enum: TARGET_IDS, description: 'Destination format.' },
        redact: { type: 'boolean', description: 'Mask secrets (default true).' },
      },
      required: ['target'],
    },
  },
  {
    name: 'membridge_redact',
    description: 'Mask API keys, tokens, and emails in any text.',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
  },
];

async function loadInput(args) {
  if (typeof args.text === 'string' && args.text.trim()) {
    return { raw: args.text, name: 'input.txt' };
  }
  if (typeof args.path === 'string' && args.path.trim()) {
    const full = path.resolve(process.cwd(), args.path);
    return { raw: await fs.readFile(full, 'utf8'), name: path.basename(full) };
  }
  throw new Error('Provide either "text" or "path".');
}

async function callTool(name, args = {}) {
  if (name === 'membridge_redact') {
    return redactSecrets(String(args.text || ''));
  }
  if (name === 'membridge_extract') {
    const { raw, name: fileName } = await loadInput(args);
    const parsed = parseInput(raw, fileName);
    return JSON.stringify({ format: parsed.format, count: parsed.items.length, memories: parsed.items }, null, 2);
  }
  if (name === 'membridge_format') {
    if (!TARGETS[args.target]) {
      throw new Error(`Unknown target "${args.target}". Valid: ${TARGET_IDS.join(', ')}`);
    }
    const { raw, name: fileName } = await loadInput(args);
    const parsed = parseInput(raw, fileName);
    const result = formatForTarget(parsed.items, args.target, {
      redact: args.redact !== false,
      rawChars: parsed.rawChars,
    });
    return result.output;
  }
  throw new Error(`Unknown tool: ${name}`);
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function handle(msg) {
  const { id, method, params } = msg;
  const isNotification = id === undefined || id === null;

  try {
    if (method === 'initialize') {
      return send({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        },
      });
    }
    if (method === 'notifications/initialized' || isNotification) return undefined;
    if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
    if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    if (method === 'tools/call') {
      try {
        const text = await callTool(params && params.name, params && params.arguments);
        return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } });
      } catch (err) {
        return send({
          jsonrpc: '2.0',
          id,
          result: { isError: true, content: [{ type: 'text', text: `Error: ${err.message}` }] },
        });
      }
    }
    return send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
  } catch (err) {
    if (!isNotification) {
      send({ jsonrpc: '2.0', id, error: { code: -32603, message: err.message } });
    }
    return undefined;
  }
}

const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch (_err) {
    send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    return;
  }
  handle(msg);
});
