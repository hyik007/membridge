(function (root) {
  'use strict';

  async function inflateRaw(compressedBytes) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('Browser does not support DecompressionStream for .zip files. Please unzip and drop conversations.json.');
    }
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(compressedBytes);
    writer.close();
    const response = new Response(ds.readable);
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  function findEndOfCentralDirectory(bytes) {
    const minOffset = Math.max(0, bytes.length - 65557);
    for (let i = bytes.length - 22; i >= minOffset; i -= 1) {
      if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
        return i;
      }
    }
    return -1;
  }

  async function extractBestTextFromZip(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);
    const eocdOffset = findEndOfCentralDirectory(bytes);
    if (eocdOffset < 0) {
      throw new Error('Invalid .zip archive (End of Central Directory not found).');
    }

    const totalEntries = view.getUint16(eocdOffset + 10, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);
    const decoder = new TextDecoder('utf-8');
    const entries = [];

    let ptr = cdOffset;
    for (let i = 0; i < totalEntries && ptr + 46 <= bytes.length; i += 1) {
      if (view.getUint32(ptr, true) !== 0x02014b50) break;
      const method = view.getUint16(ptr + 10, true);
      const compSize = view.getUint32(ptr + 20, true);
      const uncompSize = view.getUint32(ptr + 24, true);
      const nameLen = view.getUint16(ptr + 28, true);
      const extraLen = view.getUint16(ptr + 30, true);
      const commentLen = view.getUint16(ptr + 32, true);
      const localOffset = view.getUint32(ptr + 42, true);
      const name = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
      ptr += 46 + nameLen + extraLen + commentLen;

      if (name.endsWith('/') || name.startsWith('__MACOSX/')) continue;
      if (method !== 0 && method !== 8) continue;
      entries.push({ name, method, compSize, uncompSize, localOffset });
    }

    if (!entries.length) {
      throw new Error('No supported files found inside .zip archive.');
    }

    const priority = (name) => {
      const lower = name.toLowerCase();
      if (lower.endsWith('conversations.json')) return 100;
      if (lower.endsWith('.brain.json')) return 95;
      if (lower.includes('memor') && lower.endsWith('.json')) return 90;
      if (lower.endsWith('.json')) return 70;
      if (lower.endsWith('.md') || lower.endsWith('.txt')) return 50;
      return 0;
    };

    entries.sort((a, b) => priority(b.name) - priority(a.name) || b.uncompSize - a.uncompSize);
    const best = entries[0];
    if (priority(best.name) === 0) {
      throw new Error('No .json, .md, or .txt export found inside the .zip file.');
    }

    const lfh = best.localOffset;
    if (view.getUint32(lfh, true) !== 0x04034b50) {
      throw new Error('Corrupt ZIP local file header.');
    }
    const lNameLen = view.getUint16(lfh + 26, true);
    const lExtraLen = view.getUint16(lfh + 28, true);
    const dataStart = lfh + 30 + lNameLen + lExtraLen;
    const rawSlice = bytes.subarray(dataStart, dataStart + best.compSize);

    const outBytes = best.method === 0 ? rawSlice : await inflateRaw(rawSlice);
    return {
      fileName: best.name,
      content: decoder.decode(outBytes),
    };
  }

  root.MemBridgeZip = {
    extractBestTextFromZip,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
