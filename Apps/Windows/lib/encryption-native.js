/**
 * Sivara Encryption Service — Native (Electron)
 * Port of encryption.ts for Node.js/Electron renderer
 * AES-256-GCM with PBKDF2 (100k iterations, SHA-512)
 */

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

class EncryptionService {
  constructor() {
    this.masterKey = null;
  }

  async initialize(secret, saltString) {
    const encoder = new TextEncoder();

    const finalSalt = saltString
      ? encoder.encode(saltString)
      : encoder.encode(`${secret.toLowerCase().trim()}:sivara-docs-persistent-key-v2`);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    this.masterKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: finalSalt,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-512',
      },
      keyMaterial,
      { name: 'AES-GCM', length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  _generateIV() {
    return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  }

  _arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  _base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async encrypt(plaintext, ivBase64) {
    if (!this.masterKey) throw new Error('Encryption service not initialized');

    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const iv = ivBase64 ? this._base64ToArrayBuffer(ivBase64) : this._generateIV();

    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv, tagLength: 128 },
      this.masterKey,
      data
    );

    return {
      encrypted: this._arrayBufferToBase64(encryptedData),
      iv: this._arrayBufferToBase64(iv),
    };
  }

  async decrypt(encrypted, ivBase64) {
    if (!this.masterKey) throw new Error('Encryption service not initialized');

    try {
      const encryptedData = this._base64ToArrayBuffer(encrypted);
      const iv = this._base64ToArrayBuffer(ivBase64);

      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv, tagLength: 128 },
        this.masterKey,
        encryptedData
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedData);
    } catch (error) {
      throw new Error('Clé incorrecte ou données corrompues.');
    }
  }
}

// Singleton
if (typeof window !== 'undefined') {
  window.EncryptionService = EncryptionService;
}
if (typeof module !== 'undefined') {
  module.exports = { EncryptionService };
}
