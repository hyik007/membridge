(function () {
  'use strict';

  const STORAGE_KEY = 'membridge_ext_items';
  const siteBadge = document.getElementById('site-badge');
  const countEl = document.getElementById('count');
  const previewEl = document.getElementById('preview');
  const statusEl = document.getElementById('status');
  const btnExtract = document.getElementById('btn-extract');
  const btnClear = document.getElementById('btn-clear');
  const btnInject = document.getElementById('btn-inject');
  const btnExport = document.getElementById('btn-export');

  let currentPlatform = 'unknown';

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  function formatBridge(items, targetPlatform) {
    if (!items.length) return '';
    const bullets = items.map((item) => `- ${item.text}`).join('\n');
    if (targetPlatform === 'claude') {
      return `Please remember this portable context about me:\n\n<user_profile>\n${bullets}\n</user_profile>`;
    }
    return `[USER CONTEXT BRIDGE — LOAD BEFORE RESPONDING]\n${bullets}\n\nAcknowledge this context briefly and wait for my next message.`;
  }

  function renderItems(items) {
    countEl.textContent = String(items.length);
    previewEl.value = formatBridge(items, currentPlatform);
  }

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  function matchesHost(hostname, domain) {
    return hostname === domain || hostname.endsWith(`.${domain}`);
  }

  function detectHost(url = '') {
    let host = '';
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch (_err) {
      return 'unsupported';
    }
    if (matchesHost(host, 'chatgpt.com')) return 'chatgpt';
    if (matchesHost(host, 'claude.ai')) return 'claude';
    if (matchesHost(host, 'gemini.google.com')) return 'gemini';
    if (matchesHost(host, 'deepseek.com')) return 'deepseek';
    return 'unsupported';
  }

  async function init() {
    const tab = await getActiveTab();
    currentPlatform = detectHost(tab && tab.url);
    siteBadge.textContent = currentPlatform === 'unsupported' ? 'Open AI Chat' : currentPlatform.toUpperCase();

    const stored = await chrome.storage.local.get(STORAGE_KEY);
    renderItems(Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : []);
  }

  btnExtract.addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (!tab || !tab.id) return;
    try {
      const res = await chrome.tabs.sendMessage(tab.id, { type: 'MEMBRIDGE_EXTRACT' });
      if (!res || !Array.isArray(res.items) || !res.items.length) {
        setStatus('No user messages or selected text found on this tab.');
        return;
      }
      const stored = await chrome.storage.local.get(STORAGE_KEY);
      const existing = Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
      const seen = new Set(existing.map((m) => m.text.toLowerCase()));
      const merged = [...existing];
      for (const item of res.items) {
        if (!seen.has(item.text.toLowerCase())) {
          seen.add(item.text.toLowerCase());
          merged.push(item);
        }
      }
      await chrome.storage.local.set({ [STORAGE_KEY]: merged });
      renderItems(merged);
      setStatus(`Captured ${res.items.length} items from ${res.platform}!`);
    } catch (_err) {
      setStatus('Reload the AI chat tab once, then click Extract Brain.');
    }
  });

  btnClear.addEventListener('click', async () => {
    await chrome.storage.local.remove(STORAGE_KEY);
    renderItems([]);
    setStatus('Cleared stored memory bridge.');
  });

  btnInject.addEventListener('click', async () => {
    const text = previewEl.value.trim();
    if (!text) {
      setStatus('Capture or paste memories first.');
      return;
    }
    const tab = await getActiveTab();
    if (!tab || !tab.id) return;
    try {
      const res = await chrome.tabs.sendMessage(tab.id, { type: 'MEMBRIDGE_INJECT', text });
      setStatus(res && res.ok ? 'Injected into prompt box! Press Send.' : 'Could not locate prompt box on this page.');
    } catch (_err) {
      setStatus('Open ChatGPT, Claude, Gemini, or DeepSeek and reload the tab.');
    }
  });

  btnExport.addEventListener('click', async () => {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const items = Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
    const payload = {
      version: '1.0',
      format: 'membridge.brain.json',
      exportedAt: new Date().toISOString(),
      memories: items.map((m, i) => ({
        id: `ext_${i}`,
        category: 'preferences',
        text: m.text,
        source: m.source || 'extension',
        enabled: true,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'membridge.brain.json';
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Downloaded membridge.brain.json');
  });

  init();
})();
