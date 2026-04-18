/**
 * Service de chiffrement AES-256-GCM côté client
 * Architecture KEK/DEK — VRAI MOT DE PASSE
 * 
 * - DEK: Clé aléatoire 32 bytes (CSPRNG), chiffre/déchiffre les documents
 * - KEK: Dérivée du MOT DE PASSE réel + sel aléatoire 16 bytes (PBKDF2 210k SHA-512)
 * - Recovery Key: 2e copie de la DEK wrappée avec une clé de récupération
 * - DEK déverrouillée stockée en sessionStorage (disparaît à la fermeture de l'onglet)
 */

import { supabase } from '@/integrations/supabase/client';

const PBKDF2_ITERATIONS = 210000;
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SESSION_KEY = 'sivara-dek-session';

export interface ProfileCrypto {
  encrypted_dek: string;
  kek_salt: string;
  dek_iv: string;
  recovery_dek: string;
  recovery_salt: string;
  recovery_iv: string;
}

export class EncryptionService {
  private static instance: EncryptionService;
  private masterKey: CryptoKey | null = null;
  private documentKey: CryptoKey | null = null;

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

  arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Returns the active encryption key: documentKey (share) if set, else masterKey (DEK).
   */
  private getActiveKey(): CryptoKey {
    const key = this.documentKey || this.masterKey;
    if (!key) throw new Error('Encryption service not initialized');
    return key;
  }

  // ─── KEK DERIVATION ───

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

  // ─── DEK WRAP / UNWRAP ───

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

  // ─── SESSION PERSISTENCE ───

  private persistToSession(dekRaw: Uint8Array): void {
    try {
      sessionStorage.setItem(SESSION_KEY, this.arrayBufferToBase64(dekRaw));
    } catch (_) {}
  }

  private async loadMasterKey(dekRaw: Uint8Array): Promise<void> {
    this.masterKey = await crypto.subtle.importKey(
      'raw', dekRaw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']
    );
    this.persistToSession(dekRaw);
  }

  // ─── PUBLIC API ───

  /**
   * Restore DEK from sessionStorage (page refresh / navigation).
   * Throws if session has expired (user must re-login).
   */
  async ensureReady(): Promise<void> {
    if (this.masterKey) return;

    const dekB64 = sessionStorage.getItem(SESSION_KEY);
    if (!dekB64) {
      throw new Error('Session de chiffrement expirée. Reconnectez-vous.');
    }

    const dekRaw = this.base64ToArrayBuffer(dekB64);
    this.masterKey = await crypto.subtle.importKey(
      'raw', dekRaw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']
    );
  }

  /**
   * Check if the encryption service is ready (DEK in memory or session).
   */
  isReady(): boolean {
    return this.masterKey !== null || sessionStorage.getItem(SESSION_KEY) !== null;
  }

  // ─── DOCUMENT SHARE KEY ───

  /**
   * Generate a cryptographically random URL-safe share secret (256-bit).
   */
  generateShareSecret(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return this.arrayBufferToBase64(bytes)
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  /**
   * Derive and cache a per-document share key from a share secret.
   * Uses fast SHA-256 (not PBKDF2) because the secret is random 256-bit (high entropy).
   * This sets `documentKey` without touching `masterKey` (DEK).
   */
  async setDocumentShareKey(secret: string): Promise<void> {
    const encoder = new TextEncoder();
    const data = encoder.encode(`sivara-doc-share-v1:${secret}`);
    const hash = await crypto.subtle.digest('SHA-256', data);
    this.documentKey = await crypto.subtle.importKey(
      'raw', new Uint8Array(hash), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
    );
  }

  /**
   * Clear the per-document share key (call when navigating away from a shared doc).
   * After this, encrypt/decrypt will fall back to masterKey (DEK).
   */
  clearDocumentKey(): void {
    this.documentKey = null;
  }

  /**
   * Encrypt using the owner's DEK explicitly (ignores documentKey).
   * Used to wrap share secrets or to save the DEK-version of shared doc content.
   */
  async encryptWithMasterKey(plaintext: string): Promise<{ encrypted: string; iv: string }> {
    if (!this.masterKey) throw new Error('DEK not initialized');
    const data = new TextEncoder().encode(plaintext);
    const iv = this.generateIV();
    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      this.masterKey,
      data
    );
    return {
      encrypted: this.arrayBufferToBase64(encryptedData),
      iv: this.arrayBufferToBase64(iv),
    };
  }

  /**
   * Decrypt using the owner's DEK explicitly (ignores documentKey).
   * Used to unwrap share secrets.
   */
  async decryptWithMasterKey(encrypted: string, ivBase64: string): Promise<string> {
    if (!this.masterKey) throw new Error('DEK not initialized');
    const encryptedData = this.base64ToArrayBuffer(encrypted);
    const iv = this.base64ToArrayBuffer(ivBase64);
    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      this.masterKey,
      encryptedData
    );
    return new TextDecoder().decode(decryptedData);
  }

  /**
   * Login flow: Derive KEK from the REAL password, unwrap the DEK.
   * Called after successful Supabase signIn.
   */
  async initializeWithPassword(password: string, userId: string): Promise<void> {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('encrypted_dek, kek_salt, dek_iv')
      .eq('id', userId)
      .single();

    if (error || !profile || !profile.encrypted_dek || !profile.kek_salt || !profile.dek_iv) {
      throw new Error('Profil de chiffrement introuvable.');
    }

    const salt = this.base64ToArrayBuffer(profile.kek_salt);
    const kek = await this.deriveKEK(password, salt);

    try {
      const dekRaw = await this.unwrapDEK(profile.encrypted_dek, profile.dek_iv, kek);
      await this.loadMasterKey(dekRaw);
    } catch (_) {
      throw new Error('Mot de passe incorrect — impossible de déverrouiller la clé de chiffrement.');
    }
  }

  /**
   * Signup flow: Generate DEK + Recovery Key, wrap both.
   * Called after successful Supabase signUp + profile insert.
   * Returns the recovery key (show ONCE to user) and the DB data to save.
   */
  async setupNewUser(password: string): Promise<{ recoveryKey: string; profileData: ProfileCrypto }> {
    const dekRaw = crypto.getRandomValues(new Uint8Array(32));

    // 1. Wrap DEK with password-derived KEK
    const kekSalt = crypto.getRandomValues(new Uint8Array(16));
    const kek = await this.deriveKEK(password, kekSalt);
    const { wrapped: encDek, iv: dekIv } = await this.wrapDEK(dekRaw, kek);

    // 2. Generate recovery key (128-bit, hex, grouped)
    const recoveryBytes = crypto.getRandomValues(new Uint8Array(16));
    const recoveryKey = Array.from(recoveryBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
      .match(/.{4}/g)!
      .join('-');

    // 3. Wrap DEK with recovery-key-derived KEK
    const recoverySalt = crypto.getRandomValues(new Uint8Array(16));
    const recoveryKek = await this.deriveKEK(recoveryKey, recoverySalt);
    const { wrapped: recoveryWrapped, iv: recoveryIv } = await this.wrapDEK(dekRaw, recoveryKek);

    // 4. Load DEK into memory + session
    await this.loadMasterKey(dekRaw);

    return {
      recoveryKey,
      profileData: {
        encrypted_dek: encDek,
        kek_salt: this.arrayBufferToBase64(kekSalt),
        dek_iv: dekIv,
        recovery_dek: recoveryWrapped,
        recovery_salt: this.arrayBufferToBase64(recoverySalt),
        recovery_iv: recoveryIv,
      },
    };
  }

  /**
   * Password reset flow: Use recovery key to unwrap DEK, re-wrap with new password.
   * Called from ResetPassword page when user provides recovery key + new password.
   */
  async resetWithRecoveryKey(
    recoveryKey: string,
    newPassword: string,
    userId: string
  ): Promise<void> {
    // Fetch recovery data
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('recovery_dek, recovery_salt, recovery_iv')
      .eq('id', userId)
      .single();

    if (error || !profile || !profile.recovery_dek || !profile.recovery_salt || !profile.recovery_iv) {
      throw new Error('Aucune clé de récupération configurée pour ce compte.');
    }

    // Unwrap DEK with recovery key
    const recoverySalt = this.base64ToArrayBuffer(profile.recovery_salt);
    const recoveryKek = await this.deriveKEK(recoveryKey, recoverySalt);

    let dekRaw: Uint8Array;
    try {
      dekRaw = await this.unwrapDEK(profile.recovery_dek, profile.recovery_iv, recoveryKek);
    } catch (_) {
      throw new Error('Clé de récupération invalide.');
    }

    // Re-wrap DEK with new password
    const newSalt = crypto.getRandomValues(new Uint8Array(16));
    const newKek = await this.deriveKEK(newPassword, newSalt);
    const { wrapped: newEncDek, iv: newDekIv } = await this.wrapDEK(dekRaw, newKek);

    // Update profile (keep recovery_* unchanged — it's still valid)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        encrypted_dek: newEncDek,
        kek_salt: this.arrayBufferToBase64(newSalt),
        dek_iv: newDekIv,
      })
      .eq('id', userId);

    if (updateError) throw new Error('Erreur de sauvegarde des clés.');

    // Load DEK into memory + session
    await this.loadMasterKey(dekRaw);
  }

  /**
   * Voluntary password change (user knows old password).
   * Unwrap DEK with old password, re-wrap with new password.
   */
  async changePassword(oldPassword: string, newPassword: string, userId: string): Promise<void> {
    // Fetch current crypto data
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('encrypted_dek, kek_salt, dek_iv')
      .eq('id', userId)
      .single();

    if (error || !profile || !profile.encrypted_dek) {
      throw new Error('Profil de chiffrement introuvable.');
    }

    // Unwrap with old password
    const oldSalt = this.base64ToArrayBuffer(profile.kek_salt);
    const oldKek = await this.deriveKEK(oldPassword, oldSalt);

    let dekRaw: Uint8Array;
    try {
      dekRaw = await this.unwrapDEK(profile.encrypted_dek, profile.dek_iv, oldKek);
    } catch (_) {
      throw new Error('Ancien mot de passe incorrect.');
    }

    // Re-wrap with new password
    const newSalt = crypto.getRandomValues(new Uint8Array(16));
    const newKek = await this.deriveKEK(newPassword, newSalt);
    const { wrapped, iv } = await this.wrapDEK(dekRaw, newKek);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        encrypted_dek: wrapped,
        kek_salt: this.arrayBufferToBase64(newSalt),
        dek_iv: iv,
      })
      .eq('id', userId);

    if (updateError) throw new Error('Erreur de sauvegarde.');

    await this.loadMasterKey(dekRaw);
  }

  /**
   * Direct PBKDF2 key derivation for .sivara files.
   * Does NOT use KEK/DEK — standalone encryption for file export/import.
   */
  async initializeDirect(secret: string, saltString?: string): Promise<void> {
    const encoder = new TextEncoder();

    // Clear documentKey so .sivara export uses the derived key, not a stale share key
    this.documentKey = null;

    let finalSalt: Uint8Array;
    if (saltString) {
      finalSalt = encoder.encode(saltString);
    } else {
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
  }

  /**
   * Clear all encryption state (logout).
   */
  logout(): void {
    this.masterKey = null;
    this.documentKey = null;
    try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
  }

  /**
   * Invalidate in-memory cache (force reload from session on next call).
   */
  invalidateCache(): void {
    this.masterKey = null;
    // Note: documentKey is NOT cleared here — it is managed separately by the editor
  }

  // ─── ENCRYPT / DECRYPT ───

  async encrypt(plaintext: string): Promise<{ encrypted: string; iv: string }> {
    const key = this.getActiveKey();

    const data = new TextEncoder().encode(plaintext);
    const iv = this.generateIV();

    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      key,
      data
    );

    return {
      encrypted: this.arrayBufferToBase64(encryptedData),
      iv: this.arrayBufferToBase64(iv)
    };
  }

  async decrypt(encrypted: string, ivBase64: string): Promise<string> {
    const key = this.getActiveKey();

    const encryptedData = this.base64ToArrayBuffer(encrypted);
    const iv = this.base64ToArrayBuffer(ivBase64);

    try {
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, tagLength: 128 },
        key,
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
 */
export function parseDocumentIVs(ivField: string): { titleIv: string; contentIv: string } {
  if (!ivField) return { titleIv: '', contentIv: '' };
  try {
    if (ivField.startsWith('{')) {
      const parsed = JSON.parse(ivField);
      return { titleIv: parsed.t || parsed.titleIv || '', contentIv: parsed.c || parsed.contentIv || '' };
    }
  } catch (_) {}
  return { titleIv: ivField, contentIv: ivField };
}

export const encryptionService = EncryptionService.getInstance();