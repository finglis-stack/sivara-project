/**
 * Service de chiffrement AES-256-GCM côté client
 * Architecture KEK/DEK (Key Encryption Key / Data Encryption Key)
 * 
 * - DEK: Clé aléatoire 32 bytes (CSPRNG), chiffre/déchiffre les documents
 * - KEK: Dérivée du user.id + sel aléatoire (PBKDF2 210k SHA-512), protège la DEK
 * - La DEK chiffrée (wrapped) est stockée dans profiles.encrypted_dek
 */

import { supabase } from '@/integrations/supabase/client';

const PBKDF2_ITERATIONS = 210000;
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

export class EncryptionService {
  private static instance: EncryptionService;
  private masterKey: CryptoKey | null = null;
  private cachedUserId: string | null = null;

  private constructor() {}

  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  // ─── HELPERS ───

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

  // ─── KEK DERIVATION ───

  /**
   * Derive the Key Encryption Key from a password/userId + salt
   * Uses PBKDF2 with 210k iterations and SHA-512
   */
  private async deriveKEK(secret: string, salt: Uint8Array): Promise<CryptoKey> {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-512' },
      keyMaterial,
      { name: 'AES-GCM', length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // ─── DEK MANAGEMENT ───

  /**
   * Generate a new random DEK (32 bytes CSPRNG)
   */
  private generateDEK(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(32));
  }

  /**
   * Wrap (encrypt) the DEK with the KEK for storage
   */
  private async wrapDEK(dekRaw: Uint8Array, kek: CryptoKey): Promise<{ wrapped: string; iv: string }> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      kek,
      dekRaw
    );
    return {
      wrapped: this.arrayBufferToBase64(encrypted),
      iv: this.arrayBufferToBase64(iv),
    };
  }

  /**
   * Unwrap (decrypt) the DEK using the KEK
   */
  private async unwrapDEK(wrappedBase64: string, ivBase64: string, kek: CryptoKey): Promise<Uint8Array> {
    const wrapped = this.base64ToArrayBuffer(wrappedBase64);
    const iv = this.base64ToArrayBuffer(ivBase64);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      kek,
      wrapped
    );
    return new Uint8Array(decrypted);
  }

  // ─── INITIALIZATION ───

  /**
   * Initialize encryption for Supabase documents using KEK/DEK architecture.
   * Fetches the user's encrypted DEK from profiles, derives the KEK, unwraps the DEK.
   * If no DEK exists yet (first login), generates one automatically (lazy provisioning).
   * 
   * @param userId The user's UUID (used as KEK derivation secret)
   */
  async initialize(userId: string): Promise<void> {
    // Cache: don't re-derive if already initialized for this user
    if (this.masterKey && this.cachedUserId === userId) return;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('encrypted_dek, kek_salt, dek_iv')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      throw new Error('Profil introuvable. Impossible d\'initialiser le chiffrement.');
    }

    if (profile.encrypted_dek && profile.kek_salt && profile.dek_iv) {
      // Existing user: unwrap the DEK
      const salt = this.base64ToArrayBuffer(profile.kek_salt);
      const kek = await this.deriveKEK(userId, salt);
      const dekRaw = await this.unwrapDEK(profile.encrypted_dek, profile.dek_iv, kek);
      
      this.masterKey = await crypto.subtle.importKey(
        'raw', dekRaw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
      );
      this.cachedUserId = userId;
    } else {
      // First time: generate DEK, wrap with KEK, save to profile
      const dekRaw = this.generateDEK();
      const kekSalt = crypto.getRandomValues(new Uint8Array(16));
      const kek = await this.deriveKEK(userId, kekSalt);
      const { wrapped, iv } = await this.wrapDEK(dekRaw, kek);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          encrypted_dek: wrapped,
          kek_salt: this.arrayBufferToBase64(kekSalt),
          dek_iv: iv,
        })
        .eq('id', userId);

      if (updateError) {
        throw new Error('Impossible de sauvegarder la clé de chiffrement.');
      }

      this.masterKey = await crypto.subtle.importKey(
        'raw', dekRaw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
      );
      this.cachedUserId = userId;
    }
  }

  /**
   * Initialize encryption with a direct PBKDF2-derived key.
   * Used for .sivara file encryption/decryption (password mode or auto_key mode).
   * Does NOT fetch from Supabase — purely local key derivation.
   * 
   * @param secret The password or auto_key
   * @param saltString Optional salt string (for password-protected .sivara files)
   */
  async initializeDirect(secret: string, saltString?: string): Promise<void> {
    const encoder = new TextEncoder();

    let finalSalt: Uint8Array;
    if (saltString) {
      finalSalt = encoder.encode(saltString);
    } else {
      // Derive salt from secret via SHA-256 (deterministic but cryptographically separated)
      const saltInput = encoder.encode(`sivara-docs-salt-v3:${secret.toLowerCase().trim()}`);
      const saltHash = await crypto.subtle.digest('SHA-256', saltInput);
      finalSalt = new Uint8Array(saltHash);
    }

    const keyMaterial = await crypto.subtle.importKey(
      'raw', encoder.encode(secret), 'PBKDF2', false, ['deriveBits', 'deriveKey']
    );

    this.masterKey = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: finalSalt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-512' },
      keyMaterial,
      { name: 'AES-GCM', length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );

    // Clear cache — this isn't a user-bound initialization
    this.cachedUserId = null;
  }

  /**
   * Force re-initialization on next call (clears cache)
   */
  invalidateCache(): void {
    this.cachedUserId = null;
  }

  // ─── ENCRYPT / DECRYPT ───

  async encrypt(plaintext: string): Promise<{ encrypted: string; iv: string }> {
    if (!this.masterKey) throw new Error('Encryption service not initialized');

    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const iv = this.generateIV();

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

    const encryptedData = this.base64ToArrayBuffer(encrypted);
    const iv = this.base64ToArrayBuffer(ivBase64);

    try {
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv, tagLength: 128 },
        this.masterKey,
        encryptedData
      );
      return new TextDecoder().decode(decryptedData);
    } catch (_) {
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