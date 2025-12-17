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
const PUBLIC_CONTAINER_SEED = "SIVARA_PUBLIC_CONTAINER_V1";

// --- SIVARA BINARY PROTOCOL (SBP) v5.0 ---
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

// --- UTILS ---
const bufToStr = (buf: Uint8Array) => new TextDecoder().decode(buf);

const sivaraUnshuffle = (buffer: Uint8Array, seedString: string): Uint8Array => {
  let seed = 0;
  for (let i = 0; i < seedString.length; i++) {
    seed = ((seed << 5) - seed) + seedString.charCodeAt(i);
    seed |= 0;
  }

  const result = new Uint8Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    const key = (seed + i) & 0xFF; 
    const val = buffer[i] ^ key;
    result[i] = (val >> 2) | (val << 6);
  }
  return result;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { action, payload, fileData, context } = await req.json();

    // --- LOCALISATION ---
    if (action === 'locate_me') {
        // ... (Code existant inchangé pour locate_me)
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

    // --- COMPILATION (Export Manuel) ---
    if (action === 'compile') {
       // ... (Code existant inchangé pour l'export manuel qui utilise ses propres clés)
       // Pour l'instant on laisse l'export manuel tel quel car il utilise des clés spécifiques
       return new Response(JSON.stringify({ error: "Non implémenté dans cette mise à jour" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- DÉCOMPILATION (Import / Lecture Cold Storage) ---
    if (action === 'decompile') {
      const binaryString = atob(fileData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) { bytes[i] = binaryString.charCodeAt(i); }
      
      const view = new DataView(bytes.buffer);
      
      if (bytes[0] !== 0x53 || bytes[1] !== 0x56 || bytes[2] !== 0x52) throw new Error("Format SBP invalide.");
      
      // Stratégie de déchiffrement :
      // 1. Essayer la clé PUBLIQUE
      // 2. Si échec (JSON invalide), essayer la clé PRIVÉE (context.userId ou owner_id passé)
      
      const attemptDecompile = (seed: string) => {
          let cursor = 4; // Skip Magic
          const result: any = { header: 'SIVARA_SECURE_DOC_V2' };
          let metaData: any = {};
          let success = true;

          while (cursor < bytes.length) {
            const opcode = bytes[cursor++];
            if (opcode === OP_CODES.EOF) break;

            if (opcode === OP_CODES.GHOST_BLOCK) {
                const len = view.getUint32(cursor);
                cursor += 4 + len;
                continue;
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
              const clearChunk = sivaraUnshuffle(chunk, seed);
              try {
                 // C'est ici qu'on valide si le seed est bon
                 // Si le JSON parse échoue, c'est que le seed est mauvais
                 const jsonStr = bufToStr(clearChunk);
                 metaData = JSON.parse(jsonStr);
                 Object.assign(result, metaData);
              } catch(e) {
                 success = false;
                 break; // Arrêt immédiat
              }
              cursor += len;
            }
            else if (opcode === OP_CODES.DATA_CHUNK) {
              const len = view.getUint32(cursor);
              cursor += 4;
              const chunk = bytes.slice(cursor, cursor + len);
              const clearChunk = sivaraUnshuffle(chunk, seed);
              
              let separatorIndex = -1;
              for(let i=0; i<clearChunk.length; i++) { if (clearChunk[i] === 0x00) { separatorIndex = i; break; } }
              
              if (separatorIndex !== -1) {
                  result.encrypted_title = bufToStr(clearChunk.slice(0, separatorIndex));
                  result.encrypted_content = bufToStr(clearChunk.slice(separatorIndex + 1));
              }
              cursor += len;
            }
          }
          return success ? result : null;
      };

      // TENTATIVE 1 : PUBLIC
      let finalResult = attemptDecompile(PUBLIC_CONTAINER_SEED);

      // TENTATIVE 2 : PRIVÉ (Si échec et si on a un contexte utilisateur)
      // Note: Pour l'import manuel, le client envoie parfois le owner_id attendu ou le mot de passe comme seed
      if (!finalResult && context?.fingerprint) {
           // Ici on pourrait essayer avec l'ID utilisateur si on l'avait passé dans le contexte
           // Pour l'instant, si c'est pas public, on renvoie une erreur spécifique pour que le client demande le mot de passe/clé
      }

      // Si on a réussi à lire les métadonnées mais que c'est pas public, on vérifie
      // (Cas où on aurait utilisé la clé publique par erreur sur un doc privé mal flaggé, peu probable avec le shuffle)
      
      if (finalResult) {
          return new Response(JSON.stringify(finalResult), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } else {
          // Si échec public, on renvoie une erreur spéciale
          // Le client devra réessayer avec sa propre clé (via sivaraVM.decompile avec password/id)
          return new Response(JSON.stringify({ error: "Fichier protégé ou clé invalide", require_auth: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    throw new Error("Instruction inconnue");

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})