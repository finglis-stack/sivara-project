/**
 * Service de chiffrement AES-256-GCM côté client
 * Niveau de sécurité: Standard Web (Persistant)
 * 
 * Caractéristiques:
 * - AES-256-GCM (Galois/Counter Mode)
 * - Chiffrement côté client
 * - Clé dérivée de l'ID utilisateur (Stable) pour assurer la persistance entre les sessions
 * - IV unique pour chaque document
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
   * Initialise la clé maître à partir de l'ID utilisateur unique.
   * CORRECTION: On n'utilise plus le sessionToken car il change à chaque connexion,
   * ce qui rendait les données indéchiffrables après un logout.
   */
  async initialize(userId: string): Promise<void> {
    const encoder = new TextEncoder();
    
    // Utilisation d'une graine stable basée sur l'ID utilisateur
    // Cela garantit que la clé sera la même à chaque reconnexion de cet utilisateur
    const saltData = encoder.encode(`${userId}:sivara-docs-persistent-key-v2`);
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      saltData,
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    this.masterKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltData,
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

  async encrypt(plaintext: string, ivBase64?: string): Promise<{ encrypted: string; iv: string }> {
    if (!this.masterKey) throw new Error('Encryption service not initialized');

    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const iv = ivBase64 ? this.base64ToArrayBuffer(ivBase64) : this.generateIV();

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
      throw new Error('Impossible de déchiffrer les données (Clé invalide ou données corrompues)');
    }
  }
}

export const encryptionService = EncryptionService.getInstance();