// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- SIVARA BINARY PROTOCOL (SBP) CONSTANTS ---
// Doit être IDENTIQUE à sivara-kernel
const OP_CODES = {
  MAGIC: 0x53, // 'S'
  HEADER: 0xA1,
  IV_BLOCK: 0xB2,
  DATA_CHUNK: 0xC3,
  META_TAG: 0xD4,
  GHOST_BLOCK: 0x1F,
  VM_BYTECODE: 0xE5, // Le bloc VM
  EOF: 0xFF
};

// Bytecode pour "exiger(1)" (Toujours vrai / Accès autorisé)
// PUSH_NUM(1) -> 0x01, 0x00, 0x00, 0x00, 0x01
// ASSERT      -> 0x99
// HALT        -> 0x00
const DEFAULT_ALLOW_BYTECODE = new Uint8Array([0x01, 0x00, 0x00, 0x00, 0x01, 0x99, 0x00]);

// Clé universelle pour les archives publiques
const PUBLIC_CONTAINER_SEED = "SIVARA_PUBLIC_CONTAINER_V1";

// Utils pour la construction binaire
const strToBuf = (str: string) => new TextEncoder().encode(str);

// Fonction de mélange (Shuffling)
const sivaraShuffle = (buffer: Uint8Array, seedString: string): Uint8Array => {
  let seed = 0;
  for (let i = 0; i < seedString.length; i++) {
    seed = ((seed << 5) - seed) + seedString.charCodeAt(i);
    seed |= 0;
  }

  const result = new Uint8Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    const key = (seed + i) & 0xFF; 
    result[i] = ((buffer[i] << 2) | (buffer[i] >> 6)) ^ key;
  }
  return result;
};

const generateGhostBlock = (): Uint8Array[] => {
  const size = Math.floor(Math.random() * 64) + 16;
  const noise = crypto.getRandomValues(new Uint8Array(size));
  const lenBuffer = new Uint8Array(4);
  new DataView(lenBuffer.buffer).setUint32(0, size);
  return [new Uint8Array([OP_CODES.GHOST_BLOCK]), lenBuffer, noise];
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Trouver les documents "Hot" inactifs (> 5 min)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: docsToArchive, error: fetchError } = await supabase
      .from('documents')
      .select('id, title, content, encryption_iv, owner_id, icon, color, visibility')
      .is('storage_path', null)
      .neq('content', '') 
      .lt('updated_at', fiveMinutesAgo)
      .limit(20);

    if (fetchError) throw fetchError;

    console.log(`[Archiver] ${docsToArchive?.length || 0} documents à compiler en .sivara`);

    const results = [];

    for (const doc of docsToArchive || []) {
        if (!doc.content) continue;

        // DÉTERMINATION DE LA CLÉ DU CONTENEUR
        const containerSeed = doc.visibility === 'public' ? PUBLIC_CONTAINER_SEED : doc.owner_id;

        const parts: Uint8Array[] = [];
        
        // 1. Magic Header (SVR2)
        parts.push(new Uint8Array([0x53, 0x56, 0x52, 0x02])); 

        // 2. VM Bytecode (Smart Contract par défaut)
        // C'est ici qu'on assure la compatibilité avec le Kernel
        const bcLen = new Uint8Array(4);
        new DataView(bcLen.buffer).setUint32(0, DEFAULT_ALLOW_BYTECODE.length);
        parts.push(new Uint8Array([OP_CODES.VM_BYTECODE]));
        parts.push(bcLen);
        parts.push(DEFAULT_ALLOW_BYTECODE);

        // 3. IV Block
        const ivBinString = atob(doc.encryption_iv);
        const ivBuf = new Uint8Array(ivBinString.length);
        for (let i = 0; i < ivBinString.length; i++) ivBuf[i] = ivBinString.charCodeAt(i);
        
        parts.push(new Uint8Array([OP_CODES.IV_BLOCK]));
        parts.push(new Uint8Array([ivBuf.length]));
        parts.push(ivBuf);

        // 4. Metadata
        const metaJson = JSON.stringify({ 
            owner_id: doc.owner_id, 
            icon: doc.icon, 
            color: doc.color,
            visibility: doc.visibility,
            archived_at: new Date().toISOString(),
            type: 'auto-archive'
        });
        const metaBuf = strToBuf(metaJson);
        // On ne shuffle pas les métadonnées ici pour que le Kernel puisse lire l'owner_id facilement
        const metaLen = new Uint8Array(4);
        new DataView(metaLen.buffer).setUint32(0, metaBuf.length);
        
        parts.push(new Uint8Array([OP_CODES.META_TAG]));
        parts.push(metaLen);
        parts.push(metaBuf);

        // 5. Ghost Block (Obfuscation)
        parts.push(...generateGhostBlock());

        // 6. Payload (Title + Content)
        const titleBuf = strToBuf(doc.title);
        const contentBuf = strToBuf(doc.content);
        
        const combinedPayload = new Uint8Array(titleBuf.length + 1 + contentBuf.length);
        combinedPayload.set(titleBuf, 0);
        combinedPayload[titleBuf.length] = 0x00; // Separator
        combinedPayload.set(contentBuf, titleBuf.length + 1);

        const shuffledPayload = sivaraShuffle(combinedPayload, containerSeed);
        const payloadLen = new Uint8Array(4);
        new DataView(payloadLen.buffer).setUint32(0, shuffledPayload.length);

        parts.push(new Uint8Array([OP_CODES.DATA_CHUNK]));
        parts.push(payloadLen);
        parts.push(shuffledPayload);

        // 7. EOF
        parts.push(new Uint8Array([OP_CODES.EOF]));

        // Assemblage
        const totalLength = parts.reduce((acc, p) => acc + p.length, 0);
        const finalBuffer = new Uint8Array(totalLength);
        let offset = 0;
        for (const part of parts) { finalBuffer.set(part, offset); offset += part.length; }

        // Upload
        const filePath = `${doc.owner_id}/${doc.id}.sivara`;
        const { error: uploadError } = await supabase.storage
            .from('doc-archives')
            .upload(filePath, finalBuffer, {
                contentType: 'application/x-sivara-binary',
                upsert: true
            });

        if (uploadError) {
            console.error(`Erreur upload ${doc.id}:`, uploadError);
            continue;
        }

        // Update DB (Passage en Cold Storage)
        // IMPORTANT: On garde le titre pour le dashboard
        const { error: updateError } = await supabase
            .from('documents')
            .update({ 
                content: '', // On vide le contenu
                storage_path: filePath 
            })
            .eq('id', doc.id);

        if (!updateError) {
            results.push(doc.id);
        }
    }

    return new Response(JSON.stringify({ archived: results.length, ids: results }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})