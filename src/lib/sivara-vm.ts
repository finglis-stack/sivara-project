import { supabase } from '@/integrations/supabase/client';
import FingerprintJS from '@fingerprintjs/fingerprintjs';

const _RT = (() => {
  const $ = (...c: number[]) => String.fromCharCode(...c);
  const _e = new TextEncoder();
  const _d = new TextDecoder();
  const b64 = (b: Uint8Array): string => {
    let r = '';
    for (let i = 0; i < b.length; i += 0x2000) {
      r += $.apply(null, Array.from(b.subarray(i, Math.min(i + 0x2000, b.length))));
    }
    return btoa(r);
  };
  const d64 = (s: string): Uint8Array => {
    const b = atob(s);
    const r = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) r[i] = b.charCodeAt(i);
    return r;
  };
  const i32 = (v: number): Uint8Array => {
    const b = new ArrayBuffer(4);
    new DataView(b).setInt32(0, v, false);
    return new Uint8Array(b);
  };
  const u32 = (v: number): Uint8Array => {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, v);
    return b;
  };
  // Obfuscation layer (NOT encryption) — rotate + XOR with linear counter
  const xF = (d: Uint8Array, k: number): Uint8Array => {
    const r = new Uint8Array(d.length);
    for (let i = 0; i < d.length; i++) {
      const m = (k + i) & 0xFF;
      r[i] = ((d[i] << 2) | (d[i] >>> 6)) ^ m;
    }
    return r;
  };
  // Reverse of xF
  const xR = (d: Uint8Array, k: number): Uint8Array => {
    const r = new Uint8Array(d.length);
    for (let i = 0; i < d.length; i++) {
      const m = (k + i) & 0xFF;
      const v = d[i] ^ m;
      r[i] = ((v >>> 2) | (v << 6)) & 0xFF;
    }
    return r;
  };
  // LCG-based stream obfuscation (NOT a secure cipher)
  const sx = (d: Uint8Array, k: number): Uint8Array => {
    const r = new Uint8Array(d.length);
    let s = k;
    for (let i = 0; i < d.length; i++) {
      s = (s * 1103515245 + 12345) >>> 0;
      r[i] = d[i] ^ ((s >>> 16) & 0xFF);
    }
    return r;
  };
  // Ghost/chaff blocks for anti-analysis padding
  const gB = (): Uint8Array[] => {
    const sz = (Math.random() * 0x400 | 0) + 0x40;
    return [new Uint8Array([0x1F]), u32(sz), crypto.getRandomValues(new Uint8Array(sz))];
  };

  const MAX_VM_INSTRUCTIONS = 100000;
  const MAX_VM_STACK = 1024;

  const vm = (bc: Uint8Array, env: { lat: number; lng: number }): number => {
    const s: number[] = [];
    const m: number[] = new Array(0x100).fill(0);
    const dv = new DataView(bc.buffer, bc.byteOffset, bc.byteLength);
    let p = 0;
    let instructionCount = 0;
    const r = (): number => { const v = dv.getInt32(p, false); p += 4; return v; };
    while (p < bc.length) {
      // SECURITY: Prevent infinite loop DoS from malicious bytecode
      if (++instructionCount > MAX_VM_INSTRUCTIONS) throw new Error('SBP_VM_INSTRUCTION_LIMIT');
      if (s.length > MAX_VM_STACK) throw new Error('SBP_VM_STACK_OVERFLOW');
      const o = bc[p++];
      switch (o) {
        case 0x10: s.push(r()); break;
        case 0x20: {
          const id = bc[p++];
          s.push(id === 0x01 ? Math.floor(Date.now() / 1e3) : id === 0x02 ? Math.round((env.lat || 0) * 1e4) : id === 0x03 ? Math.round((env.lng || 0) * 1e4) : 0);
          break;
        }
        case 0x60: m[r()] = s.pop()!; break;
        case 0x61: s.push(m[r()]); break;
        case 0x70: { const t = r(); if (t < 0 || t >= bc.length) throw new Error('SBP_VM_JMP_OOB'); p = t; break; }
        case 0x71: { const t = r(); if (s.pop() === 0) p = t; break; }
        case 0x50: s.push(s.pop()! + s.pop()!); break;
        case 0x51: { const b = s.pop()!; s.push(s.pop()! - b); break; }
        case 0x52: s.push(Math.abs(s.pop()!)); break;
        case 0x55: s.push(s.pop()! ^ s.pop()!); break;
        case 0x30: s.push(s.pop() === s.pop() ? 1 : 0); break;
        case 0x31: { const b = s.pop()!; s.push(s.pop()! > b ? 1 : 0); break; }
        case 0x32: { const b = s.pop()!; s.push(s.pop()! < b ? 1 : 0); break; }
        case 0x33: { const b = s.pop(); s.push((s.pop() === 1 && b === 1) ? 1 : 0); break; }
        case 0x34: { const b = s.pop(); s.push((s.pop() === 1 || b === 1) ? 1 : 0); break; }
        case 0x40: if (s.pop() !== 1) throw new Error($(0x53,0x42,0x50,0x5F,0x56,0x4D,0x5F,0x50,0x41,0x4E,0x49,0x43)); break;
        case 0x00: return s.pop() || 0;
      }
    }
    return s.pop() || 0;
  };
  const cc = (src: string): Uint8Array => {
    const tk = src.replace(/\(/g, ' ( ').replace(/\)/g, ' ) ').replace(/=/g, ' = ').trim().split(/\s+/).filter(t => t.length > 0);
    const bc: number[] = [];
    const vt = new Map<string, number>();
    let mp = 0, tp = 0;
    const em = (op: number, ...a: number[]) => bc.push(op, ...a);
    const e32 = (v: number) => i32(v).forEach(b => bc.push(b));
    const pj = (ai: number, ti: number) => { const b = i32(ti); for (let i = 0; i < 4; i++) bc[ai + i] = b[i]; };
    const pk = () => tk[tp];
    const nx = () => tk[tp++];
    const K0 = $(0x73,0x6F,0x69,0x74), K1 = $(0x73,0x69), K2 = $(0x65,0x78,0x69,0x67,0x65,0x72);
    const K3 = $(0x61,0x62,0x73), K4 = $(0x45,0x54), K5 = $(0x4F,0x55);
    const K6 = $(0x65,0x6E,0x76,0x2E,0x67,0x65,0x6F,0x2E,0x6C,0x61,0x74);
    const K7 = $(0x65,0x6E,0x76,0x2E,0x67,0x65,0x6F,0x2E,0x6C,0x6E,0x67);
    const K8 = $(0x65,0x6E,0x76,0x2E,0x74,0x65,0x6D,0x70,0x73);
    const pA = (): void => {
      const t = nx();
      if (!isNaN(Number(t))) { em(0x10); e32(parseInt(t)); }
      else if (t === K6) em(0x20, 0x02);
      else if (t === K7) em(0x20, 0x03);
      else if (t === K8) em(0x20, 0x01);
      else if (t === K3) { nx(); pE(); nx(); em(0x52); }
      else if (t === '(') { pE(); nx(); }
      else if (vt.has(t)) { em(0x61); e32(vt.get(t)!); }
    };
    const pF = (): void => { pA(); while (tp < tk.length && ['+','-','^'].includes(pk())) { const o = nx(); pA(); em(o === '+' ? 0x50 : o === '-' ? 0x51 : 0x55); } };
    const pT = (): void => { pF(); while (tp < tk.length && ['<','>','=='].includes(pk())) { const o = nx(); pF(); em(o === '<' ? 0x32 : o === '>' ? 0x31 : 0x30); } };
    const pE = (): void => { pT(); while (tp < tk.length && [K4,K5].includes(pk())) { const o = nx(); pT(); em(o === K4 ? 0x33 : 0x34); } };
    const pS = (): void => {
      const t = pk();
      if (t === K0) { nx(); const n = nx(); nx(); pE(); if (!vt.has(n)) vt.set(n, mp++); em(0x60); e32(vt.get(n)!); }
      else if (t === K1) { nx(); nx(); pE(); nx(); nx(); nx(); em(0x71); const ji = bc.length; e32(0); while (pk() !== ')') pS(); nx(); pj(ji, bc.length); }
      else if (t === K2) { nx(); nx(); pE(); nx(); em(0x40); }
      else pE();
    };
    while (tp < tk.length) pS();
    em(0x00);
    return new Uint8Array(bc);
  };

  // SECURITY: CSPRNG-based random int with rejection sampling (no modulo bias)
  const csprngInt = (max: number): number => {
    const limit = Math.floor(0x100000000 / max) * max;
    let val: number;
    do {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      val = buf[0];
    } while (val >= limit);
    return val % max;
  };

  // AES-256-GCM wrapping for metadata (v7)
  const deriveWrappingKey = async (nonce: Uint8Array): Promise<CryptoKey> => {
    const keyMaterial = await crypto.subtle.importKey('raw', nonce, 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: _e.encode('sivara-sbp-wrap-v7'), iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  };

  const wrapMetadata = async (data: Uint8Array, nonce: Uint8Array): Promise<Uint8Array> => {
    const key = await deriveWrappingKey(nonce);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, data);
    // Format: [12 bytes iv] [encrypted data with tag]
    const result = new Uint8Array(12 + encrypted.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encrypted), 12);
    return result;
  };

  const unwrapMetadata = async (wrapped: Uint8Array, nonce: Uint8Array): Promise<Uint8Array> => {
    const key = await deriveWrappingKey(nonce);
    const iv = wrapped.slice(0, 12);
    const data = wrapped.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, data);
    return new Uint8Array(decrypted);
  };

  // HMAC-SHA256 for file integrity (v7)
  const computeHMAC = async (data: Uint8Array, nonce: Uint8Array): Promise<Uint8Array> => {
    const keyData = await crypto.subtle.digest('SHA-256', nonce);
    const hmacKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', hmacKey, data);
    return new Uint8Array(sig);
  };

  const verifyHMAC = async (data: Uint8Array, expectedHmac: Uint8Array, nonce: Uint8Array): Promise<boolean> => {
    const keyData = await crypto.subtle.digest('SHA-256', nonce);
    const hmacKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    return crypto.subtle.verify('HMAC', hmacKey, expectedHmac, data);
  };

  // ─── V8 OWNER-BOUND SECURITY (fixes CRIT-03 + HIGH-02) ───
  // Wrapping key now derived from nonce + ownerSecret → file alone is insufficient
  const deriveWrappingKeyV8 = async (nonce: Uint8Array, ownerSecret: string): Promise<CryptoKey> => {
    const ownerBytes = _e.encode(ownerSecret);
    const combined = new Uint8Array(nonce.length + ownerBytes.length);
    combined.set(nonce); combined.set(ownerBytes, nonce.length);
    const keyMaterial = await crypto.subtle.importKey('raw', combined, 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: _e.encode('sivara-sbp-wrap-v8'), iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  };

  const wrapMetadataV8 = async (data: Uint8Array, nonce: Uint8Array, ownerSecret: string): Promise<Uint8Array> => {
    const key = await deriveWrappingKeyV8(nonce, ownerSecret);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, data);
    const result = new Uint8Array(12 + encrypted.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encrypted), 12);
    return result;
  };

  const unwrapMetadataV8 = async (wrapped: Uint8Array, nonce: Uint8Array, ownerSecret: string): Promise<Uint8Array> => {
    const key = await deriveWrappingKeyV8(nonce, ownerSecret);
    const iv = wrapped.slice(0, 12);
    const data = wrapped.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, data);
    return new Uint8Array(decrypted);
  };

  // HMAC with owner-bound key — can't be forged without ownerSecret
  const computeHMACv8 = async (data: Uint8Array, nonce: Uint8Array, ownerSecret: string): Promise<Uint8Array> => {
    const ownerBytes = _e.encode(ownerSecret);
    const combined = new Uint8Array(nonce.length + ownerBytes.length);
    combined.set(nonce); combined.set(ownerBytes, nonce.length);
    const keyData = await crypto.subtle.digest('SHA-256', combined);
    const hmacKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', hmacKey, data);
    return new Uint8Array(sig);
  };

  const verifyHMACv8 = async (data: Uint8Array, expectedHmac: Uint8Array, nonce: Uint8Array, ownerSecret: string): Promise<boolean> => {
    const ownerBytes = _e.encode(ownerSecret);
    const combined = new Uint8Array(nonce.length + ownerBytes.length);
    combined.set(nonce); combined.set(ownerBytes, nonce.length);
    const keyData = await crypto.subtle.digest('SHA-256', combined);
    const hmacKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    return crypto.subtle.verify('HMAC', hmacKey, expectedHmac, data);
  };

  // SHA-256 hash of owner ID for verification block (0xA2)
  const ownerHash = async (ownerId: string): Promise<Uint8Array> => {
    const hash = await crypto.subtle.digest('SHA-256', _e.encode(ownerId));
    return new Uint8Array(hash);
  };

  // SECURITY: Safe metadata merge — whitelist keys to prevent prototype pollution
  const safeMeta = (out: any, jsonStr: string): void => {
    const ALLOWED = ['auto_key', 'icon', 'color', 'salt', 'v', 'security', 'owner_id'];
    try {
      const p = JSON.parse(jsonStr);
      if (p && typeof p === 'object' && !Array.isArray(p)) {
        for (const k of ALLOWED) if (k in p) out[k] = p[k];
      }
    } catch (_) {}
  };

  return Object.freeze({ $, _e, _d, b64, d64, i32, u32, xF, xR, sx, gB, vm, cc, csprngInt, wrapMetadata, unwrapMetadata, computeHMAC, verifyHMAC, wrapMetadataV8, unwrapMetadataV8, computeHMACv8, verifyHMACv8, ownerHash, safeMeta });
})();

export const sivaraVM = Object.freeze({
  /**
   * Compile a document payload into a .sivara binary (SBP v7.0)
   * 
   * v7/v8 security:
   * - CSPRNG for key generation (crypto.getRandomValues instead of Math.random)
   * - Separate IVs for title and content
   * - Metadata protected by AES-256-GCM with PBKDF2-derived wrapping key
   * - HMAC-SHA256 integrity check
   * - VM execution limits for bytecode
   * - v8: Owner-bound wrapping key + HMAC (auto_key NOT embedded in file)
   */
  async compile(payload: any): Promise<Blob> {
    const { encrypted_title: eT, encrypted_content: eC, title_iv: tIv, content_iv: cIv, icon: ic, color: cl, salt: sl, security: sec, embedded_key: eK, user_secret: uS } = payload;
    const isOwnerBound = !!eK && !sl; // auto-key mode (not password-protected)
    const isPasswordProtected = !!sl; // password-protected mode

    // SECURITY: Use CSPRNG instead of Math.random for key generation
    const dk1 = _RT.csprngInt(0x7FFFFFFF);
    const dk2 = _RT.csprngInt(0x7FFFFFFF);
    const mKey = dk1 ^ dk2;
    const vmKeyGen = _RT.cc(`${dk1} ^ ${dk2}`);

    // SECURITY (v8): auto_key is NOT stored in metadata for owner-bound files
    const metaObj: any = { icon: ic, color: cl, salt: sl, v: 7.0, security: sec || {} };
    if (!isOwnerBound) {
      // Password-protected files still embed the key (it's derived from password anyway)
      metaObj.auto_key = eK;
    }
    const mB = _RT._e.encode(JSON.stringify(metaObj));
    const titleIvB = _RT.d64(tIv);
    const contentIvB = _RT.d64(cIv);
    const tB = _RT._e.encode(eT);
    const cB = _RT._e.encode(eC);
    const pts: Uint8Array[] = [new Uint8Array([0x53,0x56,0x52,0x07])]; // SBP v7.0 Magic

    // KEY_GEN Block (0xEE) — VM bytecode to compute mKey
    pts.push(new Uint8Array([0xEE]), _RT.u32(vmKeyGen.length ^ 0x12345678), vmKeyGen);

    // Geofence VM block (optional)
    if (sec?.geofence) {
      const { lat, lng, radius_km } = sec.geofence;
      const tL = Math.round(lat * 1e4), tN = Math.round(lng * 1e4), dR = Math.round((radius_km / 111) * 1e4);
      const T = _RT.$;
      const src = [T(0x73,0x6F,0x69,0x74),' cible_lat = ',String(tL),' ',T(0x73,0x6F,0x69,0x74),' cible_lng = ',String(tN),' ',T(0x73,0x6F,0x69,0x74),' rayon = ',String(dR),' ',T(0x73,0x6F,0x69,0x74),' diff_lat = ',T(0x61,0x62,0x73),' ( ',T(0x65,0x6E,0x76,0x2E,0x67,0x65,0x6F,0x2E,0x6C,0x61,0x74),' - cible_lat ) ',T(0x73,0x6F,0x69,0x74),' diff_lng = ',T(0x61,0x62,0x73),' ( ',T(0x65,0x6E,0x76,0x2E,0x67,0x65,0x6F,0x2E,0x6C,0x6E,0x67),' - cible_lng ) ',T(0x65,0x78,0x69,0x67,0x65,0x72),' ( diff_lat < rayon ',T(0x45,0x54),' diff_lng < rayon )'].join('');
      const vmBc = _RT.cc(src);
      pts.push(new Uint8Array([0xE5]), _RT.u32(vmBc.length ^ mKey), vmBc);
    }
    
    // Chaff/ghost blocks (anti-analysis padding, NOT security)
    if (Math.random() > 0.5) pts.push(..._RT.gB());
    
    // Title IV block (0xB2)
    pts.push(new Uint8Array([0xB2]), new Uint8Array([titleIvB.length ^ (mKey & 0xFF)]), titleIvB);
    pts.push(..._RT.gB());

    // Content IV block (0xB3) — NEW in v7: separate IV for content
    pts.push(new Uint8Array([0xB3]), new Uint8Array([contentIvB.length ^ (mKey & 0xFF)]), contentIvB);

    // Wrapping nonce for metadata protection (0xA1) — NEW in v7
    const wrappingNonce = crypto.getRandomValues(new Uint8Array(16));
    pts.push(new Uint8Array([0xA1]), wrappingNonce);

    // SECURITY (v8): Owner hash block (0xA2) — 32 bytes SHA-256(ownerSecret)
    // Allows decompiler to verify the owner without exposing the secret
    if (isOwnerBound) {
      const oh = await _RT.ownerHash(eK);
      pts.push(new Uint8Array([0xA2]), oh);
    }

    // SECURITY: Salt block (0xA3) — store salt outside encrypted metadata for password files
    // This allows the decompiler to prompt for password BEFORE unwrapping metadata
    if (isPasswordProtected && sl) {
      const saltBytes = _RT._e.encode(sl);
      pts.push(new Uint8Array([0xA3]), _RT.u32(saltBytes.length), saltBytes);
    }

    // SECURITY: Metadata encrypted with AES-256-GCM
    // v8 (owner-bound): wrapping key derived from nonce + ownerSecret — auto_key NOT in metadata
    // v7 (password): wrapping key derived from nonce only — auto_key null in metadata
    const wrappedMetadata = isOwnerBound
      ? await _RT.wrapMetadataV8(mB, wrappingNonce, eK)
      : (isPasswordProtected && uS)
        ? await _RT.wrapMetadataV8(mB, wrappingNonce, uS)
        : await _RT.wrapMetadata(mB, wrappingNonce);
    pts.push(new Uint8Array([0xD5]), _RT.u32(wrappedMetadata.length ^ mKey), wrappedMetadata);
    
    if (Math.random() > 0.3) pts.push(..._RT.gB());
    
    // Payload: title + content (already AES-256-GCM encrypted by EncryptionService)
    const dP = new Uint8Array(tB.length + 1 + cB.length);
    dP.set(tB, 0); dP[tB.length] = 0x00; dP.set(cB, tB.length + 1);
    const sP = _RT.xF(dP, 0xBB);
    pts.push(new Uint8Array([0xC3]), _RT.u32(sP.length ^ mKey), sP);
    
    pts.push(..._RT.gB());

    // Compute HMAC before adding the HMAC block and EOF marker
    const preHmacTotal = pts.reduce((a, p) => a + p.length, 0);
    const preHmacBuf = new Uint8Array(preHmacTotal);
    let preOff = 0;
    for (const p of pts) { preHmacBuf.set(p, preOff); preOff += p.length; }
    
    // SECURITY: HMAC-SHA256 integrity check (0xFA)
    // v8: owner-bound HMAC (can't be forged without ownerSecret)
    // v7: nonce-only HMAC (backward compat for password files)
    const hmac = isOwnerBound
      ? await _RT.computeHMACv8(preHmacBuf, wrappingNonce, eK)
      : (isPasswordProtected && uS)
        ? await _RT.computeHMACv8(preHmacBuf, wrappingNonce, uS)
        : await _RT.computeHMAC(preHmacBuf, wrappingNonce);
    pts.push(new Uint8Array([0xFA]), hmac);

    pts.push(new Uint8Array([0xFF]));
    
    const total = pts.reduce((a, p) => a + p.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const p of pts) { out.set(p, off); off += p.length; }
    return new Blob([out], { type: _RT.$(0x61,0x70,0x70,0x6C,0x69,0x63,0x61,0x74,0x69,0x6F,0x6E,0x2F,0x78,0x2D,0x73,0x69,0x76,0x61,0x72,0x61,0x2D,0x62,0x69,0x6E,0x61,0x72,0x79) });
  },

  async decompile(file: File, ownerSecret?: string): Promise<any> {
    let fp: string | null = null;
    try { const a = await FingerprintJS.load(); fp = (await a.get()).visitorId; } catch (_) {}
    const buf = await file.arrayBuffer();
    const b = new Uint8Array(buf);
    const v = new DataView(buf);
    
    if (b[0] !== 0x53 || b[1] !== 0x56 || b[2] !== 0x52) throw new Error(_RT.$(0x53,0x42,0x50,0x20,0x69,0x6E,0x76,0x61,0x6C,0x69,0x64,0x65));
    
    const version = b[3];
    
    // Route to version-specific parser
    if (version === 0x07) {
      return this._decompileV7(b, v, fp, ownerSecret);
    }
    // Default: v6 (legacy) parser
    return this._decompileV6(b, v, fp);
  },

  // ─── v6 LEGACY DECOMPILER (backward compatibility) ───
  async _decompileV6(b: Uint8Array, v: DataView, fp: string | null): Promise<any> {
    let c = 4;
    const out: any = { header: _RT.$(83,73,86,65,82,65,95,83,69,67,85,82,69,95,68,79,67,95,86,50) };
    const vx: Uint8Array[] = [];
    let dKey = 0;

    while (c < b.length) {
      const op = b[c++];
      if (op === 0xFF) break;
      if (op === 0x1F) { c += 4 + v.getUint32(c); continue; }
      if (op === 0xEE) { 
        const l = v.getUint32(c) ^ 0x12345678; 
        c += 4; 
        const script = b.slice(c, c + l);
        dKey = _RT.vm(script, {lat: 0, lng: 0}); 
        c += l; 
        continue; 
      }
      if (op === 0xE5) { const l = v.getUint32(c) ^ dKey; c += 4; vx.push(b.slice(c, c + l)); c += l; continue; }
      if (op === 0xB2) { const l = b[c++] ^ (dKey & 0xFF); out.iv = _RT.b64(b.slice(c, c + l)); c += l; continue; }
      if (op === 0xD4) { 
        const l = v.getUint32(c) ^ dKey; c += 4; 
        try { 
          const dec2 = _RT.sx(b.slice(c, c + l), dKey);
          const dec1 = _RT.xR(dec2, 0xAA);
          _RT.safeMeta(out, _RT._d.decode(dec1)); 
        } catch (_) {} 
        c += l; 
        continue; 
      }
      if (op === 0xC3) {
        const l = v.getUint32(c) ^ dKey; c += 4;
        const cl = _RT.xR(b.slice(c, c + l), 0xBB);
        let s = -1;
        for (let i = 0; i < cl.length; i++) { if (cl[i] === 0x00) { s = i; break; } }
        if (s !== -1) { out.encrypted_title = _RT._d.decode(cl.slice(0, s)); out.encrypted_content = _RT._d.decode(cl.slice(s + 1)); }
        c += l; continue;
      }
      try { const n = v.getUint32(c); c += 4 + (dKey ? n ^ dKey : n); } catch (_) { break; }
    }

    // v6: title_iv and content_iv are the same (legacy behavior)
    out.title_iv = out.iv;
    out.content_iv = out.iv;

    // Security enforcement (same as before)
    if (out.security?.allowed_fingerprints?.length > 0) {
      if (!fp || !out.security.allowed_fingerprints.includes(fp)) throw new Error(_RT.$(0x41,0x70,0x70,0x61,0x72,0x65,0x69,0x6C,0x20,0x72,0x65,0x66,0x75,0x73,0xE9));
    }
    
    if (out.security?.allowed_emails?.length > 0) {
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email?.toLowerCase();
      if (!email || !out.security.allowed_emails.includes(email)) throw new Error(_RT.$(0x43,0x6F,0x6D,0x70,0x74,0x65,0x20,0x72,0x65,0x66,0x75,0x73,0xE9));
    }
    
    if (vx.length > 0) {
      let geo = { lat: 0, lng: 0 };
      try {
        const { data, error } = await supabase.functions.invoke(_RT.$(0x73,0x69,0x76,0x61,0x72,0x61,0x2D,0x6B,0x65,0x72,0x6E,0x65,0x6C), { body: { action: _RT.$(0x6C,0x6F,0x63,0x61,0x74,0x65,0x5F,0x6D,0x65) } });
        if (!error && data?.lat) geo = { lat: data.lat, lng: data.lng };
      } catch (_) {}
      for (const bc of vx) _RT.vm(bc, geo);
    }
    
    return out;
  },

  // ─── v7 DECOMPILER ───
  async _decompileV7(b: Uint8Array, v: DataView, fp: string | null, ownerSecret?: string): Promise<any> {
    let c = 4;
    const out: any = { header: 'SIVARA_SECURE_DOC_V7' };
    const vx: Uint8Array[] = [];
    let dKey = 0;
    let wrappingNonce: Uint8Array | null = null;
    let hmacOffset = -1;
    let storedOwnerHash: Uint8Array | null = null;
    let isOwnerBound = false;
    let isPasswordProtected = false;
    let storedSalt: string | null = null;

    // First pass: parse all blocks
    while (c < b.length) {
      const op = b[c++];
      if (op === 0xFF) break;
      
      if (op === 0x1F) { const gl = v.getUint32(c); c += 4; if (c + gl > b.length) throw new Error('SIVARA_CORRUPT: ghost block overflow'); c += gl; continue; }
      
      if (op === 0xEE) {
        const l = v.getUint32(c) ^ 0x12345678;
        c += 4;
        if (l < 0 || c + l > b.length) throw new Error('SIVARA_CORRUPT: keygen block overflow');
        const script = b.slice(c, c + l);
        dKey = _RT.vm(script, { lat: 0, lng: 0 });
        c += l;
        continue;
      }
      
      if (op === 0xE5) { const l = v.getUint32(c) ^ dKey; c += 4; if (l < 0 || c + l > b.length) throw new Error('SIVARA_CORRUPT: vm block overflow'); vx.push(b.slice(c, c + l)); c += l; continue; }
      
      // Title IV (0xB2)
      if (op === 0xB2) {
        const l = b[c++] ^ (dKey & 0xFF);
        out.title_iv = _RT.b64(b.slice(c, c + l));
        out.iv = out.title_iv; // backward compat
        c += l;
        continue;
      }
      
      // Content IV (0xB3) — NEW in v7
      if (op === 0xB3) {
        const l = b[c++] ^ (dKey & 0xFF);
        out.content_iv = _RT.b64(b.slice(c, c + l));
        c += l;
        continue;
      }
      
      // Wrapping nonce (0xA1) — NEW in v7 (always 16 bytes)
      if (op === 0xA1) {
        if (c + 16 > b.length) throw new Error('SIVARA_CORRUPT: nonce block overflow');
        wrappingNonce = b.slice(c, c + 16);
        c += 16;
        continue;
      }

      // Owner hash block (0xA2) — v8 security (always 32 bytes SHA-256)
      if (op === 0xA2) {
        if (c + 32 > b.length) throw new Error('SIVARA_CORRUPT: owner hash block overflow');
        storedOwnerHash = b.slice(c, c + 32);
        isOwnerBound = true;
        c += 32;
        continue;
      }

      // Salt block (0xA3) — password-protected files (salt stored outside metadata)
      if (op === 0xA3) {
        const l = v.getUint32(c); c += 4;
        if (l < 0 || c + l > b.length) throw new Error('SIVARA_CORRUPT: salt block overflow');
        storedSalt = _RT._d.decode(b.slice(c, c + l));
        isPasswordProtected = true;
        c += l;
        continue;
      }
      
      // AES-GCM encrypted metadata (0xD5) — NEW in v7
      if (op === 0xD5) {
        const l = v.getUint32(c) ^ dKey;
        c += 4;
        if (l < 0 || c + l > b.length) throw new Error('SIVARA_CORRUPT: metadata block overflow');
        if (wrappingNonce) {
          try {
            let decrypted: Uint8Array;
            if (isOwnerBound && ownerSecret) {
              // v8: owner-bound wrapping key
              decrypted = await _RT.unwrapMetadataV8(b.slice(c, c + l), wrappingNonce, ownerSecret);
            } else if (isPasswordProtected && ownerSecret) {
              // Password-protected file with password provided (new format)
              decrypted = await _RT.unwrapMetadataV8(b.slice(c, c + l), wrappingNonce, ownerSecret);
            } else if (isPasswordProtected && !ownerSecret) {
              // Password-protected without password — try legacy nonce-only (backward compat)
              try {
                decrypted = await _RT.unwrapMetadata(b.slice(c, c + l), wrappingNonce);
              } catch (_) {
                throw new Error('SIVARA_PASSWORD_REQUIRED: Ce fichier nécessite un mot de passe.');
              }
            } else if (!isOwnerBound && !isPasswordProtected) {
              // Legacy nonce-only wrapping key
              decrypted = await _RT.unwrapMetadata(b.slice(c, c + l), wrappingNonce);
            } else {
              // Owner-bound file but no ownerSecret provided
              throw new Error('SIVARA_AUTH_REQUIRED: Ce fichier nécessite une authentification.');
            }
            _RT.safeMeta(out, _RT._d.decode(decrypted));
          } catch (e: any) {
            if (e.message?.startsWith('SIVARA_AUTH_REQUIRED')) throw e;
            if (e.message?.startsWith('SIVARA_PASSWORD_REQUIRED')) throw e;
            console.error('Metadata decryption failed:', e);
          }
        }
        c += l;
        continue;
      }
      
      // Legacy v6 metadata (0xD4) — should not appear in v7 but handle gracefully
      if (op === 0xD4) {
        const l = v.getUint32(c) ^ dKey; c += 4;
        try {
          const dec2 = _RT.sx(b.slice(c, c + l), dKey);
          const dec1 = _RT.xR(dec2, 0xAA);
          _RT.safeMeta(out, _RT._d.decode(dec1));
        } catch (_) {}
        c += l;
        continue;
      }
      
      // Payload (0xC3)
      if (op === 0xC3) {
        const l = v.getUint32(c) ^ dKey; c += 4;
        if (l < 0 || c + l > b.length) throw new Error('SIVARA_CORRUPT: payload block overflow');
        const cl = _RT.xR(b.slice(c, c + l), 0xBB);
        let s = -1;
        for (let i = 0; i < cl.length; i++) { if (cl[i] === 0x00) { s = i; break; } }
        if (s !== -1) {
          out.encrypted_title = _RT._d.decode(cl.slice(0, s));
          out.encrypted_content = _RT._d.decode(cl.slice(s + 1));
        }
        c += l;
        continue;
      }
      
      // HMAC block (0xFA) — NEW in v7
      if (op === 0xFA) {
        hmacOffset = c - 1; // position of 0xFA opcode
        const expectedHmac = b.slice(c, c + 32);
        // Verify HMAC over everything BEFORE the HMAC block
        if (wrappingNonce) {
          const dataToVerify = b.slice(0, hmacOffset);
          let valid: boolean;
          if (isOwnerBound && ownerSecret) {
            // v8: owner-bound HMAC verification
            valid = await _RT.verifyHMACv8(dataToVerify, expectedHmac, wrappingNonce, ownerSecret);
          } else if (isPasswordProtected && ownerSecret) {
            // Password-protected HMAC verification (new format)
            valid = await _RT.verifyHMACv8(dataToVerify, expectedHmac, wrappingNonce, ownerSecret);
          } else if (isPasswordProtected && !ownerSecret) {
            // Try legacy nonce-only HMAC (backward compat for old password files)
            try { valid = await _RT.verifyHMAC(dataToVerify, expectedHmac, wrappingNonce); } catch (_) { valid = false; }
          } else if (!isOwnerBound) {
            // Legacy nonce-only HMAC verification
            valid = await _RT.verifyHMAC(dataToVerify, expectedHmac, wrappingNonce);
          } else {
            throw new Error('SIVARA_AUTH_REQUIRED: Ce fichier nécessite une authentification.');
          }
          if (!valid) {
            throw new Error('SIVARA_INTEGRITY_VIOLATION: Le fichier a été modifié ou corrompu.');
          }
        }
        c += 32;
        continue;
      }
      
      // Unknown opcode: skip polymorphically
      try { const n = v.getUint32(c); const skip = dKey ? n ^ dKey : n; c += 4; if (skip < 0 || c + skip > b.length) break; c += skip; } catch (_) { break; }
    }

    // If content_iv not found, fall back to title_iv (shouldn't happen in v7 but safety)
    if (!out.content_iv) out.content_iv = out.title_iv;

    // SECURITY (v8): For owner-bound files, verify owner hash and set auto_key from ownerSecret
    if (isOwnerBound) {
      if (!ownerSecret) {
        out.requires_auth = true;
        return out;
      }
      // SECURITY: Constant-time hash comparison — prevents timing attacks (CRIT-01 fix)
      const computedHash = await _RT.ownerHash(ownerSecret);
      if (storedOwnerHash) {
        let diff = 0;
        for (let i = 0; i < 32; i++) {
          diff |= computedHash[i] ^ storedOwnerHash[i];
        }
        if (diff !== 0) {
          throw new Error('SIVARA_OWNER_MISMATCH: Identité du propriétaire invalide.');
        }
      }
      // auto_key is the ownerSecret itself (not stored in the file)
      out.auto_key = ownerSecret;
    }

    // SECURITY: For password-protected files with new format (0xA3 salt block)
    if (isPasswordProtected && storedSalt) {
      out.salt = storedSalt;
      if (!ownerSecret) {
        out.requires_password = true;
        return out;
      }
    }

    // Security enforcement
    if (out.security?.allowed_fingerprints?.length > 0) {
      if (!fp || !out.security.allowed_fingerprints.includes(fp)) throw new Error(_RT.$(0x41,0x70,0x70,0x61,0x72,0x65,0x69,0x6C,0x20,0x72,0x65,0x66,0x75,0x73,0xE9));
    }
    
    if (out.security?.allowed_emails?.length > 0) {
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email?.toLowerCase();
      if (!email || !out.security.allowed_emails.includes(email)) throw new Error(_RT.$(0x43,0x6F,0x6D,0x70,0x74,0x65,0x20,0x72,0x65,0x66,0x75,0x73,0xE9));
    }
    
    if (vx.length > 0) {
      let geo = { lat: 0, lng: 0 };
      try {
        const { data, error } = await supabase.functions.invoke(_RT.$(0x73,0x69,0x76,0x61,0x72,0x61,0x2D,0x6B,0x65,0x72,0x6E,0x65,0x6C), { body: { action: _RT.$(0x6C,0x6F,0x63,0x61,0x74,0x65,0x5F,0x6D,0x65) } });
        if (!error && data?.lat) geo = { lat: data.lat, lng: data.lng };
      } catch (_) {}
      for (const bc of vx) _RT.vm(bc, geo);
    }
    
    return out;
  }
});