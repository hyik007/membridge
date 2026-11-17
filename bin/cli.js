#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { SAMPLE_DATA, TARGETS, parseInput, formatForTarget } from '../src/core/engine.mjs';

function printHelp() {
  console.log(`MemBridge CLI — Universal AI Memory Teleport

Usage:
  membridge demo [--to <target>] [--no-redact]
  membridge <input-file> [--to <target>] [--out <output-file>] [--no-redact]

Targets:
  ${Object.keys(TARGETS).join(', ')}

Examples:
  node bin/cli.js demo --to claude
  node bin/cli.js conversations.json --to gemini --out gemini-memory.txt
  node bin/cli.js membridge.brain.json --to markdown --out MEMORY.md
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  let inputArg = null;
  let target = 'claude';
  let outFile = null;
  let redact = true;

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--to' && args[i + 1]) {
      target = args[++i].toLowerCase();
    } else if (a === '--out' && args[i + 1]) {
      outFile = args[++i];
    } else if (a === '--no-redact') {
      redact = false;
    } else if (!a.startsWith('-')) {
      inputArg = a;
    }
  }

  if (!TARGETS[target]) {
    console.error(`Unknown target "${target}". Valid targets: ${Object.keys(TARGETS).join(', ')}`);
    process.exit(1);
  }

  let raw = '';
  let sourceName = 'demo';

  if (inputArg === 'demo') {
    raw = SAMPLE_DATA.chatgpt;
    sourceName = 'sample-chatgpt.json';
  } else if (inputArg) {
    const fullPath = path.resolve(process.cwd(), inputArg);
    raw = await fs.readFile(fullPath, 'utf8');
    sourceName = path.basename(fullPath);
  } else {
    printHelp();
    process.exit(1);
  }

  const parsed = parseInput(raw, sourceName);
  const formatted = formatForTarget(parsed.items, target, {
    redact,
    rawChars: parsed.rawChars,
  });

  if (outFile) {
    await fs.writeFile(path.resolve(process.cwd(), outFile), formatted.output, 'utf8');
    console.log(
      `Exported ${formatted.stats.activeItems} memories (${parsed.format} -> ${target}) to ${outFile} (~${formatted.stats.estimatedTokens} tokens)`
    );
  } else {
    console.log(formatted.output);
    console.error(
      `\n--- MemBridge: ${formatted.stats.activeItems} memories | ~${formatted.stats.estimatedTokens} tokens | ${formatted.stats.compressionSavedPct}% compressed ---`
    );
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
