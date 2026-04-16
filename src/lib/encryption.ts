/**
 * Service de chiffrement AES-256-GCM côté client
 * Niveau de sécurité: Standard Web (Persistant)
 */

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

export class EncryptionService {
  private static instance: EncryptionService;
  private masterKey: CryptoKey | null = null;

  private constructor() {}

  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Initialise la clé maître à partir d'un secret (ID utilisateur ou Mot de passe)
   * @param secret Le secret (ID ou Password)
   * @param saltString Optionnel: Un sel spécifique (pour les mots de passe)
   */
  async initialize(secret: string, saltString?: string): Promise<void> {
    const encoder = new TextEncoder();
    
    // Si pas de sel fourni, on utilise le mode "Persistant User ID" (Legacy/Auto)
    // Sinon on utilise le mode "Mot de passe" avec le sel fourni
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
        hash: 'SHA-512'
      },
      keyMaterial,
      { name: 'AES-GCM', length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private generateIV(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async encrypt(plaintext: string): Promise<{ encrypted: string; iv: string }> {
    if (!this.masterKey) throw new Error('Encryption service not initialized');

    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const iv = this.generateIV(); // SECURITY: Always generate a fresh IV — reusing IV with AES-GCM is catastrophic

    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv, tagLength: 128 },
      this.masterKey,
      data
    );

    return {
      encrypted: this.arrayBufferToBase64(encryptedData),
      iv: this.arrayBufferToBase64(iv)
    };
  }

  async decrypt(encrypted: string, ivBase64: string): Promise<string> {
    if (!this.masterKey) throw new Error('Encryption service not initialized');

    try {
      const encryptedData = this.base64ToArrayBuffer(encrypted);
      const iv = this.base64ToArrayBuffer(ivBase64);

      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv, tagLength: 128 },
        this.masterKey,
        encryptedData
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedData);
    } catch (error) {
      console.error("Decryption failed:", error);
      throw new Error('Clé incorrecte ou données corrompues.');
    }
  }
}

/**
 * Parse encryption IVs from a document's encryption_iv column.
 * Handles two formats:
 * - Legacy: a single base64 string (same IV used for title and content — v1 format)
 * - New: a JSON string { t: titleIv, c: contentIv } (separate IVs — security fix)
 */
export function parseDocumentIVs(ivField: string): { titleIv: string; contentIv: string } {
  if (!ivField) return { titleIv: '', contentIv: '' };
  try {
    // Try parsing as JSON (new format)
    if (ivField.startsWith('{')) {
      const parsed = JSON.parse(ivField);
      return { titleIv: parsed.t || parsed.titleIv || '', contentIv: parsed.c || parsed.contentIv || '' };
    }
  } catch (_) {}
  // Legacy format: single IV for both
  return { titleIv: ivField, contentIv: ivField };
}

export const encryptionService = EncryptionService.getInstance();