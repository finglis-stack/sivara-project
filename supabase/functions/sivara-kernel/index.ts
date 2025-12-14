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

// --- SIVARA BINARY PROTOCOL (SBP) v3.1 ---
const OP_CODES = {
  MAGIC: 0x53, // 'S'
  HEADER: 0xA1,
  IV_BLOCK: 0xB2,
  DATA_CHUNK: 0xC3,
  META_TAG: 0xD4,
  GHOST_BLOCK: 0x1F, // NOUVEAU: Bloc Fantôme (Polymorphisme)
  EOF: 0xFF
};

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

// Générateur de bruit cryptographique (Leurre)
const generateGhostBlock = (): Uint8Array[] => {
  // Taille aléatoire entre 64 octets et 1KB pour varier la signature du fichier
  const size = Math.floor(Math.random() * 1024) + 64;
  const noise = crypto.getRandomValues(new Uint8Array(size));
  
  const lenBuffer = new Uint8Array(4);
  new DataView(lenBuffer.buffer).setUint32(0, size);

  return [
    new Uint8Array([OP_CODES.GHOST_BLOCK]),
    lenBuffer,
    noise
  ];
};

const strToBuf = (str: string) => new TextEncoder().encode(str);
const bufToStr = (buf: Uint8Array) => new TextDecoder().decode(buf);

const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { action, payload, fileData, context } = await req.json();

    // --- DEBUG: LOCALISATION IP ---
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

    // --- COMPILATION (AVEC POLYMORPHISME) ---
    if (action === 'compile') {
      const { encrypted_title, encrypted_content, iv, owner_id, icon, color, salt, security } = payload;
      
      const metaJson = JSON.stringify({ 
          owner_id, icon, color, salt, v: 3.1, // Version bump
          security: security || {} 
      });
      
      const ivBuf = new Uint8Array(atob(iv).split('').map(c => c.charCodeAt(0)));
      const metaBuf = strToBuf(metaJson);
      const titleBuf = strToBuf(encrypted_title);
      const contentBuf = strToBuf(encrypted_content);

      const parts = [];
      
      // MAGIC "SVR3"
      parts.push(new Uint8Array([0x53, 0x56, 0x52, 0x03]));

      // Injection aléatoire de bruit au début (1 chance sur 2)
      if (Math.random() > 0.5) parts.push(...generateGhostBlock());

      // IV
      parts.push(new Uint8Array([OP_CODES.IV_BLOCK]));
      parts.push(new Uint8Array([ivBuf.length]));
      parts.push(ivBuf);

      // Injection systématique de bruit entre IV et META pour casser la séquence
      parts.push(...generateGhostBlock());

      // META
      const shuffledMeta = sivaraShuffle(metaBuf, 0xAA);
      const metaLen = new Uint8Array(4);
      new DataView(metaLen.buffer).setUint32(0, shuffledMeta.length);
      
      parts.push(new Uint8Array([OP_CODES.META_TAG]));
      parts.push(metaLen);
      parts.push(shuffledMeta);

      // Injection aléatoire de bruit avant la DATA
      if (Math.random() > 0.3) parts.push(...generateGhostBlock());

      // DATA
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

      // Injection finale de bruit (Padding de fin)
      parts.push(...generateGhostBlock());

      // EOF
      parts.push(new Uint8Array([OP_CODES.EOF]));

      const totalLength = parts.reduce((acc, p) => acc + p.length, 0);
      const finalBuffer = new Uint8Array(totalLength);
      let offset = 0;
      for (const part of parts) {
        finalBuffer.set(part, offset);
        offset += part.length;
      }

      let binary = '';
      const len = finalBuffer.byteLength;
      const CHUNK_SIZE = 8192;
      for (let i = 0; i < len; i += CHUNK_SIZE) {
          const chunk = finalBuffer.subarray(i, Math.min(i + CHUNK_SIZE, len));
          binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64Output = btoa(binary);

      return new Response(JSON.stringify({ file: base64Output }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- DÉCOMPILATION (IGNORER LES FANTÔMES) ---
    if (action === 'decompile') {
      const binaryString = atob(fileData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) { bytes[i] = binaryString.charCodeAt(i); }
      
      const view = new DataView(bytes.buffer);
      let cursor = 0;

      if (bytes[0] !== 0x53 || bytes[1] !== 0x56 || bytes[2] !== 0x52) {
        throw new Error("Format de fichier SBP invalide ou corrompu.");
      }
      cursor += 4; 

      const result: any = { header: 'SIVARA_SECURE_DOC_V2' };
      let metaData: any = {};

      while (cursor < bytes.length) {
        const opcode = bytes[cursor++];
        if (opcode === OP_CODES.EOF) break;

        // --- GESTION DES BLOCS FANTÔMES ---
        if (opcode === OP_CODES.GHOST_BLOCK) {
            // On lit la taille et on saute par dessus
            const len = view.getUint32(cursor);
            cursor += 4 + len;
            // Le VM ignore silencieusement ce bloc
            continue;
        }

        if (opcode === OP_CODES.IV_BLOCK) {
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
          const metaStr = bufToStr(clearChunk);
          try {
             metaData = JSON.parse(metaStr);
             Object.assign(result, metaData);
          } catch(e) { console.error("Meta parse error", e); }
          cursor += len;
        }
        else if (opcode === OP_CODES.DATA_CHUNK) {
          // --- SÉCURITÉ ---
          if (metaData.security) {
              const sec = metaData.security;

              // EMAIL
              if (sec.allowed_emails && sec.allowed_emails.length > 0) {
                  const supabase = createClient(
                    // @ts-ignore
                    Deno.env.get('SUPABASE_URL') ?? '',
                    // @ts-ignore
                    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
                    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
                  );
                  const { data: { user } } = await supabase.auth.getUser();
                  
                  if (!user || !user.email || !sec.allowed_emails.includes(user.email.toLowerCase())) {
                      throw new Error("Acces refuse : Votre compte n'est pas autorise.");
                  }
              }

              // DEVICE
              if (sec.allowed_fingerprints && sec.allowed_fingerprints.length > 0) {
                  const clientFp = context?.fingerprint;
                  if (!clientFp || !sec.allowed_fingerprints.includes(clientFp)) {
                      throw new Error("Acces refuse : Cet appareil n'est pas autorise.");
                  }
              }

              // GEO
              if (sec.geofence && sec.geofence.lat && sec.geofence.lng) {
                  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || '0.0.0.0';
                  
                  if (!IP_GEO_KEY) {
                      throw new Error("Erreur serveur : Service de localisation non configure.");
                  }

                  const geoRes = await fetch(`https://api.ipgeolocation.io/ipgeo?apiKey=${IP_GEO_KEY}&ip=${clientIp}`);
                  const geoData = await geoRes.json();
                  
                  if (geoData && geoData.latitude && geoData.longitude) {
                      const dist = getDistanceKm(
                          parseFloat(geoData.latitude), parseFloat(geoData.longitude),
                          sec.geofence.lat, sec.geofence.lng
                      );
                      
                      console.log(`[GeoCheck] Distance: ${dist}km (Max: ${sec.geofence.radius_km}km)`);
                      
                      if (dist > sec.geofence.radius_km) {
                          throw new Error(`Acces refuse : Zone geographique non autorisee (Distance: ${Math.round(dist)}km).`);
                      }
                  } else {
                      throw new Error("Acces refuse : Impossible de verifier votre localisation.");
                  }
              }
          }

          const len = view.getUint32(cursor);
          cursor += 4;
          const chunk = bytes.slice(cursor, cursor + len);
          const clearChunk = sivaraUnshuffle(chunk, 0xBB);
          
          let separatorIndex = -1;
          for(let i=0; i<clearChunk.length; i++) {
             if (clearChunk[i] === 0x00) { separatorIndex = i; break; }
          }
          
          if (separatorIndex !== -1) {
              const titleBytes = clearChunk.slice(0, separatorIndex);
              const contentBytes = clearChunk.slice(separatorIndex + 1);
              result.encrypted_title = bufToStr(titleBytes);
              result.encrypted_content = bufToStr(contentBytes);
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