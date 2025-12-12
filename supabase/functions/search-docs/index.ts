// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
// @ts-ignore: Deno types
import DoubleMetaphone from 'https://esm.sh/natural@6.10.4/lib/natural/phonetics/double_metaphone.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- MOTEUR LINGUISTIQUE ---
class TitaniumTokenizer {
  static normalize(text: string): string {
    if (!text) return "";
    return text.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Enlève les accents (é -> e)
      .replace(/[^a-z0-9\s]/g, " ") // Enlève la ponctuation
      .replace(/\s+/g, " ").trim();
  }

  static getPhoneticFingerprint(word: string): string {
    try {
        const code = DoubleMetaphone.process(word);
        return code ? code[0] : ''; 
    } catch (e) { return ''; }
  }
}

// --- LOGIQUE DE CHIFFREMENT ---
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 256;

class ServerEncryption {
  private masterKey: CryptoKey | null = null;

  async initialize(secret: string) {
    const encoder = new TextEncoder();
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
      return null;
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        console.log("Auth failed or no user");
        return new Response(JSON.stringify({ results: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { query } = await req.json();
    if (!query || query.length < 2) {
        return new Response(JSON.stringify({ results: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 1. Préparation de la requête
    const normQuery = TitaniumTokenizer.normalize(query);
    const queryTokens = normQuery.split(' ').filter(w => w.length > 0);
    
    // Si la requête est vide après nettoyage, on arrête
    if (queryTokens.length === 0) {
        return new Response(JSON.stringify({ results: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const queryPhonetics = queryTokens.map(w => TitaniumTokenizer.getPhoneticFingerprint(w));

    // 2. Initialisation Crypto
    const cryptoService = new ServerEncryption();
    await cryptoService.initialize(user.id);

    // 3. Récupération des docs
    const { data: docs, error: dbError } = await supabase
        .from('documents')
        .select('id, title, content, encryption_iv, updated_at, type')
        .eq('owner_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(100);

    if (dbError) throw dbError;

    // 4. Analyse en mémoire (Edge)
    const results = [];

    for (const doc of docs || []) {
        // --- MATCH TITRE ---
        const decryptedTitle = await cryptoService.decrypt(doc.title, doc.encryption_iv);
        
        if (decryptedTitle) {
            // Normalisation CRITIQUE : "Dictée" -> "dictee"
            const normTitle = TitaniumTokenizer.normalize(decryptedTitle);
            const titleWords = normTitle.split(' ');
            const titlePhonetics = new Set(titleWords.map(w => TitaniumTokenizer.getPhoneticFingerprint(w)));

            // Vérifie si un des tokens de la recherche matche
            // On utilise .some() pour être plus permissif (au moins un mot trouvé), ou .every() pour strict.
            // Pour l'UX, .every() est souvent mieux pour éviter le bruit, mais on va assouplir la phonétique.
            const isTitleMatch = queryTokens.every((qToken, idx) => {
                const qCode = queryPhonetics[idx];
                return normTitle.includes(qToken) || (qCode && titlePhonetics.has(qCode));
            });

            if (isTitleMatch) {
                results.push({
                    id: doc.id,
                    title: decryptedTitle,
                    snippet: "Titre correspondant",
                    type: doc.type,
                    updated_at: doc.updated_at
                });
                continue; 
            }
        }

        // --- MATCH CONTENU ---
        if (doc.type === 'file' && doc.content) {
             const decryptedContent = await cryptoService.decrypt(doc.content, doc.encryption_iv);
             if (decryptedContent) {
                 const normContent = TitaniumTokenizer.normalize(decryptedContent);
                 
                 // Recherche textuelle simple sur le contenu normalisé
                 // Ex: "dictee" dans "voici ma dictee import" -> TRUE
                 if (normContent.includes(normQuery)) {
                     const index = decryptedContent.toLowerCase().indexOf(queryTokens[0]); // Pour l'affichage snippet
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
    }

    return new Response(JSON.stringify({ results: results.slice(0, 5) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("Search Docs Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})