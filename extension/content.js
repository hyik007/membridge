(function () {
  'use strict';

  function matchesHost(hostname, domain) {
    return hostname === domain || hostname.endsWith(`.${domain}`);
  }

  function detectPlatform() {
    const host = (window.location.hostname || '').toLowerCase();
    if (matchesHost(host, 'chatgpt.com')) return 'chatgpt';
    if (matchesHost(host, 'claude.ai')) return 'claude';
    if (matchesHost(host, 'gemini.google.com')) return 'gemini';
    if (matchesHost(host, 'deepseek.com')) return 'deepseek';
    return 'unknown';
  }

  function extractVisibleMemories() {
    const platform = detectPlatform();
    const collected = [];

    const selected = window.getSelection ? window.getSelection().toString().trim() : '';
    if (selected) {
      for (const line of selected.split(/\r?\n/)) {
        const clean = line.replace(/^[-*•]\s+/, '').trim();
        if (clean.length >= 10) collected.push({ text: clean, source: `${platform}-selection` });
      }
    }

    const selectorsByPlatform = {
      chatgpt: '[data-message-author-role="user"], [role="dialog"] li, [role="dialog"] td',
      claude: '[data-testid="user-message"], .font-user-message',
      gemini: 'user-query, .query-text, [data-test-id="saved-info-item"]',
      deepseek: '.fbb737a4, [class*="user"] p',
    };

    const selector = selectorsByPlatform[platform] || 'p';
    document.querySelectorAll(selector).forEach((el) => {
      const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length >= 15 && text.length <= 320) {
        collected.push({ text, source: platform });
      }
    });

    const seen = new Set();
    const unique = [];
    for (const item of collected) {
      const key = item.text.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    }
    return { platform, items: unique.slice(0, 40) };
  }

  function injectPrompt(text) {
    const candidates = [
      '#prompt-textarea',
      'div[contenteditable="true"][role="textbox"]',
      'div.ProseMirror[contenteditable="true"]',
      'rich-textarea div[contenteditable="true"]',
      'textarea',
    ];

    let target = null;
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) {
        target = el;
        break;
      }
    }
    if (!target) return false;

    target.focus();
    if (target.tagName === 'TEXTAREA') {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(target, text);
      target.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      target.innerText = text;
      target.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
    }
    return true;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.type) return;
    if (message.type === 'MEMBRIDGE_EXTRACT') {
      sendResponse(extractVisibleMemories());
      return true;
    }
    if (message.type === 'MEMBRIDGE_INJECT') {
      const ok = injectPrompt(message.text || '');
      sendResponse({ ok });
      return true;
    }
  });
})();
