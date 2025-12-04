// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- SIVARA INSTRUCTION SET ARCHITECTURE (S-ISA) ---
const OP_CODES = {
  MAGIC: 0x53, // 'S'
  HEADER: 0xA1,
  IV_BLOCK: 0xB2,
  DATA_CHUNK: 0xC3,
  META_TAG: 0xD4,
  EOF: 0xFF
};

// Fonction de brouillage binaire (Obfuscation propriétaire, pas de la crypto)
// Cela rend le fichier "tordu" à lire sans connaître l'algo
const sivaraShuffle = (buffer: Uint8Array, seed: number): Uint8Array => {
  const result = new Uint8Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    // Rotation de bits + XOR dynamique basé sur la position
    result[i] = ((buffer[i] << 2) | (buffer[i] >> 6)) ^ (seed + i % 255);
  }
  return result;
};

const sivaraUnshuffle = (buffer: Uint8Array, seed: number): Uint8Array => {
  const result = new Uint8Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    const val = buffer[i] ^ (seed + i % 255);
    // Rotation inverse
    result[i] = (val >> 2) | (val << 6);
  }
  return result;
};

// Encodeur de texte vers buffer
const strToBuf = (str: string) => new TextEncoder().encode(str);
const bufToStr = (buf: Uint8Array) => new TextDecoder().decode(buf);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { action, payload, fileData } = await req.json();

    // --- MODE COMPILATION (EXPORT) ---
    // JSON Chiffré -> Fichier Binaire .sivara
    if (action === 'compile') {
      const { encrypted_title, encrypted_content, iv, owner_id, icon, color, salt } = payload;
      
      // On prépare les blocs de données
      const metaJson = JSON.stringify({ owner_id, icon, color, salt, v: 2 });
      
      const ivBuf = new Uint8Array(atob(iv).split('').map(c => c.charCodeAt(0))); // Base64 -> Bytes (IV est brut)
      const metaBuf = strToBuf(metaJson);
      const titleBuf = strToBuf(encrypted_title); // C'est déjà du Base64 chiffré, mais on le traite comme string
      const contentBuf = strToBuf(encrypted_content);

      // Calcul de la taille totale
      // Header(4) + IV(1+Len+Bytes) + Meta(1+Len+Bytes) + Title(1+Len+Bytes) + Content(1+Len+Bytes) + EOF(1)
      // Format TLV (Type-Length-Value) propriétaire
      
      const parts = [];
      
      // 1. MAGIC HEADER "SVR1"
      parts.push(new Uint8Array([0x53, 0x56, 0x52, 0x01]));

      // 2. IV BLOCK (Non brouillé pour compatibilité crypto rapide)
      parts.push(new Uint8Array([OP_CODES.IV_BLOCK]));
      parts.push(new Uint8Array([ivBuf.length])); // IV length (usually 12)
      parts.push(ivBuf);

      // 3. META BLOCK (Brouillé)
      const shuffledMeta = sivaraShuffle(metaBuf, 0xAA);
      // Length sur 4 bytes (Big Endian) car meta peut être grand
      const metaLen = new Uint8Array(4);
      new DataView(metaLen.buffer).setUint32(0, shuffledMeta.length);
      
      parts.push(new Uint8Array([OP_CODES.META_TAG]));
      parts.push(metaLen);
      parts.push(shuffledMeta);

      // 4. DATA CHUNKS (Titre + Contenu fusionnés et brouillés)
      // On crée un "payload interne" qui contient Titre et Content séparés par un délimiteur nul
      const combinedPayload = new Uint8Array(titleBuf.length + 1 + contentBuf.length);
      combinedPayload.set(titleBuf, 0);
      combinedPayload[titleBuf.length] = 0x00; // Separator
      combinedPayload.set(contentBuf, titleBuf.length + 1);
      
      const shuffledPayload = sivaraShuffle(combinedPayload, 0xBB);
      
      const payloadLen = new Uint8Array(4);
      new DataView(payloadLen.buffer).setUint32(0, shuffledPayload.length);

      parts.push(new Uint8Array([OP_CODES.DATA_CHUNK]));
      parts.push(payloadLen);
      parts.push(shuffledPayload);

      // 5. EOF
      parts.push(new Uint8Array([OP_CODES.EOF]));

      // Assemblage final
      const totalLength = parts.reduce((acc, p) => acc + p.length, 0);
      const finalBuffer = new Uint8Array(totalLength);
      let offset = 0;
      for (const part of parts) {
        finalBuffer.set(part, offset);
        offset += part.length;
      }

      // Retour en Base64 pour le transport HTTP vers le client (qui en fera un Blob)
      // Note: On utilise btoa sur le buffer binaire
      let binary = '';
      const len = finalBuffer.byteLength;
      for (let i = 0; i < len; i++) { binary += String.fromCharCode(finalBuffer[i]); }
      const base64Output = btoa(binary);

      return new Response(JSON.stringify({ file: base64Output }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- MODE DÉCOMPILATION (IMPORT) ---
    // Fichier Binaire .sivara -> JSON Chiffré
    if (action === 'decompile') {
      // fileData arrive en Base64 depuis le client
      const binaryString = atob(fileData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) { bytes[i] = binaryString.charCodeAt(i); }
      
      const view = new DataView(bytes.buffer);
      let cursor = 0;

      // Check Magic
      if (bytes[0] !== 0x53 || bytes[1] !== 0x56 || bytes[2] !== 0x52) {
        throw new Error("Format de fichier invalide ou corrompu.");
      }
      cursor += 4; // Skip Magic + Version

      const result: any = { header: 'SIVARA_SECURE_DOC_V2' }; // On force le V2 pour compatibilité UI

      while (cursor < bytes.length) {
        const opcode = bytes[cursor++];

        if (opcode === OP_CODES.EOF) break;

        if (opcode === OP_CODES.IV_BLOCK) {
          const len = bytes[cursor++];
          const ivBytes = bytes.slice(cursor, cursor + len);
          // Convertir Bytes -> Base64 String pour l'objet JS
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
          const metaStr = bufToStr(clearChunk);
          const meta = JSON.parse(metaStr);
          Object.assign(result, meta);
          cursor += len;
        }
        else if (opcode === OP_CODES.DATA_CHUNK) {
          const len = view.getUint32(cursor);
          cursor += 4;
          const chunk = bytes.slice(cursor, cursor + len);
          const clearChunk = sivaraUnshuffle(chunk, 0xBB);
          
          // Séparation Titre / Contenu
          let separatorIndex = -1;
          for(let i=0; i<clearChunk.length; i++) {
             if (clearChunk[i] === 0x00) { separatorIndex = i; break; }
          }
          
          const titleBytes = clearChunk.slice(0, separatorIndex);
          const contentBytes = clearChunk.slice(separatorIndex + 1);
          
          result.encrypted_title = bufToStr(titleBytes);
          result.encrypted_content = bufToStr(contentBytes);
          
          cursor += len;
        }
      }

      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    throw new Error("Instruction inconnue");

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})