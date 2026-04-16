/**
 * Sivara Encryption Service — Native (Electron)
 * Port of encryption.ts for Node.js/Electron renderer
 * AES-256-GCM with PBKDF2 (100k iterations, SHA-512)
 */

const PBKDF2_ITERATIONS = 210000;
const PBKDF2_ITERATIONS_LEGACY = 100000;
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

class EncryptionService {
  constructor() {
    this.masterKey = null;
    this.legacyKey = null;
  }

  async initialize(secret, saltString) {
    const encoder = new TextEncoder();

    // SECURITY: Derive a proper 32-byte salt via SHA-256 instead of using raw secret as salt
    let finalSalt;
    if (saltString) {
      finalSalt = encoder.encode(saltString);
    } else {
      // Owner-bound mode: derive salt from secret through SHA-256
      const saltInput = encoder.encode(`sivara-docs-salt-v3:${secret.toLowerCase().trim()}`);
      const saltHash = await crypto.subtle.digest('SHA-256', saltInput);
      finalSalt = new Uint8Array(saltHash);
    }

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    // New key: 210k iterations, SHA-512, cryptographic salt
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

    // Legacy key: for backward compatibility with existing documents (100k iterations, old salt)
    const legacySalt = saltString
      ? encoder.encode(saltString)
      : encoder.encode(`${secret.toLowerCase().trim()}:sivara-docs-persistent-key-v2`);
    const legacyKeyMaterial = await crypto.subtle.importKey(
      'raw', encoder.encode(secret), 'PBKDF2', false, ['deriveBits', 'deriveKey']
    );
    this.legacyKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: legacySalt,
        iterations: PBKDF2_ITERATIONS_LEGACY,
        hash: 'SHA-512',
      },
      legacyKeyMaterial,
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

  async encrypt(plaintext) {
    if (!this.masterKey) throw new Error('Encryption service not initialized');

    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const iv = this._generateIV(); // SECURITY: Always generate a fresh IV — reusing IV with AES-GCM is catastrophic

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

    const encryptedData = this._base64ToArrayBuffer(encrypted);
    const iv = this._base64ToArrayBuffer(ivBase64);

    // Try new key first, then fall back to legacy key for backward compatibility
    try {
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv, tagLength: 128 },
        this.masterKey,
        encryptedData
      );
      return new TextDecoder().decode(decryptedData);
    } catch (_) {
      // Legacy fallback: document was encrypted with old KDF params
      if (this.legacyKey) {
        try {
          const decryptedData = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv, tagLength: 128 },
            this.legacyKey,
            encryptedData
          );
          return new TextDecoder().decode(decryptedData);
        } catch (e) {
          throw new Error('Clé incorrecte ou données corrompues.');
        }
      }
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
