(function (root) {
  'use strict';

  const VAULT_FORMAT = 'membridge.vault.v1';
  const PBKDF2_ITERATIONS = 120000;

  function getCrypto() {
    if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
      return globalThis.crypto;
    }
    throw new Error('Web Crypto API (crypto.subtle) is required for Encrypted Vaults.');
  }

  function bytesToBase64(bytes) {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(bytes).toString('base64');
    }
    let binary = '';
    const arr = new Uint8Array(bytes);
    for (let i = 0; i < arr.length; i++) {
      binary += String.fromCharCode(arr[i]);
    }
    return btoa(binary);
  }

  function base64ToBytes(b64) {
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(b64, 'base64'));
    }
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async function deriveAesKey(passphrase, salt, iterations) {
    const cryptoApi = getCrypto();
    const enc = new TextEncoder();
    const keyMaterial = await cryptoApi.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return cryptoApi.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  function isEncryptedVault(rawText) {
    if (typeof rawText !== 'string') return false;
    const trimmed = rawText.trim();
    if (!trimmed.startsWith('{')) return false;
    try {
      const parsed = JSON.parse(trimmed);
      return Boolean(parsed && parsed.format === VAULT_FORMAT && parsed.ciphertext && parsed.salt && parsed.iv);
    } catch (_err) {
      return false;
    }
  }

  async function encryptVault(brainPayload, passphrase) {
    if (typeof passphrase !== 'string' || passphrase.length < 4) {
      throw new Error('Passphrase must be at least 4 characters.');
    }
    const cryptoApi = getCrypto();
    const salt = cryptoApi.getRandomValues(new Uint8Array(16));
    const iv = cryptoApi.getRandomValues(new Uint8Array(12));
    const key = await deriveAesKey(passphrase, salt, PBKDF2_ITERATIONS);

    const plaintext = new TextEncoder().encode(JSON.stringify(brainPayload));
    const cipherBuf = await cryptoApi.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

    const envelope = {
      format: VAULT_FORMAT,
      alg: 'AES-256-GCM',
      kdf: 'PBKDF2-SHA256',
      iterations: PBKDF2_ITERATIONS,
      createdAt: new Date().toISOString(),
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(new Uint8Array(cipherBuf)),
    };
    return JSON.stringify(envelope, null, 2);
  }

  async function decryptVault(vaultText, passphrase) {
    if (typeof passphrase !== 'string' || !passphrase) {
      throw new Error('Passphrase is required to unlock this vault.');
    }
    let envelope;
    try {
      envelope = JSON.parse(String(vaultText || '').trim());
    } catch (_err) {
      throw new Error('Invalid vault file (not valid JSON).');
    }
    if (!envelope || envelope.format !== VAULT_FORMAT || !envelope.salt || !envelope.iv || !envelope.ciphertext) {
      throw new Error('Unsupported or corrupted MemBridge vault format.');
    }

    const cryptoApi = getCrypto();
    const salt = base64ToBytes(envelope.salt);
    const iv = base64ToBytes(envelope.iv);
    const ciphertext = base64ToBytes(envelope.ciphertext);
    const iterations = Number(envelope.iterations) || PBKDF2_ITERATIONS;
    const key = await deriveAesKey(passphrase, salt, iterations);

    try {
      const plainBuf = await cryptoApi.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
      const decoded = new TextDecoder().decode(plainBuf);
      return JSON.parse(decoded);
    } catch (_err) {
      throw new Error('Incorrect passphrase or corrupted encrypted vault.');
    }
  }

  const api = {
    VAULT_FORMAT,
    isEncryptedVault,
    encryptVault,
    decryptVault,
  };

  root.MemBridgeVault = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
