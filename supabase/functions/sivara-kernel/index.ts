// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// @ts-ignore
const IP_GEO_KEY = Deno.env.get('IPGEOLOCATION_API_KEY');

// --- SIVARA BINARY PROTOCOL (SBP) v4.1 ---
const OP_CODES = {
  MAGIC: 0x53, // 'S'
  HEADER: 0xA1,
  IV_BLOCK: 0xB2,
  DATA_CHUNK: 0xC3,
  META_TAG: 0xD4,
  GHOST_BLOCK: 0x1F,
  VM_EXEC: 0xE5,
  EOF: 0xFF
};

// --- VM INSTRUCTION SET (Sivara Assembly) ---
const VM_OPS = {
  PUSH_CONST: 0x10, // Pousse une valeur (4 bytes)
  GET_ENV: 0x20,    // Récupère une variable d'environnement
  
  // Comparaisons
  EQ: 0x30,         // ==
  GT: 0x31,         // >
  LT: 0x32,         // <
  
  // Logique
  AND: 0x33,        // &&
  OR: 0x34,         // ||
  
  // Mathématiques
  ADD: 0x50,        // +
  SUB: 0x51,        // -
  ABS: 0x52,        // Valeur Absolue
  
  // Sécurité
  ASSERT: 0x40,     // Panic si faux
  HALT: 0x00        // Stop
};

// IDs pour GET_ENV
const ENV_VARS = {
  TIMESTAMP: 0x01,
  GEO_LAT: 0x02, // Multiplié par 10000 pour précision Int
  GEO_LNG: 0x03, // Multiplié par 10000 pour précision Int
  USER_ID_HASH: 0x04
};

// --- UTILS ---
const sivaraShuffle = (buffer: Uint8Array, seed: number): Uint8Array => {
  const result = new Uint8Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    const key = (seed + i) & 0xFF; 
    result[i] = ((buffer[i] << 2) | (buffer[i] >> 6)) ^ key;
  }
  return result;
};

const sivaraUnshuffle = (buffer: Uint8Array, seed: number): Uint8Array => {
  const result = new Uint8Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    const key = (seed + i) & 0xFF; 
    const val = buffer[i] ^ key;
    result[i] = (val >> 2) | (val << 6);
  }
  return result;
};

const generateGhostBlock = (): Uint8Array[] => {
  const size = Math.floor(Math.random() * 1024) + 64;
  const noise = crypto.getRandomValues(new Uint8Array(size));
  const lenBuffer = new Uint8Array(4);
  new DataView(lenBuffer.buffer).setUint32(0, size); // Big Endian default
  return [new Uint8Array([OP_CODES.GHOST_BLOCK]), lenBuffer, noise];
};

// CRITIQUE: Force Big Endian pour compatibilité VM DataView.getInt32()
const int32ToBytes = (val: number): Uint8Array => {
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setInt32(0, val, false); // false = Big Endian
  return new Uint8Array(buffer);
};

const strToBuf = (str: string) => new TextEncoder().encode(str);
const bufToStr = (buf: Uint8Array) => new TextDecoder().decode(buf);

// --- VM ENGINE ---
const executeVM = (bytecode: Uint8Array, context: any) => {
  const stack: number[] = [];
  const view = new DataView(bytecode.buffer, bytecode.byteOffset, bytecode.byteLength);
  let pc = 0; // Program Counter

  console.log(`[VM] Start. Context: Lat=${context.lat}, Lng=${context.lng}`);

  while (pc < bytecode.length) {
    const op = bytecode[pc++];

    switch (op) {
      case VM_OPS.PUSH_CONST:
        const val = view.getInt32(pc, false); // Big Endian explicit
        pc += 4;
        stack.push(val);
        break;

      case VM_OPS.GET_ENV:
        const envId = bytecode[pc++];
        if (envId === ENV_VARS.TIMESTAMP) stack.push(Math.floor(Date.now() / 1000));
        else if (envId === ENV_VARS.GEO_LAT) stack.push(Math.round((context.lat || 0) * 10000));
        else if (envId === ENV_VARS.GEO_LNG) stack.push(Math.round((context.lng || 0) * 10000));
        else stack.push(0);
        break;

      // --- MATHS ---
      case VM_OPS.ADD:
        const bAdd = stack.pop()!; const aAdd = stack.pop()!;
        stack.push(aAdd + bAdd);
        break;
      case VM_OPS.SUB:
        const bSub = stack.pop()!; const aSub = stack.pop()!;
        stack.push(aSub - bSub);
        break;
      case VM_OPS.ABS:
        const aAbs = stack.pop()!;
        stack.push(Math.abs(aAbs));
        break;

      // --- COMPARAISONS ---
      case VM_OPS.EQ:
        const bEq = stack.pop(); const aEq = stack.pop();
        stack.push(aEq === bEq ? 1 : 0);
        break;
      case VM_OPS.GT:
        const bGt = stack.pop()!; const aGt = stack.pop()!;
        stack.push(aGt > bGt ? 1 : 0);
        break;
      case VM_OPS.LT:
        const bLt = stack.pop()!; const aLt = stack.pop()!;
        stack.push(aLt < bLt ? 1 : 0);
        break;

      // --- LOGIQUE ---
      case VM_OPS.AND:
        const bAnd = stack.pop(); const aAnd = stack.pop();
        stack.push((aAnd === 1 && bAnd === 1) ? 1 : 0);
        break;
      case VM_OPS.OR:
        const bOr = stack.pop(); const aOr = stack.pop();
        stack.push((aOr === 1 || bOr === 1) ? 1 : 0);
        break;

      case VM_OPS.ASSERT:
        const check = stack.pop();
        if (check !== 1) {
          console.error("[VM] ASSERT FAILED. Stack dump:", stack);
          throw new Error("SIVARA_VM_PANIC: Security Assertion Failed. Access Denied.");
        }
        break;

      case VM_OPS.HALT:
        return;

      default:
        console.warn(`[VM] Opcode inconnu: 0x${op.toString(16)}`);
    }
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { action, payload, fileData, context } = await req.json();

    // --- LOCALISATION ---
    if (action === 'locate_me') {
        const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || '0.0.0.0';
        if (!IP_GEO_KEY) throw new Error("Service de géolocalisation non configuré.");
        const geoRes = await fetch(`https://api.ipgeolocation.io/ipgeo?apiKey=${IP_GEO_KEY}&ip=${clientIp}`);
        const geoData = await geoRes.json();
        return new Response(JSON.stringify({ 
            lat: parseFloat(geoData.latitude), 
            lng: parseFloat(geoData.longitude),
            ip: clientIp,
            city: geoData.city
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- COMPILATION ---
    if (action === 'compile') {
      const { encrypted_title, encrypted_content, iv, owner_id, icon, color, salt, security } = payload;
      
      const metaJson = JSON.stringify({ owner_id, icon, color, salt, v: 4.1, security: security || {} });
      const ivBuf = new Uint8Array(atob(iv).split('').map(c => c.charCodeAt(0)));
      const metaBuf = strToBuf(metaJson);
      const titleBuf = strToBuf(encrypted_title);
      const contentBuf = strToBuf(encrypted_content);

      const parts = [];
      
      // 1. MAGIC
      parts.push(new Uint8Array([0x53, 0x56, 0x52, 0x03]));

      // 2. VM SMART CONTRACT GENERATION
      if (security && security.geofence) {
          const { lat, lng, radius_km } = security.geofence;
          
          const targetLat = Math.round(lat * 10000);
          const targetLng = Math.round(lng * 10000);
          const delta = Math.round((radius_km / 111) * 10000);

          const vmBuilder: number[] = [];
          
          // --- CHECK LATITUDE ---
          vmBuilder.push(VM_OPS.GET_ENV, ENV_VARS.GEO_LAT);
          vmBuilder.push(VM_OPS.PUSH_CONST, ...int32ToBytes(targetLat)); // FIX: Big Endian
          vmBuilder.push(VM_OPS.SUB);
          vmBuilder.push(VM_OPS.ABS);
          vmBuilder.push(VM_OPS.PUSH_CONST, ...int32ToBytes(delta)); // FIX: Big Endian
          vmBuilder.push(VM_OPS.LT); 

          // --- CHECK LONGITUDE ---
          vmBuilder.push(VM_OPS.GET_ENV, ENV_VARS.GEO_LNG);
          vmBuilder.push(VM_OPS.PUSH_CONST, ...int32ToBytes(targetLng)); // FIX: Big Endian
          vmBuilder.push(VM_OPS.SUB);
          vmBuilder.push(VM_OPS.ABS);
          vmBuilder.push(VM_OPS.PUSH_CONST, ...int32ToBytes(delta)); // FIX: Big Endian
          vmBuilder.push(VM_OPS.LT); 

          // --- COMBINAISON ---
          vmBuilder.push(VM_OPS.AND); 
          vmBuilder.push(VM_OPS.ASSERT); 
          vmBuilder.push(VM_OPS.HALT);

          const vmBytecode = new Uint8Array(vmBuilder);
          const vmLen = new Uint8Array(4);
          new DataView(vmLen.buffer).setUint32(0, vmBytecode.length); // Big Endian default

          parts.push(new Uint8Array([OP_CODES.VM_EXEC]));
          parts.push(vmLen);
          parts.push(vmBytecode);
      }

      if (Math.random() > 0.5) parts.push(...generateGhostBlock());

      // 3. IV
      parts.push(new Uint8Array([OP_CODES.IV_BLOCK]));
      parts.push(new Uint8Array([ivBuf.length]));
      parts.push(ivBuf);

      parts.push(...generateGhostBlock());

      // 4. META
      const shuffledMeta = sivaraShuffle(metaBuf, 0xAA);
      const metaLen = new Uint8Array(4);
      new DataView(metaLen.buffer).setUint32(0, shuffledMeta.length);
      parts.push(new Uint8Array([OP_CODES.META_TAG]));
      parts.push(metaLen);
      parts.push(shuffledMeta);

      if (Math.random() > 0.3) parts.push(...generateGhostBlock());

      // 5. DATA
      const combinedPayload = new Uint8Array(titleBuf.length + 1 + contentBuf.length);
      combinedPayload.set(titleBuf, 0);
      combinedPayload[titleBuf.length] = 0x00;
      combinedPayload.set(contentBuf, titleBuf.length + 1);
      
      const shuffledPayload = sivaraShuffle(combinedPayload, 0xBB);
      const payloadLen = new Uint8Array(4);
      new DataView(payloadLen.buffer).setUint32(0, shuffledPayload.length);
      parts.push(new Uint8Array([OP_CODES.DATA_CHUNK]));
      parts.push(payloadLen);
      parts.push(shuffledPayload);

      parts.push(...generateGhostBlock());
      parts.push(new Uint8Array([OP_CODES.EOF]));

      const totalLength = parts.reduce((acc, p) => acc + p.length, 0);
      const finalBuffer = new Uint8Array(totalLength);
      let offset = 0;
      for (const part of parts) { finalBuffer.set(part, offset); offset += part.length; }

      let binary = '';
      const len = finalBuffer.byteLength;
      const CHUNK_SIZE = 8192;
      for (let i = 0; i < len; i += CHUNK_SIZE) {
          const chunk = finalBuffer.subarray(i, Math.min(i + CHUNK_SIZE, len));
          binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      return new Response(JSON.stringify({ file: btoa(binary) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- DÉCOMPILATION ---
    if (action === 'decompile') {
      const binaryString = atob(fileData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) { bytes[i] = binaryString.charCodeAt(i); }
      
      const view = new DataView(bytes.buffer);
      let cursor = 0;

      if (bytes[0] !== 0x53 || bytes[1] !== 0x56 || bytes[2] !== 0x52) throw new Error("Format SBP invalide.");
      cursor += 4; 

      const result: any = { header: 'SIVARA_SECURE_DOC_V2' };
      let metaData: any = {};

      // Contexte d'exécution pour la VM
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || '0.0.0.0';
      let geoContext = { lat: 0, lng: 0 };
      
      if (IP_GEO_KEY) {
          try {
              const geoRes = await fetch(`https://api.ipgeolocation.io/ipgeo?apiKey=${IP_GEO_KEY}&ip=${clientIp}`);
              const geoData = await geoRes.json();
              if (geoData.latitude) {
                  geoContext = { lat: parseFloat(geoData.latitude), lng: parseFloat(geoData.longitude) };
              }
          } catch (e) { console.warn("Geo lookup failed", e); }
      }

      while (cursor < bytes.length) {
        const opcode = bytes[cursor++];
        if (opcode === OP_CODES.EOF) break;

        if (opcode === OP_CODES.GHOST_BLOCK) {
            const len = view.getUint32(cursor);
            cursor += 4 + len;
            continue;
        }

        // --- EXECUTION VM ---
        if (opcode === OP_CODES.VM_EXEC) {
            const len = view.getUint32(cursor);
            cursor += 4;
            const bytecode = bytes.slice(cursor, cursor + len);
            
            try {
                executeVM(bytecode, geoContext);
            } catch (e) {
                throw new Error(`SBP Security Violation: ${e.message}`);
            }
            cursor += len;
        }

        else if (opcode === OP_CODES.IV_BLOCK) {
          const len = bytes[cursor++];
          const ivBytes = bytes.slice(cursor, cursor + len);
          let ivBin = '';
          for(let i=0; i<ivBytes.length; i++) ivBin += String.fromCharCode(ivBytes[i]);
          result.iv = btoa(ivBin);
          cursor += len;
        }
        else if (opcode === OP_CODES.META_TAG) {
          const len = view.getUint32(cursor);
          cursor += 4;
          const chunk = bytes.slice(cursor, cursor + len);
          const clearChunk = sivaraUnshuffle(chunk, 0xAA);
          try {
             metaData = JSON.parse(bufToStr(clearChunk));
             Object.assign(result, metaData);
          } catch(e) {}
          cursor += len;
        }
        else if (opcode === OP_CODES.DATA_CHUNK) {
          const len = view.getUint32(cursor);
          cursor += 4;
          const chunk = bytes.slice(cursor, cursor + len);
          const clearChunk = sivaraUnshuffle(chunk, 0xBB);
          
          let separatorIndex = -1;
          for(let i=0; i<clearChunk.length; i++) { if (clearChunk[i] === 0x00) { separatorIndex = i; break; } }
          
          if (separatorIndex !== -1) {
              result.encrypted_title = bufToStr(clearChunk.slice(0, separatorIndex));
              result.encrypted_content = bufToStr(clearChunk.slice(separatorIndex + 1));
          }
          cursor += len;
        }
      }

      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    throw new Error("Instruction inconnue");

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})