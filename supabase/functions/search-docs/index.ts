// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- LOGIQUE DE CHIFFREMENT (Miroir de src/lib/encryption.ts) ---
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 256;

class ServerEncryption {
  private masterKey: CryptoKey | null = null;

  async initialize(secret: string) {
    const encoder = new TextEncoder();
    // Le sel doit être EXACTEMENT le même que côté client
    const saltString = `${secret.toLowerCase().trim()}:sivara-docs-persistent-key-v2`;
    const salt = encoder.encode(saltString);
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    this.masterKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-512'
      },
      keyMaterial,
      { name: 'AES-GCM', length: KEY_LENGTH },
      false,
      ['decrypt']
    );
  }

  async decrypt(encryptedBase64: string, ivBase64: string): Promise<string | null> {
    if (!this.masterKey) return null;
    try {
      const encryptedData = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
      const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));

      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv, tagLength: 128 },
        this.masterKey,
        encryptedData
      );

      return new TextDecoder().decode(decryptedData);
    } catch (e) {
      return null; // Échec déchiffrement silencieux
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 1. Vérifier l'utilisateur
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return new Response(JSON.stringify({ results: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { query } = await req.json();
    if (!query || query.length < 2) {
        return new Response(JSON.stringify({ results: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Initialiser le service de crypto avec l'ID utilisateur (comme le client)
    const cryptoService = new ServerEncryption();
    await cryptoService.initialize(user.id);

    // 3. Récupérer TOUS les documents de l'utilisateur (Headers seulement pour perf)
    // Note: On ne peut pas filtrer en SQL car c'est chiffré.
    const { data: docs, error: dbError } = await supabase
        .from('documents')
        .select('id, title, content, encryption_iv, updated_at, type')
        .eq('owner_id', user.id)
        .order('updated_at', { ascending: false });

    if (dbError) throw dbError;

    // 4. Déchiffrer et Filtrer en mémoire (Edge)
    const results = [];
    const searchTerms = query.toLowerCase().split(' ');

    for (const doc of docs || []) {
        const decryptedTitle = await cryptoService.decrypt(doc.title, doc.encryption_iv);
        
        // Si le titre déchiffré match, on l'ajoute direct
        if (decryptedTitle && searchTerms.every((term: string) => decryptedTitle.toLowerCase().includes(term))) {
            results.push({
                id: doc.id,
                title: decryptedTitle,
                snippet: "Document trouvé par titre",
                type: doc.type,
                updated_at: doc.updated_at
            });
            continue;
        }

        // Sinon, on tente le contenu (plus coûteux, on peut limiter la taille ou le nombre)
        // Pour l'instant on le fait si c'est un fichier
        if (doc.type === 'file' && doc.content) {
             const decryptedContent = await cryptoService.decrypt(doc.content, doc.encryption_iv);
             if (decryptedContent && searchTerms.every((term: string) => decryptedContent.toLowerCase().includes(term))) {
                 // Créer un snippet autour du mot trouvé
                 const index = decryptedContent.toLowerCase().indexOf(searchTerms[0]);
                 const start = Math.max(0, index - 30);
                 const end = Math.min(decryptedContent.length, index + 100);
                 const snippet = "..." + decryptedContent.substring(start, end) + "...";
                 
                 results.push({
                    id: doc.id,
                    title: decryptedTitle || "Document sans titre",
                    snippet: snippet,
                    type: doc.type,
                    updated_at: doc.updated_at
                });
             }
        }
    }

    return new Response(JSON.stringify({ results: results.slice(0, 5) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("Search Docs Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})