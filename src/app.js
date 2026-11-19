(function () {
  'use strict';

  const {
    CATEGORIES,
    CATEGORY_ORDER,
    TARGETS,
    EXTRACTION_PROMPT,
    SAMPLE_DATA,
    parseInput,
    formatForTarget,
    hasSecret,
    redactSecrets,
  } = window.MemBridge;

  const STORAGE_KEY = 'membridge_state_v1';

  const state = {
    memories: [],
    rawChars: 0,
    format: 'ready',
    activeCategory: 'all',
    search: '',
    redact: true,
    target: 'claude',
  };

  const els = {
    formatBadge: document.getElementById('format-badge'),
    btnClear: document.getElementById('btn-clear'),
    btnCopyPrompt: document.getElementById('btn-copy-prompt'),
    dropzone: document.getElementById('dropzone'),
    fileInput: document.getElementById('file-input'),
    rawInput: document.getElementById('raw-input'),
    btnExtract: document.getElementById('btn-extract'),
    importStatus: document.getElementById('import-status'),
    toggleRedact: document.getElementById('toggle-redact'),
    categoryTabs: document.getElementById('category-tabs'),
    searchInput: document.getElementById('search-input'),
    addForm: document.getElementById('add-form'),
    addCategory: document.getElementById('add-category'),
    addText: document.getElementById('add-text'),
    memoryList: document.getElementById('memory-list'),
    targetTabs: document.getElementById('target-tabs'),
    targetGuide: document.getElementById('target-guide'),
    outputPreview: document.getElementById('output-preview'),
    metricItems: document.getElementById('metric-items'),
    metricTokens: document.getElementById('metric-tokens'),
    metricSaved: document.getElementById('metric-saved'),
    btnCopyOutput: document.getElementById('btn-copy-output'),
    btnDownload: document.getElementById('btn-download'),
    btnOpenTarget: document.getElementById('btn-open-target'),
    toast: document.getElementById('toast'),
  };

  let toastTimer = null;

  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2200);
  }

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Copied ${label} to clipboard!`);
    } catch (_err) {
      const helper = document.createElement('textarea');
      helper.value = text;
      document.body.appendChild(helper);
      helper.select();
      document.execCommand('copy');
      document.body.removeChild(helper);
      showToast(`Copied ${label} to clipboard!`);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          memories: state.memories,
          rawChars: state.rawChars,
          format: state.format,
          redact: state.redact,
          target: state.target,
        })
      );
    } catch (_err) {
      // Ignore storage quota errors
    }
  }

  function loadInitialState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.memories) && parsed.memories.length) {
          state.memories = parsed.memories;
          state.rawChars = parsed.rawChars || 0;
          state.format = parsed.format || 'restored';
          state.redact = parsed.redact !== false;
          state.target = TARGETS[parsed.target] ? parsed.target : 'claude';
          els.toggleRedact.checked = state.redact;
          return;
        }
      }
    } catch (_err) {
      // Fallback to demo sample
    }
    runExtraction(SAMPLE_DATA.chatgpt, 'sample-chatgpt.json');
    els.rawInput.value = SAMPLE_DATA.chatgpt;
  }

  function runExtraction(rawText, fileName = '') {
    const result = parseInput(rawText, fileName);
    state.memories = result.items;
    state.rawChars = result.rawChars;
    state.format = result.format;
    state.activeCategory = 'all';
    els.importStatus.textContent = `Extracted ${result.items.length} memories (${result.format})`;
    saveState();
    renderAll();
  }

  function renderCategoryTabs() {
    const counts = { all: state.memories.length };
    for (const cat of CATEGORY_ORDER) counts[cat] = 0;
    for (const mem of state.memories) {
      if (counts[mem.category] !== undefined) counts[mem.category] += 1;
    }

    const tabs = [{ id: 'all', label: `All (${counts.all})` }];
    for (const cat of CATEGORY_ORDER) {
      tabs.push({ id: cat, label: `${CATEGORIES[cat].short} (${counts[cat]})` });
    }

    els.categoryTabs.innerHTML = '';
    for (const tab of tabs) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `tab-btn${state.activeCategory === tab.id ? ' active' : ''}`;
      btn.textContent = tab.label;
      btn.addEventListener('click', () => {
        state.activeCategory = tab.id;
        renderCategoryTabs();
        renderMemoryList();
      });
      els.categoryTabs.appendChild(btn);
    }
  }

  function renderMemoryList() {
    const q = state.search.trim().toLowerCase();
    const visible = state.memories.filter((item) => {
      if (state.activeCategory !== 'all' && item.category !== state.activeCategory) return false;
      if (q && !item.text.toLowerCase().includes(q)) return false;
      return true;
    });

    els.memoryList.innerHTML = '';
    if (!visible.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = state.memories.length
        ? 'No memories match the current filter.'
        : 'No memories loaded yet. Drop a file, paste text, or click a demo button on the left.';
      els.memoryList.appendChild(empty);
      return;
    }

    for (const item of visible) {
      const card = document.createElement('div');
      card.className = `memory-card${item.enabled === false ? ' disabled' : ''}`;

      const top = document.createElement('div');
      top.className = 'memory-card-top';

      const left = document.createElement('div');
      left.className = 'memory-card-left';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = item.enabled !== false;
      checkbox.ariaLabel = 'Include memory in export';
      checkbox.addEventListener('change', () => {
        item.enabled = checkbox.checked;
        saveState();
        renderMemoryList();
        renderOutput();
      });

      const select = document.createElement('select');
      select.className = 'cat-select';
      for (const cat of CATEGORY_ORDER) {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = CATEGORIES[cat].short;
        opt.selected = item.category === cat;
        select.appendChild(opt);
      }
      select.addEventListener('change', () => {
        item.category = select.value;
        saveState();
        renderCategoryTabs();
        renderOutput();
      });

      left.appendChild(checkbox);
      left.appendChild(select);

      if (item.hasSecret || hasSecret(item.text)) {
        const badge = document.createElement('span');
        badge.className = 'secret-badge';
        badge.textContent = state.redact ? 'Secret Masked' : 'Secret Exposed';
        left.appendChild(badge);
      }

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-delete';
      delBtn.textContent = '✕';
      delBtn.title = 'Delete memory';
      delBtn.addEventListener('click', () => {
        state.memories = state.memories.filter((m) => m.id !== item.id);
        saveState();
        renderAll();
      });

      top.appendChild(left);
      top.appendChild(delBtn);

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'memory-text-input';
      input.value = item.text;
      input.addEventListener('input', () => {
        item.text = input.value;
        item.hasSecret = hasSecret(item.text);
        saveState();
        renderOutput();
      });

      card.appendChild(top);
      card.appendChild(input);
      els.memoryList.appendChild(card);
    }
  }

  function renderTargetTabs() {
    els.targetTabs.innerHTML = '';
    for (const target of Object.values(TARGETS)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `target-btn${state.target === target.id ? ' active' : ''}`;
      btn.textContent = target.name;
      btn.addEventListener('click', () => {
        state.target = target.id;
        saveState();
        renderTargetTabs();
        renderOutput();
      });
      els.targetTabs.appendChild(btn);
    }
  }

  function renderOutput() {
    const formatted = formatForTarget(state.memories, state.target, {
      redact: state.redact,
      rawChars: state.rawChars,
    });

    els.formatBadge.textContent = `Source: ${state.format}`;
    els.targetGuide.textContent = formatted.target.instructions;
    els.outputPreview.value = formatted.output;
    els.metricItems.textContent = `${formatted.stats.activeItems}/${formatted.stats.totalItems} active`;
    els.metricTokens.textContent = `~${formatted.stats.estimatedTokens} tokens`;
    els.metricSaved.textContent = `${formatted.stats.compressionSavedPct}% compressed`;

    if (formatted.target.url) {
      els.btnOpenTarget.href = formatted.target.url;
      els.btnOpenTarget.hidden = false;
      els.btnOpenTarget.textContent = `Open ${formatted.target.name} ↗`;
    } else {
      els.btnOpenTarget.hidden = true;
    }
  }

  function renderAll() {
    renderCategoryTabs();
    renderMemoryList();
    renderTargetTabs();
    renderOutput();
  }

  // Event bindings
  els.btnCopyPrompt.addEventListener('click', () => copyText(EXTRACTION_PROMPT, 'Quick-Extract Prompt'));

  els.btnExtract.addEventListener('click', () => {
    runExtraction(els.rawInput.value, 'pasted-input.txt');
    showToast('Memories extracted & categorized!');
  });

  els.btnClear.addEventListener('click', () => {
    state.memories = [];
    state.rawChars = 0;
    state.format = 'empty';
    els.rawInput.value = '';
    els.importStatus.textContent = '';
    localStorage.removeItem(STORAGE_KEY);
    renderAll();
    showToast('Workspace reset');
  });

  document.querySelectorAll('[data-sample]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-sample');
      const data = SAMPLE_DATA[key] || '';
      els.rawInput.value = data;
      runExtraction(data, `sample-${key}`);
      showToast(`Loaded ${key} sample!`);
    });
  });

  async function handleFile(file) {
    if (!file) return;
    if (file.name.toLowerCase().endsWith('.zip') && window.MemBridgeZip) {
      try {
        els.importStatus.textContent = `Unzipping ${file.name} locally...`;
        const buf = await file.arrayBuffer();
        const extracted = await window.MemBridgeZip.extractBestTextFromZip(buf);
        const content = extracted.content || '';
        els.rawInput.value = content.length > 50000 ? `${content.slice(0, 50000)}\n... [preview truncated, full file parsed]` : content;
        runExtraction(content, extracted.fileName);
        showToast(`Unzipped ${extracted.fileName} from ${file.name}`);
      } catch (err) {
        els.importStatus.textContent = `ZIP error: ${err.message}`;
        showToast(err.message);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target.result || '');
      els.rawInput.value = content.length > 50000 ? `${content.slice(0, 50000)}\n... [preview truncated, full file parsed]` : content;
      runExtraction(content, file.name);
      showToast(`Imported ${file.name}`);
    };
    reader.readAsText(file);
  }

  const presetOllama = document.getElementById('preset-ollama');
  const presetOpenAI = document.getElementById('preset-openai');
  const aiEndpointEl = document.getElementById('ai-endpoint');
  const aiModelEl = document.getElementById('ai-model');
  const aiKeyEl = document.getElementById('ai-key');
  const btnAiCompress = document.getElementById('btn-ai-compress');
  const aiStatusEl = document.getElementById('ai-status');

  if (presetOllama) {
    presetOllama.addEventListener('click', () => {
      aiEndpointEl.value = 'http://localhost:11434/v1/chat/completions';
      aiModelEl.value = 'llama3.2';
      aiKeyEl.value = '';
      showToast('Configured for local Ollama');
    });
  }
  if (presetOpenAI) {
    presetOpenAI.addEventListener('click', () => {
      aiEndpointEl.value = 'https://api.openai.com/v1/chat/completions';
      aiModelEl.value = 'gpt-4o-mini';
      showToast('Configured for OpenAI API');
    });
  }
  if (btnAiCompress) {
    btnAiCompress.addEventListener('click', async () => {
      const endpoint = (aiEndpointEl.value || '').trim();
      const model = (aiModelEl.value || '').trim();
      const apiKey = (aiKeyEl.value || '').trim();
      const sourceText = state.memories.length
        ? state.memories.map((m) => `- ${m.text}`).join('\n')
        : (els.rawInput.value || '').trim();
      if (!endpoint || !model || !sourceText) {
        aiStatusEl.textContent = 'Provide input text, endpoint, and model first.';
        return;
      }

      const safePayload = (state.redact ? redactSecrets(sourceText) : sourceText).slice(0, 16000);
      btnAiCompress.disabled = true;
      aiStatusEl.textContent = `Compressing with ${model}...`;

      try {
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

        const res = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            temperature: 0.2,
            messages: [
              {
                role: 'system',
                content:
                  'Distill user context into concise, factual Markdown bullets grouped under these exact headings: ## Identity & Role, ## Active Projects, ## Tech & Tools, ## Style & Preferences, ## Rules & Constraints. Keep under 20 bullets total and omit sensitive secrets.',
              },
              { role: 'user', content: safePayload },
            ],
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const distilled = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
        if (!distilled) throw new Error('Empty response from model');
        els.rawInput.value = distilled;
        runExtraction(distilled, `ai-${model}.md`);
        aiStatusEl.textContent = `Compressed with ${model}!`;
        showToast('AI Smart Compress complete!');
      } catch (err) {
        aiStatusEl.textContent = `Failed: ${err.message} (check Ollama CORS or API key)`;
      } finally {
        btnAiCompress.disabled = false;
      }
    });
  }

  els.dropzone.addEventListener('click', () => els.fileInput.click());
  els.dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      els.fileInput.click();
    }
  });
  els.fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

  els.dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    els.dropzone.classList.add('dragover');
  });
  els.dropzone.addEventListener('dragleave', () => els.dropzone.classList.remove('dragover'));
  els.dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    els.dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  els.toggleRedact.addEventListener('change', () => {
    state.redact = els.toggleRedact.checked;
    saveState();
    renderMemoryList();
    renderOutput();
  });

  els.searchInput.addEventListener('input', () => {
    state.search = els.searchInput.value;
    renderMemoryList();
  });

  els.addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = els.addText.value.trim();
    if (!text) return;
    state.memories.unshift({
      id: `mem_manual_${Date.now().toString(36)}`,
      category: els.addCategory.value,
      text,
      source: 'manual',
      enabled: true,
      hasSecret: hasSecret(text),
    });
    els.addText.value = '';
    saveState();
    renderAll();
    showToast('Added memory card');
  });

  els.btnCopyOutput.addEventListener('click', () => {
    const targetName = TARGETS[state.target]?.name || state.target;
    copyText(els.outputPreview.value, `${targetName} Memory Pack`);
  });

  els.btnDownload.addEventListener('click', () => {
    const info = TARGETS[state.target] || TARGETS.markdown;
    const filename =
      state.target === 'markdown'
        ? 'MEMORY.md'
        : state.target === 'json'
        ? 'membridge.brain.json'
        : `membridge-${state.target}.${info.ext}`;
    const blob = new Blob([els.outputPreview.value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${filename}`);
  });

  loadInitialState();
})();
