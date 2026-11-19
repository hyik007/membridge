#!/usr/bin/env node
// MemBridge MCP server: zero-dependency stdio JSON-RPC (MCP 2024-11-05).
// Lets any MCP client extract, format, and redact portable AI memories.
import { createInterface } from 'node:readline';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  CATEGORIES,
  EXTRACTION_PROMPT,
  TARGETS,
  inferCategory,
  parseInput,
  formatForTarget,
  redactSecrets,
} from '../src/core/engine.mjs';

const SERVER_INFO = { name: 'membridge', version: '1.1.0' };
const PROTOCOL_VERSION = '2024-11-05';
const TARGET_IDS = Object.keys(TARGETS);
const CATEGORY_IDS = Object.keys(CATEGORIES);
const BRAIN_PATH = process.env.MEMBRIDGE_BRAIN_PATH || path.join(os.homedir(), '.membridge', 'brain.json');
const TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const WRITE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const TOOLS = [
  {
    name: 'membridge_extract',
    description:
      'Extract and categorize portable memories (identity, projects, stack, preferences, rules) from raw text, a ChatGPT/Claude conversations.json export, or a .brain.json. Provide either "text" or "path".',
    annotations: TOOL_ANNOTATIONS,
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
    annotations: TOOL_ANNOTATIONS,
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
    annotations: TOOL_ANNOTATIONS,
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
  },
  {
    name: 'membridge_remember',
    description:
      'Save a durable memory fact into your local portable brain file (~/.membridge/brain.json) so it persists across Claude, Cursor, Antigravity, and other MCP clients.',
    annotations: WRITE_ANNOTATIONS,
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Fact, preference, project, or rule to remember.' },
        category: { type: 'string', enum: CATEGORY_IDS, description: 'Optional category (auto-detected if omitted).' },
        redact: { type: 'boolean', description: 'Mask secrets before saving (default true).' },
      },
      required: ['text'],
    },
  },
  {
    name: 'membridge_recall',
    description:
      'Search or retrieve saved memories from your local portable brain (~/.membridge/brain.json), optionally formatted for a specific AI platform.',
    annotations: TOOL_ANNOTATIONS,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional keyword filter.' },
        category: { type: 'string', enum: CATEGORY_IDS, description: 'Optional category filter.' },
        target: { type: 'string', enum: TARGET_IDS, description: 'Optional destination format (e.g. claude, markdown, json).' },
      },
    },
  },
];

const RESOURCES = [
  {
    uri: 'membridge://prompt/quick-extract',
    name: 'Universal AI Memory Quick-Extract Prompt',
    mimeType: 'text/plain',
    description: 'Prompt to extract stored memories from any AI assistant.',
  },
];

const PROMPTS = [
  {
    name: 'extract-ai-memory',
    description: 'Prompt to dump all stored user memories from ChatGPT, Claude, or Gemini',
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

async function loadBrain() {
  try {
    const raw = await fs.readFile(BRAIN_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.memories) ? parsed.memories : [];
  } catch (_err) {
    return [];
  }
}

async function saveBrain(memories) {
  await fs.mkdir(path.dirname(BRAIN_PATH), { recursive: true });
  const payload = {
    version: '1.0',
    format: 'membridge.brain.json',
    exportedAt: new Date().toISOString(),
    memories,
  };
  await fs.writeFile(BRAIN_PATH, JSON.stringify(payload, null, 2), 'utf8');
}

async function callTool(name, args = {}) {
  if (name === 'membridge_redact') {
    return redactSecrets(String(args.text || ''));
  }
  if (name === 'membridge_remember') {
    const rawText = String(args.text || '').trim();
    if (!rawText) throw new Error('Provide non-empty "text" to remember.');
    const finalText = args.redact === false ? rawText : redactSecrets(rawText);
    const category = CATEGORY_IDS.includes(args.category) ? args.category : inferCategory(finalText);
    const memories = await loadBrain();
    const norm = finalText.toLowerCase();
    const existing = memories.find((m) => String(m.text || '').toLowerCase() === norm);
    if (!existing) {
      memories.unshift({
        id: `mem_${Date.now().toString(36)}`,
        category,
        text: finalText,
        source: 'mcp-remember',
        enabled: true,
      });
      await saveBrain(memories);
    }
    return JSON.stringify(
      { saved: !existing, duplicate: Boolean(existing), category, text: finalText, totalMemories: memories.length, path: BRAIN_PATH },
      null,
      2
    );
  }
  if (name === 'membridge_recall') {
    const memories = await loadBrain();
    const q = String(args.query || '').trim().toLowerCase();
    const cat = args.category;
    const filtered = memories.filter((m) => {
      if (cat && m.category !== cat) return false;
      if (q && !String(m.text || '').toLowerCase().includes(q)) return false;
      return m.enabled !== false;
    });
    if (args.target) {
      if (!TARGETS[args.target]) {
        throw new Error(`Unknown target "${args.target}". Valid: ${TARGET_IDS.join(', ')}`);
      }
      return formatForTarget(filtered, args.target, { redact: true }).output;
    }
    return JSON.stringify({ count: filtered.length, path: BRAIN_PATH, memories: filtered }, null, 2);
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
          capabilities: { tools: {}, resources: {}, prompts: {} },
          serverInfo: SERVER_INFO,
        },
      });
    }
    if (method === 'notifications/initialized' || isNotification) return undefined;
    if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
    if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    if (method === 'resources/list') return send({ jsonrpc: '2.0', id, result: { resources: RESOURCES } });
    if (method === 'resources/templates/list') return send({ jsonrpc: '2.0', id, result: { resourceTemplates: [] } });
    if (method === 'resources/read') {
      const uri = params && params.uri;
      if (uri !== RESOURCES[0].uri) {
        return send({ jsonrpc: '2.0', id, error: { code: -32602, message: `Unknown resource: ${uri}` } });
      }
      return send({
        jsonrpc: '2.0',
        id,
        result: { contents: [{ uri, mimeType: 'text/plain', text: EXTRACTION_PROMPT }] },
      });
    }
    if (method === 'prompts/list') return send({ jsonrpc: '2.0', id, result: { prompts: PROMPTS } });
    if (method === 'prompts/get') {
      const promptName = params && params.name;
      if (promptName !== PROMPTS[0].name) {
        return send({ jsonrpc: '2.0', id, error: { code: -32602, message: `Unknown prompt: ${promptName}` } });
      }
      return send({
        jsonrpc: '2.0',
        id,
        result: {
          description: PROMPTS[0].description,
          messages: [{ role: 'user', content: { type: 'text', text: EXTRACTION_PROMPT } }],
        },
      });
    }
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
