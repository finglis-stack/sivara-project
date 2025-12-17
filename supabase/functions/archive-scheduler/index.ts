// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- SIVARA BINARY PROTOCOL (SBP) CONSTANTS ---
const OP_CODES = {
  MAGIC: 0x53, // 'S'
  HEADER: 0xA1,
  IV_BLOCK: 0xB2,
  DATA_CHUNK: 0xC3,
  META_TAG: 0xD4,
  GHOST_BLOCK: 0x1F,
  EOF: 0xFF
};

// Utils pour la construction binaire
const strToBuf = (str: string) => new TextEncoder().encode(str);

const sivaraShuffle = (buffer: Uint8Array, seed: number): Uint8Array => {
  const result = new Uint8Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    const key = (seed + i) & 0xFF; 
    result[i] = ((buffer[i] << 2) | (buffer[i] >> 6)) ^ key;
  }
  return result;
};

const generateGhostBlock = (): Uint8Array[] => {
  const size = Math.floor(Math.random() * 64) + 16; // Plus petit pour l'archivage de masse
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

    // 1. Trouver les documents "Hot" inactifs
    // Critère : > 5 minutes sans update
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: docsToArchive, error: fetchError } = await supabase
      .from('documents')
      .select('id, title, content, encryption_iv, owner_id, icon, color')
      .is('storage_path', null)
      .neq('content', '') 
      .lt('updated_at', fiveMinutesAgo)
      .limit(20); // Batch prudent

    if (fetchError) throw fetchError;

    console.log(`[Archiver] ${docsToArchive?.length || 0} documents à compiler en .sivara`);

    const results = [];

    for (const doc of docsToArchive || []) {
        if (!doc.content) continue;

        // --- COMPILATION SBP (Sivara Binary Protocol) ---
        // On encapsule les données DÉJÀ CHIFFRÉES de la DB.
        // Le serveur ne déchiffre rien. Il package.
        
        const parts: Uint8Array[] = [];
        
        // 1. Magic Header (SVR2)
        parts.push(new Uint8Array([0x53, 0x56, 0x52, 0x02])); 

        // 2. IV Block (Vital pour déchiffrer plus tard)
        // L'IV est stocké en base64 dans la DB, on le convertit en binaire
        const ivBinString = atob(doc.encryption_iv);
        const ivBuf = new Uint8Array(ivBinString.length);
        for (let i = 0; i < ivBinString.length; i++) ivBuf[i] = ivBinString.charCodeAt(i);
        
        parts.push(new Uint8Array([OP_CODES.IV_BLOCK]));
        parts.push(new Uint8Array([ivBuf.length]));
        parts.push(ivBuf);

        // 3. Metadata (Icon, Color, Owner) - Obfusqué
        const metaJson = JSON.stringify({ 
            owner_id: doc.owner_id, 
            icon: doc.icon, 
            color: doc.color,
            archived_at: new Date().toISOString()
        });
        const metaBuf = strToBuf(metaJson);
        const shuffledMeta = sivaraShuffle(metaBuf, 0xAA);
        const metaLen = new Uint8Array(4);
        new DataView(metaLen.buffer).setUint32(0, shuffledMeta.length);
        
        parts.push(new Uint8Array([OP_CODES.META_TAG]));
        parts.push(metaLen);
        parts.push(shuffledMeta);

        // 4. Ghost Block (Noise)
        parts.push(...generateGhostBlock());

        // 5. Payload (Title + Content) - Déjà chiffrés en AES-GCM par le client
        // On les concatène avec un séparateur NULL
        const titleBuf = strToBuf(doc.title);
        const contentBuf = strToBuf(doc.content);
        
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

        // 6. EOF
        parts.push(new Uint8Array([OP_CODES.EOF]));

        // Assemblage final
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
        // On garde le titre chiffré pour l'affichage rapide dans la liste
        // On vide le contenu lourd
        const { error: updateError } = await supabase
            .from('documents')
            .update({ 
                content: '', 
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