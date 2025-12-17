// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- SIVARA BINARY PROTOCOL (SBP) ---
const OP_CODES = {
  MAGIC: 0x53, HEADER: 0xA1, IV_BLOCK: 0xB2, DATA_CHUNK: 0xC3,
  META_TAG: 0xD4, GHOST_BLOCK: 0x1F, VM_BYTECODE: 0xE5, EOF: 0xFF
};

// --- VM INSTRUCTIONS ---
const VM = {
  PUSH_NUM: 0x01, PUSH_STR: 0x02, 
  EQ: 0x30, OR: 0x35, 
  ENV_GET: 0x50, ASSERT: 0x99
};

const ENV_EMAIL = 3; // ID pour env.utilisateur.email

// Clé universelle pour les archives publiques
const PUBLIC_CONTAINER_SEED = "SIVARA_PUBLIC_CONTAINER_V1";

const strToBuf = (str: string) => new TextEncoder().encode(str);

// Hachage DJB2 pour les strings (identique au Kernel)
const hashString = (str: string): number => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash) + str.charCodeAt(i);
  return hash >>> 0;
};

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

// Générateur de Bytecode ACL (Access Control List)
const generateACLBytecode = (allowedEmails: string[]): Uint8Array => {
    const bytecode: number[] = [];
    
    // Init: PUSH 0 (False) - État initial "Accès Refusé"
    bytecode.push(VM.PUSH_NUM, 0, 0, 0, 0); 

    for (const email of allowedEmails) {
        // 1. Récupérer Email Courant
        bytecode.push(VM.ENV_GET, 0, 0, 0, ENV_EMAIL);
        
        // 2. PUSH Hash Email Autorisé
        const hash = hashString(email.toLowerCase().trim());
        bytecode.push(VM.PUSH_STR, (hash >> 24) & 0xFF, (hash >> 16) & 0xFF, (hash >> 8) & 0xFF, hash & 0xFF);
        
        // 3. Comparer (EQ)
        bytecode.push(VM.EQ);
        
        // 4. OU Logique (Si c'est bon, on passe à 1)
        bytecode.push(VM.OR);
    }

    // Final: ASSERT (Si 0 -> Kernel Panic)
    bytecode.push(VM.ASSERT);
    
    return new Uint8Array(bytecode);
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

    // 1. TIMING : 3 Minutes
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();

    const { data: docsToArchive, error: fetchError } = await supabase
      .from('documents')
      .select('id, title, content, encryption_iv, owner_id, icon, color, visibility')
      .eq('type', 'file') // FICHIERS SEULEMENT
      .is('storage_path', null)
      .neq('content', '') 
      .lt('updated_at', threeMinutesAgo)
      .limit(15); // Batch size raisonnable

    if (fetchError) throw fetchError;

    console.log(`[Archiver] ${docsToArchive?.length || 0} fichiers inactifs (>3min) à traiter.`);

    const results = [];

    for (const doc of docsToArchive || []) {
        if (!doc.content) continue;

        // --- LOGIQUE DE SÉCURITÉ (SMART CONTRACT) ---
        let vmBytecode: Uint8Array;
        let containerSeed = doc.owner_id;

        if (doc.visibility === 'public') {
            // Public : Tout le monde passe, Seed publique
            containerSeed = PUBLIC_CONTAINER_SEED;
            // Bytecode: PUSH 1, ASSERT (Toujours vrai)
            vmBytecode = new Uint8Array([VM.PUSH_NUM, 0, 0, 0, 1, VM.ASSERT]);
        } else {
            // Privé / Limité : Liste blanche stricte
            const allowedEmails: string[] = [];
            
            // A. Récupérer l'email du propriétaire
            // Note: On utilise profiles car auth.users n'est pas toujours accessible facilement en join
            const { data: ownerProfile } = await supabase.from('profiles').select('email').eq('id', doc.owner_id).single();
            if (ownerProfile?.email) allowedEmails.push(ownerProfile.email);

            // B. Récupérer les invités (si limité)
            if (doc.visibility === 'limited') {
                const { data: accessList } = await supabase.from('document_access').select('email').eq('document_id', doc.id);
                if (accessList) accessList.forEach((a: any) => allowedEmails.push(a.email));
            }

            // Génération du contrat
            vmBytecode = generateACLBytecode(allowedEmails);
            console.log(`[Archiver] ACL générée pour ${doc.id} : ${allowedEmails.length} emails autorisés.`);
        }

        // --- CONSTRUCTION SBP ---
        const parts: Uint8Array[] = [];
        
        // Header
        parts.push(new Uint8Array([0x53, 0x56, 0x52, 0x02])); 

        // VM Block (Le contrat de sécurité)
        const bcLen = new Uint8Array(4);
        new DataView(bcLen.buffer).setUint32(0, vmBytecode.length);
        parts.push(new Uint8Array([OP_CODES.VM_BYTECODE]));
        parts.push(bcLen);
        parts.push(vmBytecode);

        // IV Block
        const ivBinString = atob(doc.encryption_iv);
        const ivBuf = new Uint8Array(ivBinString.length);
        for (let i = 0; i < ivBinString.length; i++) ivBuf[i] = ivBinString.charCodeAt(i);
        parts.push(new Uint8Array([OP_CODES.IV_BLOCK]));
        parts.push(new Uint8Array([ivBuf.length]));
        parts.push(ivBuf);

        // Metadata
        const metaJson = JSON.stringify({ 
            owner_id: doc.owner_id, 
            icon: doc.icon, 
            color: doc.color,
            visibility: doc.visibility,
            archived_at: new Date().toISOString(),
            type: 'auto-archive'
        });
        const metaBuf = strToBuf(metaJson);
        const metaLen = new Uint8Array(4);
        new DataView(metaLen.buffer).setUint32(0, metaBuf.length);
        parts.push(new Uint8Array([OP_CODES.META_TAG]));
        parts.push(metaLen);
        parts.push(metaBuf);

        // Ghost Block
        parts.push(...generateGhostBlock());

        // Payload
        const titleBuf = strToBuf(doc.title);
        const contentBuf = strToBuf(doc.content);
        const combinedPayload = new Uint8Array(titleBuf.length + 1 + contentBuf.length);
        combinedPayload.set(titleBuf, 0);
        combinedPayload[titleBuf.length] = 0x00;
        combinedPayload.set(contentBuf, titleBuf.length + 1);

        const shuffledPayload = sivaraShuffle(combinedPayload, containerSeed);
        const payloadLen = new Uint8Array(4);
        new DataView(payloadLen.buffer).setUint32(0, shuffledPayload.length);
        parts.push(new Uint8Array([OP_CODES.DATA_CHUNK]));
        parts.push(payloadLen);
        parts.push(shuffledPayload);

        // EOF
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

        // Update DB (Cold Storage)
        const { error: updateError } = await supabase
            .from('documents')
            .update({ 
                content: '', // Contenu vidé
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