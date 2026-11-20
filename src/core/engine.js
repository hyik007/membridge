(function (root) {
  'use strict';

  const CATEGORIES = {
    identity: { id: 'identity', label: 'Identity & Role', short: 'Identity' },
    projects: { id: 'projects', label: 'Active Projects', short: 'Projects' },
    stack: { id: 'stack', label: 'Tech & Tools', short: 'Tech Stack' },
    preferences: { id: 'preferences', label: 'Style & Preferences', short: 'Preferences' },
    rules: { id: 'rules', label: 'Rules & Constraints', short: 'Rules' },
  };

  const CATEGORY_ORDER = ['identity', 'projects', 'stack', 'preferences', 'rules'];

  const TARGETS = {
    claude: {
      id: 'claude',
      name: 'Claude',
      ext: 'txt',
      url: 'https://claude.ai/settings/capabilities',
      instructions:
        'Open Claude -> Settings -> Capabilities -> Memory (or Project Instructions), then paste this XML-structured profile.',
    },
    chatgpt: {
      id: 'chatgpt',
      name: 'ChatGPT',
      ext: 'txt',
      url: 'https://chatgpt.com/#settings/Personalization',
      instructions:
        'Paste into Settings -> Personalization -> Custom Instructions (split into Box 1 & Box 2), OR paste the Quick-Save prompt into any new chat.',
    },
    gemini: {
      id: 'gemini',
      name: 'Gemini',
      ext: 'txt',
      url: 'https://gemini.google.com/saved-info',
      instructions:
        'Open Gemini -> Saved Info and add items, OR paste the entire block into a new Gemini chat to load your context immediately.',
    },
    deepseek: {
      id: 'deepseek',
      name: 'DeepSeek / Grok / Local',
      ext: 'txt',
      url: 'https://chat.deepseek.com/',
      instructions:
        'Paste this ultra-compact context bridge at the start of any chat in DeepSeek, Grok, Perplexity, Poe, or Open WebUI.',
    },
    markdown: {
      id: 'markdown',
      name: 'MEMORY.md (Agents)',
      ext: 'md',
      url: '',
      instructions:
        'Save as MEMORY.md or CLAUDE.md in your project root for Cursor, Antigravity, Claude Code, Windsurf, or GitHub Copilot.',
    },
    json: {
      id: 'json',
      name: '.brain.json',
      ext: 'brain.json',
      url: '',
      instructions:
        'Portable open-format backup (.brain.json). Re-import into MemBridge anytime or share with scripts and MCP servers.',
    },
  };

  const EXTRACTION_PROMPT = [
    'Export everything you know about me, my work, my preferences, and our ongoing projects so I can migrate my memory to another AI assistant.',
    '',
    'Format the output as concise, factual bullet points grouped under these exact headings:',
    '## Identity & Role',
    '## Active Projects',
    '## Tech & Tools',
    '## Style & Preferences',
    '## Rules & Constraints',
    '',
    'Keep each bullet under 1 sentence and omit any sensitive passwords or API keys.',
  ].join('\n');

  const SAMPLE_DATA = {
    chatgpt: JSON.stringify(
      [
        {
          id: 'conv-gpt-1',
          title: 'SaaS Architecture & Preferences',
          mapping: {
            n1: {
              message: {
                author: { role: 'user' },
                content: {
                  parts: [
                    'Hi! I am a full-stack indie developer based in Singapore. I am building MemBridge, an open-source tool to teleport AI memory between ChatGPT, Claude, and Gemini.',
                  ],
                },
              },
            },
            n2: {
              message: {
                author: { role: 'assistant' },
                content: { parts: ['Got it! Let us plan MemBridge.'] },
              },
            },
            n3: {
              message: {
                author: { role: 'user' },
                content: {
                  parts: [
                    'My preferred stack is TypeScript, React, Node.js, Tailwind CSS, and SQLite. For tests, my demo key was sk-proj-demo9876543210abcdef123456 and email dev@example.com.',
                  ],
                },
              },
            },
            n4: {
              message: {
                author: { role: 'user' },
                content: {
                  parts: [
                    'Always give concise, copy-pasteable code without long intro fluff. Never invent fake API endpoints or unverified library versions. Thanks!',
                  ],
                },
              },
            },
            n5: {
              message: {
                author: { role: 'user' },
                content: { parts: ['Can you fix this typo in README?'] },
              },
            },
          },
        },
        {
          id: 'conv-gpt-2',
          title: 'Writing Style',
          mapping: {
            m1: {
              message: {
                author: { role: 'user' },
                content: {
                  parts: [
                    'I prefer bullet points, step-by-step checklists, and plain English explanations. I am targeting 5,000+ GitHub stars by focusing on zero-setup UX for non-technical users.',
                  ],
                },
              },
            },
          },
        },
      ],
      null,
      2
    ),
    claude: JSON.stringify(
      [
        {
          uuid: 'conv-claude-1',
          name: 'Product & Design Workflow',
          chat_messages: [
            {
              sender: 'human',
              text: 'I am a product designer and solo founder working on an AI workflow automation studio for small e-commerce teams.',
            },
            {
              sender: 'assistant',
              text: 'Sounds exciting! How can I help?',
            },
            {
              sender: 'human',
              text: 'I use Figma, Next.js, Supabase, and Python FastAPI. Always explain tradeoffs briefly before writing code.',
            },
            {
              sender: 'human',
              text: 'Never use corporate buzzwords in marketing copy—write like a helpful friend. My contact is founder@shopstudio.io.',
            },
            {
              sender: 'human',
              text: 'Looks good, thank you!',
            },
          ],
        },
      ],
      null,
      2
    ),
    raw: [
      '## Identity & Role',
      '- Senior software engineer and open-source creator based in Malaysia',
      '- Bilingual in English and Mandarin; prefers English for technical docs',
      '',
      '## Active Projects',
      '- Building MemBridge: a 1-click local-first AI memory bridge across ChatGPT, Claude, Gemini, and DeepSeek',
      '- Launching a lightweight Chrome Extension + Web Studio for non-technical AI users',
      '',
      '## Tech & Tools',
      '- Primary stack: JavaScript/TypeScript, Python, Node.js, React, Tailwind CSS',
      '- Daily environment: Windows 11, VS Code, Git, and local Ollama models',
      '',
      '## Style & Preferences',
      '- Prefer concise, direct answers with concrete examples instead of generic theory',
      '- Show step-by-step instructions when setting up new tools',
      '',
      '## Rules & Constraints',
      '- Always prioritize local-first privacy and zero external tracking',
      '- Never include real API keys like sk-live-secret1234567890abcdef in exported prompts',
    ].join('\n'),
  };

  const SECRET_RULES = [
    { regex: /\bsk-(?:proj-|ant-|live-|test-)?[A-Za-z0-9_-]{16,}\b/g, replacement: '[REDACTED_API_KEY]' },
    { regex: /\bgh[pousr]_[A-Za-z0-9_]{16,}\b/g, replacement: '[REDACTED_TOKEN]' },
    { regex: /\bAIza[0-9A-Za-z_-]{20,}\b/g, replacement: '[REDACTED_API_KEY]' },
    { regex: /\bAKIA[0-9A-Z]{16}\b/g, replacement: '[REDACTED_AWS_KEY]' },
    { regex: /\bBearer\s+[A-Za-z0-9._-]{16,}\b/gi, replacement: 'Bearer [REDACTED_TOKEN]' },
    { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: '[REDACTED_EMAIL]' },
  ];

  function hasSecret(text) {
    if (!text) return false;
    return SECRET_RULES.some(({ regex }) => {
      const clone = new RegExp(regex.source, regex.flags.replace('g', ''));
      return clone.test(text);
    });
  }

  function redactSecrets(text) {
    if (!text) return '';
    let result = String(text);
    for (const rule of SECRET_RULES) {
      result = result.replace(rule.regex, rule.replacement);
    }
    return result;
  }

  function inferCategory(text, headingHint = '') {
    const hint = headingHint.toLowerCase();
    if (hint.includes('rule') || hint.includes('constraint')) return 'rules';
    if (hint.includes('preference') || hint.includes('style')) return 'preferences';
    if (hint.includes('stack') || hint.includes('tech') || hint.includes('tool')) return 'stack';
    if (hint.includes('project') || hint.includes('goal')) return 'projects';
    if (hint.includes('identity') || hint.includes('role') || hint.includes('about')) return 'identity';

    const lower = text.toLowerCase();
    if (/\b(always|never|do not|don't|must not|must|strictly|avoid|omit|forbid)\b/.test(lower)) {
      return 'rules';
    }
    if (/\b(prefer|prefers|like|style|concise|brief|detailed|step-by-step|tone|explain|checklist|bullet|plain english)\b/.test(lower)) {
      return 'preferences';
    }
    if (/\b(building|working on|project|launching|developing|startup|repo|targeting|open-source tool)\b/.test(lower)) {
      return 'projects';
    }
    if (
      /\b(typescript|javascript|python|rust|go|react|next\.?js|tailwind|node\.?js|docker|sqlite|postgres|supabase|fastapi|figma|aws|windows|mac|linux|vscode|cursor|ollama|git)\b/.test(
        lower
      )
    ) {
      return 'stack';
    }
    if (/\b(i am|i'm|my role|work as|founder|developer|engineer|designer|student|based in|bilingual|senior|indie)\b/.test(lower)) {
      return 'identity';
    }
    return 'preferences';
  }

  function isLikelySignal(sentence, fromConversationLog) {
    const clean = sentence.trim();
    if (clean.length < 12 || clean.length > 360) return false;
    if (!fromConversationLog) return true;

    // Filter out casual chat filler and pure questions in conversation logs
    if (/^(hi|hello|hey|thanks|thank you|ok|okay|cool|great|sure|looks good)[!.\s]*$/i.test(clean)) {
      return false;
    }
    const signalRegex =
      /\b(i am|i'm|my|we are|our|building|working on|project|prefer|prefers|always|never|don't|do not|must|stack|using|use|based in|founder|developer|engineer|designer|style|concise|brief|step-by-step|explain|targeting|bilingual)\b/i;
    if (clean.endsWith('?') && !/\b(prefer|always|never|rule)\b/i.test(clean)) {
      return false;
    }
    return signalRegex.test(clean);
  }

  function cleanStatement(raw) {
    return raw
      .replace(/^[-*•]+\s+/, '')
      .replace(/^\d+[.)]\s+/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function splitCandidateLines(text, fromConversationLog) {
    if (!text || typeof text !== 'string') return [];
    const lines = text.split(/\r?\n/);
    const results = [];
    let currentHeading = '';

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('#')) {
        let hashes = 0;
        while (hashes < trimmed.length && trimmed[hashes] === '#') hashes++;
        if (hashes >= 1 && hashes <= 4 && hashes < trimmed.length && /\s/.test(trimmed[hashes])) {
          const heading = trimmed.slice(hashes).trim();
          if (heading) {
            currentHeading = heading;
            continue;
          }
        }
      }

      if (fromConversationLog) {
        const sentences = trimmed.split(/(?<=[.!?])\s+/);
        for (const s of sentences) {
          const cleaned = cleanStatement(s);
          if (isLikelySignal(cleaned, true)) {
            results.push({ text: cleaned, headingHint: currentHeading });
          }
        }
      } else {
        const cleaned = cleanStatement(trimmed);
        if (isLikelySignal(cleaned, false)) {
          results.push({ text: cleaned, headingHint: currentHeading });
        }
      }
    }
    return results;
  }

  function extractFromChatGPT(data) {
    const texts = [];
    for (const conv of data) {
      if (!conv || typeof conv !== 'object' || !conv.mapping) continue;
      for (const node of Object.values(conv.mapping)) {
        const msg = node && node.message;
        if (!msg || !msg.author || msg.author.role !== 'user') continue;
        const parts = msg.content && msg.content.parts;
        if (Array.isArray(parts)) {
          for (const part of parts) {
            if (typeof part === 'string' && part.trim()) {
              texts.push(part);
            }
          }
        }
      }
    }
    return texts;
  }

  function extractFromClaude(data) {
    const texts = [];
    for (const conv of data) {
      if (!conv || typeof conv !== 'object' || !Array.isArray(conv.chat_messages)) continue;
      for (const msg of conv.chat_messages) {
        if (!msg || msg.sender !== 'human') continue;
        if (typeof msg.text === 'string' && msg.text.trim()) {
          texts.push(msg.text);
        } else if (Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block && typeof block.text === 'string' && block.text.trim()) {
              texts.push(block.text);
            }
          }
        }
      }
    }
    return texts;
  }

  function extractFromGenericJson(data) {
    const texts = [];
    const visit = (val) => {
      if (!val) return;
      if (typeof val === 'string') {
        if (val.trim().length >= 12) texts.push(val);
        return;
      }
      if (Array.isArray(val)) {
        for (const item of val) visit(item);
        return;
      }
      if (typeof val === 'object') {
        const role = String(val.role || val.sender || val.author || '').toLowerCase();
        if (role && !['user', 'human', 'me'].includes(role)) {
          return;
        }
        for (const key of ['text', 'prompt', 'content', 'parts', 'memory', 'value', 'memories']) {
          if (val[key] !== undefined) visit(val[key]);
        }
      }
    };
    visit(data);
    return texts;
  }

  function makeId(index, text) {
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
      hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }
    return `mem_${index}_${hash.toString(36)}`;
  }

  function parseInput(rawContent, fileName = '') {
    const raw = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent || '');
    const trimmed = raw.trim();
    if (!trimmed) {
      return { format: 'empty', rawChars: 0, items: [] };
    }

    let format = 'text';
    let items = [];
    let parsedJson = null;

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        parsedJson = JSON.parse(trimmed);
      } catch (_err) {
        parsedJson = null;
      }
    }

    // 1. Native .brain.json format
    if (parsedJson && !Array.isArray(parsedJson) && Array.isArray(parsedJson.memories)) {
      format = 'brain-json';
      const seen = new Set();
      parsedJson.memories.forEach((entry, idx) => {
        const text = cleanStatement(typeof entry === 'string' ? entry : entry.text || '');
        const norm = text.toLowerCase();
        if (!text || seen.has(norm)) return;
        seen.add(norm);
        const category = CATEGORIES[entry.category] ? entry.category : inferCategory(text);
        items.push({
          id: entry.id || makeId(idx, text),
          category,
          text,
          source: entry.source || fileName || 'brain.json',
          enabled: entry.enabled !== false,
          hasSecret: hasSecret(text),
        });
      });
      return { format, rawChars: raw.length, items };
    }

    let candidateSegments = [];
    let fromConversationLog = false;

    if (Array.isArray(parsedJson)) {
      if (parsedJson.some((c) => c && c.mapping)) {
        format = 'chatgpt-json';
        fromConversationLog = true;
        candidateSegments = extractFromChatGPT(parsedJson);
      } else if (parsedJson.some((c) => c && Array.isArray(c.chat_messages))) {
        format = 'claude-json';
        fromConversationLog = true;
        candidateSegments = extractFromClaude(parsedJson);
      } else {
        format = 'generic-json';
        fromConversationLog = parsedJson.length > 3;
        candidateSegments = extractFromGenericJson(parsedJson);
      }
    } else if (parsedJson && typeof parsedJson === 'object') {
      format = 'generic-json';
      candidateSegments = extractFromGenericJson(parsedJson);
    } else {
      format = fileName.endsWith('.md') ? 'markdown' : 'text';
      candidateSegments = [trimmed];
    }

    const seen = new Set();
    let idx = 0;
    for (const seg of candidateSegments) {
      const candidates = splitCandidateLines(seg, fromConversationLog);
      for (const { text, headingHint } of candidates) {
        let end = text.length;
        while (end > 0 && (text[end - 1] === '.' || text[end - 1] === '!' || text[end - 1] === '?')) {
          end--;
        }
        const norm = text.slice(0, end).toLowerCase();
        if (seen.has(norm)) continue;
        seen.add(norm);
        items.push({
          id: makeId(idx++, text),
          category: inferCategory(text, headingHint),
          text,
          source: format,
          enabled: true,
          hasSecret: hasSecret(text),
        });
      }
    }

    return { format, rawChars: raw.length, items };
  }

  function groupMemories(memories, redact = true) {
    const grouped = {};
    for (const cat of CATEGORY_ORDER) grouped[cat] = [];

    for (const item of memories) {
      if (!item || item.enabled === false) continue;
      const cat = CATEGORIES[item.category] ? item.category : 'preferences';
      const finalText = redact ? redactSecrets(item.text) : item.text;
      if (finalText.trim()) {
        grouped[cat].push(finalText.trim());
      }
    }
    return grouped;
  }

  function formatForTarget(memories, target = 'claude', options = {}) {
    const redact = options.redact !== false;
    const rawChars = Number(options.rawChars || 0);
    const active = memories.filter((m) => m && m.enabled !== false);
    const grouped = groupMemories(active, redact);
    const targetInfo = TARGETS[target] || TARGETS.claude;

    let output = '';

    if (target === 'claude') {
      const sections = [];
      for (const cat of CATEGORY_ORDER) {
        if (!grouped[cat].length) continue;
        sections.push(`  <${cat}>\n${grouped[cat].map((line) => `    - ${line}`).join('\n')}\n  </${cat}>`);
      }
      output = [
        'Please save and remember the following portable profile for our conversations:',
        '',
        '<user_profile>',
        sections.join('\n'),
        '</user_profile>',
      ].join('\n');
    } else if (target === 'chatgpt') {
      const aboutMe = [...grouped.identity, ...grouped.projects, ...grouped.stack];
      const howToRespond = [...grouped.preferences, ...grouped.rules];
      output = [
        '=== BOX 1: What would you like ChatGPT to know about you? ===',
        aboutMe.length ? aboutMe.map((l) => `- ${l}`).join('\n') : '- (No identity/project items selected)',
        '',
        '=== BOX 2: How would you like ChatGPT to respond? ===',
        howToRespond.length ? howToRespond.map((l) => `- ${l}`).join('\n') : '- (No style/rule items selected)',
        '',
        '=== OR PASTE THIS IN ANY CHAT TO SAVE TO MEMORY ===',
        `Please save these facts to my ChatGPT Memory:\n${[...aboutMe, ...howToRespond].map((l) => `- ${l}`).join('\n')}`,
      ].join('\n');
    } else if (target === 'gemini') {
      const lines = [];
      for (const cat of CATEGORY_ORDER) {
        for (const item of grouped[cat]) {
          lines.push(`- ${item}`);
        }
      }
      output = [
        'Remember these facts about me across our chats (for Gemini Saved Info or new chat context):',
        '',
        lines.join('\n'),
      ].join('\n');
    } else if (target === 'deepseek') {
      const parts = [];
      for (const cat of CATEGORY_ORDER) {
        if (!grouped[cat].length) continue;
        parts.push(`[${CATEGORIES[cat].short.toUpperCase()}]\n${grouped[cat].map((l) => `- ${l}`).join('\n')}`);
      }
      output = [
        '[USER CONTEXT BRIDGE — LOAD BEFORE RESPONDING]',
        parts.join('\n\n'),
        '',
        'Confirm you understand this context in 1 short sentence, then wait for my first task.',
      ].join('\n');
    } else if (target === 'markdown') {
      const parts = ['# Portable AI Memory (`MEMORY.md`)', ''];
      for (const cat of CATEGORY_ORDER) {
        if (!grouped[cat].length) continue;
        parts.push(`## ${CATEGORIES[cat].label}`);
        for (const line of grouped[cat]) {
          parts.push(`- ${line}`);
        }
        parts.push('');
      }
      output = parts.join('\n').trim();
    } else if (target === 'json') {
      const payload = {
        version: '1.0',
        format: 'membridge.brain.json',
        exportedAt: new Date().toISOString(),
        memories: active.map((m) => ({
          id: m.id,
          category: m.category,
          text: redact ? redactSecrets(m.text) : m.text,
          source: m.source || 'manual',
          enabled: true,
        })),
      };
      output = JSON.stringify(payload, null, 2);
    }

    const estimatedTokens = Math.max(1, Math.ceil(output.length / 4));
    const baselineChars = Math.max(rawChars, output.length);
    const compressionSavedPct =
      baselineChars > output.length
        ? Math.max(0, Math.round(((baselineChars - output.length) / baselineChars) * 100))
        : 0;

    return {
      target: targetInfo,
      output,
      stats: {
        totalItems: memories.length,
        activeItems: active.length,
        estimatedTokens,
        outputChars: output.length,
        compressionSavedPct,
      },
    };
  }

  const PLATFORM_LIMITS = {
    chatgpt: 1500,
    gemini: 4000,
    deepseek: 8000,
    claude: 12000,
    markdown: 16000,
    json: 32000,
  };

  const PRIORITY_ORDER = ['identity', 'rules', 'stack', 'projects', 'preferences', 'context'];

  function normalizeForDedup(text) {
    const collapsed = String(text || '').replace(/\s+/g, ' ').trim();
    let end = collapsed.length;
    while (end > 0 && (collapsed[end - 1] === '.' || collapsed[end - 1] === '!' || collapsed[end - 1] === '?')) {
      end--;
    }
    return collapsed.slice(0, end).toLowerCase();
  }

  function mergeMemories(existing = [], incoming = []) {
    const merged = [];
    const seen = new Set();
    for (const item of existing) {
      const key = normalizeForDedup(item && item.text);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
    let added = 0;
    let skipped = 0;
    for (const item of incoming) {
      const key = normalizeForDedup(item && item.text);
      if (!key) continue;
      if (seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);
      merged.push(item);
      added++;
    }
    return { memories: merged, added, skipped };
  }

  function autoFitMemories(memories = [], targetId = 'chatgpt', redact = true) {
    const limit = PLATFORM_LIMITS[targetId] || 4000;
    const enabled = memories.filter((m) => m && m.enabled !== false);
    const ranked = [...enabled].sort((a, b) => {
      const pa = PRIORITY_ORDER.indexOf(a.category);
      const pb = PRIORITY_ORDER.indexOf(b.category);
      const ra = pa === -1 ? 99 : pa;
      const rb = pb === -1 ? 99 : pb;
      if (ra !== rb) return ra - rb;
      return (a.text || '').length - (b.text || '').length;
    });

    const chosen = [];
    for (const item of ranked) {
      const candidate = [...chosen, item];
      const formatted = formatForTarget(candidate, targetId, { redact });
      if (formatted.stats.outputChars <= limit || chosen.length === 0) {
        chosen.push(item);
      }
    }

    const selectedIds = new Set(chosen.map((m) => m.id));
    const finalOut = formatForTarget(chosen, targetId, { redact });
    return {
      selectedIds,
      kept: chosen.length,
      trimmed: Math.max(0, enabled.length - chosen.length),
      chars: finalOut.stats.outputChars,
      limit,
    };
  }

  root.MemBridge = {
    CATEGORIES,
    CATEGORY_ORDER,
    TARGETS,
    PLATFORM_LIMITS,
    EXTRACTION_PROMPT,
    SAMPLE_DATA,
    hasSecret,
    redactSecrets,
    inferCategory,
    parseInput,
    formatForTarget,
    mergeMemories,
    autoFitMemories,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
