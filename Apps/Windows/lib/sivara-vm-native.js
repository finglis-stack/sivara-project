/**
 * Sivara VM — Native (Electron)
 * Port of sivara-vm.ts for Node.js/Electron
 * Handles .sivara binary format (SBP v6.0)
 * 
 * Differences from web version:
 * - No Supabase dependency
 * - No FingerprintJS dependency
 * - decompile() takes Uint8Array instead of File
 * - compile() returns Uint8Array instead of Blob
 * - Security checks (geofence, fingerprint, email) are DETECTED but not enforced locally
 *   → Returns metadata flags so the caller can decide what to do
 */

const _RT = (() => {
  const $ = (...c) => String.fromCharCode(...c);
  const _e = new TextEncoder();
  const _d = new TextDecoder();

  const b64 = (b) => {
    let r = '';
    for (let i = 0; i < b.length; i += 0x2000) {
      r += $.apply(null, Array.from(b.subarray(i, Math.min(i + 0x2000, b.length))));
    }
    return btoa(r);
  };

  const d64 = (s) => {
    const b = atob(s);
    const r = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) r[i] = b.charCodeAt(i);
    return r;
  };

  const i32 = (v) => {
    const b = new ArrayBuffer(4);
    new DataView(b).setInt32(0, v, false);
    return new Uint8Array(b);
  };

  const u32 = (v) => {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, v);
    return b;
  };

  const xF = (d, k) => {
    const r = new Uint8Array(d.length);
    for (let i = 0; i < d.length; i++) {
      const m = (k + i) & 0xff;
      r[i] = ((d[i] << 2) | (d[i] >>> 6)) ^ m;
    }
    return r;
  };

  const xR = (d, k) => {
    const r = new Uint8Array(d.length);
    for (let i = 0; i < d.length; i++) {
      const m = (k + i) & 0xff;
      const v = d[i] ^ m;
      r[i] = ((v >>> 2) | (v << 6)) & 0xff;
    }
    return r;
  };

  const sx = (d, k) => {
    const r = new Uint8Array(d.length);
    let s = k;
    for (let i = 0; i < d.length; i++) {
      s = (s * 1103515245 + 12345) >>> 0;
      r[i] = d[i] ^ ((s >>> 16) & 0xff);
    }
    return r;
  };

  const gB = () => {
    const sz = (Math.random() * 0x400 | 0) + 0x40;
    return [new Uint8Array([0x1f]), u32(sz), crypto.getRandomValues(new Uint8Array(sz))];
  };

  const vm = (bc, env) => {
    const s = [];
    const m = new Array(0x100).fill(0);
    const dv = new DataView(bc.buffer, bc.byteOffset, bc.byteLength);
    let p = 0;
    const r = () => { const v = dv.getInt32(p, false); p += 4; return v; };
    while (p < bc.length) {
      const o = bc[p++];
      switch (o) {
        case 0x10: s.push(r()); break;
        case 0x20: {
          const id = bc[p++];
          s.push(id === 0x01 ? Math.floor(Date.now() / 1e3) : id === 0x02 ? Math.round((env.lat || 0) * 1e4) : id === 0x03 ? Math.round((env.lng || 0) * 1e4) : 0);
          break;
        }
        case 0x60: m[r()] = s.pop(); break;
        case 0x61: s.push(m[r()]); break;
        case 0x70: p = r(); break;
        case 0x71: { const t = r(); if (s.pop() === 0) p = t; break; }
        case 0x50: s.push(s.pop() + s.pop()); break;
        case 0x51: { const b = s.pop(); s.push(s.pop() - b); break; }
        case 0x52: s.push(Math.abs(s.pop())); break;
        case 0x55: s.push(s.pop() ^ s.pop()); break;
        case 0x30: s.push(s.pop() === s.pop() ? 1 : 0); break;
        case 0x31: { const b = s.pop(); s.push(s.pop() > b ? 1 : 0); break; }
        case 0x32: { const b = s.pop(); s.push(s.pop() < b ? 1 : 0); break; }
        case 0x33: { const b = s.pop(); s.push((s.pop() === 1 && b === 1) ? 1 : 0); break; }
        case 0x34: { const b = s.pop(); s.push((s.pop() === 1 || b === 1) ? 1 : 0); break; }
        case 0x40: if (s.pop() !== 1) throw new Error($(0x53, 0x42, 0x50, 0x5f, 0x56, 0x4d, 0x5f, 0x50, 0x41, 0x4e, 0x49, 0x43)); break;
        case 0x00: return s.pop() || 0;
      }
    }
    return s.pop() || 0;
  };

  const cc = (src) => {
    const tk = src.replace(/\(/g, ' ( ').replace(/\)/g, ' ) ').replace(/=/g, ' = ').trim().split(/\s+/).filter(t => t.length > 0);
    const bc = [];
    const vt = new Map();
    let mp = 0, tp = 0;
    const em = (op, ...a) => bc.push(op, ...a);
    const e32 = (v) => i32(v).forEach(b => bc.push(b));
    const pj = (ai, ti) => { const b = i32(ti); for (let i = 0; i < 4; i++) bc[ai + i] = b[i]; };
    const pk = () => tk[tp];
    const nx = () => tk[tp++];
    const K0 = $(0x73, 0x6f, 0x69, 0x74), K1 = $(0x73, 0x69), K2 = $(0x65, 0x78, 0x69, 0x67, 0x65, 0x72);
    const K3 = $(0x61, 0x62, 0x73), K4 = $(0x45, 0x54), K5 = $(0x4f, 0x55);
    const K6 = $(0x65, 0x6e, 0x76, 0x2e, 0x67, 0x65, 0x6f, 0x2e, 0x6c, 0x61, 0x74);
    const K7 = $(0x65, 0x6e, 0x76, 0x2e, 0x67, 0x65, 0x6f, 0x2e, 0x6c, 0x6e, 0x67);
    const K8 = $(0x65, 0x6e, 0x76, 0x2e, 0x74, 0x65, 0x6d, 0x70, 0x73);
    const pA = () => {
      const t = nx();
      if (!isNaN(Number(t))) { em(0x10); e32(parseInt(t)); }
      else if (t === K6) em(0x20, 0x02);
      else if (t === K7) em(0x20, 0x03);
      else if (t === K8) em(0x20, 0x01);
      else if (t === K3) { nx(); pE(); nx(); em(0x52); }
      else if (t === '(') { pE(); nx(); }
      else if (vt.has(t)) { em(0x61); e32(vt.get(t)); }
    };
    const pF = () => { pA(); while (tp < tk.length && ['+', '-', '^'].includes(pk())) { const o = nx(); pA(); em(o === '+' ? 0x50 : o === '-' ? 0x51 : 0x55); } };
    const pT = () => { pF(); while (tp < tk.length && ['<', '>', '=='].includes(pk())) { const o = nx(); pF(); em(o === '<' ? 0x32 : o === '>' ? 0x31 : 0x30); } };
    const pE = () => { pT(); while (tp < tk.length && [K4, K5].includes(pk())) { const o = nx(); pT(); em(o === K4 ? 0x33 : 0x34); } };
    const pS = () => {
      const t = pk();
      if (t === K0) { nx(); const n = nx(); nx(); pE(); if (!vt.has(n)) vt.set(n, mp++); em(0x60); e32(vt.get(n)); }
      else if (t === K1) { nx(); nx(); pE(); nx(); nx(); nx(); em(0x71); const ji = bc.length; e32(0); while (pk() !== ')') pS(); nx(); pj(ji, bc.length); }
      else if (t === K2) { nx(); nx(); pE(); nx(); em(0x40); }
      else pE();
    };
    while (tp < tk.length) pS();
    em(0x00);
    return new Uint8Array(bc);
  };

  return Object.freeze({ $, _e, _d, b64, d64, i32, u32, xF, xR, sx, gB, vm, cc });
})();

const sivaraVM = Object.freeze({
  /**
   * Compile a document payload into a .sivara binary
   * @param {Object} payload - { encrypted_title, encrypted_content, iv, icon, color, salt, security, embedded_key }
   * @returns {Uint8Array} The compiled binary
   */
  compile(payload) {
    const { encrypted_title: eT, encrypted_content: eC, iv, icon: ic, color: cl, salt: sl, security: sec, embedded_key: eK } = payload;

    const dk1 = Math.floor(Math.random() * 0x7fffffff);
    const dk2 = Math.floor(Math.random() * 0x7fffffff);
    const mKey = dk1 ^ dk2;
    const vmKeyGen = _RT.cc(`${dk1} ^ ${dk2}`);

    const mB = _RT._e.encode(JSON.stringify({ auto_key: eK, icon: ic, color: cl, salt: sl, v: 6.0, security: sec || {} }));
    const ivB = _RT.d64(iv);
    const tB = _RT._e.encode(eT);
    const cB = _RT._e.encode(eC);
    const pts = [new Uint8Array([0x53, 0x56, 0x52, 0x06])]; // SVR magic v6

    // KEY_GEN block
    pts.push(new Uint8Array([0xee]), _RT.u32(vmKeyGen.length ^ 0x12345678), vmKeyGen);

    // Geofence VM block
    if (sec?.geofence) {
      const { lat, lng, radius_km } = sec.geofence;
      const tL = Math.round(lat * 1e4), tN = Math.round(lng * 1e4), dR = Math.round((radius_km / 111) * 1e4);
      const T = _RT.$;
      const src = [T(0x73, 0x6f, 0x69, 0x74), ' cible_lat = ', String(tL), ' ', T(0x73, 0x6f, 0x69, 0x74), ' cible_lng = ', String(tN), ' ', T(0x73, 0x6f, 0x69, 0x74), ' rayon = ', String(dR), ' ', T(0x73, 0x6f, 0x69, 0x74), ' diff_lat = ', T(0x61, 0x62, 0x73), ' ( ', T(0x65, 0x6e, 0x76, 0x2e, 0x67, 0x65, 0x6f, 0x2e, 0x6c, 0x61, 0x74), ' - cible_lat ) ', T(0x73, 0x6f, 0x69, 0x74), ' diff_lng = ', T(0x61, 0x62, 0x73), ' ( ', T(0x65, 0x6e, 0x76, 0x2e, 0x67, 0x65, 0x6f, 0x2e, 0x6c, 0x6e, 0x67), ' - cible_lng ) ', T(0x65, 0x78, 0x69, 0x67, 0x65, 0x72), ' ( diff_lat < rayon ', T(0x45, 0x54), ' diff_lng < rayon )'].join('');
      const vmBc = _RT.cc(src);
      pts.push(new Uint8Array([0xe5]), _RT.u32(vmBc.length ^ mKey), vmBc);
    }

    if (Math.random() > 0.5) pts.push(..._RT.gB());

    pts.push(new Uint8Array([0xb2]), new Uint8Array([ivB.length ^ (mKey & 0xff)]), ivB);
    pts.push(..._RT.gB());

    // Double encrypted metadata
    const sM1 = _RT.xF(mB, 0xaa);
    const sM2 = _RT.sx(sM1, mKey);
    pts.push(new Uint8Array([0xd4]), _RT.u32(sM2.length ^ mKey), sM2);

    if (Math.random() > 0.3) pts.push(..._RT.gB());

    // Payload (title + content)
    const dP = new Uint8Array(tB.length + 1 + cB.length);
    dP.set(tB, 0); dP[tB.length] = 0x00; dP.set(cB, tB.length + 1);
    const sP = _RT.xF(dP, 0xbb);
    pts.push(new Uint8Array([0xc3]), _RT.u32(sP.length ^ mKey), sP);

    pts.push(..._RT.gB(), new Uint8Array([0xff]));

    const total = pts.reduce((a, p) => a + p.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const p of pts) { out.set(p, off); off += p.length; }
    return out;
  },

  /**
   * Decompile a .sivara binary into its components
   * @param {Uint8Array} buffer - The raw file bytes
   * @returns {Object} { header, iv, encrypted_title, encrypted_content, auto_key, icon, color, salt, security, requiresInternet }
   */
  decompile(buffer) {
    const b = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);

    if (b[0] !== 0x53 || b[1] !== 0x56 || b[2] !== 0x52) {
      throw new Error('Format de fichier .sivara invalide');
    }

    let c = 4;
    const out = { header: 'SIVARA_SECURE_DOC_V2' };
    const vx = [];
    let dKey = 0;

    while (c < b.length) {
      const op = b[c++];
      if (op === 0xff) break;
      if (op === 0x1f) { c += 4 + v.getUint32(c); continue; }
      if (op === 0xee) {
        const l = v.getUint32(c) ^ 0x12345678;
        c += 4;
        const script = b.slice(c, c + l);
        dKey = _RT.vm(script, { lat: 0, lng: 0 });
        c += l;
        continue;
      }
      if (op === 0xe5) {
        const l = v.getUint32(c) ^ dKey;
        c += 4;
        vx.push(b.slice(c, c + l));
        c += l;
        continue;
      }
      if (op === 0xb2) {
        const l = b[c++] ^ (dKey & 0xff);
        out.iv = _RT.b64(b.slice(c, c + l));
        c += l;
        continue;
      }
      if (op === 0xd4) {
        const l = v.getUint32(c) ^ dKey;
        c += 4;
        try {
          const dec2 = _RT.sx(b.slice(c, c + l), dKey);
          const dec1 = _RT.xR(dec2, 0xaa);
          Object.assign(out, JSON.parse(_RT._d.decode(dec1)));
        } catch (_) {}
        c += l;
        continue;
      }
      if (op === 0xc3) {
        const l = v.getUint32(c) ^ dKey;
        c += 4;
        const cl = _RT.xR(b.slice(c, c + l), 0xbb);
        let s = -1;
        for (let i = 0; i < cl.length; i++) { if (cl[i] === 0x00) { s = i; break; } }
        if (s !== -1) {
          out.encrypted_title = _RT._d.decode(cl.slice(0, s));
          out.encrypted_content = _RT._d.decode(cl.slice(s + 1));
        }
        c += l;
        continue;
      }
      try {
        const n = v.getUint32(c);
        c += 4 + (dKey ? n ^ dKey : n);
      } catch (_) { break; }
    }

    // Detect security requirements (don't enforce, just flag)
    out.requiresInternet = false;
    out.securityFlags = [];

    if (out.security?.allowed_fingerprints?.length > 0) {
      out.requiresInternet = true;
      out.securityFlags.push('fingerprint');
    }
    if (out.security?.allowed_emails?.length > 0) {
      out.requiresInternet = true;
      out.securityFlags.push('email');
    }
    if (vx.length > 0) {
      out.requiresInternet = true;
      out.securityFlags.push('geofence');
      out._vmBlocks = vx; // Keep for online verification
    }

    return out;
  },
});

// Export
if (typeof window !== 'undefined') {
  window.sivaraVM = sivaraVM;
}
if (typeof module !== 'undefined') {
  module.exports = { sivaraVM };
}
